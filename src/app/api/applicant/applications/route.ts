import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { requireAuthUser } from "@/server/auth/session";

export async function GET() {
  try {
    const user = await requireAuthUser();
    const admin = createSupabaseAdmin();

    let query = admin
      .from("applications")
      .select("id, job_id, pipeline_step, current_stage, applied_at")
      .eq("user_id", user.id)
      .order("applied_at", { ascending: false });
    let { data: applicationRows, error } = await query;

    const missingPipelineStepColumn =
      (error?.message || "").includes("Could not find the 'pipeline_step' column") ||
      (error?.message || "").includes("column applications.pipeline_step does not exist") ||
      (error?.message || "").includes('column "pipeline_step" does not exist');
    if (missingPipelineStepColumn) {
      const fallback = await admin
        .from("applications")
        .select("id, job_id, current_stage, applied_at")
        .eq("user_id", user.id)
        .order("applied_at", { ascending: false });
      applicationRows = fallback.data as typeof applicationRows;
      error = fallback.error;
    }

    const missingCurrentStageColumn =
      (error?.message || "").includes("Could not find the 'current_stage' column");
    if (missingCurrentStageColumn) {
      const fallback = await admin
        .from("applications")
        .select("id, job_id, applied_at")
        .eq("user_id", user.id)
        .order("applied_at", { ascending: false });
      applicationRows = fallback.data as typeof applicationRows;
      error = fallback.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type AppRow = {
      id: string;
      job_id: string;
      pipeline_step?: string | null;
      current_stage?: string | null;
      applied_at?: string | null;
    };
    const rows = ((applicationRows || []) as AppRow[]).map((r) => ({
      ...r,
      pipeline_step: r.pipeline_step || r.current_stage || "APPLIED",
    }));
    const jobIds = Array.from(new Set(rows.map((r) => r.job_id).filter(Boolean)));

    let titleByJobId = new Map<string, string>();
    if (jobIds.length > 0) {
      const { data: jobs, error: jobsError } = await admin
        .from("jobs")
        .select("id, title")
        .in("id", jobIds);
      if (!jobsError) {
        titleByJobId = new Map((jobs || []).map((j) => [j.id as string, (j.title as string) || "Untitled role"]));
      }
    }

    const applications = rows.map((row) => ({
      ...row,
      jobs: { title: titleByJobId.get(row.job_id) || "Untitled role" },
    }));

    return NextResponse.json({ applications });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load applications.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
