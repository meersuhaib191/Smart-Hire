import {
  createJob,
  getAllJobs,
  getJobsByRecruiter,
  getJobById,
  updateJob,
  deleteJob
} from "../models/jobModel.js";

export const postJob = (req, res) => {
  const jobData = {
    ...req.body,
    recruiter_id: req.user.id
  };

  createJob(jobData, (err, result) => {
    if (err) return res.status(500).json({ message: "DB Error", err });

    res.status(201).json({
      message: "Job posted successfully",
      jobId: result.insertId
    });
  });
};

export const getMyJobs = (req, res) => {
  getJobsByRecruiter(req.user.id, (err, results) => {
    if (err) return res.status(500).json({ message: "DB Error", err });
    res.json(results);
  });
};

export const getJob = (req, res) => {
  const jobId = req.params.id;

  getJobById(jobId, (err, results) => {
    if (err) return res.status(500).json({ message: "DB Error", err });

    if (results.length === 0)
      return res.status(404).json({ message: "Job not found" });

    res.json(results[0]);
  });
};

export const editJob = (req, res) => {
  const jobId = req.params.id;

  getJobById(jobId, (err, results) => {
    if (err) return res.status(500).json({ message: "DB Error", err });
    if (results.length === 0)
      return res.status(404).json({ message: "Job not found" });

    if (results[0].recruiter_id !== req.user.id)
      return res.status(403).json({ message: "Unauthorized" });

    updateJob(req.body, jobId, (err2) => {
      if (err2) return res.status(500).json({ message: "DB Error", err2 });

      res.json({ message: "Job updated successfully" });
    });
  });
};

export const removeJob = (req, res) => {
  const jobId = req.params.id;

  getJobById(jobId, (err, results) => {
    if (err) return res.status(500).json({ message: "DB Error", err });
    if (results.length === 0)
      return res.status(404).json({ message: "Job not found" });

    if (results[0].recruiter_id !== req.user.id)
      return res.status(403).json({ message: "Unauthorized" });

    deleteJob(jobId, (err2) => {
      if (err2) return res.status(500).json({ message: "DB Error", err2 });

      res.json({ message: "Job deleted successfully" });
    });
  });
};
