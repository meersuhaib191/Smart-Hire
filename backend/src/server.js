import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import db from "./config/db.js";

// Routes
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import recruiterRoutes from "./routes/recruiterRoutes.js";
import candidateRoutes from "./routes/candidateRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";

dotenv.config();
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Serve uploaded files (VERY IMPORTANT)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/recruiter", recruiterRoutes);
app.use("/api/candidate", candidateRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/applications", applicationRoutes);

// Default route
app.get("/", (req, res) => {
  res.send("SmartHire API is running...");
});
app.use("/uploads", express.static("uploads"));


// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
