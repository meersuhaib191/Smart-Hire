export type DifficultyLevel = "basic" | "intermediate" | "advanced";

export type ExperienceBucket = "fresher" | "mid" | "senior";

/** One row from public.questions */
export type BankQuestion = {
  id: string;
  question: string;
  options: string[];
  answer: string;
  difficulty: DifficultyLevel;
  tags: string[];
};

/** Stored in candidate_tests.questions (includes correct index for server-side grading). */
export type TestSnapshotItem = {
  key: string;
  bankQuestionId: string;
  question: string;
  options: string[];
  correctIndex: number;
  /** First skill-related tag for UI (optional). */
  skillTag?: string | null;
};

/** Safe to send to the browser (no correct answer). */
export type PublicMcqQuestion = {
  id: string;
  question_text: string;
  options: string[];
  skill_tag: string | null;
  difficulty: string | null;
};

export type CandidateTestRow = {
  id: string;
  application_id: string;
  candidate_id: string;
  job_id: string;
  questions: TestSnapshotItem[];
  score: number;
  status: "pending" | "in_progress" | "completed";
  created_at: string;
};
