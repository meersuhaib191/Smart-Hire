import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";

export async function GET() {
  try {
    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("jobs")
      .select("id, title, description, created_at, status, submission_deadline_at, companies(name), job_skills(skill_name)")
      .eq("status", "PUBLISHED")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type JobRow = {
      id: string;
      title: string;
      description: string;
      created_at: string;
      submission_deadline_at?: string | null;
      companies?: { name?: string | null } | null;
      job_skills?: Array<{ skill_name: string }> | null;
    };

    const jobs = ((data || []) as JobRow[]).map((job) => ({
      id: job.id as string,
      title: job.title || "Untitled job",
      description: job.description || "",
      created_at: job.created_at,
      submission_deadline_at: job.submission_deadline_at || null,
      company: job.companies?.name || "Company",
      skills: (job.job_skills || []).map((s: { skill_name: string }) => s.skill_name).filter(Boolean),
    }));

    return NextResponse.json({ jobs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load public jobs.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
