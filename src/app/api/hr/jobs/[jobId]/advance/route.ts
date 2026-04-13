import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { requireAuthUser, requireHr } from "@/server/auth/session";
import { createUserNotification } from "@/server/notifications/createNotification";
import { generateMcqsFromContext } from "@/server/mcq/generator";

type Stage = "ATS" | "MCQ" | "CODING" | "INTERVIEW";

const stageOrder: Stage[] = ["ATS", "MCQ", "CODING", "INTERVIEW"];

const mapCurrentStageToPipeline = (current?: string | null): Stage | "COMPLETE" => {
  const value = String(current || "").toUpperCase();
  if (value === "SCREENING") return "MCQ";
  if (value === "CODING") return "CODING";
  if (value === "INTERVIEW") return "INTERVIEW";
  if (value === "OFFER" || value === "COMPLETE") return "COMPLETE";
  return "ATS";
};

const mapPipelineToCurrentStage = (pipeline: Stage): string => {
  if (pipeline === "ATS") return "APPLIED";
  if (pipeline === "MCQ") return "SCREENING";
  if (pipeline === "CODING") return "CODING";
  return "INTERVIEW";
};

const missingPipelineStepColumn = (message?: string) =>
  (message || "").includes("Could not find the 'pipeline_step' column") ||
  (message || "").includes("column applications.pipeline_step does not exist") ||
  (message || "").includes('column "pipeline_step" does not exist');
const isMissingRoundControlsTable = (message?: string) =>
  (message || "").includes("relation \"application_round_controls\" does not exist") ||
  (message || "").includes("relation \"public.application_round_controls\" does not exist") ||
  (message || "").includes("Could not find the table 'application_round_controls'") ||
  (message || "").includes("Could not find the table 'public.application_round_controls'");
const isMissingQuestionSetsTable = (message?: string) =>
  (message || "").includes("relation \"mcq_question_sets\" does not exist") ||
  (message || "").includes("relation \"public.mcq_question_sets\" does not exist") ||
  (message || "").includes("Could not find the table 'mcq_question_sets'") ||
  (message || "").includes("Could not find the table 'public.mcq_question_sets'");
const isMissingAttemptAnswersTable = (message?: string) =>
  (message || "").includes("relation \"mcq_attempt_answers\" does not exist") ||
  (message || "").includes("relation \"public.mcq_attempt_answers\" does not exist") ||
  (message || "").includes("Could not find the table 'mcq_attempt_answers'") ||
  (message || "").includes("Could not find the table 'public.mcq_attempt_answers'");

async function resetMcqProgressForApplications(
  admin: ReturnType<typeof createSupabaseAdmin>,
  applicationIds: string[]
) {
  if (!applicationIds.length) return;
  const { data: attempts, error: attemptsError } = await admin
    .from("mcq_attempts")
    .select("id")
    .in("application_id", applicationIds);
  if (attemptsError) {
    throw new Error(`Failed to load prior MCQ attempts: ${attemptsError.message}`);
  }

  const attemptIds = (attempts || []).map((row) => String(row.id));
  if (attemptIds.length) {
    const { error: deleteAnswersError } = await admin
      .from("mcq_attempt_answers")
      .delete()
      .in("attempt_id", attemptIds);
    if (deleteAnswersError && !isMissingAttemptAnswersTable(deleteAnswersError.message)) {
      throw new Error(`Failed to reset MCQ attempt answers: ${deleteAnswersError.message}`);
    }
  }

  const { error: deleteAttemptsError } = await admin
    .from("mcq_attempts")
    .delete()
    .in("application_id", applicationIds);
  if (deleteAttemptsError) {
    throw new Error(`Failed to reset MCQ attempts: ${deleteAttemptsError.message}`);
  }

  const { error: deleteSetError } = await admin
    .from("mcq_question_sets")
    .delete()
    .in("application_id", applicationIds);
  if (deleteSetError && !isMissingQuestionSetsTable(deleteSetError.message)) {
    throw new Error(`Failed to reset MCQ question set: ${deleteSetError.message}`);
  }
}

async function ensureMcqsForJob(
  admin: ReturnType<typeof createSupabaseAdmin>,
  jobId: string
) {
  const minQuestions = 12;
  const { count } = await admin
    .from("mcq_questions")
    .select("*", { count: "exact", head: true })
    .eq("job_id", jobId);
  if ((count || 0) >= minQuestions) return;

  const toGenerate = Math.max(8, minQuestions - Number(count || 0));
  const { data: job } = await admin
    .from("jobs")
    .select("id, title, description, job_skills(skill_name)")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return;

  const skills =
    ((job.job_skills as Array<{ skill_name: string }> | null) || [])
      .map((s) => s.skill_name)
      .filter(Boolean);
  const generated = await generateMcqsFromContext({
    skills,
    jobId,
    count: toGenerate,
    requireEngine: true,
    jobTitle: String(job.title || ""),
    jobDescription: String(job.description || ""),
    difficultyHint: "challenging",
  });

  if (!generated.length) return;
  await admin.from("mcq_questions").insert(
    generated.map((q) => ({
      job_id: jobId,
      question_text: q.questionText,
      options: q.options,
      correct_option: q.correctOption,
      skill_tag: q.skillTag || null,
      difficulty: q.difficulty || "medium",
    }))
  );
}

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const user = await requireAuthUser();
    requireHr(user);
    const { jobId } = await context.params;

    const body = (await request.json()) as {
      fromStage?: Stage;
      topN?: number;
      rejectRest?: boolean;
      deadlineAt?: string;
      directives?: string;
    };
    const fromStage = (body.fromStage || "ATS").toUpperCase() as Stage;
    if (!stageOrder.includes(fromStage)) {
      return NextResponse.json({ error: "Invalid fromStage. Use ATS, MCQ, CODING, INTERVIEW." }, { status: 400 });
    }

    const fromIndex = stageOrder.indexOf(fromStage);
    if (fromIndex >= stageOrder.length - 1) {
      return NextResponse.json({ error: "INTERVIEW is the last stage. No further round to advance." }, { status: 400 });
    }

    const nextStage = stageOrder[fromIndex + 1];
    const topN = Math.max(1, Math.min(500, Number(body.topN || 10)));
    const rejectRest = Boolean(body.rejectRest);
    const directives = String(body.directives || "").trim();
    const deadlineAt =
      body.deadlineAt && !Number.isNaN(new Date(body.deadlineAt).getTime())
        ? new Date(body.deadlineAt).toISOString()
        : null;

    const admin = createSupabaseAdmin();
    let { data: apps, error: appsError } = await admin
      .from("applications")
      .select("id, job_id, user_id, applied_at, pipeline_step, current_stage")
      .eq("job_id", jobId);

    if (missingPipelineStepColumn(appsError?.message)) {
      const fallback = await admin
        .from("applications")
        .select("id, job_id, user_id, applied_at, current_stage")
        .eq("job_id", jobId);
      apps = (fallback.data || []).map((a) => ({
        ...a,
        pipeline_step: mapCurrentStageToPipeline((a as { current_stage?: string | null }).current_stage),
      })) as typeof apps;
      appsError = fallback.error;
    }

    if (appsError) {
      return NextResponse.json({ error: appsError.message }, { status: 500 });
    }

    const rows = (apps || []) as Array<{
      id: string;
      job_id: string;
      user_id: string;
      applied_at?: string | null;
      pipeline_step?: string | null;
      current_stage?: string | null;
    }>;

    const candidatesAtStage = rows.filter((r) => {
      const pipeline = String(r.pipeline_step || mapCurrentStageToPipeline(r.current_stage)).toUpperCase();
      return pipeline === fromStage;
    });

    if (!candidatesAtStage.length) {
      return NextResponse.json({
        success: true,
        message: `No candidates currently in ${fromStage}.`,
        advanced: 0,
        rejected: 0,
      });
    }

    const appIds = candidatesAtStage.map((c) => c.id);
    const { data: stageScores } = await admin
      .from("stage_results")
      .select("application_id, stage_type, score")
      .in("application_id", appIds);

    const scoreByApp = new Map<string, number>();
    for (const c of candidatesAtStage) scoreByApp.set(c.id, 0);
    for (const row of stageScores || []) {
      const stageType = String(row.stage_type || "").toUpperCase();
      if (stageType !== fromStage) continue;
      scoreByApp.set(String(row.application_id), Number(row.score || 0));
    }

    const ranked = [...candidatesAtStage].sort((a, b) => {
      const diff = (scoreByApp.get(b.id) || 0) - (scoreByApp.get(a.id) || 0);
      if (Math.abs(diff) > 0.0001) return diff;
      return new Date(a.applied_at || 0).getTime() - new Date(b.applied_at || 0).getTime();
    });

    const selected = ranked.slice(0, topN);
    const nonSelected = ranked.slice(topN);
    const selectedIds = selected.map((r) => r.id);
    const rejectedIds = rejectRest ? nonSelected.map((r) => r.id) : [];

    if (selectedIds.length) {
      const updatePayload = {
        pipeline_step: nextStage,
        current_stage: mapPipelineToCurrentStage(nextStage),
      };
      const { error: updateError } = await admin
        .from("applications")
        .update(updatePayload)
        .in("id", selectedIds);

      if (missingPipelineStepColumn(updateError?.message)) {
        const { error: fallbackError } = await admin
          .from("applications")
          .update({ current_stage: mapPipelineToCurrentStage(nextStage) })
          .in("id", selectedIds);
        if (fallbackError) {
          return NextResponse.json({ error: fallbackError.message }, { status: 500 });
        }
      } else if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      if (nextStage === "MCQ") {
        await resetMcqProgressForApplications(admin, selectedIds);
        await ensureMcqsForJob(admin, jobId);
      }

      if ((nextStage === "MCQ" || nextStage === "CODING" || nextStage === "INTERVIEW") && selectedIds.length) {
        const payload = selectedIds.map((id) => ({
          application_id: id,
          stage_type: nextStage,
          deadline_at: deadlineAt,
          directives: directives || null,
          created_by_user_id: user.id,
          updated_at: new Date().toISOString(),
        }));
        const { error: controlsError } = await admin
          .from("application_round_controls")
          .upsert(payload, { onConflict: "application_id,stage_type" });
        if (controlsError && !isMissingRoundControlsTable(controlsError.message)) {
          return NextResponse.json({ error: controlsError.message }, { status: 500 });
        }
      }

      const selectedById = new Map(selected.map((row) => [row.id, row]));
      const { data: jobMeta } = await admin.from("jobs").select("title").eq("id", jobId).maybeSingle();
      const jobTitle = String(jobMeta?.title || "your application");

      await Promise.all(
        selectedIds.map(async (id) => {
          const app = selectedById.get(id);
          if (!app?.user_id) return;
          const routeByStage: Record<string, string> = {
            MCQ: `/dashboard/applicant/applications/${id}/mcq`,
            CODING: `/dashboard/applicant/applications/${id}`,
            INTERVIEW: `/dashboard/applicant/applications/${id}`,
          };
          await createUserNotification(admin, {
            userId: app.user_id,
            applicationId: id,
            title: `Advanced to ${nextStage}`,
            message:
              nextStage === "MCQ"
                ? `You were shortlisted for the MCQ round for ${jobTitle}.${deadlineAt ? ` Deadline: ${new Date(deadlineAt).toLocaleString()}.` : ""}${directives ? ` Instructions: ${directives}` : ""}`
                : `Your application for ${jobTitle} moved to ${nextStage}.`,
            route: routeByStage[nextStage] || `/dashboard/applicant/applications/${id}`,
            type: nextStage === "MCQ" ? "mcq" : "info",
          });
        })
      );
    }

    if (rejectedIds.length) {
      const { error: rejectError } = await admin
        .from("applications")
        .update({ current_stage: "REJECTED" })
        .in("id", rejectedIds);
      if (rejectError) {
        return NextResponse.json({ error: rejectError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      fromStage,
      nextStage,
      advanced: selectedIds.length,
      rejected: rejectedIds.length,
      selectedApplicationIds: selectedIds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to advance candidates.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

