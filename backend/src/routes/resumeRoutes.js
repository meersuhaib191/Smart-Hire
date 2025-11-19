// src/routes/resumeRoutes.js
import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { upload } from "../middleware/upload.js"; // multer uploader (single 'resume')
import {
  uploadResume,
  getParsedResume,
  getResumeFile,
} from "../controllers/resumeController.js";

const router = express.Router();

// Upload resume (candidate)
router.post("/upload", authMiddleware(), upload.single("resume"), uploadResume);

// Get parsed resume JSON (candidate view)
router.get("/parsed/:resumeId", authMiddleware(), getParsedResume);

// Serve resume file (download)
router.get("/file/:filename", authMiddleware(), getResumeFile);

export default router;
