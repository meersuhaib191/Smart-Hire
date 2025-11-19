// src/utils/scoreCalculator.js

/**
 * calculateResumeScore(parsed, jobSkills)
 * Returns integer 0..50 based on:
 * - skills match (max 25)
 * - experience (max 15)
 * - education + summary (max 10)
 */
export function calculateResumeScore(parsed = {}, jobSkills = []) {
  let score = 0;
  const parsedSkills = (parsed.skills || []).map(s => s.toLowerCase());

  // 1. Skill match
  if (Array.isArray(jobSkills) && jobSkills.length > 0) {
    const matched = parsedSkills.filter(s => jobSkills.map(j => j.toLowerCase()).includes(s));
    score += Math.min(matched.length * 5, 25); // each skill 5 points, cap 25
  } else {
    // if no jobSkills provided, give partial credit for any recognized skills
    score += Math.min(parsedSkills.length * 3, 15);
  }

  // 2. Experience
  const years = parsed.experience_years || 0;
  score += Math.min(years * 2, 15); // 2 points per year up to 15

  // 3. Education & contact info
  if (parsed.education) score += 5;
  if (parsed.email || parsed.phone) score += 3;

  // 4. Normalize to max 50
  return Math.min(Math.round(score), 50);
}
