import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { requireAuthUser } from "@/server/auth/session";
import {
  createMcqSessionToken,
  getMcqExamSeconds,
  getMcqRemainingSeconds,
  verifyMcqSessionToken,
} from "@/server/mcq/sessionToken";
import { cookies } from "next/headers";
import { sanitizeSnapshotForClient } from "@/services/testEngine";
import { loadMcqReviewAnswers } from "@/server/mcq/reviewAnswers";
import type { TestSnapshotItem } from "@/types/candidateTest";

const mapCurrentStageToPipeline = (current?: string | null) => {
  const value = String(current || "").toUpperCase();
  if (value === "SCREENING") return "MCQ";
  if (value === "CODING") return "CODING";
  if (value === "INTERVIEW") return "INTERVIEW";
  if (value === "OFFER" || value === "COMPLETE") return "COMPLETE";
  return "ATS";
};

const stageRank = (stage: string) => {
  const s = String(stage || "").toUpperCase();
  if (s === "ATS") return 0;
  if (s === "MCQ") return 1;
  if (s === "CODING") return 2;
  if (s === "INTERVIEW") return 3;
  if (s === "COMPLETE") return 4;
  return 0;
};

const isMissingRoundControlsTable = (message?: string) =>
  (message || "").includes('relation "application_round_controls" does not exist') ||
  (message || "").includes('relation "public.application_round_controls" does not exist') ||
  (message || "").includes("Could not find the table 'application_round_controls'") ||
  (message || "").includes("Could not find the table 'public.application_round_controls'");

const MCQ_QUESTIONS_PER_TEST = 10;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const applicationId = url.searchParams.get("applicationId") || "";
    if (!applicationId) {
      return NextResponse.json({ error: "applicationId is required." }, { status: 400 });
    }

    const user = await requireAuthUser();
    const cookieStore = await cookies();
    const admin = createSupabaseAdmin();

    let { data: application, error: appError } = await admin
      .from("applications")
      .select("id, user_id, job_id, pipeline_step")
      .eq("id", applicationId)
      .maybeSingle();

    const missingPipelineStepColumn =
      (appError?.message || "").includes("Could not find the 'pipeline_step' column") ||
      (appError?.message || "").includes("column applications.pipeline_step does not exist") ||
      (appError?.message || "").includes('column "pipeline_step" does not exist');
    if (missingPipelineStepColumn) {
      const fallback = await admin
        .from("applications")
        .select("id, user_id, job_id, current_stage")
        .eq("id", applicationId)
        .maybeSingle();
      application = fallback.data as typeof application;
      appError = fallback.error;
      if (application) {
        application = {
          ...application,
          pipeline_step: mapCurrentStageToPipeline((application as { current_stage?: string | null }).current_stage),
        };
      }
    }

    if (appError || !application) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }
    if (application.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const normalizedStep = String(application.pipeline_step || "ATS").toUpperCase();

    const { data: attempt } = await admin
      .from("mcq_attempts")
      .select("id, score, total_questions, correct_answers, submitted_at")
      .eq("application_id", applicationId)
      .maybeSingle();

    let deadlineAt: string | null = null;
    let directives: string | null = null;
    const controls = await admin
      .from("application_round_controls")
      .select("deadline_at, directives")
      .eq("application_id", applicationId)
      .eq("stage_type", "MCQ")
      .maybeSingle();
    if (!isMissingRoundControlsTable(controls.error?.message)) {
      if (controls.error) {
        return NextResponse.json({ error: controls.error.message }, { status: 500 });
      }
      deadlineAt = controls.data?.deadline_at || null;
      directives = controls.data?.directives || null;
    }

    if (!attempt?.id && stageRank(normalizedStep) < stageRank("MCQ")) {
      return NextResponse.json(
        { error: "MCQ round is not unlocked yet for this application." },
        { status: 403 }
      );
    }
    if (!attempt?.id && deadlineAt && new Date(deadlineAt).getTime() < Date.now()) {
      return NextResponse.json(
        { error: "MCQ round deadline has passed. Please contact HR for extension." },
        { status: 403 }
      );
    }

    const { data: candidateTest } = await admin
      .from("candidate_tests")
      .select("questions")
      .eq("application_id", applicationId)
      .maybeSingle();

    const snap = (candidateTest?.questions as TestSnapshotItem[] | null) || [];
    const hasTestSnapshot = snap.length >= MCQ_QUESTIONS_PER_TEST;

    let reviewAnswers: Awaited<ReturnType<typeof loadMcqReviewAnswers>> = [];
    if (attempt?.id) {
      reviewAnswers = await loadMcqReviewAnswers(admin, applicationId, attempt.id);
    }

    const orderedQuestions = hasTestSnapshot ? sanitizeSnapshotForClient(snap) : [];
    const needsStart = Boolean(!attempt?.id && !hasTestSnapshot);

    const cookieName = `mcq_session_${applicationId}`;
    const existingToken = cookieStore.get(cookieName)?.value || "";
    let hasExpired = false;
    let sessionToken = "";
    let issuedAt = Math.floor(Date.now() / 1000);

    if (!attempt?.id && hasTestSnapshot) {
      if (existingToken) {
        const checked = verifyMcqSessionToken(existingToken, applicationId);
        if (checked.valid) {
          sessionToken = existingToken;
          issuedAt = checked.issuedAt;
        } else if (checked.reason === "expired") {
          sessionToken = createMcqSessionToken(applicationId);
          const verified = verifyMcqSessionToken(sessionToken, applicationId);
          if (verified.valid) issuedAt = verified.issuedAt;
        } else {
          sessionToken = createMcqSessionToken(applicationId);
          const verified = verifyMcqSessionToken(sessionToken, applicationId);
          if (verified.valid) issuedAt = verified.issuedAt;
        }
      } else {
        sessionToken = createMcqSessionToken(applicationId);
        const verified = verifyMcqSessionToken(sessionToken, applicationId);
        if (verified.valid) issuedAt = verified.issuedAt;
      }
    }

    if (attempt?.id) {
      hasExpired = false;
    }

    const remainingSeconds = hasExpired ? 0 : needsStart ? getMcqExamSeconds() : getMcqRemainingSeconds(issuedAt);
    const response = NextResponse.json({
      applicationId,
      pipelineStep: application.pipeline_step,
      hasSubmitted: Boolean(attempt?.id),
      attempt: attempt || null,
      questions: orderedQuestions,
      needsStart,
      reviewAnswers,
      examSeconds: getMcqExamSeconds(),
      remainingSeconds,
      hasExpired,
      sessionToken: attempt?.id ? "" : needsStart ? "" : sessionToken,
      deadlineAt,
      directives,
    });

    if (attempt?.id) {
      response.cookies.set(cookieName, "", {
        path: "/",
        maxAge: 0,
      });
    } else if (sessionToken && hasTestSnapshot) {
      response.cookies.set(cookieName, sessionToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24,
      });
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load MCQ session.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
