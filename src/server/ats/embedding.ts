import { EmbeddingVector } from "@/server/ats/types";

const DIMENSIONS = 768;

const l2Normalize = (vector: number[]) => {
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (!norm) return vector;
  return vector.map((v) => v / norm);
};

const resizeAndNormalize = (input: number[]) => {
  const result = new Array<number>(DIMENSIONS).fill(0);
  for (let i = 0; i < Math.min(input.length, DIMENSIONS); i += 1) {
    result[i] = input[i];
  }
  return l2Normalize(result);
};

const fallbackEmbedding = (text: string): EmbeddingVector => {
  // Deterministic hashed fallback for local/dev when provider key is unavailable.
  const vec = new Array<number>(DIMENSIONS).fill(0);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    vec[i % DIMENSIONS] += (code % 97) / 97;
  }
  return l2Normalize(vec);
};

async function embedWithOpenAI(text: string, apiKey: string): Promise<EmbeddingVector> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-large",
      input: text.slice(0, 12000),
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI embedding failed: ${response.status}`);
  }

  const json = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const embedding = json.data?.[0]?.embedding;
  if (!embedding?.length) {
    throw new Error("OpenAI returned empty embedding.");
  }
  return resizeAndNormalize(embedding);
}

export async function createEmbedding(text: string): Promise<EmbeddingVector> {
  const clean = text.trim();
  if (!clean) {
    throw new Error("Cannot create embedding from empty text.");
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey) {
    return embedWithOpenAI(clean, openAiKey);
  }

  return fallbackEmbedding(clean);
}

export const vectorToSql = (vector: number[]) => `[${vector.map((v) => Number(v.toFixed(8))).join(",")}]`;
