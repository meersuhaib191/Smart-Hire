import { McqQuestionInput } from "@/server/mcq/types";

const fallbackQuestions = (skills: string[], count: number): McqQuestionInput[] => {
  const sourceSkills = skills.length ? skills : ["General Programming"];
  const items: McqQuestionInput[] = [];

  for (let i = 0; i < count; i += 1) {
    const skill = sourceSkills[i % sourceSkills.length];
    items.push({
      questionText: `Which statement best reflects good practice in ${skill}?`,
      options: [
        `Ignore edge cases in ${skill} to speed delivery`,
        `Apply core ${skill} principles and validate with tests`,
        `Only focus on UI and skip ${skill} fundamentals`,
        `Use random approach without measuring outcomes`,
      ],
      correctOption: 1,
      skillTag: skill,
      difficulty: "medium",
    });
  }

  return items;
};

const parseQuestions = (raw: string, expectedCount: number): McqQuestionInput[] => {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error("Invalid MCQ JSON shape.");
  const valid = parsed
    .filter((q: any) => q?.questionText && Array.isArray(q?.options) && Number.isInteger(q?.correctOption))
    .map(
      (q: any): McqQuestionInput => ({
        questionText: String(q.questionText),
        options: q.options.slice(0, 4).map((o: unknown) => String(o)),
        correctOption: Number(q.correctOption),
        skillTag: q.skillTag ? String(q.skillTag) : undefined,
        difficulty: q.difficulty === "easy" || q.difficulty === "hard" ? q.difficulty : "medium",
      })
    )
    .filter((q) => q.options.length === 4 && q.correctOption >= 0 && q.correctOption <= 3);

  if (valid.length < expectedCount) throw new Error("Insufficient MCQs from model.");
  return valid.slice(0, expectedCount);
};

export async function generateMcqs(skills: string[], count: number): Promise<McqQuestionInput[]> {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) {
    return fallbackQuestions(skills, count);
  }

  const prompt = `Generate ${count} multiple-choice questions for a hiring assessment.\nSkills: ${skills.join(
    ", "
  )}\nReturn ONLY JSON array: [{questionText, options(4), correctOption(0-3), skillTag, difficulty}].`;

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

  const json = (await response.json()) as any;
  const content = json?.choices?.[0]?.message?.content;
  if (!content) return fallbackQuestions(skills, count);

  try {
    return parseQuestions(content, count);
  } catch {
    return fallbackQuestions(skills, count);
  }
}
