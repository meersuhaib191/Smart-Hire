import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { runDeadlineShortlistForJob } from "@/server/pipeline/shortlist";

function isAuthorized(request: Request): boolean {
  const expected = String(process.env.SHORTLIST_CRON_SECRET || process.env.CRON_SECRET || "");
  if (!expected) return false;
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
    const nowIso = new Date().toISOString();
    const { data: jobs, error } = await admin
      .from("jobs")
      .select("id")
      .eq("status", "PUBLISHED")
      .lte("submission_deadline_at", nowIso)
      .or("shortlist_status.in.(pending,failed),shortlist_status.is.null")
      .order("submission_deadline_at", { ascending: true })
      .limit(20);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results: Array<Record<string, unknown>> = [];
    for (const row of jobs || []) {
      try {
        const result = await runDeadlineShortlistForJob(admin, String((row as { id: string }).id));
        results.push(result as unknown as Record<string, unknown>);
      } catch (jobError) {
        results.push({
          jobId: (row as { id: string }).id,
          error: jobError instanceof Error ? jobError.message : "unknown_error",
        });
      }
    }

    return NextResponse.json({
      success: true,
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
