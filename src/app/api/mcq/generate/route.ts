import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { generateMcqsFromContext } from "@/server/mcq/generator";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      jobId?: string;
      candidateId?: string;
      companyTier?: "faang" | "startup" | "enterprise" | "general";
      candidatePerformanceScore?: number;
      jobRole?: string;
      experienceLevel?: "fresher" | "junior" | "mid" | "senior";
      seed?: string;
      count?: number;
    };
    const jobId = body.jobId || "";
    const count = Math.max(1, Math.min(20, body.count || 10));

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required." }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, title, description, experience_required, job_skills(skill_name)")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found.", detail: jobError?.message }, { status: 404 });
    }

    const skills =
      job.job_skills?.map((s: { skill_name: string }) => s.skill_name).filter(Boolean) || [];
    const mcqs = await generateMcqsFromContext({
      skills,
      count,
      jobId: job.id,
      jobRole: body.jobRole || String(job.title || ""),
      candidateId: body.candidateId,
      companyTier: body.companyTier || "general",
      candidatePerformanceScore: body.candidatePerformanceScore,
      experienceLevel:
        body.experienceLevel ||
        (Number(job.experience_required || 0) <= 1
          ? "fresher"
          : Number(job.experience_required || 0) <= 3
            ? "junior"
            : Number(job.experience_required || 0) <= 6
              ? "mid"
              : "senior"),
      seed: body.seed || body.candidateId || `${job.id}:${Date.now()}`,
      requireEngine: true,
      jobTitle: String(job.title || ""),
      jobDescription: String(job.description || ""),
      difficultyHint: "challenging",
    });

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
