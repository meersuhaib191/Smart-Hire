import db from "../config/db.js";

export const insertApplication = (data, cb) => {
  const sql = `INSERT INTO applications (job_id, candidate_id, resume_url, cover_letter) 
               VALUES (?, ?, ?, ?)`;
  const values = [
    data.job_id,
    data.candidate_id,
    data.resume_url || null,
    data.cover_letter || null,
  ];

  db.query(sql, values, cb);
};

export const findApplication = (job_id, candidate_id, cb) => {
  const sql = `SELECT * FROM applications WHERE job_id = ? AND candidate_id = ?`;
  db.query(sql, [job_id, candidate_id], cb);
};

export const getApplicationsByCandidate = (candidate_id, cb) => {
  const sql = `
      SELECT a.*, j.title, j.company 
      FROM applications a 
      JOIN jobs j ON a.job_id = j.id 
      WHERE a.candidate_id = ?
      ORDER BY applied_at DESC
    `;
  db.query(sql, [candidate_id], cb);
};

export const getApplicationsByJob = (job_id, cb) => {
  const sql = `
      SELECT a.*, u.name AS candidate_name, u.email AS candidate_email
      FROM applications a 
      JOIN users u ON a.candidate_id = u.user_id
      WHERE a.job_id = ?
      ORDER BY applied_at DESC
    `;
  db.query(sql, [job_id], cb);
};

export const updateApplicationStatus = (id, status, cb) => {
  const sql = `UPDATE applications SET status = ? WHERE id = ?`;
  db.query(sql, [status, id], cb);
};
