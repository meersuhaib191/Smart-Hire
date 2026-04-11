import { createSupabaseAdmin } from "@/server/supabase/admin";
import { runAtsScreeningForJob } from "@/server/ats/screening";
import { createUserNotification } from "@/server/notifications/createNotification";
import { generateMcqsFromContext } from "@/server/mcq/generator";

const SHORTLIST_PERCENT = 0.2;
const MCQ_WINDOW_HOURS = Number(process.env.SHORTLIST_MCQ_WINDOW_HOURS || 72);

const missingPipelineStepColumn = (message?: string) =>
  (message || "").includes("Could not find the 'pipeline_step' column") ||
  (message || "").includes("column applications.pipeline_step does not exist") ||
  (message || "").includes('column "pipeline_step" does not exist');

const isMissingRoundControlsTable = (message?: string) =>
  (message || "").includes("relation \"application_round_controls\" does not exist") ||
  (message || "").includes("relation \"public.application_round_controls\" does not exist") ||
  (message || "").includes("Could not find the table 'application_round_controls'") ||
  (message || "").includes("Could not find the table 'public.application_round_controls'");

type JobShortlistRow = {
  id: string;
  title: string;
  description: string;
  submission_deadline_at: string | null;
  shortlist_status: string | null;
  status: string | null;
  job_skills?: Array<{ skill_name: string }> | null;
};

type AppRow = {
  id: string;
  user_id: string;
  applied_at: string | null;
};

export type ShortlistRunResult = {
  jobId: string;
  totalApplicants: number;
  shortlisted: number;
  rejected: number;
  rankingsWritten: number;
  status: "completed" | "skipped";
  reason?: string;
};

function computeShortlistSize(total: number): number {
  if (total <= 0) return 0;
  // Strict top 20% selection as requested.
  return Math.floor(total * SHORTLIST_PERCENT);
}

function buildMcqDeadlineIso(): string {
  const ms = MCQ_WINDOW_HOURS * 60 * 60 * 1000;
  return new Date(Date.now() + ms).toISOString();
}

async function updateJobShortlistState(
  admin: ReturnType<typeof createSupabaseAdmin>,
  jobId: string,
  payload: Record<string, unknown>
) {
  const { error } = await admin.from("jobs").update(payload).eq("id", jobId);
  if (!error) return;
  if ((error.message || "").includes("column jobs.shortlist_status does not exist")) {
    throw new Error(
      "Missing jobs shortlist columns. Apply latest migration: 20260410170000_add_job_shortlist_deadline_fields.sql"
    );
  }
  throw new Error(error.message);
}

async function ensureAdvancedMcqPool(admin: ReturnType<typeof createSupabaseAdmin>, job: JobShortlistRow) {
  const minimum = 20;
  const { count } = await admin
    .from("mcq_questions")
    .select("*", { count: "exact", head: true })
    .eq("job_id", job.id);
  if ((count || 0) >= minimum) return;

  const skills =
    ((job.job_skills as Array<{ skill_name: string }> | null) || [])
      .map((s) => s.skill_name)
      .filter(Boolean);
  const generated = await generateMcqsFromContext({
    skills,
    count: Math.max(10, minimum - Number(count || 0)),
    jobTitle: String(job.title || ""),
    jobDescription: String(job.description || ""),
    difficultyHint: "challenging",
  });
  if (!generated.length) return;

  await admin.from("mcq_questions").insert(
    generated.map((q) => ({
      job_id: job.id,
      question_text: q.questionText,
      options: q.options,
      correct_option: q.correctOption,
      skill_tag: q.skillTag || null,
      difficulty: "hard",
    }))
  );
}

export async function runDeadlineShortlistForJob(
  admin: ReturnType<typeof createSupabaseAdmin>,
  jobId: string
): Promise<ShortlistRunResult> {
  const { data: jobData, error: jobError } = await admin
    .from("jobs")
    .select(
      "id, title, description, submission_deadline_at, shortlist_status, status, job_skills(skill_name)"
    )
    .eq("id", jobId)
    .maybeSingle();
  if (jobError || !jobData) throw new Error(jobError?.message || "Job not found.");
  const job = jobData as JobShortlistRow;

  if (String(job.status || "").toUpperCase() !== "PUBLISHED") {
    return { jobId, totalApplicants: 0, shortlisted: 0, rejected: 0, rankingsWritten: 0, status: "skipped", reason: "job_not_published" };
  }
  if (!job.submission_deadline_at) {
    return { jobId, totalApplicants: 0, shortlisted: 0, rejected: 0, rankingsWritten: 0, status: "skipped", reason: "no_submission_deadline" };
  }
  if (new Date(job.submission_deadline_at).getTime() > Date.now()) {
    return { jobId, totalApplicants: 0, shortlisted: 0, rejected: 0, rankingsWritten: 0, status: "skipped", reason: "deadline_not_reached" };
  }
  if (String(job.shortlist_status || "").toLowerCase() === "completed") {
    return { jobId, totalApplicants: 0, shortlisted: 0, rejected: 0, rankingsWritten: 0, status: "skipped", reason: "already_completed" };
  }

  await updateJobShortlistState(admin, job.id, {
    shortlist_status: "running",
    shortlist_error: null,
  });

  try {
    const atsResult = await runAtsScreeningForJob({
      admin,
      jobId: job.id,
      notifyApplicants: false,
      passScore: 0,
    });

    const { data: appRows, error: appsError } = await admin
      .from("applications")
      .select("id, user_id, applied_at")
      .eq("job_id", job.id);
    if (appsError) throw new Error(appsError.message);
    const applications = (appRows || []) as AppRow[];
    if (!applications.length) {
      await updateJobShortlistState(admin, job.id, {
        shortlist_status: "completed",
        shortlist_ran_at: new Date().toISOString(),
        shortlist_error: null,
        shortlist_selected_count: 0,
        shortlist_total_submissions: 0,
      });
      return {
        jobId: job.id,
        totalApplicants: 0,
        shortlisted: 0,
        rejected: 0,
        rankingsWritten: 0,
        status: "completed",
      };
    }

    const appIds = applications.map((a) => a.id);
    const { data: atsStages, error: stageError } = await admin
      .from("stage_results")
      .select("application_id, score")
      .in("application_id", appIds)
      .eq("stage_type", "ATS");
    if (stageError) throw new Error(stageError.message);

    const scoreMap = new Map<string, number>();
    for (const [appId, score] of Object.entries(atsResult.scoresByApplicationId || {})) {
      scoreMap.set(String(appId), Number(score || 0));
    }
    for (const row of atsStages || []) {
      if (!scoreMap.has(String(row.application_id))) {
        scoreMap.set(String(row.application_id), Number(row.score || 0));
      }
    }

    const ranked = [...applications].sort((a, b) => {
      const diff = (scoreMap.get(b.id) || 0) - (scoreMap.get(a.id) || 0);
      if (Math.abs(diff) > 0.0001) return diff;
      return new Date(a.applied_at || 0).getTime() - new Date(b.applied_at || 0).getTime();
    });

    const shortlistCount = computeShortlistSize(ranked.length);
    const selected = ranked.slice(0, shortlistCount);
    const rejected = ranked.slice(shortlistCount);
    const selectedIds = selected.map((r) => r.id);
    const rejectedIds = rejected.map((r) => r.id);

    if (selectedIds.length) {
      const { error: updateSelectedError } = await admin
        .from("applications")
        .update({
          pipeline_step: "MCQ",
          current_stage: "SCREENING",
        })
        .in("id", selectedIds);
      if (missingPipelineStepColumn(updateSelectedError?.message)) {
        const fallback = await admin
          .from("applications")
          .update({ current_stage: "SCREENING" })
          .in("id", selectedIds);
        if (fallback.error) throw new Error(fallback.error.message);
      } else if (updateSelectedError) {
        throw new Error(updateSelectedError.message);
      }
    }

    if (rejectedIds.length) {
      const { error: rejectErr } = await admin
        .from("applications")
        .update({
          pipeline_step: "REJECTED",
          current_stage: "REJECTED",
        })
        .in("id", rejectedIds);
      if (missingPipelineStepColumn(rejectErr?.message)) {
        const fallback = await admin
          .from("applications")
          .update({ current_stage: "REJECTED" })
          .in("id", rejectedIds);
        if (fallback.error) throw new Error(fallback.error.message);
      } else if (rejectErr) {
        throw new Error(rejectErr.message);
      }
    }

    const mcqDeadlineAt = buildMcqDeadlineIso();
    if (selectedIds.length) {
      const controls = selectedIds.map((id) => ({
        application_id: id,
        stage_type: "MCQ",
        deadline_at: mcqDeadlineAt,
        directives:
          "Advanced MCQ round: solve carefully, focus on correctness and applied reasoning. One attempt only.",
        updated_at: new Date().toISOString(),
      }));
      const { error: controlsError } = await admin
        .from("application_round_controls")
        .upsert(controls, { onConflict: "application_id,stage_type" });
      if (controlsError && !isMissingRoundControlsTable(controlsError.message)) {
        throw new Error(controlsError.message);
      }
    }

    // Persist ATS-only ranking for shortlist stage.
    if (ranked.length) {
      const rankingRows = ranked.map((row, idx) => ({
        application_id: row.id,
        job_id: job.id,
        final_score: scoreMap.get(row.id) || 0,
        rank_position: idx + 1,
        updated_at: new Date().toISOString(),
      }));
      const { error: rankingErr } = await admin.from("rankings").upsert(rankingRows, { onConflict: "application_id" });
      if (rankingErr) throw new Error(rankingErr.message);
    }

    await ensureAdvancedMcqPool(admin, job);

    await Promise.all(
      selected.map((row) =>
        createUserNotification(admin, {
          userId: row.user_id,
          applicationId: row.id,
          title: "Shortlisted for MCQ round",
          message: `You are shortlisted for the next round (${job.title}). Start your advanced MCQ test before ${new Date(
            mcqDeadlineAt
          ).toLocaleString()}.`,
          route: `/dashboard/applicant/applications/${row.id}/mcq`,
          type: "mcq",
        })
      )
    );
    await Promise.all(
      rejected.map((row) =>
        createUserNotification(admin, {
          userId: row.user_id,
          applicationId: row.id,
          title: "Application update",
          message: `Thank you for applying to ${job.title}. You were not shortlisted for the next round this cycle.`,
          route: `/dashboard/applicant/applications/${row.id}`,
          type: "info",
        })
      )
    );

    await updateJobShortlistState(admin, job.id, {
      shortlist_status: "completed",
      shortlist_ran_at: new Date().toISOString(),
      shortlist_error: null,
      shortlist_selected_count: selected.length,
      shortlist_total_submissions: ranked.length,
      status: "CLOSED",
    });

    return {
      jobId: job.id,
      totalApplicants: ranked.length,
      shortlisted: selected.length,
      rejected: rejected.length,
      rankingsWritten: ranked.length,
      status: "completed",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shortlist run failed.";
    await updateJobShortlistState(admin, job.id, {
      shortlist_status: "failed",
      shortlist_error: message.slice(0, 4000),
    });
    throw error;
  }
}
