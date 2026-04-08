import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { requireAuthUser, getAppRole } from "@/server/auth/session";

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = (await request.json()) as { applicationId?: string };
    const applicationId = body.applicationId || "";
    if (!applicationId) {
      return NextResponse.json({ error: "applicationId is required." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    const { data: app, error: appError } = await admin
      .from("applications")
      .select("id, user_id, job_id")
      .eq("id", applicationId)
      .single();

    if (appError || !app) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }

    const role = getAppRole(user);
    if (role === "applicant" && app.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const { data: weights } = await admin.from("job_weights").select("*").eq("job_id", app.job_id).maybeSingle();

    const w = weights || {
      ats_weight: 0.25,
      mcq_weight: 0.25,
      coding_weight: 0.25,
      interview_weight: 0.25,
    };

    const { data: stages, error: stagesError } = await admin
      .from("stage_results")
      .select("stage_type, score")
      .eq("application_id", applicationId);

    if (stagesError) {
      return NextResponse.json({ error: stagesError.message }, { status: 500 });
    }

    const map: Record<string, number> = {};
    for (const row of stages || []) {
      map[row.stage_type as string] = Number(row.score);
    }

    const finalScore =
      Number(w.ats_weight) * (map.ATS ?? 0) +
      Number(w.mcq_weight) * (map.MCQ ?? 0) +
      Number(w.coding_weight) * (map.CODING ?? 0) +
      Number(w.interview_weight) * (map.INTERVIEW ?? 0);

    const { error: rankError } = await admin.from("rankings").upsert(
      {
        application_id: applicationId,
        job_id: app.job_id,
        final_score: finalScore,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "application_id" }
    );

    if (rankError) {
      return NextResponse.json({ error: "Failed to save ranking.", detail: rankError.message }, { status: 500 });
    }

    const { error: rpcError } = await admin.rpc("refresh_job_rankings", { p_job_id: app.job_id });
    if (rpcError) {
      console.error("refresh_job_rankings:", rpcError.message);
    }

    const { error: updateError } = await admin
      .from("applications")
      .update({
        pipeline_step: "COMPLETE",
        current_stage: "OFFER",
      })
      .eq("id", applicationId);

    const missingPipelineStepColumn =
      (updateError?.message || "").includes("Could not find the 'pipeline_step' column") ||
      (updateError?.message || "").includes("column applications.pipeline_step does not exist") ||
      (updateError?.message || "").includes('column "pipeline_step" does not exist');

    if (missingPipelineStepColumn) {
      await admin
        .from("applications")
        .update({
          current_stage: "OFFER",
        })
        .eq("id", applicationId);
    } else if (updateError) {
      return NextResponse.json({ error: "Failed to update pipeline stage.", detail: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      finalScore: Number(finalScore.toFixed(3)),
      weights: w,
      stageScores: map,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Final scoring failed.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
