export type InterviewScores = {
  clarity: number;
  relevance: number;
  logic: number;
  overall: number;
  feedback: string;
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

const heuristicScores = (question: string, answer: string): InterviewScores => {
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  const base = Math.min(100, 40 + Math.min(40, words));
  return {
    clarity: clamp(base + (answer.length > 120 ? 10 : 0)),
    relevance: clamp(base - 5),
    logic: clamp(base),
    overall: clamp(base),
    feedback: "Heuristic evaluation (set OPENAI_API_KEY for LLM scoring).",
  };
};

export async function evaluateInterviewAnswer(input: {
  question: string;
  answer: string;
  jobTitle?: string;
}): Promise<InterviewScores> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return heuristicScores(input.question, input.answer);
  }

  const prompt = `You are an interview evaluator. Score the candidate answer on clarity, relevance, and logic (0-100 each).
Job context: ${input.jobTitle || "N/A"}
Question: ${input.question}
Answer: ${input.answer}

Return ONLY JSON: {"clarity":number,"relevance":number,"logic":number,"overall":number,"feedback":string}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_LLM_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    return heuristicScores(input.question, input.answer);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content || "";
  try {
    const parsed = JSON.parse(content) as Partial<InterviewScores>;
    return {
      clarity: clamp(Number(parsed.clarity ?? 0)),
      relevance: clamp(Number(parsed.relevance ?? 0)),
      logic: clamp(Number(parsed.logic ?? 0)),
      overall: clamp(Number(parsed.overall ?? 0)),
      feedback: String(parsed.feedback || ""),
    };
  } catch {
    return heuristicScores(input.question, input.answer);
  }
}
