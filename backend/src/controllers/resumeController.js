// src/controllers/resumeController.js
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  insertResume,
  findResumeById,
} from "../models/resumeModel.js";
import { parseResumeText } from "../utils/resumeParser.js";
import { calculateResumeScore } from "../utils/scoreCalculator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const uploadResume = async (req, res) => {
  try {
    const candidate_id = req.user.id;
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const filePath = `/uploads/resumes/${req.file.filename}`;
    // parse file (pdf/docx handled by parser)
    const parsed = await parseResumeText(req.file.path);

    // compute a resume score (jobSkills empty for now)
    const resume_score = calculateResumeScore(parsed, []);

    // save to DB
    insertResume(
      {
        candidate_id,
        filename: req.file.filename,
        file_path: filePath,
        parsed_json: JSON.stringify(parsed),
        resume_score,
      },
      (err, result) => {
        if (err) return res.status(500).json({ message: "DB Error", err });
        res.status(201).json({ message: "Resume uploaded", resumeId: result.insertId, parsed, resume_score });
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", err });
  }
};

export const getParsedResume = (req, res) => {
  const resumeId = req.params.resumeId;
  findResumeById(resumeId, (err, results) => {
    if (err) return res.status(500).json({ message: "DB error", err });
    if (!results[0]) return res.status(404).json({ message: "Resume not found" });
    const r = results[0];
    const parsed = r.parsed_json ? JSON.parse(r.parsed_json) : null;
    res.json({ resumeId: r.id, filename: r.filename, parsed, resume_score: r.resume_score });
  });
};

export const getResumeFile = (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(process.cwd(), "uploads", "resumes", filename);
  if (!fs.existsSync(filePath)) return res.status(404).send("Not found");
  res.download(filePath);
};
