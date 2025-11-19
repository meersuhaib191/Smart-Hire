// src/routes/profileRoutes.js
import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { getProfileFromResume } from "../controllers/profileController.js";

const router = express.Router();

// Candidate endpoints
router.get("/me", authMiddleware(), getProfileFromResume);

export default router;
