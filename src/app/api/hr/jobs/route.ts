import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/supabase/admin";
import { requireAuthUser, requireHr } from "@/server/auth/session";
import { generateMcqs } from "@/server/mcq/generator";
import { buildDefaultChallenge } from "@/server/coding/seedChallenge";

type CreateJobBody = {
  title: string;
  description: string;
  experience_required: number;
  company_id?: string;
  skills: string[];
  weights: {
    ats_weight: number;
    mcq_weight: number;
    coding_weight: number;
    interview_weight: number;
  };
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveCompanyId(
  admin: ReturnType<typeof createSupabaseAdmin>,
  user: Awaited<ReturnType<typeof requireAuthUser>>,
  companyHint?: string
) {
  const hint = (companyHint || "").trim();
  const metadataCompany = String(user.user_metadata?.company || "").trim();
  const profileCompany = String((user.user_metadata?.profile as { companyName?: string } | undefined)?.companyName || "").trim();
  const candidate = hint || metadataCompany || profileCompany;

  if (!candidate) {
    return { companyId: "", error: "Set your company in HR profile before posting jobs." };
  }

  if (UUID_REGEX.test(candidate)) {
    const { data: byId, error: byIdError } = await admin
      .from("companies")
      .select("id")
      .eq("id", candidate)
      .maybeSingle();
    if (byIdError) return { companyId: "", error: byIdError.message };
    if (byId?.id) return { companyId: byId.id, error: "" };
    return { companyId: "", error: "Provided company id is invalid." };
  }

  const { data: byName, error: byNameError } = await admin
    .from("companies")
    .select("id")
    .eq("name", candidate)
    .maybeSingle();
  if (byNameError) return { companyId: "", error: byNameError.message };
  if (byName?.id) return { companyId: byName.id, error: "" };

  const { data: created, error: createError } = await admin
    .from("companies")
    .insert({ name: candidate, verified: false })
    .select("id")
    .single();
  if (createError || !created?.id) {
    return { companyId: "", error: createError?.message || "Failed to create company record." };
  }
  return { companyId: created.id, error: "" };
}

async function findCompanyIdByHint(
  admin: ReturnType<typeof createSupabaseAdmin>,
  user: Awaited<ReturnType<typeof requireAuthUser>>
) {
  const metadataCompany = String(user.user_metadata?.company || "").trim();
  const profileCompany = String((user.user_metadata?.profile as { companyName?: string } | undefined)?.companyName || "").trim();
  const candidate = metadataCompany || profileCompany;
  if (!candidate) return "";

  if (UUID_REGEX.test(candidate)) {
    const { data, error } = await admin.from("companies").select("id").eq("id", candidate).maybeSingle();
    if (error) return "";
    return (data?.id as string) || "";
  }

  const { data, error } = await admin
    .from("companies")
    .select("id")
    .eq("name", candidate)
    .maybeSingle();
  if (error) return "";
  return (data?.id as string) || "";
}

export async function GET() {
  try {
    const user = await requireAuthUser();
    requireHr(user);

    const admin = createSupabaseAdmin();
    const companyId = await findCompanyIdByHint(admin, user);
    let query = admin
      .from("jobs")
      .select("id, title, company_id, status, created_at, applications(id)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (companyId) {
      query = query.eq("company_id", companyId);
    }
    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ jobs: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load jobs.";
    const status =
      message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser();
    requireHr(user);
    const body = (await request.json()) as Partial<CreateJobBody>;

    if (!body.title || !body.description) {
      return NextResponse.json({ error: "title and description are required." }, { status: 400 });
    }

    const skills = body.skills || [];
    const weights = body.weights || {
      ats_weight: 1,
      mcq_weight: 0,
      coding_weight: 0,
      interview_weight: 0,
    };
    const weightSum =
      Number(weights.ats_weight) +
      Number(weights.mcq_weight) +
      Number(weights.coding_weight) +
      Number(weights.interview_weight);
    if (Math.abs(weightSum - 1) > 0.01) {
      return NextResponse.json({ error: "Stage weights must sum to 1.00." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    const { companyId, error: companyError } = await resolveCompanyId(admin, user, body.company_id);
    if (!companyId) {
      return NextResponse.json({ error: companyError || "Company is required." }, { status: 400 });
    }

    const { data: job, error: jobError } = await admin
      .from("jobs")
      .insert({
        title: body.title,
        description: body.description,
        experience_required: body.experience_required || 0,
        company_id: companyId,
        status: "PUBLISHED",
      })
      .select("id, title")
      .single();
    if (jobError || !job) {
      return NextResponse.json({ error: "Failed to create job.", detail: jobError?.message }, { status: 500 });
    }

    if (skills.length) {
      await admin.from("job_skills").insert(
        skills.map((skill) => ({
          job_id: job.id,
          skill_name: skill,
        }))
      );
    }

    await admin.from("job_weights").upsert(
      {
        job_id: job.id,
        ats_weight: weights.ats_weight,
        mcq_weight: weights.mcq_weight,
        coding_weight: weights.coding_weight,
        interview_weight: weights.interview_weight,
      },
      { onConflict: "job_id" }
    );

    // Auto-seed MCQ pool
    const mcqs = await generateMcqs(skills, 10);
    await admin.from("mcq_questions").insert(
      mcqs.map((q) => ({
        job_id: job.id,
        question_text: q.questionText,
        options: q.options,
        correct_option: q.correctOption,
        skill_tag: q.skillTag || null,
        difficulty: q.difficulty || "medium",
      }))
    );

    // Auto-seed coding challenge + hidden tests
    const challenge = buildDefaultChallenge(job.title, skills);
    const { data: createdChallenge } = await admin
      .from("coding_challenges")
      .insert({
        job_id: job.id,
        title: challenge.title,
        description: challenge.description,
        starter_code: challenge.starterCode,
        language: challenge.language,
        difficulty: "medium",
      })
      .select("id")
      .single();

    if (createdChallenge?.id) {
      await admin.from("coding_test_cases").insert(
        challenge.testCases.map((tc) => ({
          challenge_id: createdChallenge.id,
          input: tc.input,
          expected_output: tc.expected_output,
          is_hidden: tc.is_hidden,
        }))
      );
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      seeded: {
        mcqQuestions: mcqs.length,
        codingChallenge: Boolean(createdChallenge?.id),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create job.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
