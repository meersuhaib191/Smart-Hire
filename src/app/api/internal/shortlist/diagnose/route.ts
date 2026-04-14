import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";

function getExpectedSecret(): string {
  return String(process.env.SHORTLIST_CRON_SECRET || process.env.CRON_SECRET || "");
}

function isAuthorized(request: Request): boolean {
  const expected = getExpectedSecret();
  if (!expected) {
    return process.env.NODE_ENV !== "production";
  }
  const header =
    request.headers.get("x-shortlist-secret") ||
    request.headers.get("x-cron-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  return header === expected;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId") || "";
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: job, error: jobError } = await admin
    .from("jobs")
    .select("id, status, submission_deadline_at, shortlist_status, shortlist_error, shortlist_ran_at")
    .eq("id", jobId)
    .maybeSingle();

  if (jobError || !job) {
    return NextResponse.json({ error: "Job not found.", detail: jobError?.message }, { status: 404 });
  }

  const deadlineIso = String((job as { submission_deadline_at?: string | null }).submission_deadline_at || "");
  const deadlineMs = deadlineIso ? new Date(deadlineIso).getTime() : NaN;
  const deadlinePassed = Number.isFinite(deadlineMs) ? deadlineMs <= now.getTime() : false;

  const status = String((job as { status?: string | null }).status || "");
  const shortlistStatus = String((job as { shortlist_status?: string | null }).shortlist_status || "");

  const eligibleByStatus = status === "PUBLISHED";
  const eligibleByShortlistStatus = ["", "pending", "failed"].includes(shortlistStatus.toLowerCase());
  const eligible = eligibleByStatus && deadlinePassed && eligibleByShortlistStatus;

  const { count: appCount } = await admin
    .from("applications")
    .select("*", { count: "exact", head: true })
    .eq("job_id", jobId);

  return NextResponse.json({
    success: true,
    serverNowIso: nowIso,
    expectedSecretConfigured: Boolean(getExpectedSecret()),
    job: {
      id: job.id,
      status,
      submission_deadline_at: deadlineIso || null,
      shortlist_status: shortlistStatus || null,
      shortlist_error: (job as { shortlist_error?: string | null }).shortlist_error || null,
      shortlist_ran_at: (job as { shortlist_ran_at?: string | null }).shortlist_ran_at || null,
      applicationCount: Number(appCount || 0),
    },
    evaluation: {
      deadlinePassed,
      eligibleByStatus,
      eligibleByShortlistStatus,
      eligibleForSweep: eligible,
    },
  });
}

