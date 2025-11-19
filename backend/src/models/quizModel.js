// src/models/quizModel.js
import db from "../config/db.js";

export const insertQuestion = (payload, cb) => {
  const sql = `INSERT INTO quiz_questions
    (job_id, question, option_a, option_b, option_c, option_d, correct_option)
    VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.query(sql, [payload.job_id, payload.question, payload.option_a, payload.option_b, payload.option_c, payload.option_d, payload.correct_option], cb);
};

export const getQuestionsByJob = (job_id, cb) => {
  const sql = "SELECT id, job_id, question, option_a, option_b, option_c, option_d FROM quiz_questions WHERE job_id = ?";
  db.query(sql, [job_id], cb);
};

export const getAnswersByIds = (ids, cb) => {
  const sql = `SELECT id, correct_option FROM quiz_questions WHERE id IN (?)`;
  db.query(sql, [ids], cb);
};
