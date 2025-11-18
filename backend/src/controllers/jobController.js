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
    postedBy: req.user.id
  };

  createJob(jobData, (err, result) => {
    if (err) return res.status(500).json({ message: "DB Error", err });

    res.status(201).json({
      message: "Job posted successfully",
      jobId: result.insertId
    });
  });
};

export const getJobs = (req, res) => {
  getAllJobs((err, results) => {
    if (err) return res.status(500).json({ message: "DB Error", err });
    res.json(results);
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
    if (results.length === 0) return res.status(404).json({ message: "Job not found" });
    res.json(results[0]);
  });
};

export const editJob = (req, res) => {
  const jobId = req.params.id;
  const recruiterId = req.user.id;

  // Verify job ownership
  getJobById(jobId, (err, results) => {
    if (err) return res.status(500).json({ message: "DB Error", err });
    if (results.length === 0) return res.status(404).json({ message: "Job not found" });

    if (results[0].postedBy !== recruiterId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    updateJob(req.body, jobId, (updateErr) => {
      if (updateErr) return res.status(500).json({ message: "DB Error", updateErr });

      res.json({ message: "Job updated successfully" });
    });
  });
};

export const removeJob = (req, res) => {
  const jobId = req.params.id;
  const recruiterId = req.user.id;

  getJobById(jobId, (err, results) => {
    if (err) return res.status(500).json({ message: "DB Error", err });
    if (results.length === 0) return res.status(404).json({ message: "Job not found" });

    if (results[0].postedBy !== recruiterId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    deleteJob(jobId, (deleteErr) => {
      if (deleteErr) return res.status(500).json({ message: "DB Error", deleteErr });

      res.json({ message: "Job deleted successfully" });
    });
  });
};
