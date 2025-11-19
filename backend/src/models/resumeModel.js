// src/models/resumeModel.js
import db from "../config/db.js";

export const insertResume = (data, cb) => {
  const sql = `INSERT INTO resumes (candidate_id, filename, file_path, parsed_json, resume_score, created_at)
    VALUES (?, ?, ?, ?, ?, NOW())`;
  db.query(sql, [data.candidate_id, data.filename, data.file_path, data.parsed_json, data.resume_score], cb);
};

export const findResumeById = (id, cb) => {
  const sql = "SELECT * FROM resumes WHERE id = ?";
  db.query(sql, [id], cb);
};

export const findLatestByCandidate = (candidate_id, cb) => {
  const sql = "SELECT * FROM resumes WHERE candidate_id = ? ORDER BY id DESC LIMIT 1";
  db.query(sql, [candidate_id], cb);
};
