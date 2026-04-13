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

const MCQ_QUESTIONS_PER_TEST = 10;
const LEGACY_FALLBACK_PREFIX = "You are reviewing a production issue related to";

const normalizePerformanceScore = (raw?: number | null): number | null => {
  if (typeof raw !== "number" || Number.isNaN(raw)) return null;
  if (raw >= 0 && raw <= 1) return raw;
  if (raw >= 0 && raw <= 100) return raw / 100;
  return null;
};

const resolveCandidatePerformanceScore = (input: {
  atsScore?: number | null;
  experienceRequired?: number | null;
}): number => {
  const fromAts = normalizePerformanceScore(input.atsScore);
  if (fromAts !== null) return fromAts;

  const exp = Number(input.experienceRequired || 0);
  if (exp <= 1) return 0.25; // fresher/basic leaning
  if (exp <= 3) return 0.5; // mid-level balanced
  return 0.75; // experienced/challenging leaning
};

const resolveExperienceLevelForEngine = (experienceRequired?: number | null): "fresher" | "junior" | "mid" | "senior" => {
  const exp = Number(experienceRequired || 0);
  if (exp <= 1) return "fresher";
  if (exp <= 3) return "junior";
  if (exp <= 6) return "mid";
  return "senior";
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

    // Only candidates already advanced to MCQ (or further) can open the assessment.
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

    const { data: existingSet, error: setError } = await admin
      .from("mcq_question_sets")
      .select("question_ids")
      .eq("application_id", applicationId)
      .maybeSingle();
    const missingQuestionSetsTable = isMissingQuestionSetsTable(setError?.message);
    if (setError && !missingQuestionSetsTable) {
      return NextResponse.json({ error: "Failed to load MCQ question set.", detail: setError.message }, { status: 500 });
    }

    let questionIds: string[] = (existingSet?.question_ids || []) as string[];
    const { data: roleJobMeta } = await admin
      .from("jobs")
      .select("experience_required")
      .eq("id", application.job_id)
      .maybeSingle();
    const isFresherRole = Number(roleJobMeta?.experience_required || 0) <= 1;
    const { data: atsRows } = await admin
      .from("stage_results")
      .select("score")
      .eq("application_id", applicationId)
      .eq("stage_type", "ATS")
      .limit(1);
    const atsScore = Number((atsRows || [])[0]?.score);

    if (!questionIds.length) {
      const { data: job, error: jobError } = await admin
        .from("jobs")
        .select("title, description, experience_required, job_skills(skill_name)")
        .eq("id", application.job_id)
        .maybeSingle();
      if (jobError) {
        return NextResponse.json({ error: "Failed to load job for MCQ generation.", detail: jobError.message }, { status: 500 });
      }
      if (!job) {
        return NextResponse.json({ error: "Job not found for MCQ generation." }, { status: 404 });
      }

      const skills =
        ((job.job_skills as Array<{ skill_name: string }> | null) || [])
          .map((s) => s.skill_name)
          .filter(Boolean);
      const generated = await generateMcqsFromContext({
        skills,
        count: MCQ_QUESTIONS_PER_TEST,
        jobId: String(application.job_id),
        candidateId: String(application.id),
        candidatePerformanceScore: resolveCandidatePerformanceScore({
          atsScore,
          experienceRequired: Number(job.experience_required || 0),
        }),
        experienceLevel: resolveExperienceLevelForEngine(Number(job.experience_required || 0)),
        jobRole: String(job.title || ""),
        seed: `${application.id}:initial`,
        requireEngine: true,
        jobTitle: String(job.title || ""),
        jobDescription: String(job.description || ""),
        difficultyHint: "challenging",
      });
      if (!generated.length) {
        return NextResponse.json({ error: "Failed to generate MCQ questions for this applicant." }, { status: 500 });
      }

      const { data: inserted, error: insertError } = await admin
        .from("mcq_questions")
        .insert(
          generated.map((q) => ({
            job_id: application.job_id,
            question_text: q.questionText,
            options: q.options,
            correct_option: q.correctOption,
            skill_tag: q.skillTag || null,
            difficulty: q.difficulty || "medium",
          }))
        )
        .select("id");
      if (insertError || !inserted?.length) {
        return NextResponse.json({ error: "Failed to persist generated MCQs.", detail: insertError?.message }, { status: 500 });
      }

      questionIds = inserted.map((row) => String(row.id)).slice(0, MCQ_QUESTIONS_PER_TEST);

      if (!missingQuestionSetsTable) {
        const { error: createSetError } = await admin.from("mcq_question_sets").upsert(
          {
            application_id: applicationId,
            question_ids: questionIds,
          },
          { onConflict: "application_id" }
        );
        if (createSetError) {
          return NextResponse.json({ error: "Failed to save applicant MCQ set.", detail: createSetError.message }, { status: 500 });
        }
      }
    }

    let orderedQuestions: Array<{
      id: string;
      question_text: string;
      options: string[];
      skill_tag: string | null;
      difficulty: string | null;
    }> = [];

    if (questionIds.length) {
      const { data: questions, error: questionsError } = await admin
        .from("mcq_questions")
        .select("id, question_text, options, skill_tag, difficulty")
        .in("id", questionIds);
      if (questionsError) {
        return NextResponse.json({ error: "Failed to load MCQ questions.", detail: questionsError.message }, { status: 500 });
      }
      const orderMap = new Map(questionIds.map((id, idx) => [id, idx]));
      orderedQuestions = (questions || [])
        .sort((a, b) => (orderMap.get(String(a.id)) ?? 999) - (orderMap.get(String(b.id)) ?? 999))
        .slice(0, MCQ_QUESTIONS_PER_TEST);

      const hasLegacyFallbackQuestion = orderedQuestions.some((q) =>
        String(q.question_text || "").startsWith(LEGACY_FALLBACK_PREFIX)
      );
      const hardCount = orderedQuestions.filter((q) => String(q.difficulty || "").toLowerCase() === "hard").length;
      const isTooHardForFresher = isFresherRole && hardCount > 4;
      if ((hasLegacyFallbackQuestion || isTooHardForFresher) && !attempt?.id) {
        questionIds = [];
        orderedQuestions = [];
      }
    } else if (missingQuestionSetsTable) {
      const fallbackQuestions = await admin
        .from("mcq_questions")
        .select("id, question_text, options, skill_tag, difficulty")
        .eq("job_id", application.job_id)
        .order("created_at", { ascending: true })
        .limit(MCQ_QUESTIONS_PER_TEST);
      if (fallbackQuestions.error) {
        return NextResponse.json({ error: "Failed to load fallback MCQ questions.", detail: fallbackQuestions.error.message }, { status: 500 });
      }
      orderedQuestions = (fallbackQuestions.data || []).slice(0, MCQ_QUESTIONS_PER_TEST);
    }

    if (!orderedQuestions.length && !attempt?.id) {
      const { data: job, error: jobError } = await admin
        .from("jobs")
        .select("title, description, experience_required, job_skills(skill_name)")
        .eq("id", application.job_id)
        .maybeSingle();
      if (jobError) {
        return NextResponse.json({ error: "Failed to load job for MCQ regeneration.", detail: jobError.message }, { status: 500 });
      }
      if (!job) {
        return NextResponse.json({ error: "Job not found for MCQ regeneration." }, { status: 404 });
      }

      const skills =
        ((job.job_skills as Array<{ skill_name: string }> | null) || [])
          .map((s) => s.skill_name)
          .filter(Boolean);
      const regenerated = await generateMcqsFromContext({
        skills,
        count: MCQ_QUESTIONS_PER_TEST,
        jobId: String(application.job_id),
        candidateId: String(application.id),
        candidatePerformanceScore: resolveCandidatePerformanceScore({
          atsScore,
          experienceRequired: Number(job.experience_required || 0),
        }),
        experienceLevel: resolveExperienceLevelForEngine(Number(job.experience_required || 0)),
        jobRole: String(job.title || ""),
        seed: `${application.id}:regen`,
        requireEngine: true,
        jobTitle: String(job.title || ""),
        jobDescription: String(job.description || ""),
        difficultyHint: "challenging",
      });
      if (!regenerated.length) {
        return NextResponse.json({ error: "MCQ engine returned no questions for this applicant." }, { status: 500 });
      }

      const { data: insertedRegenerated, error: insertRegeneratedError } = await admin
        .from("mcq_questions")
        .insert(
          regenerated.map((q) => ({
            job_id: application.job_id,
            question_text: q.questionText,
            options: q.options,
            correct_option: q.correctOption,
            skill_tag: q.skillTag || null,
            difficulty: q.difficulty || "medium",
          }))
        )
        .select("id, question_text, options, skill_tag, difficulty");
      if (insertRegeneratedError || !insertedRegenerated?.length) {
        return NextResponse.json({ error: "Failed to persist regenerated MCQs.", detail: insertRegeneratedError?.message }, { status: 500 });
      }

      orderedQuestions = insertedRegenerated.slice(0, MCQ_QUESTIONS_PER_TEST).map((row) => ({
        id: String(row.id),
        question_text: String(row.question_text),
        options: row.options as string[],
        skill_tag: row.skill_tag as string | null,
        difficulty: row.difficulty as string | null,
      }));

      if (!missingQuestionSetsTable) {
        const replacementIds = orderedQuestions.map((q) => q.id);
        const { error: replaceSetError } = await admin.from("mcq_question_sets").upsert(
          {
            application_id: applicationId,
            question_ids: replacementIds,
          },
          { onConflict: "application_id" }
        );
        if (replaceSetError) {
          return NextResponse.json({ error: "Failed to replace applicant MCQ set.", detail: replaceSetError.message }, { status: 500 });
        }
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
        // Expired cookie tokens should not lock candidates forever.
        // Start a fresh timed session when there is no submitted attempt.
        if (!attempt?.id) {
          sessionToken = createMcqSessionToken(applicationId);
          const verified = verifyMcqSessionToken(sessionToken, applicationId);
          if (verified.valid) issuedAt = verified.issuedAt;
        } else {
          hasExpired = true;
        }
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
      questions: orderedQuestions,
      reviewAnswers,
      examSeconds: getMcqExamSeconds(),
      remainingSeconds,
      hasExpired,
      sessionToken: attempt?.id ? "" : sessionToken,
      deadlineAt,
      directives,
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
