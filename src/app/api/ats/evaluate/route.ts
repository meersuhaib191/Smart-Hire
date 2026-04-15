import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { AtsResult } from "@/server/ats/types";
import { syncPipelineStep } from "@/server/pipeline/syncPipeline";

const ATS_PASS_SCORE = Number(process.env.ATS_PASS_SCORE || 60);
const ATS_ENGINE_BASE_URL = String(process.env.ATS_ENGINE_BASE_URL || "").replace(/\/+$/, "");

const asScore = (value: number) => Math.max(0, Math.min(100, value));

async function scoreWithAtsEngine(file: File, jobText: string): Promise<{ score100: number; raw?: unknown } | null> {
  if (!ATS_ENGINE_BASE_URL) return null;
  try {
    const form = new FormData();
    form.append("resume", file);
    form.append("job_text", jobText);
    const response = await fetch(`${ATS_ENGINE_BASE_URL}/score`, {
      method: "POST",
      body: form,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { score?: number };
    const score01 = Number(payload?.score ?? 0);
    return { score100: asScore(score01 * 100), raw: payload };
  } catch {
    return null;
  }
}

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

    if (!ATS_ENGINE_BASE_URL) {
      return NextResponse.json({ error: "ATS_ENGINE_BASE_URL is not configured." }, { status: 500 });
    }

    const fileForEngine =
      resumeFile ||
      (resumeTextInput.trim()
        ? new File([resumeTextInput.trim()], "resume.txt", { type: "text/plain" })
        : null);
    if (!fileForEngine) {
      return NextResponse.json({ error: "Could not prepare resume input for ATS engine." }, { status: 400 });
    }

    const atsEngineResult = await scoreWithAtsEngine(fileForEngine, jobSemanticText);
    if (!atsEngineResult) {
      return NextResponse.json({ error: "ATS engine request failed." }, { status: 502 });
    }
    const atsScore = atsEngineResult.score100;

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
            source: "ats_engine",
            ats_engine: atsEngineResult.raw,
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
          source: "ats_engine",
          ats_engine: atsEngineResult.raw,
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
      similarity: Number((atsScore / 100).toFixed(4)),
      extractedTextLength: resumeTextInput.trim().length || 0,
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
