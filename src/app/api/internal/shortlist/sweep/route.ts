import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { runDeadlineShortlistForJob } from "@/server/pipeline/shortlist";

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

async function sweep(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const admin = createSupabaseAdmin();
    const now = new Date();
    const nowIso = now.toISOString();
    const expectedSecretConfigured = Boolean(getExpectedSecret());

    // Fetch a wider set for diagnosis: same eligibility except deadline,
    // then we explain which ones were skipped for not passing the deadline yet.
    const { data: candidates, error } = await admin
      .from("jobs")
      .select("id, submission_deadline_at, shortlist_status, status")
      .in("status", ["PUBLISHED", "CLOSED"])
      .or("shortlist_status.in.(pending,failed,running),shortlist_status.is.null")
      .order("submission_deadline_at", { ascending: true })
      .limit(50);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const skipped: Array<Record<string, unknown>> = [];
    const runnable: string[] = [];
    for (const row of candidates || []) {
      const deadlineIso = String((row as { submission_deadline_at?: string | null }).submission_deadline_at || "");
      if (!deadlineIso) {
        skipped.push({
          jobId: (row as { id: string }).id,
          reason: "no_submission_deadline",
          submission_deadline_at: null,
        });
        continue;
      }
      const deadlineMs = deadlineIso ? new Date(deadlineIso).getTime() : NaN;
      const deadlinePassed = Number.isFinite(deadlineMs) ? deadlineMs <= now.getTime() : false;
      if (!deadlinePassed) {
        skipped.push({
          jobId: (row as { id: string }).id,
          reason: "deadline_not_passed",
          submission_deadline_at: deadlineIso || null,
        });
      } else {
        runnable.push(String((row as { id: string }).id));
      }
    }

    const results: Array<Record<string, unknown>> = [];
    for (const jobId of runnable.slice(0, 20)) {
      try {
        const result = await runDeadlineShortlistForJob(admin, jobId);
        results.push(result as unknown as Record<string, unknown>);
      } catch (jobError) {
        results.push({
          jobId,
          error: jobError instanceof Error ? jobError.message : "unknown_error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      serverNowIso: nowIso,
      expectedSecretConfigured,
      candidateJobs: (candidates || []).length,
      runnableJobs: runnable.length,
      skippedJobs: skipped.length,
      skipped: skipped.slice(0, 20),
      processed: results.length,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sweep failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return sweep(request);
}

export async function GET(request: Request) {
  return sweep(request);
}
