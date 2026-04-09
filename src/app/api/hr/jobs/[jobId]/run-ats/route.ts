import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { requireAuthUser, requireHr } from "@/server/auth/session";
import { createEmbedding, vectorToSql } from "@/server/ats/embedding";
import { syncPipelineStep } from "@/server/pipeline/syncPipeline";
import { extractResumeText } from "@/server/ats/parseResume";
import { createUserNotification } from "@/server/notifications/createNotification";

const ATS_PASS_SCORE = Number(process.env.ATS_PASS_SCORE || 60);

const asScore = (similarity: number) => Math.max(0, Math.min(100, similarity * 100));

export async function POST(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const user = await requireAuthUser();
    requireHr(user);
    const { jobId } = await context.params;
    const admin = createSupabaseAdmin();

    const { data: job, error: jobError } = await admin
      .from("jobs")
      .select("id, title, description, job_skills(skill_name)")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found.", detail: jobError?.message }, { status: 404 });
    }

    const skillText =
      job.job_skills?.map((s: { skill_name: string }) => s.skill_name).filter(Boolean).join(", ") || "";
    const jobSemanticText = `${job.description}\nRequired skills: ${skillText}`.trim();
    const jobEmbedding = await createEmbedding(jobSemanticText);
    const jobVectorSql = vectorToSql(jobEmbedding);

    const { data: applications, error: appsError } = await admin
      .from("applications")
      .select("id, user_id, resume_snapshot_url")
      .eq("job_id", jobId);
    if (appsError) {
      return NextResponse.json({ error: appsError.message }, { status: 500 });
    }

    let screened = 0;
    let skipped = 0;
    let failed = 0;

    for (const app of applications || []) {
      const resumePath = String(app.resume_snapshot_url || "").trim();
      if (!resumePath) {
        skipped += 1;
        continue;
      }

      try {
        const { data: fileData, error: downloadError } = await admin.storage.from("resumes").download(resumePath);
        if (downloadError || !fileData) {
          skipped += 1;
          continue;
        }

        const arrayBuffer = await fileData.arrayBuffer();
        const file = new File([arrayBuffer], "resume.pdf", { type: "application/pdf" });
        const resumeText = await extractResumeText(file);
        if (!resumeText.trim()) {
          skipped += 1;
          continue;
        }

        const resumeEmbedding = await createEmbedding(resumeText);
        const resumeVectorSql = vectorToSql(resumeEmbedding);

        const { error: resumeEmbError } = await admin.from("resume_embeddings").upsert(
          {
            application_id: app.id,
            embedding: resumeVectorSql,
          },
          { onConflict: "application_id" }
        );
        if (resumeEmbError) {
          failed += 1;
          continue;
        }

        const { error: jobEmbError } = await admin.from("job_embeddings").upsert(
          {
            job_id: jobId,
            embedding: jobVectorSql,
          },
          { onConflict: "job_id" }
        );
        if (jobEmbError) {
          failed += 1;
          continue;
        }

        const { data: scoreData, error: scoreError } = await admin.rpc("compute_ats_similarity", {
          resume_embedding: resumeVectorSql,
          job_embedding: jobVectorSql,
        });

        const similarity = scoreError ? 0 : Number(scoreData ?? 0);
        const atsScore = asScore(similarity);

        const { data: existingStage } = await admin
          .from("stage_results")
          .select("id")
          .eq("application_id", app.id)
          .eq("stage_type", "ATS")
          .maybeSingle();

        if (existingStage?.id) {
          await admin
            .from("stage_results")
            .update({
              score: atsScore,
              breakdown: { similarity, extracted_text_length: resumeText.length },
              passed: atsScore >= ATS_PASS_SCORE,
              evaluated_at: new Date().toISOString(),
            })
            .eq("id", existingStage.id);
        } else {
          await admin.from("stage_results").insert({
            application_id: app.id,
            stage_type: "ATS",
            score: atsScore,
            breakdown: { similarity, extracted_text_length: resumeText.length },
            passed: atsScore >= ATS_PASS_SCORE,
          });
        }

        await syncPipelineStep(app.id);
        const passedAts = atsScore >= ATS_PASS_SCORE;
        await createUserNotification(admin, {
          userId: String(app.user_id),
          applicationId: app.id,
          title: passedAts ? "ATS screening cleared" : "ATS screening result",
          message: passedAts
            ? `Great news! You cleared ATS for ${String(job.title || "this role")} with score ${atsScore.toFixed(1)}. You can proceed to MCQ when unlocked by HR.`
            : `Your ATS screening score for ${String(job.title || "this role")} is ${atsScore.toFixed(1)}. HR will review and update next steps.`,
          route: `/dashboard/applicant/applications/${app.id}`,
          type: "info",
        });
        screened += 1;
      } catch {
        failed += 1;
      }
    }

    return NextResponse.json({
      success: true,
      jobId,
      screened,
      skipped,
      failed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run ATS screening.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

