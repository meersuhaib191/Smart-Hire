import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { requireAuthUser } from "@/server/auth/session";

export async function GET() {
  try {
    const user = await requireAuthUser();
    const admin = createSupabaseAdmin();

    const { data, error } = await admin
      .from("applications")
      .select("id, job_id, pipeline_step, current_stage, applied_at, jobs(title)")
      .eq("user_id", user.id)
      .order("applied_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ applications: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load applications.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
