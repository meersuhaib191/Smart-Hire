// controllers/applicationController.js

import {
  insertApplication,
  findApplication,
  getApplicationsByCandidate,
  getApplicationsByJob,
  updateApplicationStatus,
} from "../models/applicationModel.js";

// =======================================================
// CANDIDATE — APPLY TO JOB
// =======================================================
export const applyToJob = (req, res) => {
  const candidate_id = req.user.id; // always trust token, NOT body
  const { job_id, cover_letter } = req.body;

  if (!job_id) {
    return res.status(400).json({ message: "Job ID is required" });
  }

  if (!req.file) {
    return res.status(400).json({ message: "Resume file is required" });
  }

  const resume_url = `/uploads/${req.file.filename}`;

  // Step 1 — Check if already applied
  findApplication(job_id, candidate_id, (err, result) => {
    if (err) {
      return res.status(500).json({ message: "Database error", err });
    }

    if (result.length > 0) {
      return res.status(409).json({ message: "You already applied to this job" });
    }

    // Step 2 — Insert new application
    insertApplication(
      { job_id, candidate_id, resume_url, cover_letter },
      (err2, insertResult) => {
        if (err2) {
          return res.status(500).json({ message: "Database error", err: err2 });
        }

        res.status(201).json({
          message: "Application submitted successfully",
          applicationId: insertResult.insertId,
          resume_url,
        });
      }
    );
  });
};

// =======================================================
// CANDIDATE — VIEW MY APPLICATIONS
// =======================================================
export const listCandidateApplications = (req, res) => {
  const candidate_id = req.user.id;

  getApplicationsByCandidate(candidate_id, (err, results) => {
    if (err) {
      return res.status(500).json({ message: "Database error", err });
    }

    res.json({ applications: results });
  });
};

// =======================================================
// RECRUITER / ADMIN — VIEW APPLICANTS OF A JOB
// =======================================================
export const listApplicantsForJob = (req, res) => {
  const job_id = req.params.jobId;

  getApplicationsByJob(job_id, (err, results) => {
    if (err) {
      return res.status(500).json({ message: "Database error", err });
    }

    res.json({ applicants: results });
  });
};

// =======================================================
// RECRUITER / ADMIN — CHANGE APPLICATION STATUS
// =======================================================
export const changeApplicationStatus = (req, res) => {
  const { applicationId } = req.params;
  const { status } = req.body;

  // Allowed statuses
  const validStatuses = ["pending", "reviewing", "accepted", "rejected"];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      message: "Invalid status. Allowed values: pending, reviewing, accepted, rejected",
    });
  }

  updateApplicationStatus(applicationId, status, (err) => {
    if (err) {
      return res.status(500).json({ message: "Database error", err });
    }

    res.json({ message: "Application status updated successfully" });
  });
};
