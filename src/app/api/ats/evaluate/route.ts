import { NextResponse } from "next/server";
import { createEmbedding, vectorToSql } from "@/server/ats/embedding";
import { extractResumeText } from "@/server/ats/parseResume";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { AtsResult } from "@/server/ats/types";
import { syncPipelineStep } from "@/server/pipeline/syncPipeline";

const ATS_PASS_SCORE = Number(process.env.ATS_PASS_SCORE || 60);

const asScore = (similarity: number) => Math.max(0, Math.min(100, similarity * 100));

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const applicationId = String(formData.get("application_id") || "");
    const jobId = String(formData.get("job_id") || "");
    const resumeFile = formData.get("resume") as File | null;
    const resumeTextInput = String(formData.get("resume_text") || "");

    if (!applicationId || !jobId || (!resumeFile && !resumeTextInput.trim())) {
      return NextResponse.json(
        { error: "application_id, job_id and either resume file or resume_text are required." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, description, job_skills(skill_name)")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found.", detail: jobError?.message }, { status: 404 });
    }

    const skillText =
      job.job_skills?.map((s: { skill_name: string }) => s.skill_name).filter(Boolean).join(", ") || "";
    const jobSemanticText = `${job.description}\nRequired skills: ${skillText}`.trim();

    const resumeText = resumeTextInput.trim() || (resumeFile ? await extractResumeText(resumeFile) : "");
    if (!resumeText) {
      return NextResponse.json({ error: "Could not extract resume text." }, { status: 400 });
    }

    const [resumeEmbedding, jobEmbedding] = await Promise.all([
      createEmbedding(resumeText),
      createEmbedding(jobSemanticText),
    ]);

    const resumeVectorSql = vectorToSql(resumeEmbedding);
    const jobVectorSql = vectorToSql(jobEmbedding);

    const { error: resumeEmbError } = await supabase.from("resume_embeddings").upsert(
      {
        application_id: applicationId,
        embedding: resumeVectorSql,
      },
      { onConflict: "application_id" }
    );
    if (resumeEmbError) {
      return NextResponse.json({ error: "Failed to store resume embedding.", detail: resumeEmbError.message }, { status: 500 });
    }

    const { error: jobEmbError } = await supabase.from("job_embeddings").upsert(
      {
        job_id: jobId,
        embedding: jobVectorSql,
      },
      { onConflict: "job_id" }
    );
    if (jobEmbError) {
      return NextResponse.json({ error: "Failed to store job embedding.", detail: jobEmbError.message }, { status: 500 });
    }

    const { data: scoreData, error: scoreError } = await supabase.rpc("compute_ats_similarity", {
      resume_embedding: resumeVectorSql,
      job_embedding: jobVectorSql,
    });

    const similarity = scoreError ? 0 : Number(scoreData ?? 0);
    const atsScore = asScore(similarity);

    const { data: existingStage } = await supabase
      .from("stage_results")
      .select("id")
      .eq("application_id", applicationId)
      .eq("stage_type", "ATS")
      .maybeSingle();

    if (existingStage?.id) {
      const { error: updateError } = await supabase
        .from("stage_results")
        .update({
          score: atsScore,
          breakdown: {
            similarity,
            extracted_text_length: resumeText.length,
          },
          passed: atsScore >= ATS_PASS_SCORE,
          evaluated_at: new Date().toISOString(),
        })
        .eq("id", existingStage.id);
      if (updateError) {
        return NextResponse.json({ error: "Failed to update ATS stage result.", detail: updateError.message }, { status: 500 });
      }
    } else {
      const { error: insertError } = await supabase.from("stage_results").insert({
        application_id: applicationId,
        stage_type: "ATS",
        score: atsScore,
        breakdown: {
          similarity,
          extracted_text_length: resumeText.length,
        },
        passed: atsScore >= ATS_PASS_SCORE,
      });
      if (insertError) {
        return NextResponse.json({ error: "Failed to save ATS stage result.", detail: insertError.message }, { status: 500 });
      }
    }

    const result: AtsResult = {
      applicationId,
      jobId,
      atsScore: Number(atsScore.toFixed(2)),
      similarity: Number(similarity.toFixed(4)),
      extractedTextLength: resumeText.length,
    };

    try {
      await syncPipelineStep(applicationId);
    } catch (e) {
      console.error("syncPipelineStep (ATS):", e);
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ATS evaluation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
