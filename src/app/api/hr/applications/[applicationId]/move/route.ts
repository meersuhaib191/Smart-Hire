import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { requireAuthUser, requireHr } from "@/server/auth/session";
import { createUserNotification } from "@/server/notifications/createNotification";
import { generateMcqsFromContext } from "@/server/mcq/generator";

type TargetStage = "ATS" | "MCQ" | "CODING" | "INTERVIEW" | "COMPLETE" | "REJECTED";

const validStages: TargetStage[] = ["ATS", "MCQ", "CODING", "INTERVIEW", "COMPLETE", "REJECTED"];

const mapPipelineToCurrentStage = (stage: TargetStage): string => {
  if (stage === "ATS") return "APPLIED";
  if (stage === "MCQ") return "SCREENING";
  if (stage === "CODING") return "CODING";
  if (stage === "INTERVIEW") return "INTERVIEW";
  if (stage === "COMPLETE") return "OFFER";
  return "REJECTED";
};

const isMissingPipelineColumn = (message?: string) =>
  (message || "").includes("Could not find the 'pipeline_step' column") ||
  (message || "").includes("column applications.pipeline_step does not exist") ||
  (message || "").includes('column "pipeline_step" does not exist');
const isMissingRoundControlsTable = (message?: string) =>
  (message || "").includes("relation \"application_round_controls\" does not exist") ||
  (message || "").includes("relation \"public.application_round_controls\" does not exist") ||
  (message || "").includes("Could not find the table 'application_round_controls'") ||
  (message || "").includes("Could not find the table 'public.application_round_controls'");

async function ensureMcqsForJob(admin: ReturnType<typeof createSupabaseAdmin>, jobId: string) {
  const { count } = await admin
    .from("mcq_questions")
    .select("*", { count: "exact", head: true })
    .eq("job_id", jobId);
  if ((count || 0) >= 12) return;

  const { data: job } = await admin
    .from("jobs")
    .select("title, description, job_skills(skill_name)")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return;

  const skills =
    ((job.job_skills as Array<{ skill_name: string }> | null) || [])
      .map((s) => s.skill_name)
      .filter(Boolean);
  const generated = await generateMcqsFromContext({
    skills,
    count: Math.max(8, 12 - Number(count || 0)),
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

export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> }
) {
  try {
    const user = await requireAuthUser();
    requireHr(user);
    const { applicationId } = await context.params;
    const body = (await request.json()) as { targetStage?: string; deadlineAt?: string; directives?: string };
    const targetStage = String(body.targetStage || "").toUpperCase() as TargetStage;
    const directives = String(body.directives || "").trim();
    const deadlineAt =
      body.deadlineAt && !Number.isNaN(new Date(body.deadlineAt).getTime())
        ? new Date(body.deadlineAt).toISOString()
        : null;

    if (!validStages.includes(targetStage)) {
      return NextResponse.json(
        { error: "Invalid targetStage. Use ATS, MCQ, CODING, INTERVIEW, COMPLETE, or REJECTED." },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdmin();
    const { data: app, error: appError } = await admin
      .from("applications")
      .select("id, user_id, job_id")
      .eq("id", applicationId)
      .maybeSingle();

    if (appError || !app) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }

    const currentStage = mapPipelineToCurrentStage(targetStage);
    const { error: updateError } = await admin
      .from("applications")
      .update({
        pipeline_step: targetStage,
        current_stage: currentStage,
      })
      .eq("id", applicationId);

    if (isMissingPipelineColumn(updateError?.message)) {
      const { error: fallbackError } = await admin
        .from("applications")
        .update({
          current_stage: currentStage,
        })
        .eq("id", applicationId);
      if (fallbackError) {
        return NextResponse.json({ error: fallbackError.message }, { status: 500 });
      }
    } else if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (targetStage === "MCQ") {
      await ensureMcqsForJob(admin, String(app.job_id));
    }

    if (targetStage === "MCQ" || targetStage === "CODING" || targetStage === "INTERVIEW") {
      const { error: controlsError } = await admin
        .from("application_round_controls")
        .upsert(
          {
            application_id: applicationId,
            stage_type: targetStage,
            deadline_at: deadlineAt,
            directives: directives || null,
            created_by_user_id: user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "application_id,stage_type" }
        );
      if (controlsError && !isMissingRoundControlsTable(controlsError.message)) {
        return NextResponse.json({ error: controlsError.message }, { status: 500 });
      }
    }

    const { data: jobMeta } = await admin
      .from("jobs")
      .select("title")
      .eq("id", app.job_id)
      .maybeSingle();
    const jobTitle = String(jobMeta?.title || "your application");

    const routeByStage: Record<string, string> = {
      MCQ: `/dashboard/applicant/applications/${applicationId}/mcq`,
      CODING: `/dashboard/applicant/applications/${applicationId}`,
      INTERVIEW: `/dashboard/applicant/applications/${applicationId}`,
      COMPLETE: `/dashboard/applicant/applications/${applicationId}`,
      REJECTED: `/dashboard/applicant/applications/${applicationId}`,
      ATS: `/dashboard/applicant/applications/${applicationId}`,
    };
    await createUserNotification(admin, {
      userId: String(app.user_id),
      applicationId,
      title: `Application moved to ${targetStage}`,
      message:
        targetStage === "MCQ"
          ? `You are shortlisted for the MCQ round for ${jobTitle}.${deadlineAt ? ` Deadline: ${new Date(deadlineAt).toLocaleString()}.` : ""}${directives ? ` Instructions: ${directives}` : ""}`
          : `Your application for ${jobTitle} moved to ${targetStage}.`,
      route: routeByStage[targetStage] || `/dashboard/applicant/applications/${applicationId}`,
      type: targetStage === "MCQ" ? "mcq" : "info",
    });

    return NextResponse.json({ success: true, applicationId, targetStage, currentStage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to move candidate.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

