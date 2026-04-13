import type { SupabaseClient } from "@supabase/supabase-js";
import type { TestSnapshotItem } from "@/types/candidateTest";

export type ReviewAnswerRow = {
  questionId: string;
  questionText: string;
  options: string[];
  selectedOption: number;
  isCorrect: boolean;
};

export async function loadMcqReviewAnswers(
  admin: SupabaseClient,
  applicationId: string,
  attemptId: string
): Promise<ReviewAnswerRow[]> {
  const { data: ct } = await admin
    .from("candidate_tests")
    .select("questions")
    .eq("application_id", applicationId)
    .maybeSingle();
  const snap = (ct?.questions as TestSnapshotItem[] | null) || [];
  const snapByKey = new Map(snap.map((q) => [q.key, q]));

  const { data: rows } = await admin
    .from("mcq_attempt_answers")
    .select("question_id, snapshot_question_key, selected_option, is_correct")
    .eq("attempt_id", attemptId);

  const legacyIds = (rows || [])
    .filter((r) => r.question_id && !r.snapshot_question_key)
    .map((r) => String(r.question_id));
  const legacyMap = new Map<string, { id: string; question_text: string; options: string[] }>();
  if (legacyIds.length) {
    const { data: mq } = await admin.from("mcq_questions").select("id, question_text, options").in("id", legacyIds);
    for (const q of mq || []) {
      legacyMap.set(String(q.id), {
        id: String(q.id),
        question_text: String(q.question_text),
        options: q.options as string[],
      });
    }
  }

  const out: ReviewAnswerRow[] = [];
  for (const row of rows || []) {
    const key = row.snapshot_question_key;
    if (key && snapByKey.has(key)) {
      const q = snapByKey.get(key)!;
      out.push({
        questionId: q.key,
        questionText: q.question,
        options: q.options,
        selectedOption: Number(row.selected_option),
        isCorrect: Boolean(row.is_correct),
      });
    } else if (row.question_id && legacyMap.has(String(row.question_id))) {
      const q = legacyMap.get(String(row.question_id))!;
      out.push({
        questionId: q.id,
        questionText: q.question_text,
        options: q.options,
        selectedOption: Number(row.selected_option),
        isCorrect: Boolean(row.is_correct),
      });
    }
  }
  return out;
}
