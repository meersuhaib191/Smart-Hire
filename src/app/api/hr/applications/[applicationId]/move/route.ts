import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { requireAuthUser, requireHr } from "@/server/auth/session";

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

export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> }
) {
  try {
    const user = await requireAuthUser();
    requireHr(user);
    const { applicationId } = await context.params;
    const body = (await request.json()) as { targetStage?: string };
    const targetStage = String(body.targetStage || "").toUpperCase() as TargetStage;

    if (!validStages.includes(targetStage)) {
      return NextResponse.json(
        { error: "Invalid targetStage. Use ATS, MCQ, CODING, INTERVIEW, COMPLETE, or REJECTED." },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdmin();
    const { data: app, error: appError } = await admin
      .from("applications")
      .select("id")
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

    return NextResponse.json({ success: true, applicationId, targetStage, currentStage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to move candidate.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

