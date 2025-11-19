// src/controllers/profileController.js
import { findLatestByCandidate } from "../models/resumeModel.js";

/**
 * Returns candidate profile built from latest resume
 */
export const getProfileFromResume = (req, res) => {
  const candidate_id = req.user.id;
  findLatestByCandidate(candidate_id, (err, results) => {
    if (err) return res.status(500).json({ message: "DB error", err });
    if (!results[0]) return res.status(404).json({ message: "No resume found" });

    const r = results[0];
    const parsed = r.parsed_json ? JSON.parse(r.parsed_json) : {};
    // shape a profile
    const profile = {
      name: req.user.name || null,
      email: parsed.email || req.user.email,
      phone: parsed.phone || null,
      skills: parsed.skills || [],
      experience_years: parsed.experience_years || 0,
      education: parsed.education || null,
      resume_url: r.file_path,
    };
    res.json(profile);
  });
};
