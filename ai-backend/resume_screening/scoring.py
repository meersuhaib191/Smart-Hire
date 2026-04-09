from __future__ import annotations

from dataclasses import dataclass
import re

from .semantic import SemanticScorer, SemanticResult
from .skills import SkillScoreResult, compute_skill_score


def _clamp_0_100(value: float) -> float:
    return max(0.0, min(100.0, value))


DATA_ROLES = ("data analyst", "data scientist", "data engineer", "ml engineer", "machine learning engineer")
BUSINESS_ROLES = ("business analyst",)
DEV_ROLES = ("frontend", "backend", "full stack", "fullstack", "software engineer")

DATA_KEYWORDS = {
    "pandas", "numpy", "analysis", "analytics", "sql", "tableau", "power bi",
    "dashboard", "kpi", "reporting", "machine learning", "model",
}
BUSINESS_KEYWORDS = {"stakeholder", "requirements", "business process", "documentation", "roadmap"}
DEV_KEYWORDS = {"react", "javascript", "typescript", "api", "fastapi", "backend", "frontend", "node"}


def infer_role_from_job_description(job_description: str) -> str:
    jd = job_description.lower()
    for role in DATA_ROLES:
        if role in jd:
            return role
    for role in BUSINESS_ROLES:
        if role in jd:
            return role
    for role in DEV_ROLES:
        if role in jd:
            return role
    return "unknown"


def detect_domain(text: str) -> str:
    content = text.lower()
    data_hits = sum(1 for k in DATA_KEYWORDS if k in content)
    business_hits = sum(1 for k in BUSINESS_KEYWORDS if k in content)
    dev_hits = sum(1 for k in DEV_KEYWORDS if k in content)
    if max(data_hits, business_hits, dev_hits) == 0:
        return "unknown"
    if data_hits >= business_hits and data_hits >= dev_hits:
        return "data"
    if business_hits >= dev_hits:
        return "business"
    return "dev"


def role_domain(role: str) -> str:
    role_l = role.lower()
    if any(tag in role_l for tag in DATA_ROLES):
        return "data"
    if any(tag in role_l for tag in BUSINESS_ROLES):
        return "business"
    if any(tag in role_l for tag in DEV_ROLES):
        return "dev"
    return "unknown"


def compute_semantic_score(
    scorer: SemanticScorer,
    resume_text: str,
    job_description: str,
    domain_match: bool = True,
) -> SemanticResult:
    base = scorer.score(resume_text, job_description)
    if not domain_match:
        base.score = round(_clamp_0_100(base.score * 0.7), 2)
    return base


@dataclass
class ExperienceScoreResult:
    score: float
    candidate_years: float
    required_years: float | None
    fresher: bool
    has_projects: bool
    no_real_experience: bool


def _extract_required_experience_years(job_description: str) -> float | None:
    jd = job_description.lower()
    patterns = [
        r"(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)\s+(?:of\s+)?experience",
        r"(?:minimum|min)\s+(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)",
        r"(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(?:years|yrs)",
    ]
    for pattern in patterns:
        match = re.search(pattern, jd)
        if not match:
            continue
        if len(match.groups()) == 2:
            low, high = float(match.group(1)), float(match.group(2))
            return max(low, high)
        return float(match.group(1))
    return None


def _extract_candidate_experience_years(resume_text: str) -> float:
    text = resume_text.lower()
    # direct mentions: "5 years", "3+ years"
    direct_matches = re.findall(r"(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)\s+(?:of\s+)?experience", text)
    direct_years = [float(x) for x in direct_matches] if direct_matches else []

    # "2019 - 2024" style ranges
    range_matches = re.findall(r"(20\d{2})\s*[-–]\s*(20\d{2}|present|current)", text)
    ranged_years: list[float] = []
    for start, end in range_matches:
        end_year = 2026 if end in {"present", "current"} else int(end)
        duration = max(0, end_year - int(start))
        ranged_years.append(float(duration))

    # Weighted signal by context:
    internship_mentions = len(re.findall(r"\bintern(ship)?\b", text))
    project_mentions = len(re.findall(r"\bprojects?\b", text))
    work_mentions = len(re.findall(r"\b(engineer|developer|analyst|scientist|consultant|lead)\b", text))

    if direct_years:
        # Prefer explicit "X years of experience" when available.
        base = max(direct_years)
        bonus = 0.0
    else:
        base = max(ranged_years + [0.0])
        bonus = min(2.0, 0.4 * work_mentions)
    penalty = min(2.5, 0.5 * internship_mentions + 0.3 * project_mentions)
    effective = max(0.0, base + bonus - penalty)
    return round(effective, 2)


def _has_project_signal(resume_text: str) -> bool:
    text = resume_text.lower()
    return any(token in text for token in ("project", "capstone", "github", "portfolio", "built "))


def _has_real_work_signal(resume_text: str) -> bool:
    text = resume_text.lower()
    return any(
        token in text
        for token in ("worked at", "experience as", "full-time", "company", "employment", "engineer at", "analyst at")
    )


def compute_experience_score(
    resume_text: str,
    job_description: str,
    role: str = "unknown",
) -> ExperienceScoreResult:
    candidate_exp = _extract_candidate_experience_years(resume_text)
    required_exp = _extract_required_experience_years(job_description)
    has_projects = _has_project_signal(resume_text)
    no_real_experience = not _has_real_work_signal(resume_text)
    fresher = candidate_exp < 1.0 or ("fresher" in resume_text.lower() or "student" in resume_text.lower())

    if fresher:
        score = 50.0
    elif required_exp is None or required_exp <= 0:
        score = min(100.0, candidate_exp * 12.0)
    else:
        score = min(100.0, (candidate_exp / required_exp) * 100.0)

    role_l = role.lower()
    if "business analyst" in role_l and no_real_experience:
        score *= 0.6
    if any(x in role_l for x in ("data analyst", "data scientist", "ml engineer", "machine learning engineer")) and has_projects:
        score += 10.0

    return ExperienceScoreResult(
        score=round(_clamp_0_100(score), 2),
        candidate_years=candidate_exp,
        required_years=required_exp,
        fresher=fresher,
        has_projects=has_projects,
        no_real_experience=no_real_experience,
    )


def compute_role_alignment_boost(resume_text: str, role: str) -> float:
    role_l = role.lower()
    resume = resume_text.lower()
    if "data analyst" in role_l or "data scientist" in role_l:
        if any(k in resume for k in ("project", "dashboard", "kpi", "analysis", "model", "prediction")):
            return 8.0
    return 0.0


def compile_insights(
    semantic_score: float,
    skill: SkillScoreResult,
    experience: ExperienceScoreResult,
    domain_match: bool,
    role: str,
) -> list[str]:
    insights: list[str] = []
    if semantic_score >= 75 and domain_match:
        insights.append(f"Strong match for {role.title()} role.")
    elif semantic_score >= 55:
        insights.append("Moderate semantic relevance; profile aligns partially with role context.")
    else:
        insights.append("Low semantic relevance to the role context.")

    critical_missing = skill.missing_critical_skills
    if critical_missing:
        insights.append(f"Missing critical skills: {', '.join(critical_missing[:4])}.")
    elif skill.missing_skills:
        insights.append(f"Missing some non-critical skills: {', '.join(skill.missing_skills[:4])}.")
    else:
        insights.append("Skill coverage is complete for listed requirements.")

    if experience.fresher:
        insights.append("Profile appears fresher-level; experience score is adjusted accordingly.")
    elif experience.required_years is None:
        insights.append("Experience requirement was not explicit in the job description.")
    elif experience.candidate_years >= (experience.required_years or 0):
        insights.append("Experience meets or exceeds the role requirement.")
    else:
        insights.append("Experience is below the required threshold for this role.")

    if not domain_match:
        insights.append("Domain mismatch detected between resume profile and target role.")
    if experience.has_projects and any(x in role.lower() for x in ("data analyst", "data scientist")):
        insights.append("Project experience boosts score for data-focused role.")

    return insights
