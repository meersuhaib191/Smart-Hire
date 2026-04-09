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
import { generateMcqsFromContext } from "@/server/mcq/generator";

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

    // Only candidates already advanced to MCQ (or further) can open the assessment.
    if (!attempt?.id && stageRank(normalizedStep) < stageRank("MCQ")) {
      return NextResponse.json(
        { error: "MCQ round is not unlocked yet for this application." },
        { status: 403 }
      );
    }

    let { data: questions, error: questionsError } = await admin
      .from("mcq_questions")
      .select("id, question_text, options, skill_tag, difficulty")
      .eq("job_id", application.job_id)
      .order("created_at", { ascending: true })
      .limit(30);

    if (questionsError) {
      return NextResponse.json({ error: "Failed to load MCQ questions.", detail: questionsError.message }, { status: 500 });
    }

    if (!questions?.length) {
      const { data: job } = await admin
        .from("jobs")
        .select("title, description, job_skills(skill_name)")
        .eq("id", application.job_id)
        .maybeSingle();
      if (job) {
        const skills =
          ((job.job_skills as Array<{ skill_name: string }> | null) || [])
            .map((s) => s.skill_name)
            .filter(Boolean);
        const generated = await generateMcqsFromContext({
          skills,
          count: 12,
          jobTitle: String(job.title || ""),
          jobDescription: String(job.description || ""),
          difficultyHint: "challenging",
        });
        if (generated.length) {
          await admin.from("mcq_questions").insert(
            generated.map((q) => ({
              job_id: application.job_id,
              question_text: q.questionText,
              options: q.options,
              correct_option: q.correctOption,
              skill_tag: q.skillTag || null,
              difficulty: q.difficulty || "medium",
            }))
          );
        }
      }

      const reload = await admin
        .from("mcq_questions")
        .select("id, question_text, options, skill_tag, difficulty")
        .eq("job_id", application.job_id)
        .order("created_at", { ascending: true })
        .limit(30);
      questions = reload.data;
      questionsError = reload.error;
      if (questionsError) {
        return NextResponse.json({ error: "Failed to load MCQ questions.", detail: questionsError.message }, { status: 500 });
      }
    }

    let reviewAnswers: Array<{
      questionId: string;
      questionText: string;
      options: string[];
      selectedOption: number;
      isCorrect: boolean;
    }> = [];

    if (attempt?.id) {
      const { data: reviewed } = await admin
        .from("mcq_attempt_answers")
        .select("selected_option, is_correct, mcq_questions(id, question_text, options)")
        .eq("attempt_id", attempt.id);

      type ReviewedRow = {
        selected_option: number;
        is_correct: boolean;
        mcq_questions:
          | { id: string; question_text: string; options: string[] }
          | Array<{ id: string; question_text: string; options: string[] }>
          | null;
      };

      reviewAnswers = ((reviewed || []) as ReviewedRow[])
        .map((row) => {
          const q = Array.isArray(row.mcq_questions) ? row.mcq_questions[0] : row.mcq_questions;
          return {
          questionId: q?.id || "",
          questionText: q?.question_text || "",
          options: q?.options || [],
          selectedOption: Number(row.selected_option),
          isCorrect: Boolean(row.is_correct),
        }})
        .filter((r) => r.questionId && r.questionText);
    }

    const cookieName = `mcq_session_${applicationId}`;
    const existingToken = cookieStore.get(cookieName)?.value || "";
    let hasExpired = false;
    let sessionToken = "";
    let issuedAt = Math.floor(Date.now() / 1000);

    if (existingToken) {
      const checked = verifyMcqSessionToken(existingToken, applicationId);
      if (checked.valid) {
        sessionToken = existingToken;
        issuedAt = checked.issuedAt;
      } else if (checked.reason === "expired") {
        hasExpired = true;
      } else {
        // Invalid/malformed cookie token: restart session instead of blocking forever.
        sessionToken = createMcqSessionToken(applicationId);
        const verified = verifyMcqSessionToken(sessionToken, applicationId);
        if (verified.valid) issuedAt = verified.issuedAt;
      }
    } else {
      sessionToken = createMcqSessionToken(applicationId);
      const verified = verifyMcqSessionToken(sessionToken, applicationId);
      if (verified.valid) issuedAt = verified.issuedAt;
    }

    if (attempt?.id) {
      hasExpired = false;
    }

    const remainingSeconds = hasExpired ? 0 : getMcqRemainingSeconds(issuedAt);
    const response = NextResponse.json({
      applicationId,
      pipelineStep: application.pipeline_step,
      hasSubmitted: Boolean(attempt?.id),
      attempt: attempt || null,
      questions: questions || [],
      reviewAnswers,
      examSeconds: getMcqExamSeconds(),
      remainingSeconds,
      hasExpired,
      sessionToken: attempt?.id ? "" : sessionToken,
    });

    if (attempt?.id) {
      response.cookies.set(cookieName, "", {
        path: "/",
        maxAge: 0,
      });
    } else if (sessionToken) {
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
