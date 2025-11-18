import db from "../config/db.js";

export const createJob = (jobData, callback) => {
  const sql = `
    INSERT INTO jobs (title, company, location, salary, description, experience, type, postedBy)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [
    jobData.title,
    jobData.company,
    jobData.location,
    jobData.salary,
    jobData.description,
    jobData.experience,
    jobData.type,
    jobData.postedBy
  ];
  db.query(sql, values, callback);
};

export const getAllJobs = (callback) => {
  const sql = "SELECT * FROM jobs ORDER BY created_at DESC";
  db.query(sql, callback);
};

export const getJobById = (id, callback) => {
  const sql = "SELECT * FROM jobs WHERE id = ?";
  db.query(sql, [id], callback);
};

export const getJobsByRecruiter = (recruiterId, callback) => {
  const sql = "SELECT * FROM jobs WHERE postedBy = ? ORDER BY created_at DESC";
  db.query(sql, [recruiterId], callback);
};

export const updateJob = (data, id, callback) => {
  const sql = `
    UPDATE jobs SET 
      title=?, company=?, location=?, salary=?, description=?, experience=?, type=?
    WHERE id=?
  `;
  const values = [
    data.title,
    data.company,
    data.location,
    data.salary,
    data.description,
    data.experience,
    data.type,
    id
  ];
  db.query(sql, values, callback);
};

export const deleteJob = (id, callback) => {
  const sql = "DELETE FROM jobs WHERE id = ?";
  db.query(sql, [id], callback);
};
