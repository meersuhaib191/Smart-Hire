// routes/applicationRoutes.js
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

/* ============================================================
   CANDIDATE — Apply to Job
   Requires:
     - Authenticated candidate
     - resume file uploaded using "resume"
     - formData: job_id, candidate_id, cover_letter
   ============================================================ */
router.post(
  "/apply",
  authMiddleware(["candidate"]),   // Only candidates can apply
  upload.single("resume"),
  applyToJob
);

/* ============================================================
   CANDIDATE — View My Applications
   Fetches all applications where candidate_id = logged in user
   ============================================================ */
router.get(
  "/mine",
  authMiddleware(["candidate"]),
  listCandidateApplications
);

/* ============================================================
   RECRUITER / ADMIN — View applicants for a specific job
   ============================================================ */
router.get(
  "/job/:jobId",
  authMiddleware(["recruiter", "admin"]),
  listApplicantsForJob
);

/* ============================================================
   RECRUITER / ADMIN — Change an applicant's status
   Example statuses: "accepted", "rejected", "reviewing"
   ============================================================ */
router.put(
  "/status/:applicationId",
  authMiddleware(["recruiter", "admin"]),
  changeApplicationStatus
);

export default router;
