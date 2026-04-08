import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("jobs")
      .select("id, title, description, created_at, status, companies(name), job_skills(skill_name)")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    const job = {
      id: data.id as string,
      title: (data.title as string) || "Untitled role",
      description: (data.description as string) || "",
      created_at: data.created_at as string,
      status: data.status as string,
      company: (data.companies as { name?: string | null } | null)?.name || "Company",
      skills: ((data.job_skills as Array<{ skill_name: string }> | null) || [])
        .map((s) => s.skill_name)
        .filter(Boolean),
    };
    return NextResponse.json({ job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load job.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

