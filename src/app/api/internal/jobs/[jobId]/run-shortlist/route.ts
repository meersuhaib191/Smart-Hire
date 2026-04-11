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

async function runForJob(request: Request, context: { params: Promise<{ jobId: string }> }) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const { jobId } = await context.params;
    const admin = createSupabaseAdmin();
    const result = await runDeadlineShortlistForJob(admin, jobId);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shortlist run failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  return runForJob(request, context);
}

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  return runForJob(request, context);
}
