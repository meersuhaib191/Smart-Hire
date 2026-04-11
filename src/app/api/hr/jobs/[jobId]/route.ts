import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { requireAuthUser, requireHr } from "@/server/auth/session";

type UpdateJobBody = {
  title?: string;
  description?: string;
  experience_required?: number;
  submission_deadline_at?: string | null;
  status?: string;
  skills?: string[];
  weights?: {
    ats_weight: number;
    mcq_weight: number;
    coding_weight: number;
    interview_weight: number;
  };
};

const missingCreatedByColumn = (message?: string) =>
  (message || "").includes("Could not find the 'created_by_user_id' column") ||
  (message || "").includes("column jobs.created_by_user_id does not exist") ||
  (message || "").includes('column "created_by_user_id" does not exist');

async function getManagedJob(
  admin: ReturnType<typeof createSupabaseAdmin>,
  jobId: string,
  userId: string
) {
  const primary = await admin
    .from("jobs")
    .select("id, title, description, experience_required, submission_deadline_at, status, created_by_user_id")
    .eq("id", jobId)
    .eq("created_by_user_id", userId)
    .maybeSingle();

  if (!missingCreatedByColumn(primary.error?.message)) {
    return { data: primary.data, error: primary.error };
  }

  const fallback = await admin
    .from("jobs")
    .select("id, title, description, experience_required, submission_deadline_at, status")
    .eq("id", jobId)
    .maybeSingle();
  return { data: fallback.data, error: fallback.error };
}

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const user = await requireAuthUser();
    requireHr(user);
    const { jobId } = await context.params;
    const admin = createSupabaseAdmin();

    const { data: job, error } = await getManagedJob(admin, jobId, user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });

    const { data: skills } = await admin
      .from("job_skills")
      .select("skill_name")
      .eq("job_id", jobId);
    const { data: weights } = await admin
      .from("job_weights")
      .select("ats_weight, mcq_weight, coding_weight, interview_weight")
      .eq("job_id", jobId)
      .maybeSingle();

    return NextResponse.json({
      job: {
        ...job,
        skills: (skills || []).map((s) => s.skill_name).filter(Boolean),
        weights: weights || {
          ats_weight: 1,
          mcq_weight: 0,
          coding_weight: 0,
          interview_weight: 0,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load job.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const user = await requireAuthUser();
    requireHr(user);
    const { jobId } = await context.params;
    const body = (await request.json()) as UpdateJobBody;
    const admin = createSupabaseAdmin();

    const { data: existing, error: existingError } = await getManagedJob(admin, jobId, user.id);
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: "Job not found." }, { status: 404 });

    const patch: Record<string, unknown> = {};
    if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim();
    if (typeof body.description === "string" && body.description.trim()) patch.description = body.description.trim();
    if (typeof body.experience_required === "number" && Number.isFinite(body.experience_required)) {
      patch.experience_required = Math.max(0, body.experience_required);
    }
    if (body.status) patch.status = String(body.status).toUpperCase();
    if (body.submission_deadline_at !== undefined) {
      const raw = body.submission_deadline_at;
      if (!raw) {
        patch.submission_deadline_at = null;
      } else {
        const ts = new Date(raw).getTime();
        if (Number.isNaN(ts)) {
          return NextResponse.json({ error: "submission_deadline_at must be a valid date-time." }, { status: 400 });
        }
        patch.submission_deadline_at = new Date(raw).toISOString();
      }
    }

    if (Object.keys(patch).length) {
      const { error: updateError } = await admin.from("jobs").update(patch).eq("id", jobId);
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (Array.isArray(body.skills)) {
      const cleaned = [...new Set(body.skills.map((s) => String(s || "").trim()).filter(Boolean))];
      const { error: deleteSkillsError } = await admin.from("job_skills").delete().eq("job_id", jobId);
      if (deleteSkillsError) return NextResponse.json({ error: deleteSkillsError.message }, { status: 500 });
      if (cleaned.length) {
        const { error: insertSkillsError } = await admin
          .from("job_skills")
          .insert(cleaned.map((skill) => ({ job_id: jobId, skill_name: skill })));
        if (insertSkillsError) return NextResponse.json({ error: insertSkillsError.message }, { status: 500 });
      }
    }

    if (body.weights) {
      const weightSum =
        Number(body.weights.ats_weight) +
        Number(body.weights.mcq_weight) +
        Number(body.weights.coding_weight) +
        Number(body.weights.interview_weight);
      if (Math.abs(weightSum - 1) > 0.01) {
        return NextResponse.json({ error: "Stage weights must sum to 1.00." }, { status: 400 });
      }
      const { error: weightsError } = await admin.from("job_weights").upsert(
        {
          job_id: jobId,
          ats_weight: body.weights.ats_weight,
          mcq_weight: body.weights.mcq_weight,
          coding_weight: body.weights.coding_weight,
          interview_weight: body.weights.interview_weight,
        },
        { onConflict: "job_id" }
      );
      if (weightsError) return NextResponse.json({ error: weightsError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, jobId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update job.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
