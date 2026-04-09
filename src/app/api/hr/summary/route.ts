import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { requireAuthUser, requireHr } from "@/server/auth/session";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isMissingCreatedByColumn = (message?: string) =>
  (message || "").includes("Could not find the 'created_by_user_id' column") ||
  (message || "").includes("column jobs.created_by_user_id does not exist") ||
  (message || "").includes('column "created_by_user_id" does not exist');

async function findCompanyIdByHint(
  admin: ReturnType<typeof createSupabaseAdmin>,
  user: Awaited<ReturnType<typeof requireAuthUser>>
) {
  const metadataCompany = String(user.user_metadata?.company || "").trim();
  const profileCompany = String(
    (user.user_metadata?.profile as { companyName?: string } | undefined)?.companyName || ""
  ).trim();
  const candidate = metadataCompany || profileCompany;
  if (!candidate) return "";

  if (UUID_REGEX.test(candidate)) {
    const { data, error } = await admin.from("companies").select("id").eq("id", candidate).maybeSingle();
    if (error) return "";
    return (data?.id as string) || "";
  }

  const { data, error } = await admin
    .from("companies")
    .select("id")
    .eq("name", candidate)
    .maybeSingle();
  if (error) return "";
  return (data?.id as string) || "";
}

export async function GET() {
  try {
    const user = await requireAuthUser();
    requireHr(user);

    const admin = createSupabaseAdmin();
    let { data: hrJobs, error: hrJobsError } = await admin
      .from("jobs")
      .select("id")
      .eq("created_by_user_id", user.id)
      .limit(5000);

    if (isMissingCreatedByColumn(hrJobsError?.message)) {
      const companyId = await findCompanyIdByHint(admin, user);
      if (companyId) {
        const fallback = await admin.from("jobs").select("id").eq("company_id", companyId).limit(5000);
        hrJobs = fallback.data;
        hrJobsError = fallback.error;
      } else {
        hrJobs = [];
        hrJobsError = null;
      }
    }

    if (hrJobsError) {
      return NextResponse.json({ error: hrJobsError.message }, { status: 500 });
    }

    const jobIds = (hrJobs || []).map((j) => j.id as string);
    const jobCount = jobIds.length;

    if (!jobIds.length) {
      return NextResponse.json({
        activeJobs: 0,
        totalApplicants: 0,
        interviewingCount: 0,
        completedCount: 0,
        completionRate: 0,
        funnel: [
          { name: "ATS", value: 0 },
          { name: "MCQ", value: 0 },
          { name: "CODING", value: 0 },
          { name: "INTERVIEW", value: 0 },
          { name: "COMPLETE", value: 0 },
        ],
        dailyApplicants: Array.from({ length: 7 }).map((_, idx) => {
          const date = new Date();
          date.setDate(date.getDate() - (6 - idx));
          return {
            name: date.toLocaleString("en-US", { weekday: "short" }),
            applicants: 0,
          };
        }),
      });
    }

    const { count: applicantCount } = await admin
      .from("applications")
      .select("*", { count: "exact", head: true })
      .in("job_id", jobIds);

    let { data: appRows, error: appRowsError } = await admin
      .from("applications")
      .select("pipeline_step, applied_at")
      .in("job_id", jobIds)
      .limit(5000);

    const missingPipelineStepColumn =
      (appRowsError?.message || "").includes("Could not find the 'pipeline_step' column") ||
      (appRowsError?.message || "").includes("column applications.pipeline_step does not exist") ||
      (appRowsError?.message || "").includes('column "pipeline_step" does not exist');
    if (missingPipelineStepColumn) {
      const fallback = await admin
        .from("applications")
        .select("current_stage, applied_at")
        .in("job_id", jobIds)
        .limit(5000);
      appRows = ((fallback.data || []) as Array<{ current_stage?: string | null; applied_at?: string | null }>).map(
        (r) => ({
          pipeline_step: r.current_stage || "APPLIED",
          applied_at: r.applied_at || null,
        })
      ) as typeof appRows;
      appRowsError = fallback.error;
    }
    if (appRowsError) {
      return NextResponse.json({ error: appRowsError.message }, { status: 500 });
    }

    const rows = appRows || [];
    const interviewingCount = rows.filter((r) => r.pipeline_step === "INTERVIEW").length;
    const completedCount = rows.filter((r) => r.pipeline_step === "COMPLETE").length;

    const funnelSeed: Record<string, number> = {
      ATS: 0,
      MCQ: 0,
      CODING: 0,
      INTERVIEW: 0,
      COMPLETE: 0,
    };
    for (const row of rows) {
      const key = String(row.pipeline_step || "ATS").toUpperCase();
      if (funnelSeed[key] != null) {
        funnelSeed[key] += 1;
      }
    }
    const funnel = Object.entries(funnelSeed).map(([name, value]) => ({ name, value }));

    const now = new Date();
    const dailyApplicants = Array.from({ length: 7 }).map((_, idx) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (6 - idx));
      const key = date.toISOString().slice(0, 10);
      return {
        name: date.toLocaleString("en-US", { weekday: "short" }),
        key,
        applicants: 0,
      };
    });
    const dailyMap = Object.fromEntries(dailyApplicants.map((d) => [d.key, d]));
    for (const row of rows) {
      const appliedKey = String(row.applied_at || "").slice(0, 10);
      if (dailyMap[appliedKey]) {
        dailyMap[appliedKey].applicants += 1;
      }
    }

    return NextResponse.json({
      activeJobs: jobCount ?? 0,
      totalApplicants: applicantCount ?? 0,
      interviewingCount,
      completedCount,
      completionRate: applicantCount ? Math.round((completedCount / applicantCount) * 100) : 0,
      funnel,
      dailyApplicants: dailyApplicants.map((d) => ({ name: d.name, applicants: d.applicants })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load summary.";
    const status =
      message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
