import db from "../config/db.js";

export const createJob = (data, callback) => {
  db.query("INSERT INTO jobs SET ?", data, callback);
};

export const getAllJobs = (callback) => {
  db.query("SELECT * FROM jobs ORDER BY created_at DESC", callback);
};

export const getJobsByRecruiter = (recruiter_id, callback) => {
  db.query(
    "SELECT * FROM jobs WHERE recruiter_id = ? ORDER BY created_at DESC",
    [recruiter_id],
    callback
  );
};

export const getJobById = (id, callback) => {
  db.query("SELECT * FROM jobs WHERE id = ?", [id], callback);
};

export const updateJob = (data, id, callback) => {
  db.query("UPDATE jobs SET ? WHERE id = ?", [data, id], callback);
};

export const deleteJob = (id, callback) => {
  db.query("DELETE FROM jobs WHERE id = ?", [id], callback);
};
