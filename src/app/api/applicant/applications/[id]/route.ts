import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { requireAuthUser } from "@/server/auth/session";

const mapCurrentStageToPipeline = (current?: string | null) => {
  const value = String(current || "").toUpperCase();
  if (value === "ATS") return "ATS";
  if (value === "MCQ") return "MCQ";
  if (value === "COMPLETE") return "COMPLETE";
  if (value === "REJECTED") return "REJECTED";
  if (value === "SCREENING") return "MCQ";
  if (value === "CODING") return "CODING";
  if (value === "INTERVIEW") return "INTERVIEW";
  if (value === "OFFER" || value === "COMPLETE" || value === "HIRED") return "COMPLETE";
  if (value === "REJECTED") return "REJECTED";
  if (value === "APPLIED") return "ATS";
  return "ATS";
};
const isMissingRoundControlsTable = (message?: string) =>
  (message || "").includes("relation \"application_round_controls\" does not exist") ||
  (message || "").includes("relation \"public.application_round_controls\" does not exist") ||
  (message || "").includes("Could not find the table 'application_round_controls'") ||
  (message || "").includes("Could not find the table 'public.application_round_controls'");

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireAuthUser();
    const admin = createSupabaseAdmin();

    let { data: application, error: appError } = await admin
      .from("applications")
      .select("id, user_id, job_id, pipeline_step, current_stage, applied_at, jobs(id,title,description)")
      .eq("id", id)
      .single();

    const missingPipelineStepColumn =
      (appError?.message || "").includes("Could not find the 'pipeline_step' column") ||
      (appError?.message || "").includes("column applications.pipeline_step does not exist") ||
      (appError?.message || "").includes('column "pipeline_step" does not exist');
    if (missingPipelineStepColumn) {
      const fallback = await admin
        .from("applications")
        .select("id, user_id, job_id, current_stage, applied_at, jobs(id,title,description)")
        .eq("id", id)
        .single();
      application = fallback.data as typeof application;
      appError = fallback.error;
      if (application) {
        application = {
          ...application,
          pipeline_step: mapCurrentStageToPipeline(application.current_stage),
        };
      }
    }

    if (appError || !application) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }
    if (application.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const { data: stages } = await admin
      .from("stage_results")
      .select("stage_type, score, passed, evaluated_at")
      .eq("application_id", id);

    const { data: ranking } = await admin
      .from("rankings")
      .select("final_score, rank_position")
      .eq("application_id", id)
      .maybeSingle();

    const { data: challenge } = await admin
      .from("coding_challenges")
      .select("id, title")
      .eq("job_id", application.job_id)
      .limit(1)
      .maybeSingle();

    let { data: controls, error: controlsError } = await admin
      .from("application_round_controls")
      .select("id, stage_type, deadline_at, directives, created_at, updated_at")
      .eq("application_id", id)
      .order("updated_at", { ascending: false });
    if (isMissingRoundControlsTable(controlsError?.message)) {
      controls = [];
      controlsError = null;
    }
    if (controlsError) {
      return NextResponse.json({ error: controlsError.message }, { status: 500 });
    }

    const normalizedStep = mapCurrentStageToPipeline(
      (application as { pipeline_step?: string | null; current_stage?: string | null }).pipeline_step ||
        application.current_stage
    );
    const activeDirective = (controls || []).find(
      (c) => String(c.stage_type || "").toUpperCase() === String(normalizedStep || "").toUpperCase()
    );
    const deadlineExpired =
      Boolean(activeDirective?.deadline_at) && new Date(String(activeDirective?.deadline_at)).getTime() < Date.now();

    return NextResponse.json({
      application: {
        ...application,
        pipeline_step: normalizedStep,
      },
      stages: stages || [],
      ranking: ranking || null,
      codingChallenge: challenge || null,
      roundControls: controls || [],
      activeDirective: activeDirective || null,
      canProceedCurrentRound: !deadlineExpired,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load application detail.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
