import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BankQuestion,
  DifficultyLevel,
  ExperienceBucket,
  PublicMcqQuestion,
  TestSnapshotItem,
} from "@/types/candidateTest";

/** Never pull these into a job-skills test (aptitude / generic CS filler). */
const EXCLUDED_BANK_TAGS = new Set(["aptitude", "general_cs", "math", "logic"]);

const KEYWORD_TAGS: Array<{ re: RegExp; tag: string }> = [
  { re: /\b(python|django|fastapi|flask|pandas|numpy)\b/i, tag: "python" },
  { re: /\b(javascript|typescript|node\.?js|react|next\.?js|vue|angular|svelte)\b/i, tag: "javascript" },
  { re: /\b(java|spring|kotlin)\b/i, tag: "java" },
  { re: /\b(c#|\.net|dotnet|asp\.net)\b/i, tag: "dotnet" },
  { re: /\b(go|golang)\b/i, tag: "golang" },
  { re: /\b(rust)\b/i, tag: "rust" },
  { re: /\b(c\+\+|cpp)\b/i, tag: "cpp" },
  { re: /\b(sql|postgres|postgresql|mysql|sqlite|database|mongodb|redis)\b/i, tag: "sql" },
  { re: /\b(aws|azure|gcp|cloud|kubernetes|k8s|docker|terraform|helm)\b/i, tag: "cloud" },
  { re: /\b(api|rest|graphql|grpc|http)\b/i, tag: "apis" },
  { re: /\b(algorithm|complexity|big-?o)\b/i, tag: "algorithms" },
  { re: /\b(git|ci\/cd|devops|jenkins|github actions)\b/i, tag: "devops" },
  { re: /\b(security|oauth|jwt|auth|oauth2)\b/i, tag: "security" },
  { re: /\b(machine learning|ml|nlp|pytorch|tensorflow|keras)\b/i, tag: "ml" },
  { re: /\b(kafka|rabbitmq|messaging|event)\b/i, tag: "messaging" },
];

/** Map normalized job-skill tokens to bank tag vocabulary. */
const SKILL_TOKEN_TO_TAGS: Array<{ re: RegExp; tags: string[] }> = [
  { re: /python|django|fastapi|flask/i, tags: ["python"] },
  { re: /javascript|typescript|node|react|next|vue|angular|frontend|web/i, tags: ["javascript"] },
  { re: /java|spring|kotlin|jvm/i, tags: ["java"] },
  { re: /\.net|c#|dotnet|asp/i, tags: ["dotnet"] },
  { re: /golang|go\b/i, tags: ["golang"] },
  { re: /rust/i, tags: ["rust"] },
  { re: /c\+\+|cpp/i, tags: ["cpp"] },
  { re: /sql|postgres|mysql|mongo|redis|database|db\b/i, tags: ["sql"] },
  { re: /aws|azure|gcp|cloud|k8s|kubernetes|docker|terraform/i, tags: ["cloud"] },
  { re: /api|rest|graphql|grpc/i, tags: ["apis"] },
  { re: /git|devops|ci|cd|jenkins/i, tags: ["devops"] },
  { re: /security|oauth|jwt|auth/i, tags: ["security"] },
  { re: /ml\b|machine learning|nlp|data science|pytorch|tensorflow/i, tags: ["ml"] },
];

/** Broaden a tag set so the bank can match related rows (still skill-only, no aptitude). */
function expandRelatedBankTags(tags: string[]): string[] {
  const out = new Set<string>();
  const RELATED: Record<string, string[]> = {
    python: ["python", "django", "ml"],
    javascript: ["javascript", "react", "frontend", "async"],
    java: ["java", "backend", "oop"],
    dotnet: ["dotnet", "backend"],
    golang: ["golang", "backend"],
    rust: ["rust", "backend"],
    cpp: ["cpp", "algorithms"],
    sql: ["sql", "databases", "distributed"],
    cloud: ["cloud", "devops", "networking", "systems"],
    apis: ["apis", "web", "http", "security"],
    devops: ["devops", "cloud", "networking"],
    security: ["security", "web"],
    ml: ["ml", "algorithms"],
    algorithms: ["algorithms", "complexity", "data-structures"],
    messaging: ["messaging", "distributed", "systems"],
  };
  for (const t of tags) {
    const k = t.toLowerCase();
    out.add(k);
    const rel = RELATED[k];
    if (rel) rel.forEach((x) => out.add(x));
  }
  return Array.from(out);
}

export function experienceYearsToBucket(years: number): ExperienceBucket {
  if (years <= 1) return "fresher";
  if (years <= 6) return "mid";
  return "senior";
}

function parseDifficultyMixFromEnv(key: string): Record<DifficultyLevel, number> | null {
  const raw = String(process.env[key] || "").trim();
  if (!raw) return null;
  const parts = raw.split(",").map((p) => Number(p.trim()));
  if (parts.length !== 3) return null;
  const [basic, intermediate, advanced] = parts;
  if (![basic, intermediate, advanced].every((n) => Number.isInteger(n) && n >= 0)) return null;
  if (basic + intermediate + advanced !== 10) return null;
  return { basic, intermediate, advanced };
}

/** Lean away from "basic" so tests feel role-relevant (still 10 questions). */
export function difficultyMixForBucket(bucket: ExperienceBucket): Record<DifficultyLevel, number> {
  const fresherOverride = parseDifficultyMixFromEnv("MCQ_MIX_FRESHER");
  const midOverride = parseDifficultyMixFromEnv("MCQ_MIX_MID");
  const seniorOverride = parseDifficultyMixFromEnv("MCQ_MIX_SENIOR");

  switch (bucket) {
    case "fresher":
      // Harder default for fresher than before (less basic, more applied questions).
      return fresherOverride || { basic: 2, intermediate: 5, advanced: 3 };
    case "mid":
      return midOverride || { basic: 2, intermediate: 4, advanced: 4 };
    case "senior":
      return seniorOverride || { basic: 1, intermediate: 3, advanced: 6 };
    default:
      return { basic: 2, intermediate: 4, advanced: 4 };
  }
}

function normalizeSkillToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function extractTagsFromJd(jobDescription: string, jobSkills: string[]): string[] {
  const out = new Set<string>();
  for (const s of jobSkills) {
    const n = normalizeSkillToken(s);
    if (n) {
      out.add(n);
      for (const { re, tags } of SKILL_TOKEN_TO_TAGS) {
        if (re.test(s)) tags.forEach((t) => out.add(t));
      }
    }
  }
  const text = `${jobDescription}\n${jobSkills.join(" ")}`;
  const lower = text.toLowerCase();
  for (const { re, tag } of KEYWORD_TAGS) {
    if (re.test(lower)) out.add(tag);
  }
  return Array.from(out).filter(Boolean);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleOptionsWithCorrectIndex(
  options: string[],
  answerText: string
): { options: string[]; correctIndex: number } {
  const shuffled = shuffle(options);
  const idx = shuffled.findIndex((o) => o.trim() === answerText.trim());
  if (idx < 0) {
    const ci = options.findIndex((o) => o.trim() === answerText.trim());
    return { options: [...options], correctIndex: ci >= 0 ? ci : 0 };
  }
  return { options: shuffled, correctIndex: idx };
}

type QuestionRow = {
  id: string;
  question: string;
  options: unknown;
  answer: string;
  difficulty: string;
  tags: unknown;
};

function toRow(r: QuestionRow): BankQuestion {
  const opts = Array.isArray(r.options)
    ? (r.options as string[])
    : (JSON.parse(String(r.options)) as string[]);
  const tags = Array.isArray(r.tags) ? (r.tags as string[]) : [];
  return {
    id: r.id,
    question: r.question,
    options: opts,
    answer: r.answer,
    difficulty: r.difficulty as DifficultyLevel,
    tags,
  };
}

function isSkillAreaQuestion(q: BankQuestion): boolean {
  return !q.tags.some((t) => EXCLUDED_BANK_TAGS.has(String(t).toLowerCase()));
}

function overlapsJobTags(q: BankQuestion, jobTagSet: Set<string>): boolean {
  return q.tags.some((t) => jobTagSet.has(String(t).toLowerCase()));
}

function pickDisplaySkillTag(row: BankQuestion, jobTagsLower: Set<string>): string | null {
  for (const t of row.tags) {
    const tl = String(t).toLowerCase();
    if (EXCLUDED_BANK_TAGS.has(tl)) continue;
    if (jobTagsLower.has(tl)) return t;
  }
  for (const t of row.tags) {
    const tl = String(t).toLowerCase();
    if (!EXCLUDED_BANK_TAGS.has(tl)) return t;
  }
  return null;
}

async function fetchPoolForTags(
  admin: SupabaseClient,
  difficulty: DifficultyLevel,
  tagSet: string[],
  limit: number
): Promise<BankQuestion[]> {
  if (!tagSet.length) return [];
  const { data, error } = await admin
    .from("questions")
    .select("id, question, options, answer, difficulty, tags")
    .eq("difficulty", difficulty)
    .overlaps("tags", tagSet)
    .limit(limit);
  if (error) throw new Error(`Question bank query failed: ${error.message}`);
  return ((data || []) as QuestionRow[]).map(toRow).filter(isSkillAreaQuestion);
}

function pickUnique(rows: BankQuestion[], count: number, usedIds: Set<string>): BankQuestion[] {
  const out: BankQuestion[] = [];
  for (const r of shuffle(rows)) {
    if (out.length >= count) break;
    if (usedIds.has(r.id)) continue;
    usedIds.add(r.id);
    out.push(r);
  }
  return out;
}

export function sanitizeSnapshotForClient(questions: TestSnapshotItem[]): PublicMcqQuestion[] {
  return questions.map((q) => ({
    id: q.key,
    question_text: q.question,
    options: q.options,
    skill_tag: q.skillTag ?? null,
    difficulty: null,
  }));
}

export async function generateCandidateTest(
  admin: SupabaseClient,
  params: {
    applicationId: string;
    candidateId: string;
    jobId: string;
    jobDescription: string;
    experienceYears: number;
    jobSkills: string[];
  }
): Promise<{
  testId: string;
  questions: PublicMcqQuestion[];
  snapshot: TestSnapshotItem[];
  reusedExisting: boolean;
}> {
  const { data: existing, error: exErr } = await admin
    .from("candidate_tests")
    .select("id, questions, status")
    .eq("application_id", params.applicationId)
    .maybeSingle();

  if (exErr && !exErr.message.includes("does not exist")) {
    throw new Error(exErr.message);
  }

  const existingSnap = (existing?.questions as TestSnapshotItem[] | null) || [];
  if (existing && Array.isArray(existingSnap) && existingSnap.length >= 10) {
    return {
      testId: String(existing.id),
      questions: sanitizeSnapshotForClient(existingSnap),
      snapshot: existingSnap,
      reusedExisting: true,
    };
  }

  const skillTags = extractTagsFromJd(params.jobDescription, params.jobSkills);
  if (!skillTags.length) {
    throw new Error(
      "No skills could be inferred for this job. Add skills to the job posting (and a clear description) so MCQs can match your role."
    );
  }

  const primaryTagSet = skillTags;
  const expandedTagSet = expandRelatedBankTags(skillTags);
  const jobTagSet = new Set(expandedTagSet.map((t) => t.toLowerCase()));

  const bucket = experienceYearsToBucket(params.experienceYears);
  const mix = difficultyMixForBucket(bucket);
  const used = new Set<string>();
  const picked: BankQuestion[] = [];

  for (const level of ["basic", "intermediate", "advanced"] as DifficultyLevel[]) {
    const need = mix[level];
    let pool = await fetchPoolForTags(admin, level, primaryTagSet, 120);
    let got = pickUnique(pool, need, used);

    if (got.length < need) {
      pool = await fetchPoolForTags(admin, level, expandedTagSet, 120);
      got = [...got, ...pickUnique(pool, need - got.length, used)];
    }

    if (got.length < need) {
      const { data: anyRows } = await admin
        .from("questions")
        .select("id, question, options, answer, difficulty, tags")
        .eq("difficulty", level)
        .limit(200);
      const rows = ((anyRows || []) as QuestionRow[])
        .map(toRow)
        .filter(isSkillAreaQuestion)
        .filter((q) => overlapsJobTags(q, jobTagSet));
      got = [...got, ...pickUnique(rows, need - got.length, used)];
    }

    picked.push(...got.slice(0, need));
  }

  const final = shuffle(picked).slice(0, 10);
  if (final.length < 10) {
    throw new Error(
      `Not enough skill-matched questions in the bank for tags: ${primaryTagSet.join(", ")}. Add more rows to public.questions tagged with those skills (avoid aptitude/general_cs).`
    );
  }

  const snapshot: TestSnapshotItem[] = final.map((row) => {
    const key = crypto.randomUUID();
    const { options: opts, correctIndex } = shuffleOptionsWithCorrectIndex(row.options, row.answer);
    return {
      key,
      bankQuestionId: row.id,
      question: row.question,
      options: opts,
      correctIndex,
      skillTag: pickDisplaySkillTag(row, jobTagSet),
    };
  });

  const upsertPayload = {
    application_id: params.applicationId,
    candidate_id: params.candidateId,
    job_id: params.jobId,
    questions: snapshot as unknown as Record<string, unknown>,
    status: "in_progress" as const,
    updated_at: new Date().toISOString(),
  };

  const { data: saved, error: insErr } = await admin
    .from("candidate_tests")
    .upsert(upsertPayload, { onConflict: "application_id" })
    .select("id")
    .single();

  if (insErr || !saved) {
    throw new Error(insErr?.message || "Failed to save candidate test.");
  }

  return {
    testId: String(saved.id),
    questions: sanitizeSnapshotForClient(snapshot),
    snapshot,
    reusedExisting: false,
  };
}
