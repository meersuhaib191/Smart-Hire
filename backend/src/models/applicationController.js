import {
  insertApplication,
  findApplication,
  getApplicationsByCandidate,
  getApplicationsByJob,
  updateApplicationStatus,
} from "../models/applicationModel.js";

export const applyToJob = (req, res) => {
  const candidate_id = req.user.id;
  const { job_id, cover_letter } = req.body;

  if (!job_id) {
    return res.status(400).json({ message: "job_id required" });
  }

  const resume_url = req.file ? `/uploads/${req.file.filename}` : null;

  // Step 1 — Check if already applied
  findApplication(job_id, candidate_id, (err, result) => {
    if (err) return res.status(500).json({ message: "Database error", err });

    if (result.length > 0) {
      return res.status(409).json({ message: "Already applied" });
    }

    // Step 2 — Insert new application
    insertApplication(
      { job_id, candidate_id, resume_url, cover_letter },
      (err2, insertResult) => {
        if (err2) return res.status(500).json({ message: "Database error", err: err2 });

        res.status(201).json({
          message: "Application submitted",
          applicationId: insertResult.insertId,
        });
      }
    );
  });
};

export const listCandidateApplications = (req, res) => {
  const candidate_id = req.user.id;

  getApplicationsByCandidate(candidate_id, (err, results) => {
    if (err) return res.status(500).json({ message: "Database error", err });
    res.json(results);
  });
};

export const listApplicantsForJob = (req, res) => {
  const job_id = req.params.jobId;

  getApplicationsByJob(job_id, (err, results) => {
    if (err) return res.status(500).json({ message: "Database error", err });
    res.json(results);
  });
};

export const changeApplicationStatus = (req, res) => {
  const { applicationId } = req.params;
  const { status } = req.body;

  updateApplicationStatus(applicationId, status, (err) => {
    if (err) return res.status(500).json({ message: "Database error", err });
    res.json({ message: "Status updated" });
  });
};
