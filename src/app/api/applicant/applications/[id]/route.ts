import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { requireAuthUser } from "@/server/auth/session";

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
          pipeline_step: application.current_stage || "APPLIED",
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

    return NextResponse.json({
      application,
      stages: stages || [],
      ranking: ranking || null,
      codingChallenge: challenge || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load application detail.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
