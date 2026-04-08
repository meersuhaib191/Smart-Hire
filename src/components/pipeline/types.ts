export type PipelineStageId = "ATS" | "MCQ" | "CODING" | "INTERVIEW" | "COMPLETE" | "REJECTED";

export type StageRow = { stage_type: string; score: number; passed: boolean };

export type CandidateRow = {
  applicationId: string;
  email: string;
  pipelineStep: string;
  finalScore: number | null;
  rankPosition: number | null;
  stages: StageRow[];
};

export const stageOrder: PipelineStageId[] = ["ATS", "MCQ", "CODING", "INTERVIEW", "COMPLETE"];

export const stageLabels: Record<PipelineStageId, string> = {
  ATS: "ATS",
  MCQ: "MCQ",
  CODING: "Coding",
  INTERVIEW: "AI Interview",
  COMPLETE: "Selected",
  REJECTED: "Rejected",
};

export const scoreFor = (candidate: CandidateRow) => {
  if (candidate.finalScore != null) return Number(candidate.finalScore);
  const lookup = new Map(candidate.stages.map((s) => [String(s.stage_type).toUpperCase(), Number(s.score || 0)]));
  return lookup.get("ATS") ?? lookup.get("MCQ") ?? lookup.get("CODING") ?? lookup.get("INTERVIEW") ?? 0;
};

