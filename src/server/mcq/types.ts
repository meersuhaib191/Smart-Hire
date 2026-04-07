export type McqQuestionInput = {
  questionText: string;
  options: string[];
  correctOption: number;
  skillTag?: string;
  difficulty?: "easy" | "medium" | "hard";
};

export type McqQuestion = {
  id: string;
  question_text: string;
  options: string[];
  skill_tag: string | null;
  difficulty: string | null;
};
