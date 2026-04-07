import { NextResponse } from "next/server";
import { syncPipelineStep } from "@/server/pipeline/syncPipeline";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { requireAuthUser, getAppRole } from "@/server/auth/session";

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = (await request.json()) as { applicationId?: string };
    const applicationId = body.applicationId || "";
    if (!applicationId) {
      return NextResponse.json({ error: "applicationId is required." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    const { data: app, error } = await admin
      .from("applications")
      .select("user_id")
      .eq("id", applicationId)
      .single();

    if (error || !app) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }

    const role = getAppRole(user);
    if (role === "applicant" && app.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    await syncPipelineStep(applicationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pipeline sync failed.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
