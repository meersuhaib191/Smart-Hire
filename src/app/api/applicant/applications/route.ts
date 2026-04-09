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
      pipeline_step: mapCurrentStageToPipeline(r.pipeline_step || r.current_stage),
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

    let controlsByApp = new Map<
      string,
      { stage_type?: string | null; deadline_at?: string | null; directives?: string | null }
    >();
    if (rows.length) {
      const appIds = rows.map((r) => r.id);
      const { data: controls, error: controlsError } = await admin
        .from("application_round_controls")
        .select("application_id, stage_type, deadline_at, directives, updated_at")
        .in("application_id", appIds)
        .order("updated_at", { ascending: false });
      if (!controlsError) {
        controlsByApp = new Map(
          (controls || []).map((c) => [
            String(c.application_id),
            {
              stage_type: String(c.stage_type || "").toUpperCase(),
              deadline_at: c.deadline_at || null,
              directives: c.directives || null,
            },
          ])
        );
      } else if (!isMissingRoundControlsTable(controlsError.message)) {
        return NextResponse.json({ error: controlsError.message }, { status: 500 });
      }
    }

    const stageActionRoute = (appId: string, step: string) => {
      const s = String(step || "").toUpperCase();
      if (s === "MCQ") return `/dashboard/applicant/applications/${appId}/mcq`;
      if (s === "CODING" || s === "INTERVIEW") return `/dashboard/applicant/applications/${appId}`;
      return `/dashboard/applicant/applications/${appId}`;
    };

    const enriched = applications.map((row) => {
      const control = controlsByApp.get(row.id);
      const step = String(row.pipeline_step || "").toUpperCase();
      const matchesStep = control?.stage_type && String(control.stage_type).toUpperCase() === step;
      const deadlineAt = matchesStep ? control?.deadline_at || null : null;
      const directives = matchesStep ? control?.directives || null : null;
      const deadlineExpired = Boolean(deadlineAt) && new Date(String(deadlineAt)).getTime() < Date.now();
      const canProceed = ["MCQ", "CODING", "INTERVIEW"].includes(step) && !deadlineExpired;
      return {
        ...row,
        roundDeadlineAt: deadlineAt,
        roundDirectives: directives,
        canProceedRound: canProceed,
        proceedRoute: canProceed ? stageActionRoute(row.id, step) : null,
      };
    });

    return NextResponse.json({ applications: enriched });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load applications.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
