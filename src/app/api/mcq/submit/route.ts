import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { syncPipelineStep } from "@/server/pipeline/syncPipeline";
import { verifyMcqSessionToken } from "@/server/mcq/sessionToken";
import { requireAuthUser, getAppRole } from "@/server/auth/session";
import { checkRateLimit } from "@/server/security/rateLimit";
import { logStageSubmission } from "@/server/audit/stageAudit";
import { createUserNotification } from "@/server/notifications/createNotification";
import { loadMcqReviewAnswers } from "@/server/mcq/reviewAnswers";
import type { TestSnapshotItem } from "@/types/candidateTest";

type SubmittedAnswer = {
  questionId: string;
  selectedOption: number;
};

const MCQ_PASS_SCORE = Number(process.env.MCQ_PASS_SCORE || 60);
const isMissingRoundControlsTable = (message?: string) =>
  (message || "").includes('relation "application_round_controls" does not exist') ||
  (message || "").includes('relation "public.application_round_controls" does not exist') ||
  (message || "").includes("Could not find the table 'application_round_controls'") ||
  (message || "").includes("Could not find the table 'public.application_round_controls'");

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser();
    const role = getAppRole(user);
    const body = (await request.json()) as {
      applicationId?: string;
      answers?: SubmittedAnswer[];
      sessionToken?: string;
    };

    const applicationId = body.applicationId || "";
    const answers = body.answers || [];
    const sessionToken = body.sessionToken || "";
    const forwardedFor = request.headers.get("x-forwarded-for") || "";
    const ipAddress = (forwardedFor.split(",")[0] || request.headers.get("x-real-ip") || "").trim() || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";
    const rateKey = `mcq-submit:${user.id}:${applicationId}:${ipAddress}`;
    const rate = checkRateLimit(rateKey, 8, 10 * 60 * 1000);

    if (!rate.allowed) {
      await logStageSubmission({
        applicationId,
        stageType: "MCQ",
        status: "BLOCKED",
        actorUserId: user.id,
        ipAddress,
        userAgent,
        detail: { reason: "rate_limit", retryAfterMs: rate.retryAfterMs },
      });
      return NextResponse.json(
        { error: "Too many submission attempts. Please try again shortly.", retryAfterMs: rate.retryAfterMs },
        { status: 429 }
      );
    }

    if (!applicationId || !sessionToken) {
      return NextResponse.json({ error: "applicationId and sessionToken are required." }, { status: 400 });
    }

    const tokenCheck = verifyMcqSessionToken(sessionToken, applicationId);
    if (!tokenCheck.valid) {
      return NextResponse.json({ error: tokenCheck.error }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: application, error: appError } = await supabase
      .from("applications")
      .select("id, user_id, job_id")
      .eq("id", applicationId)
      .maybeSingle();
    if (appError || !application) {
      await logStageSubmission({
        applicationId,
        stageType: "MCQ",
        status: "FAILED",
        actorUserId: user.id,
        ipAddress,
        userAgent,
        detail: { reason: "application_not_found", error: appError?.message },
      });
      return NextResponse.json({ error: "Application not found.", detail: appError?.message }, { status: 404 });
    }
    if (role === "applicant" && application.user_id !== user.id) {
      await logStageSubmission({
        applicationId,
        stageType: "MCQ",
        status: "BLOCKED",
        actorUserId: user.id,
        ipAddress,
        userAgent,
        detail: { reason: "forbidden_owner_mismatch" },
      });
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const controls = await supabase
      .from("application_round_controls")
      .select("deadline_at")
      .eq("application_id", applicationId)
      .eq("stage_type", "MCQ")
      .maybeSingle();
    if (!isMissingRoundControlsTable(controls.error?.message)) {
      if (controls.error) {
        return NextResponse.json({ error: controls.error.message }, { status: 500 });
      }
      const deadlineAt = controls.data?.deadline_at;
      if (deadlineAt && new Date(deadlineAt).getTime() < Date.now()) {
        return NextResponse.json(
          { error: "MCQ round deadline has passed. Contact HR for extension." },
          { status: 403 }
        );
      }
    }

    const { data: candidateTest, error: ctError } = await supabase
      .from("candidate_tests")
      .select("id, questions, job_id, status")
      .eq("application_id", applicationId)
      .maybeSingle();

    if (ctError && !ctError.message.includes("does not exist")) {
      return NextResponse.json({ error: ctError.message }, { status: 500 });
    }

    const snapshot = (candidateTest?.questions as TestSnapshotItem[] | null) || [];
    if (!candidateTest || snapshot.length < 10) {
      return NextResponse.json(
        { error: "No active MCQ test for this application. Use Start Test on the MCQ page first." },
        { status: 400 }
      );
    }
    if (String(candidateTest.job_id) !== String(application.job_id)) {
      await logStageSubmission({
        applicationId,
        stageType: "MCQ",
        status: "BLOCKED",
        actorUserId: user.id,
        ipAddress,
        userAgent,
        detail: { reason: "candidate_test_job_mismatch" },
      });
      return NextResponse.json({ error: "Test does not match this application job." }, { status: 400 });
    }
    if (candidateTest.status === "completed") {
      return NextResponse.json({ error: "This test is already completed." }, { status: 400 });
    }

    const keySet = new Set(snapshot.map((q) => q.key));
    const answerMap = new Map(answers.map((a) => [String(a.questionId), a.selectedOption]));
    for (const k of answerMap.keys()) {
      if (!keySet.has(k)) {
        await logStageSubmission({
          applicationId,
          stageType: "MCQ",
          status: "BLOCKED",
          actorUserId: user.id,
          ipAddress,
          userAgent,
          detail: { reason: "unknown_question_key", key: k },
        });
        return NextResponse.json({ error: "Submitted answers include questions not in this test." }, { status: 400 });
      }
    }

    const evaluated = snapshot.map((q) => {
      const selectedRaw = answerMap.get(q.key);
      const selected = Number.isInteger(selectedRaw) ? Number(selectedRaw) : -1;
      const isCorrect = selected === q.correctIndex;
      return {
        snapshot_question_key: q.key,
        selected_option: selected >= 0 ? selected : 0,
        is_correct: isCorrect,
      };
    });

    const total = evaluated.length;
    const correct = evaluated.filter((e) => e.is_correct).length;
    const score = total ? (correct / total) * 100 : 0;

    const { data: existingAttempt } = await supabase
      .from("mcq_attempts")
      .select("id, score, total_questions, correct_answers")
      .eq("application_id", applicationId)
      .maybeSingle();

    if (existingAttempt?.id) {
      const reviewAnswers = await loadMcqReviewAnswers(supabase, applicationId, existingAttempt.id);
      await logStageSubmission({
        applicationId,
        stageType: "MCQ",
        status: "BLOCKED",
        actorUserId: user.id,
        ipAddress,
        userAgent,
        detail: { reason: "already_submitted", attemptId: existingAttempt.id },
      });
      return NextResponse.json(
        {
          error: "MCQ attempt already submitted for this application.",
          result: {
            applicationId,
            score: Number(existingAttempt.score ?? 0),
            totalQuestions: Number(existingAttempt.total_questions ?? 0),
            correctAnswers: Number(existingAttempt.correct_answers ?? 0),
            passed: Number(existingAttempt.score ?? 0) >= MCQ_PASS_SCORE,
          },
          reviewAnswers,
        },
        { status: 409 }
      );
    }

    const { data: insertedAttempt, error: insertAttemptError } = await supabase
      .from("mcq_attempts")
      .insert({
        application_id: applicationId,
        score,
        total_questions: total,
        correct_answers: correct,
      })
      .select("id")
      .single();
    if (insertAttemptError || !insertedAttempt) {
      await logStageSubmission({
        applicationId,
        stageType: "MCQ",
        status: "FAILED",
        actorUserId: user.id,
        ipAddress,
        userAgent,
        detail: { reason: "attempt_insert_failed", error: insertAttemptError?.message },
      });
      return NextResponse.json({ error: "Failed to create MCQ attempt.", detail: insertAttemptError?.message }, { status: 500 });
    }
    const attemptId = insertedAttempt.id;

    const answerRows = evaluated.map((e) => ({
      attempt_id: attemptId,
      question_id: null as string | null,
      snapshot_question_key: e.snapshot_question_key,
      selected_option: e.selected_option,
      is_correct: e.is_correct,
    }));
    const { error: answersError } = await supabase.from("mcq_attempt_answers").insert(answerRows);
    if (answersError) {
      await logStageSubmission({
        applicationId,
        stageType: "MCQ",
        status: "FAILED",
        actorUserId: user.id,
        ipAddress,
        userAgent,
        detail: { reason: "answers_insert_failed", error: answersError.message },
      });
      return NextResponse.json({ error: "Failed to save MCQ answers.", detail: answersError.message }, { status: 500 });
    }

    await supabase
      .from("candidate_tests")
      .update({
        score: Math.round(score),
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("application_id", applicationId);

    const { data: existingStage } = await supabase
      .from("stage_results")
      .select("id")
      .eq("application_id", applicationId)
      .eq("stage_type", "MCQ")
      .maybeSingle();

    const stagePayload = {
      score,
      breakdown: {
        total_questions: total,
        correct_answers: correct,
      },
      passed: score >= MCQ_PASS_SCORE,
      evaluated_at: new Date().toISOString(),
    };

    if (existingStage?.id) {
      await supabase.from("stage_results").update(stagePayload).eq("id", existingStage.id);
    } else {
      await supabase.from("stage_results").insert({
        application_id: applicationId,
        stage_type: "MCQ",
        ...stagePayload,
      });
    }

    try {
      await syncPipelineStep(applicationId);
    } catch (e) {
      console.error("syncPipelineStep (MCQ):", e);
    }

    const { data: updatedApp } = await supabase
      .from("applications")
      .select("pipeline_step, current_stage")
      .eq("id", applicationId)
      .maybeSingle();
    const mappedNext =
      String(updatedApp?.pipeline_step || updatedApp?.current_stage || "MCQ").toUpperCase() === "SCREENING"
        ? "MCQ"
        : String(updatedApp?.pipeline_step || updatedApp?.current_stage || "MCQ").toUpperCase();
    const routeByStep: Record<string, string> = {
      MCQ: `/dashboard/applicant/applications/${applicationId}/mcq`,
      CODING: `/dashboard/applicant/applications/${applicationId}`,
      INTERVIEW: `/dashboard/applicant/applications/${applicationId}`,
      COMPLETE: `/dashboard/applicant/applications/${applicationId}`,
    };
    await createUserNotification(supabase, {
      userId: String(application.user_id),
      applicationId,
      title: "MCQ submitted successfully",
      message: `You scored ${Number(score.toFixed(2))}%. Next step: ${mappedNext}.`,
      route: routeByStep[mappedNext] || `/dashboard/applicant/applications/${applicationId}`,
      type: mappedNext === "CODING" ? "coding" : mappedNext === "INTERVIEW" ? "interview" : "mcq",
    });

    const reviewAnswers = await loadMcqReviewAnswers(supabase, applicationId, attemptId);
    await logStageSubmission({
      applicationId,
      stageType: "MCQ",
      status: "SUCCESS",
      actorUserId: user.id,
      ipAddress,
      userAgent,
      detail: {
        attemptId,
        score: Number(score.toFixed(2)),
        totalQuestions: total,
        correctAnswers: correct,
        passed: score >= MCQ_PASS_SCORE,
      },
    });
    return NextResponse.json({
      success: true,
      result: {
        applicationId,
        score: Number(score.toFixed(2)),
        totalQuestions: total,
        correctAnswers: correct,
        passed: score >= MCQ_PASS_SCORE,
      },
      reviewAnswers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit MCQ answers.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
