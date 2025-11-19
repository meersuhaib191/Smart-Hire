// src/models/profileModel.js
import db from "../config/db.js";

// Optional: if you want to store enriched profile data persistently
export const upsertProfile = (candidate_id, profileObj, cb) => {
  // Simple example: insert or update a 'profiles' table (not required to run)
  const sql = `
    INSERT INTO profiles (candidate_id, profile_json, updated_at)
    VALUES (?, ?, NOW())
    ON DUPLICATE KEY UPDATE profile_json = VALUES(profile_json), updated_at = NOW()
  `;
  db.query(sql, [candidate_id, JSON.stringify(profileObj)], cb);
};
