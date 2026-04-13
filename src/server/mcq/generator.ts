import { McqQuestionInput } from "@/server/mcq/types";

type McqEngineQuestion = {
  question: string;
  options: string[];
  correct_answer: string;
  explanation?: string;
  difficulty?: "medium" | "hard";
  topic?: string;
  hash_id?: string;
};

type McqEngineGenerateResponse = {
  questions?: McqEngineQuestion[];
};

const fallbackQuestions = (skills: string[], count: number): McqQuestionInput[] => {
  const sourceSkills = skills.length ? skills : ["General Programming"];
  const items: McqQuestionInput[] = [];

  for (let i = 0; i < count; i += 1) {
    const skill = sourceSkills[i % sourceSkills.length];
    items.push({
      questionText: `You are reviewing a production issue related to ${skill}. Which action is most likely to produce a reliable fix?`,
      options: [
        `Patch only the symptom in UI and postpone root-cause analysis`,
        `Apply ${skill} best practices, add targeted tests, and validate with measurable checks`,
        `Revert unrelated modules to reduce immediate alerts`,
        `Skip tests and rely only on manual checks in production`,
      ],
      correctOption: 1,
      skillTag: skill,
      difficulty: "hard",
    });
  }

  return items;
};

const parseQuestions = (raw: string, expectedCount: number): McqQuestionInput[] => {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error("Invalid MCQ JSON shape.");
  const valid = parsed
    .filter((q: unknown) => {
      if (!q || typeof q !== "object") return false;
      const candidate = q as { questionText?: unknown; options?: unknown; correctOption?: unknown };
      return Boolean(candidate.questionText) && Array.isArray(candidate.options) && Number.isInteger(candidate.correctOption);
    })
    .map(
      (q: unknown): McqQuestionInput => {
        const candidate = q as {
          questionText?: unknown;
          options?: unknown[];
          correctOption?: unknown;
          skillTag?: unknown;
          difficulty?: unknown;
        };
        return {
          questionText: String(candidate.questionText),
          options: (candidate.options || []).slice(0, 4).map((o: unknown) => String(o)),
          correctOption: Number(candidate.correctOption),
          skillTag: candidate.skillTag ? String(candidate.skillTag) : undefined,
          difficulty:
            candidate.difficulty === "easy" || candidate.difficulty === "hard" ? candidate.difficulty : "medium",
        };
      }
    )
    .filter((q) => q.options.length === 4 && q.correctOption >= 0 && q.correctOption <= 3);

  if (valid.length < expectedCount) throw new Error("Insufficient MCQs from model.");
  return valid.slice(0, expectedCount);
};

const getEngineBaseUrl = (): string => {
  const configured = process.env.MCQ_ENGINE_URL || process.env.NEXT_PUBLIC_MCQ_ENGINE_URL || "";
  return configured.replace(/\/+$/, "");
};

const buildEngineJobDescription = (input: {
  skills: string[];
  jobRole?: string;
  jobTitle?: string;
  jobDescription?: string;
}): string => {
  const parts: string[] = [];
  if (input.jobRole?.trim()) parts.push(`Job Role: ${input.jobRole.trim()}`);
  if (input.jobTitle?.trim()) parts.push(`Job Title: ${input.jobTitle.trim()}`);
  if (input.jobDescription?.trim()) parts.push(`Job Description: ${input.jobDescription.trim()}`);
  if (input.skills.length) parts.push(`Core Skills: ${input.skills.join(", ")}`);
  return parts.join("\n");
};

const mapEngineQuestion = (q: McqEngineQuestion): McqQuestionInput | null => {
  if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || !q.correct_answer) return null;
  const correctIndex = q.options.findIndex((option) => option === q.correct_answer);
  if (correctIndex < 0 || correctIndex > 3) return null;
  return {
    questionText: q.question,
    options: q.options,
    correctOption: correctIndex,
    skillTag: q.topic || undefined,
    difficulty: q.difficulty === "hard" ? "hard" : "medium",
  };
};

const generateViaMcqEngine = async (input: {
  skills: string[];
  count: number;
  jobId?: string;
  jobRole?: string;
  jobTitle?: string;
  jobDescription?: string;
  candidateId?: string;
  companyTier?: "faang" | "startup" | "enterprise" | "general";
  candidatePerformanceScore?: number;
  experienceLevel?: "fresher" | "junior" | "mid" | "senior";
  seed?: string;
}): Promise<McqQuestionInput[] | null> => {
  const baseUrl = getEngineBaseUrl();
  if (!baseUrl) return null;

  const jobDescription = buildEngineJobDescription(input);
  if (!jobDescription || jobDescription.length < 30) return null;

  const targetCount = Math.max(1, input.count);
  const uniqueByText = new Map<string, McqQuestionInput>();
  const rounds = Math.max(1, Math.ceil(targetCount / 10));

  for (let round = 0; round < rounds; round += 1) {
    const candidateId =
      input.candidateId && rounds === 1
        ? input.candidateId
        : `${input.candidateId || "seed"}-${Date.now()}-${round}`;

    try {
      const response = await fetch(`${baseUrl}/mcq/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: input.jobId || `job-${Math.abs(jobDescription.length + input.skills.length)}`,
          job_description: jobDescription,
          candidate_id: candidateId,
          job_role: input.jobRole || input.jobTitle || undefined,
          company_tier: input.companyTier || "general",
          candidate_performance_score: input.candidatePerformanceScore,
          experience_level: input.experienceLevel,
          seed: input.seed || `${candidateId}:${round}`,
        }),
      });
      if (!response.ok) continue;
      const payload = (await response.json()) as McqEngineGenerateResponse;
      const questions = payload.questions || [];

      for (const item of questions) {
        const mapped = mapEngineQuestion(item);
        if (!mapped) continue;
        uniqueByText.set(mapped.questionText.trim().toLowerCase(), mapped);
      }
    } catch {
      continue;
    }

    if (uniqueByText.size >= targetCount) break;
  }

  return uniqueByText.size ? Array.from(uniqueByText.values()).slice(0, targetCount) : null;
};

export async function generateMcqs(skills: string[], count: number): Promise<McqQuestionInput[]> {
  return generateMcqsFromContext({ skills, count });
}

export async function generateMcqsFromContext(input: {
  skills: string[];
  count: number;
  jobId?: string;
  jobRole?: string;
  candidateId?: string;
  companyTier?: "faang" | "startup" | "enterprise" | "general";
  candidatePerformanceScore?: number;
  experienceLevel?: "fresher" | "junior" | "mid" | "senior";
  seed?: string;
  requireEngine?: boolean;
  jobTitle?: string;
  jobDescription?: string;
  difficultyHint?: "balanced" | "challenging";
}): Promise<McqQuestionInput[]> {
  const skills = input.skills || [];
  const count = input.count;

  let engineQuestions: McqQuestionInput[] | null = null;
  try {
    engineQuestions = await generateViaMcqEngine({
      skills,
      count,
      jobId: input.jobId,
      jobRole: input.jobRole,
      candidateId: input.candidateId,
      companyTier: input.companyTier,
      candidatePerformanceScore: input.candidatePerformanceScore,
      experienceLevel: input.experienceLevel,
      seed: input.seed,
      jobTitle: input.jobTitle,
      jobDescription: input.jobDescription,
    });
  } catch {
    engineQuestions = null;
  }
  if (engineQuestions?.length) {
    return engineQuestions.slice(0, count);
  }
  if (input.requireEngine) {
    throw new Error("MCQ engine is unavailable. Start the engine and retry.");
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) {
    return fallbackQuestions(skills, count);
  }

  const difficultyInstruction =
    input.difficultyHint === "challenging"
      ? "Questions must be advanced-level, scenario-driven, and require applied reasoning. Avoid definition-only or trivial elimination questions."
      : "Use a balanced difficulty mix of medium and hard.";
  const jobContext = [input.jobTitle ? `Job Title: ${input.jobTitle}` : "", input.jobDescription ? `Job Description: ${input.jobDescription}` : ""]
    .filter(Boolean)
    .join("\n");

  const prompt = `Generate ${count} multiple-choice questions for a hiring assessment.
${jobContext ? `${jobContext}\n` : ""}Skills: ${skills.join(", ")}
${difficultyInstruction}
At least 70% questions should require applied reasoning rather than definitions.
At least 40% questions should involve debugging, trade-off analysis, or real-world constraints.
Return ONLY JSON array: [{questionText, options(4), correctOption(0-3), skillTag, difficulty}].`;

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_LLM_MODEL || "gpt-4o-mini",
        temperature: 0.4,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    return fallbackQuestions(skills, count);
  }
  if (!response.ok) {
    return fallbackQuestions(skills, count);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) return fallbackQuestions(skills, count);

  try {
    return parseQuestions(content, count);
  } catch {
    return fallbackQuestions(skills, count);
  }
}
