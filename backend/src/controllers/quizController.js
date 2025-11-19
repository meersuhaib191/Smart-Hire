// src/controllers/quizController.js
import { getQuestionsByJob, insertQuestion, getAnswersByIds } from "../models/quizModel.js";
import { evaluateQuiz } from "../services/quizEngine.js";
import { updateApplicationQuizScore } from "../models/applicationModel.js";

/**
 * Get questions for a job (sanitized, no correct answers)
 */
export const getQuestionsForJob = (req, res) => {
  const jobId = req.params.jobId;
  getQuestionsByJob(jobId, (err, results) => {
    if (err) return res.status(500).json({ message: "DB error", err });
    res.json(results);
  });
};

/**
 * Candidate submits quiz answers:
 * payload: { jobId, answers: [{ questionId, answer }] }
 * returns quiz_score (0..50)
 */
export const submitQuizAnswers = (req, res) => {
  const candidate_id = req.user.id;
  const { jobId, answers } = req.body;

  if (!Array.isArray(answers) || answers.length === 0) return res.status(400).json({ message: "Answers required" });

  const ids = answers.map(a => a.questionId);

  getAnswersByIds(ids, (err, correctRows) => {
    if (err) return res.status(500).json({ message: "DB error", err });

    const correctMap = {};
    correctRows.forEach(r => (correctMap[r.id] = r.correct_option.toLowerCase()));

    // evaluate
    const quizScore = evaluateQuiz(answers, correctMap); // returns 0..50

    // OPTIONAL: update application record if exists for (candidate, job)
    // updateApplicationQuizScore(jobId, candidate_id, quizScore, (uerr) => { ... });

    res.json({ quiz_score: quizScore });
  });
};

/**
 * Recruiter creates a new question
 */
export const createQuestion = (req, res) => {
  const payload = req.body; // job_id, question, option_a... correct_option
  insertQuestion(payload, (err, result) => {
    if (err) return res.status(500).json({ message: "DB error", err });
    res.json({ message: "Question added", id: result.insertId });
  });
};
