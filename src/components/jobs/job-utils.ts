import type { PublicJob, SanitizedJob } from "@/components/jobs/types";

const EXPERIENCE_KEYWORDS: Array<{ label: string; terms: string[] }> = [
  { label: "Lead", terms: ["lead", "principal", "staff"] },
  { label: "Senior", terms: ["senior", "sr.", "expert"] },
  { label: "Mid", terms: ["mid", "intermediate", "ii"] },
  { label: "Entry", terms: ["junior", "entry", "intern", "graduate"] },
];

const TYPE_KEYWORDS: Array<{ label: string; terms: string[] }> = [
  { label: "Contract", terms: ["contract", "freelance"] },
  { label: "Part-time", terms: ["part-time", "part time"] },
  { label: "Internship", terms: ["intern"] },
  { label: "Full-time", terms: ["full-time", "full time"] },
];

const LOCATION_KEYWORDS: Array<{ label: string; terms: string[] }> = [
  { label: "Remote", terms: ["remote"] },
  { label: "Hybrid", terms: ["hybrid"] },
  { label: "On-site", terms: ["on-site", "onsite", "office"] },
];

const salaryRegex = /(\$|usd|eur|inr)\s?\d{2,3}(?:[,.]\d{1,3})?\s?(?:k|K|\/year|year|yr)?/g;

function titleize(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
}

export function cleanJobTitle(rawTitle: string) {
  if (!rawTitle) return "Untitled role";
  const normalized = rawTitle
    .replace(/\b(?:id|job|req)[:\- ]*[a-z0-9-]{6,}\b/gi, "")
    .replace(/\b[a-f0-9]{8}-[a-f0-9-]{27,}\b/gi, "")
    .replace(/[#(]?\d{4,}[)]?/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return normalized || "Untitled role";
}

export function cleanCompanyName(rawCompany: string) {
  if (!rawCompany) return "Company";
  const words = rawCompany
    .trim()
    .split(/\s+/)
    .filter((word) => !/^\d{6,}$/.test(word))
    .filter((word) => !/^[a-f0-9]{8}-[a-f0-9-]{27,}$/i.test(word));
  const deduped = words.filter((word, idx) => {
    if (idx === 0) return true;
    return word.toLowerCase() !== words[idx - 1].toLowerCase();
  });
  return deduped.join(" ") || "Company";
}

function inferLabel(source: string, options: Array<{ label: string; terms: string[] }>, fallback: string) {
  const value = source.toLowerCase();
  const match = options.find((option) => option.terms.some((term) => value.includes(term)));
  return match?.label || fallback;
}

function inferSalary(description: string) {
  const matches = description.match(salaryRegex);
  if (!matches || matches.length === 0) return "Compensation disclosed later";
  return matches.slice(0, 2).join(" - ");
}

export function sanitizeJob(job: PublicJob): SanitizedJob {
  const combined = `${job.title} ${job.description} ${job.skills.join(" ")}`;
  return {
    ...job,
    title: cleanJobTitle(job.title),
    company: cleanCompanyName(job.company),
    typeLabel: inferLabel(combined, TYPE_KEYWORDS, "Full-time"),
    experienceLabel: inferLabel(combined, EXPERIENCE_KEYWORDS, "Mid"),
    locationLabel: inferLabel(combined, LOCATION_KEYWORDS, "Remote-friendly"),
    salaryLabel: inferSalary(job.description),
  };
}

export function buildCompanyLogoLabel(company: string) {
  const words = company.trim().split(/\s+/).slice(0, 2);
  const initials = words.map((word) => word.charAt(0).toUpperCase()).join("");
  return initials || "SH";
}

export function splitDescription(content: string) {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const bullets = lines.filter((line) => /^[-*•]/.test(line)).map((line) => line.replace(/^[-*•]\s*/, ""));
  const paragraphs = lines.filter((line) => !/^[-*•]/.test(line));
  const responsibilities = bullets.slice(0, 5);
  const requirements = bullets.slice(5, 10);

  return {
    summary: paragraphs.slice(0, 2).join(" ") || "This role offers the opportunity to build high-impact products with a collaborative team.",
    responsibilities:
      responsibilities.length > 0
        ? responsibilities
        : ["Own feature delivery from discovery through release", "Partner with cross-functional teammates to drive outcomes", "Improve quality, performance, and maintainability across the stack"],
    requirements:
      requirements.length > 0
        ? requirements
        : ["Strong problem-solving and communication skills", "Hands-on experience in modern product development", "Ability to collaborate in fast-moving teams"],
  };
}

export function formatSkillTags(skills: string[]) {
  if (!skills.length) return ["Communication", "Ownership", "Collaboration"];
  return Array.from(new Set(skills.map((skill) => titleize(skill.trim())).filter(Boolean))).slice(0, 8);
}
