import { McqQuestionInput } from "@/server/mcq/types";

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

export async function generateMcqs(skills: string[], count: number): Promise<McqQuestionInput[]> {
  return generateMcqsFromContext({ skills, count });
}

export async function generateMcqsFromContext(input: {
  skills: string[];
  count: number;
  jobTitle?: string;
  jobDescription?: string;
  difficultyHint?: "balanced" | "challenging";
}): Promise<McqQuestionInput[]> {
  const skills = input.skills || [];
  const count = input.count;
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

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
