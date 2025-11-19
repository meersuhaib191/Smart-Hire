// src/utils/resumeParser.js
import { extractTextFromFile } from "./pdfTextExtractor.js";

/**
 * Basic rule-based resume parser.
 * Extracts:
 * - plain text
 * - skills (by matching common keywords)
 * - experience (years)
 * - education level tokens
 */
const SKILL_KEYWORDS = [
  "javascript","typescript","react","vue","angular","node","express",
  "python","java","c++","c#","sql","mysql","postgres","mongodb",
  "aws","gcp","azure","docker","kubernetes","git","html","css",
  "django","flask","spring","laravel","php","ruby","rails"
];

export async function parseResumeText(filePath) {
  const text = (await extractTextFromFile(filePath)) || "";
  const lower = text.toLowerCase();

  // skill extraction (unique)
  const skills = Array.from(
    new Set(
      SKILL_KEYWORDS.filter((kw) => lower.includes(kw))
    )
  );

  // experience: search for "X years" pattern
  let years = 0;
  const expMatch = lower.match(/(\d+)\+?\s+(years|yrs|year)\b/);
  if (expMatch) years = parseInt(expMatch[1], 10);

  // education
  let education = null;
  if (lower.match(/ph\.?d|phd/)) education = "PhD";
  else if (lower.match(/master|m\.sc|mtech|m\.tech|mba/)) education = "Master";
  else if (lower.match(/bachelor|b\.tech|btech|b\.sc|bsc/)) education = "Bachelor";

  // email, phone simple extraction
  const emailMatch = lower.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
  const phoneMatch = lower.match(/(\+?\d{1,3}[-.\s]?)?(\d{10}|\d{3}[-.\s]\d{3}[-.\s]\d{4})/);

  return {
    text,
    skills,
    experience_years: years,
    education,
    email: emailMatch ? emailMatch[0] : null,
    phone: phoneMatch ? phoneMatch[0] : null,
  };
}
