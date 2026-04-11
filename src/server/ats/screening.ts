import { createSupabaseAdmin } from "@/server/supabase/admin";
import { createEmbedding, vectorToSql } from "@/server/ats/embedding";
import { extractResumeText } from "@/server/ats/parseResume";
import { createUserNotification } from "@/server/notifications/createNotification";

const DEFAULT_ATS_PASS_SCORE = Number(process.env.ATS_PASS_SCORE || 60);
const ATS_ENGINE_BASE_URL = String(process.env.ATS_ENGINE_BASE_URL || "").replace(/\/+$/, "");

const asScore = (value: number) => Math.max(0, Math.min(100, value));

type ApplicationRow = {
  id: string;
  user_id: string;
  resume_snapshot_url: string | null;
};

type JobRow = {
  id: string;
  title: string;
  description: string;
  job_skills?: Array<{ skill_name: string }> | null;
};

type AtsScreeningOptions = {
  admin: ReturnType<typeof createSupabaseAdmin>;
  jobId: string;
  notifyApplicants?: boolean;
  passScore?: number;
};

type AtsScreeningResult = {
  screened: number;
  skipped: number;
  failed: number;
  scoresByApplicationId: Record<string, number>;
};

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

async function upsertAtsStageResult(
  admin: ReturnType<typeof createSupabaseAdmin>,
  applicationId: string,
  atsScore: number,
  passed: boolean,
  breakdown: Record<string, unknown>
) {
  const { data: existingStage } = await admin
    .from("stage_results")
    .select("id")
    .eq("application_id", applicationId)
    .eq("stage_type", "ATS")
    .maybeSingle();

  if (existingStage?.id) {
    await admin
      .from("stage_results")
      .update({
        score: atsScore,
        breakdown,
        passed,
        evaluated_at: new Date().toISOString(),
      })
      .eq("id", existingStage.id);
    return;
  }

  await admin.from("stage_results").insert({
    application_id: applicationId,
    stage_type: "ATS",
    score: atsScore,
    breakdown,
    passed,
  });
}

export async function runAtsScreeningForJob(options: AtsScreeningOptions): Promise<AtsScreeningResult> {
  const admin = options.admin;
  const notifyApplicants = Boolean(options.notifyApplicants);
  const passScore = Number.isFinite(options.passScore) ? Number(options.passScore) : DEFAULT_ATS_PASS_SCORE;

  const { data: job, error: jobError } = await admin
    .from("jobs")
    .select("id, title, description, job_skills(skill_name)")
    .eq("id", options.jobId)
    .single();
  if (jobError || !job) {
    throw new Error(jobError?.message || "Job not found.");
  }

  const typedJob = job as JobRow;
  const skillText =
    (typedJob.job_skills || [])
      .map((s) => s.skill_name)
      .filter(Boolean)
      .join(", ") || "";
  const jobSemanticText = `${typedJob.description}\nRequired skills: ${skillText}`.trim();

  // Keep pgvector embeddings in sync for existing analytics/RPC usage.
  const jobEmbedding = await createEmbedding(jobSemanticText);
  const jobVectorSql = vectorToSql(jobEmbedding);
  await admin.from("job_embeddings").upsert(
    {
      job_id: options.jobId,
      embedding: jobVectorSql,
    },
    { onConflict: "job_id" }
  );

  const { data: applications, error: appsError } = await admin
    .from("applications")
    .select("id, user_id, resume_snapshot_url")
    .eq("job_id", options.jobId);
  if (appsError) throw new Error(appsError.message);

  let screened = 0;
  let skipped = 0;
  let failed = 0;
  const scoresByApplicationId: Record<string, number> = {};

  for (const row of (applications || []) as ApplicationRow[]) {
    const resumePath = String(row.resume_snapshot_url || "").trim();
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
      const contentType = fileData.type || "application/pdf";
      const file = new File([arrayBuffer], "resume.pdf", { type: contentType });

      let atsScore = 0;
      let similarity = 0;
      let breakdown: Record<string, unknown> = {};

      // Prefer ATS engine when configured; fallback to existing embedding similarity path.
      const atsEngineResult = await scoreWithAtsEngine(file, jobSemanticText);
      if (atsEngineResult) {
        atsScore = atsEngineResult.score100;
        similarity = atsScore / 100;
        breakdown = {
          source: "ats_engine",
          ats_engine: atsEngineResult.raw,
        };
      } else {
        const resumeText = await extractResumeText(file);
        if (!resumeText.trim()) {
          skipped += 1;
          continue;
        }
        const resumeEmbedding = await createEmbedding(resumeText);
        const resumeVectorSql = vectorToSql(resumeEmbedding);
        await admin.from("resume_embeddings").upsert(
          {
            application_id: row.id,
            embedding: resumeVectorSql,
          },
          { onConflict: "application_id" }
        );
        const { data: scoreData, error: scoreError } = await admin.rpc("compute_ats_similarity", {
          resume_embedding: resumeVectorSql,
          job_embedding: jobVectorSql,
        });
        similarity = scoreError ? 0 : Number(scoreData ?? 0);
        atsScore = asScore(similarity * 100);
        breakdown = {
          source: "pgvector_similarity",
          similarity,
          extracted_text_length: resumeText.length,
        };
      }

      const passed = atsScore >= passScore;
      await upsertAtsStageResult(admin, row.id, atsScore, passed, breakdown);
      scoresByApplicationId[row.id] = atsScore;

      if (notifyApplicants) {
        await createUserNotification(admin, {
          userId: String(row.user_id),
          applicationId: row.id,
          title: passed ? "ATS screening completed" : "ATS screening completed",
          message: passed
            ? `Your ATS screening score for ${typedJob.title} is ${atsScore.toFixed(
                1
              )}. HR will shortlist top candidates after the deadline.`
            : `Your ATS screening score for ${typedJob.title} is ${atsScore.toFixed(
                1
              )}. HR will shortlist top candidates after the deadline.`,
          route: `/dashboard/applicant/applications/${row.id}`,
          type: "info",
        });
      }

      screened += 1;
    } catch {
      failed += 1;
    }
  }

  return { screened, skipped, failed, scoresByApplicationId };
}
