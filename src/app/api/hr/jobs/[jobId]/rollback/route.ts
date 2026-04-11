import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { requireAuthUser, requireHr } from "@/server/auth/session";

const missingCreatedByColumn = (message?: string) =>
  (message || "").includes("Could not find the 'created_by_user_id' column") ||
  (message || "").includes("column jobs.created_by_user_id does not exist") ||
  (message || "").includes('column "created_by_user_id" does not exist');

const missingPipelineStepColumn = (message?: string) =>
  (message || "").includes("Could not find the 'pipeline_step' column") ||
  (message || "").includes("column applications.pipeline_step does not exist") ||
  (message || "").includes('column "pipeline_step" does not exist');

const isMissingTable = (message?: string) =>
  (message || "").includes("does not exist") ||
  (message || "").includes("Could not find the table");

async function softDelete(
  admin: ReturnType<typeof createSupabaseAdmin>,
  table: string,
  column: string,
  ids: string[]
) {
  if (!ids.length) return;
  const { error } = await admin.from(table).delete().in(column, ids);
  if (error && !isMissingTable(error.message)) throw new Error(error.message);
}

export async function POST(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const user = await requireAuthUser();
    requireHr(user);
    const { jobId } = await context.params;
    const admin = createSupabaseAdmin();

    const primary = await admin
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .eq("created_by_user_id", user.id)
      .maybeSingle();
    let job = primary.data;
    let jobError = primary.error;
    if (missingCreatedByColumn(jobError?.message)) {
      const fallback = await admin.from("jobs").select("id").eq("id", jobId).maybeSingle();
      job = fallback.data;
      jobError = fallback.error;
    }
    if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 });
    if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });

    const { data: appRows, error: appsError } = await admin
      .from("applications")
      .select("id")
      .eq("job_id", jobId);
    if (appsError) return NextResponse.json({ error: appsError.message }, { status: 500 });
    const applicationIds = (appRows || []).map((a) => String(a.id));

    if (applicationIds.length) {
      const { error: appUpdateError } = await admin
        .from("applications")
        .update({ pipeline_step: "ATS", current_stage: "APPLIED" })
        .in("id", applicationIds);
      if (missingPipelineStepColumn(appUpdateError?.message)) {
        const fallback = await admin
          .from("applications")
          .update({ current_stage: "APPLIED" })
          .in("id", applicationIds);
        if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 });
      } else if (appUpdateError) {
        return NextResponse.json({ error: appUpdateError.message }, { status: 500 });
      }
    }

    await softDelete(admin, "stage_results", "application_id", applicationIds);
    await softDelete(admin, "application_round_controls", "application_id", applicationIds);
    await softDelete(admin, "mcq_attempts", "application_id", applicationIds);
    await softDelete(admin, "coding_submissions", "application_id", applicationIds);
    await softDelete(admin, "interview_submissions", "application_id", applicationIds);

    const { error: rankingError } = await admin.from("rankings").delete().eq("job_id", jobId);
    if (rankingError && !isMissingTable(rankingError.message)) {
      return NextResponse.json({ error: rankingError.message }, { status: 500 });
    }

    const { error: jobUpdateError } = await admin
      .from("jobs")
      .update({
        shortlist_status: "pending",
        shortlist_ran_at: null,
        shortlist_error: null,
        shortlist_selected_count: 0,
        shortlist_total_submissions: 0,
        status: "PUBLISHED",
      })
      .eq("id", jobId);
    if (jobUpdateError && !isMissingTable(jobUpdateError.message)) {
      return NextResponse.json({ error: jobUpdateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      jobId,
      resetApplications: applicationIds.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to rollback ATS.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
