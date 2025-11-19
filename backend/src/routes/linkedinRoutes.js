// src/routes/linkedinRoutes.js
import express from "express";
import { linkedinAuthStart, linkedinAuthCallback } from "../controllers/linkedinController.js";

const router = express.Router();

// Redirect to LinkedIn consent
router.get("/start", linkedinAuthStart);

// LinkedIn callback URL (set this in your LinkedIn app)
router.get("/callback", linkedinAuthCallback);

export default router;
