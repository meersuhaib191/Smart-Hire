import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { requireAuthUser, requireHr } from "@/server/auth/session";

type Stage = "ATS" | "MCQ" | "CODING" | "INTERVIEW";

const stageOrder: Stage[] = ["ATS", "MCQ", "CODING", "INTERVIEW"];

const mapCurrentStageToPipeline = (current?: string | null): Stage | "COMPLETE" => {
  const value = String(current || "").toUpperCase();
  if (value === "SCREENING") return "MCQ";
  if (value === "CODING") return "CODING";
  if (value === "INTERVIEW") return "INTERVIEW";
  if (value === "OFFER" || value === "COMPLETE") return "COMPLETE";
  return "ATS";
};

const mapPipelineToCurrentStage = (pipeline: Stage): string => {
  if (pipeline === "ATS") return "APPLIED";
  if (pipeline === "MCQ") return "SCREENING";
  if (pipeline === "CODING") return "CODING";
  return "INTERVIEW";
};

const missingPipelineStepColumn = (message?: string) =>
  (message || "").includes("Could not find the 'pipeline_step' column") ||
  (message || "").includes("column applications.pipeline_step does not exist") ||
  (message || "").includes('column "pipeline_step" does not exist');

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const user = await requireAuthUser();
    requireHr(user);
    const { jobId } = await context.params;

    const body = (await request.json()) as { fromStage?: Stage; topN?: number; rejectRest?: boolean };
    const fromStage = (body.fromStage || "ATS").toUpperCase() as Stage;
    if (!stageOrder.includes(fromStage)) {
      return NextResponse.json({ error: "Invalid fromStage. Use ATS, MCQ, CODING, INTERVIEW." }, { status: 400 });
    }

    const fromIndex = stageOrder.indexOf(fromStage);
    if (fromIndex >= stageOrder.length - 1) {
      return NextResponse.json({ error: "INTERVIEW is the last stage. No further round to advance." }, { status: 400 });
    }

    const nextStage = stageOrder[fromIndex + 1];
    const topN = Math.max(1, Math.min(500, Number(body.topN || 10)));
    const rejectRest = Boolean(body.rejectRest);

    const admin = createSupabaseAdmin();
    let { data: apps, error: appsError } = await admin
      .from("applications")
      .select("id, job_id, user_id, applied_at, pipeline_step, current_stage")
      .eq("job_id", jobId);

    if (missingPipelineStepColumn(appsError?.message)) {
      const fallback = await admin
        .from("applications")
        .select("id, job_id, user_id, applied_at, current_stage")
        .eq("job_id", jobId);
      apps = (fallback.data || []).map((a) => ({
        ...a,
        pipeline_step: mapCurrentStageToPipeline((a as { current_stage?: string | null }).current_stage),
      })) as typeof apps;
      appsError = fallback.error;
    }

    if (appsError) {
      return NextResponse.json({ error: appsError.message }, { status: 500 });
    }

    const rows = (apps || []) as Array<{
      id: string;
      job_id: string;
      user_id: string;
      applied_at?: string | null;
      pipeline_step?: string | null;
      current_stage?: string | null;
    }>;

    const candidatesAtStage = rows.filter((r) => {
      const pipeline = String(r.pipeline_step || mapCurrentStageToPipeline(r.current_stage)).toUpperCase();
      return pipeline === fromStage;
    });

    if (!candidatesAtStage.length) {
      return NextResponse.json({
        success: true,
        message: `No candidates currently in ${fromStage}.`,
        advanced: 0,
        rejected: 0,
      });
    }

    const appIds = candidatesAtStage.map((c) => c.id);
    const { data: stageScores } = await admin
      .from("stage_results")
      .select("application_id, stage_type, score")
      .in("application_id", appIds);

    const scoreByApp = new Map<string, number>();
    for (const c of candidatesAtStage) scoreByApp.set(c.id, 0);
    for (const row of stageScores || []) {
      const stageType = String(row.stage_type || "").toUpperCase();
      if (stageType !== fromStage) continue;
      scoreByApp.set(String(row.application_id), Number(row.score || 0));
    }

    const ranked = [...candidatesAtStage].sort((a, b) => {
      const diff = (scoreByApp.get(b.id) || 0) - (scoreByApp.get(a.id) || 0);
      if (Math.abs(diff) > 0.0001) return diff;
      return new Date(a.applied_at || 0).getTime() - new Date(b.applied_at || 0).getTime();
    });

    const selected = ranked.slice(0, topN);
    const nonSelected = ranked.slice(topN);
    const selectedIds = selected.map((r) => r.id);
    const rejectedIds = rejectRest ? nonSelected.map((r) => r.id) : [];

    if (selectedIds.length) {
      const updatePayload = {
        pipeline_step: nextStage,
        current_stage: mapPipelineToCurrentStage(nextStage),
      };
      const { error: updateError } = await admin
        .from("applications")
        .update(updatePayload)
        .in("id", selectedIds);

      if (missingPipelineStepColumn(updateError?.message)) {
        const { error: fallbackError } = await admin
          .from("applications")
          .update({ current_stage: mapPipelineToCurrentStage(nextStage) })
          .in("id", selectedIds);
        if (fallbackError) {
          return NextResponse.json({ error: fallbackError.message }, { status: 500 });
        }
      } else if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    if (rejectedIds.length) {
      const { error: rejectError } = await admin
        .from("applications")
        .update({ current_stage: "REJECTED" })
        .in("id", rejectedIds);
      if (rejectError) {
        return NextResponse.json({ error: rejectError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      fromStage,
      nextStage,
      advanced: selectedIds.length,
      rejected: rejectedIds.length,
      selectedApplicationIds: selectedIds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to advance candidates.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

