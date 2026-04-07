import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { evaluateInterviewAnswer } from "@/server/interview/evaluateAnswer";
import { syncPipelineStep } from "@/server/pipeline/syncPipeline";
import { requireAuthUser, getAppRole } from "@/server/auth/session";

const INTERVIEW_PASS_SCORE = Number(process.env.INTERVIEW_PASS_SCORE || 60);

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = (await request.json()) as {
      applicationId?: string;
      question?: string;
      answerText?: string;
      jobTitle?: string;
    };

    const applicationId = body.applicationId || "";
    const question = body.question || "";
    const answerText = body.answerText || "";

    if (!applicationId || !question.trim() || !answerText.trim()) {
      return NextResponse.json(
        { error: "applicationId, question, and answerText are required." },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdmin();
    const { data: app, error: appError } = await admin
      .from("applications")
      .select("user_id, job_id")
      .eq("id", applicationId)
      .single();

    if (appError || !app) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }

    const role = getAppRole(user);
    if (role === "applicant" && app.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const scores = await evaluateInterviewAnswer({
      question,
      answer: answerText,
      jobTitle: body.jobTitle,
    });

    const overall = scores.overall;
    const passed = overall >= INTERVIEW_PASS_SCORE;

    const { error: insertError } = await admin.from("interview_submissions").insert({
      application_id: applicationId,
      question,
      answer_text: answerText,
      clarity: scores.clarity,
      relevance: scores.relevance,
      logic_score: scores.logic,
      overall_score: overall,
      feedback: scores.feedback,
      raw_evaluation: scores,
    });

    if (insertError) {
      return NextResponse.json({ error: "Failed to save interview.", detail: insertError.message }, { status: 500 });
    }

    const { data: existingStage } = await admin
      .from("stage_results")
      .select("id")
      .eq("application_id", applicationId)
      .eq("stage_type", "INTERVIEW")
      .maybeSingle();

    const stagePayload = {
      score: overall,
      breakdown: {
        clarity: scores.clarity,
        relevance: scores.relevance,
        logic: scores.logic,
      },
      passed,
      evaluated_at: new Date().toISOString(),
    };

    if (existingStage?.id) {
      await admin.from("stage_results").update(stagePayload).eq("id", existingStage.id);
    } else {
      await admin.from("stage_results").insert({
        application_id: applicationId,
        stage_type: "INTERVIEW",
        ...stagePayload,
      });
    }

    try {
      await syncPipelineStep(applicationId);
    } catch (e) {
      console.error("syncPipelineStep (INTERVIEW):", e);
    }

    return NextResponse.json({
      success: true,
      result: {
        applicationId,
        scores,
        passed,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Interview evaluation failed.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
