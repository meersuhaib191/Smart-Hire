// src/services/quizEngine.js

/**
 * Simple evaluator:
 * - Each question equal weight
 * - Total available = 50
 */
export function evaluateQuiz(submittedAnswers = [], correctMap = {}) {
  const totalQuestions = submittedAnswers.length;
  if (totalQuestions === 0) return 0;

  let correctCount = 0;
  submittedAnswers.forEach((a) => {
    const qid = a.questionId;
    const ans = (a.answer || "").toString().trim().toLowerCase();
    if (correctMap[qid] && correctMap[qid] === ans) correctCount++;
  });

  const perQuestion = 50 / totalQuestions;
  const score = Math.round(correctCount * perQuestion);
  return Math.min(score, 50);
}
