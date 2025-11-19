// src/routes/quizRoutes.js
import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getQuestionsForJob,
  submitQuizAnswers,
  createQuestion,
} from "../controllers/quizController.js";

const router = express.Router();

// Get questions for job (public)
router.get("/:jobId", getQuestionsForJob);

// Candidate submits quiz answers
router.post("/submit", authMiddleware(), submitQuizAnswers);

// Recruiter creates question(s)
router.post("/create", authMiddleware(["recruiter"]), createQuestion);

export default router;
