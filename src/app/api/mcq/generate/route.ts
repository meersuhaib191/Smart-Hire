import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { generateMcqs } from "@/server/mcq/generator";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { jobId?: string; count?: number };
    const jobId = body.jobId || "";
    const count = Math.max(1, Math.min(20, body.count || 10));

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required." }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, job_skills(skill_name)")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found.", detail: jobError?.message }, { status: 404 });
    }

    const skills =
      job.job_skills?.map((s: { skill_name: string }) => s.skill_name).filter(Boolean) || [];
    const mcqs = await generateMcqs(skills, count);

    const rows = mcqs.map((q) => ({
      job_id: jobId,
      question_text: q.questionText,
      options: q.options,
      correct_option: q.correctOption,
      skill_tag: q.skillTag || null,
      difficulty: q.difficulty || "medium",
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("mcq_questions")
      .insert(rows)
      .select("id, question_text, options, skill_tag, difficulty");

    if (insertError) {
      return NextResponse.json({ error: "Failed to store MCQs.", detail: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, questions: inserted || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate MCQs.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
