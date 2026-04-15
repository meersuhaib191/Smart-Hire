import { NextResponse } from "next/server";

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

async function checkAtsEngine(baseUrl: string): Promise<{ reachable: boolean; detail?: string }> {
  if (!baseUrl) return { reachable: false, detail: "ATS_ENGINE_BASE_URL is not configured." };
  const normalized = baseUrl.replace(/\/+$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`${normalized}/health`, {
      method: "GET",
      signal: controller.signal,
    });
    if (!response.ok) {
      return { reachable: false, detail: `ATS engine health returned ${response.status}.` };
    }
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { reachable: true, detail: JSON.stringify(payload) };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown ATS engine connectivity error.";
    return { reachable: false, detail: message };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const baseUrl = String(process.env.ATS_ENGINE_BASE_URL || "").replace(/\/+$/, "");
  const check = await checkAtsEngine(baseUrl);

  return NextResponse.json({
    success: true,
    configured: Boolean(baseUrl),
    baseUrl: baseUrl || null,
    reachable: check.reachable,
    detail: check.detail || null,
  });
}

