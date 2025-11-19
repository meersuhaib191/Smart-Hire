// src/services/rankingService.js
import db from "../config/db.js";

/**
 * Get ranked candidates for a job
 * final_score = resume_score (0..50) + quiz_score (0..50)
 * We assume applications table holds resume_score & quiz_score (or compute on the fly).
 */
export function getRankedApplicants(job_id, cb) {
  const sql = `
    SELECT a.*, u.name, u.email,
      COALESCE(a.resume_score,0) as resume_score,
      COALESCE(a.quiz_score,0) as quiz_score,
      (COALESCE(a.resume_score,0) + COALESCE(a.quiz_score,0)) as final_score
    FROM applications a
    JOIN users u ON u.id = a.candidate_id
    WHERE a.job_id = ?
    ORDER BY final_score DESC, a.created_at DESC
  `;
  db.query(sql, [job_id], cb);
}
