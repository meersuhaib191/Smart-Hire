import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { requireAuthUser, requireHr } from "@/server/auth/session";
import { createUserNotification } from "@/server/notifications/createNotification";
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

  const { error: deleteCandidateTestsError } = await admin
    .from("candidate_tests")
    .delete()
    .in("application_id", applicationIds);
  const missingCandidateTests =
    (deleteCandidateTestsError?.message || "").includes('relation "candidate_tests" does not exist') ||
    (deleteCandidateTestsError?.message || "").includes("Could not find the table");
  if (deleteCandidateTestsError && !missingCandidateTests) {
    throw new Error(`Failed to reset candidate test snapshot: ${deleteCandidateTestsError.message}`);
  }
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
      await resetMcqProgressForApplications(admin, [applicationId]);
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

