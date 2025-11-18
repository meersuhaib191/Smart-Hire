import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  postJob,
  getJobs,
  getMyJobs,
  getJob,
  editJob,
  removeJob
} from "../controllers/jobController.js";

const router = express.Router();

// Public
router.get("/", getJobs);
router.get("/:id", getJob);

// Recruiter/Admin only
router.post("/post", authMiddleware(["recruiter", "admin"]), postJob);
router.get("/my-jobs/list", authMiddleware(["recruiter", "admin"]), getMyJobs);
router.put("/update/:id", authMiddleware(["recruiter", "admin"]), editJob);
router.delete("/delete/:id", authMiddleware(["recruiter", "admin"]), removeJob);

export default router;
