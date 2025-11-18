import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { upload } from "../utils/upload.js";
import {
  applyToJob,
  listCandidateApplications,
  listApplicantsForJob,
  changeApplicationStatus,
} from "../controllers/applicationController.js";

const router = express.Router();

// Candidate apply to job
router.post("/apply", authMiddleware(), upload.single("resume"), applyToJob);

// Candidate sees all applications
router.get("/mine", authMiddleware(), listCandidateApplications);

// Recruiter/Admin — view applicants for job
router.get("/job/:jobId", authMiddleware(["recruiter", "admin"]), listApplicantsForJob);

// Recruiter/Admin — change applicant status
router.put(
  "/status/:applicationId",
  authMiddleware(["recruiter", "admin"]),
  changeApplicationStatus
);

export default router;
