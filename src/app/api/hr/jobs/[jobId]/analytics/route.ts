import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { requireAuthUser, requireHr } from "@/server/auth/session";

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const user = await requireAuthUser();
    requireHr(user);
    const { jobId } = await context.params;

    const admin = createSupabaseAdmin();
    const { data: jobMeta } = await admin
      .from("jobs")
      .select(
        "id, title, submission_deadline_at, shortlist_status, shortlist_error, shortlist_ran_at, shortlist_selected_count, shortlist_total_submissions"
      )
      .eq("id", jobId)
      .maybeSingle();
    let { data: apps, error: appsError } = await admin
      .from("applications")
      .select("id, user_id, pipeline_step")
      .eq("job_id", jobId);

    const missingPipelineStepColumn =
      (appsError?.message || "").includes("Could not find the 'pipeline_step' column") ||
      (appsError?.message || "").includes("column applications.pipeline_step does not exist") ||
      (appsError?.message || "").includes('column "pipeline_step" does not exist');
    if (missingPipelineStepColumn) {
      const fallback = await admin
        .from("applications")
        .select("id, user_id, current_stage")
        .eq("job_id", jobId);
      apps = ((fallback.data || []) as Array<{ id: string; user_id: string; current_stage?: string | null }>).map(
        (a) => ({
          id: a.id,
          user_id: a.user_id,
          pipeline_step: a.current_stage || "APPLIED",
        })
      );
      appsError = fallback.error;
    }

    if (appsError) {
      return NextResponse.json({ error: appsError.message }, { status: 500 });
    }

    if (!apps?.length) {
      return NextResponse.json({
        jobId,
        job: jobMeta
          ? {
              id: jobMeta.id,
              title: jobMeta.title,
              submissionDeadlineAt: (jobMeta as { submission_deadline_at?: string | null }).submission_deadline_at || null,
              shortlistStatus: (jobMeta as { shortlist_status?: string | null }).shortlist_status || null,
              shortlistError: (jobMeta as { shortlist_error?: string | null }).shortlist_error || null,
              shortlistRanAt: (jobMeta as { shortlist_ran_at?: string | null }).shortlist_ran_at || null,
              shortlistSelectedCount: Number(
                (jobMeta as { shortlist_selected_count?: number | null }).shortlist_selected_count || 0
              ),
              shortlistTotalSubmissions: Number(
                (jobMeta as { shortlist_total_submissions?: number | null }).shortlist_total_submissions || 0
              ),
            }
          : null,
        candidates: [],
      });
    }

    const userIds = [...new Set((apps || []).map((a) => a.user_id))];
    const { data: users } = await admin.from("users").select("id, email").in("id", userIds);

    const emailByUser = Object.fromEntries((users || []).map((u) => [u.id, u.email]));

    const applicationIds = (apps || []).map((a) => a.id);
    const { data: rankings } = await admin
      .from("rankings")
      .select("application_id, final_score, rank_position")
      .in("application_id", applicationIds);

    const { data: stages } = await admin
      .from("stage_results")
      .select("application_id, stage_type, score, passed")
      .in("application_id", applicationIds);

    const rankByApp = Object.fromEntries((rankings || []).map((r) => [r.application_id, r]));
    const stagesByApp: Record<string, typeof stages> = {};
    for (const s of stages || []) {
      const aid = s.application_id as string;
      if (!stagesByApp[aid]) stagesByApp[aid] = [];
      stagesByApp[aid].push(s);
    }

    const candidates = (apps || []).map((a) => ({
      applicationId: a.id,
      email: emailByUser[a.user_id as string] || "unknown",
      pipelineStep: (a.pipeline_step as string) || "APPLIED",
      finalScore: rankByApp[a.id]?.final_score ?? null,
      rankPosition: rankByApp[a.id]?.rank_position ?? null,
      stages: stagesByApp[a.id] || [],
      atsScore:
        (stagesByApp[a.id] || []).find((s) => String(s.stage_type).toUpperCase() === "ATS")?.score ?? null,
    }));

    // Fallback ranking when rank_position is not populated yet.
    // Enforce ATS-first ordering for shortlist transparency.
    const scoreOf = (c: (typeof candidates)[number]) => {
      if (c.finalScore != null) return Number(c.finalScore);
      return Number(c.atsScore ?? 0);
    };
    const missingRank = candidates.every((c) => c.rankPosition == null);
    if (missingRank) {
      const sorted = [...candidates].sort((a, b) => scoreOf(b) - scoreOf(a));
      const rankMap = new Map(sorted.map((c, idx) => [c.applicationId, idx + 1]));
      for (const c of candidates) {
        c.rankPosition = rankMap.get(c.applicationId) || null;
      }
    }

    return NextResponse.json({
      jobId,
      job: jobMeta
        ? {
            id: jobMeta.id,
            title: jobMeta.title,
            submissionDeadlineAt: (jobMeta as { submission_deadline_at?: string | null }).submission_deadline_at || null,
            shortlistStatus: (jobMeta as { shortlist_status?: string | null }).shortlist_status || null,
            shortlistError: (jobMeta as { shortlist_error?: string | null }).shortlist_error || null,
            shortlistRanAt: (jobMeta as { shortlist_ran_at?: string | null }).shortlist_ran_at || null,
            shortlistSelectedCount: Number(
              (jobMeta as { shortlist_selected_count?: number | null }).shortlist_selected_count || 0
            ),
            shortlistTotalSubmissions: Number(
              (jobMeta as { shortlist_total_submissions?: number | null }).shortlist_total_submissions || 0
            ),
          }
        : null,
      candidates,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load analytics.";
    const status =
      message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
