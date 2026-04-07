import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { requireAuthUser, requireHr } from "@/server/auth/session";

export async function GET() {
  try {
    const user = await requireAuthUser();
    requireHr(user);

    const admin = createSupabaseAdmin();
    const { count: jobCount } = await admin.from("jobs").select("*", { count: "exact", head: true });

    const { count: applicantCount } = await admin
      .from("applications")
      .select("*", { count: "exact", head: true });

    const { data: appRows } = await admin
      .from("applications")
      .select("pipeline_step, applied_at")
      .limit(5000);

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
