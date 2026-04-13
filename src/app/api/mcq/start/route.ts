import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { requireAuthUser } from "@/server/auth/session";
import { generateCandidateTest } from "@/services/testEngine";
import { createMcqSessionToken, getMcqExamSeconds, getMcqRemainingSeconds, verifyMcqSessionToken } from "@/server/mcq/sessionToken";

const stageRank = (stage: string) => {
  const s = String(stage || "").toUpperCase();
  if (s === "ATS") return 0;
  if (s === "MCQ") return 1;
  if (s === "CODING") return 2;
  if (s === "INTERVIEW") return 3;
  if (s === "COMPLETE") return 4;
  return 0;
};

const mapCurrentStageToPipeline = (current?: string | null) => {
  const value = String(current || "").toUpperCase();
  if (value === "SCREENING") return "MCQ";
  if (value === "CODING") return "CODING";
  if (value === "INTERVIEW") return "INTERVIEW";
  if (value === "OFFER" || value === "COMPLETE") return "COMPLETE";
  return "ATS";
};

const isMissingRoundControlsTable = (message?: string) =>
  (message || "").includes('relation "application_round_controls" does not exist') ||
  (message || "").includes('relation "public.application_round_controls" does not exist') ||
  (message || "").includes("Could not find the table 'application_round_controls'") ||
  (message || "").includes("Could not find the table 'public.application_round_controls'");

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = (await request.json()) as { applicationId?: string };
    const applicationId = body.applicationId || "";
    if (!applicationId) {
      return NextResponse.json({ error: "applicationId is required." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();

    let { data: application, error: appError } = await admin
      .from("applications")
      .select("id, user_id, job_id, pipeline_step")
      .eq("id", applicationId)
      .maybeSingle();

    const missingPipelineStepColumn =
      (appError?.message || "").includes("Could not find the 'pipeline_step' column") ||
      (appError?.message || "").includes("column applications.pipeline_step does not exist");
    if (missingPipelineStepColumn) {
      const fallback = await admin
        .from("applications")
        .select("id, user_id, job_id, current_stage")
        .eq("id", applicationId)
        .maybeSingle();
      application = fallback.data as typeof application;
      appError = fallback.error as typeof appError;
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
      .select("id")
      .eq("application_id", applicationId)
      .maybeSingle();
    if (attempt?.id) {
      return NextResponse.json({ error: "MCQ already submitted for this application." }, { status: 409 });
    }

    if (stageRank(normalizedStep) < stageRank("MCQ")) {
      return NextResponse.json({ error: "MCQ round is not unlocked yet." }, { status: 403 });
    }

    const controls = await admin
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
          { error: "MCQ round deadline has passed. Please contact HR for extension." },
          { status: 403 }
        );
      }
    }

    const { data: job, error: jobError } = await admin
      .from("jobs")
      .select("id, title, description, experience_required, job_skills(skill_name)")
      .eq("id", application.job_id)
      .maybeSingle();
    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    const skills =
      ((job.job_skills as Array<{ skill_name: string }> | null) || [])
        .map((s) => s.skill_name)
        .filter(Boolean);

    const { testId, questions, reusedExisting } = await generateCandidateTest(admin, {
      applicationId,
      candidateId: application.user_id,
      jobId: String(application.job_id),
      jobDescription: String(job.description || ""),
      experienceYears: Number(job.experience_required || 0),
      jobSkills: skills,
    });

    const cookieName = `mcq_session_${applicationId}`;
    const cookieStore = await cookies();
    const existingToken = cookieStore.get(cookieName)?.value || "";
    let sessionToken = existingToken;
    let issuedAt = Math.floor(Date.now() / 1000);

    if (reusedExisting && existingToken) {
      const checked = verifyMcqSessionToken(existingToken, applicationId);
      if (checked.valid) {
        sessionToken = existingToken;
        issuedAt = checked.issuedAt;
      } else {
        sessionToken = createMcqSessionToken(applicationId);
        const v = verifyMcqSessionToken(sessionToken, applicationId);
        if (v.valid) issuedAt = v.issuedAt;
      }
    } else {
      sessionToken = createMcqSessionToken(applicationId);
      const v = verifyMcqSessionToken(sessionToken, applicationId);
      if (v.valid) issuedAt = v.issuedAt;
    }

    const examSeconds = getMcqExamSeconds();
    const remainingSeconds = getMcqRemainingSeconds(issuedAt);

    const response = NextResponse.json({
      success: true,
      testId,
      questions,
      alreadyStarted: reusedExisting,
      sessionToken,
      examSeconds,
      remainingSeconds,
    });

    response.cookies.set(cookieName, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start MCQ test.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
