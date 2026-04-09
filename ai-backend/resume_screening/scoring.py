from __future__ import annotations

from dataclasses import dataclass
import re

from .semantic import SemanticScorer, SemanticResult
from .skills import SkillScoreResult, compute_skill_score


def _clamp_0_100(value: float) -> float:
    return max(0.0, min(100.0, value))


def compute_semantic_score(scorer: SemanticScorer, resume_text: str, job_description: str) -> SemanticResult:
    return scorer.score(resume_text, job_description)


@dataclass
class ExperienceScoreResult:
    score: float
    candidate_years: float
    required_years: float | None


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

    base = max(direct_years + ranged_years + [0.0])
    bonus = min(2.0, 0.4 * work_mentions)
    penalty = min(2.5, 0.5 * internship_mentions + 0.3 * project_mentions)
    effective = max(0.0, base + bonus - penalty)
    return round(effective, 2)


def compute_experience_score(resume_text: str, job_description: str) -> ExperienceScoreResult:
    candidate_exp = _extract_candidate_experience_years(resume_text)
    required_exp = _extract_required_experience_years(job_description)
    if required_exp is None or required_exp <= 0:
        # Missing JD requirement should not over-inflate; use neutral-high default.
        return ExperienceScoreResult(score=70.0, candidate_years=candidate_exp, required_years=None)

    if candidate_exp >= required_exp:
        score = 100.0
    else:
        score = (candidate_exp / required_exp) * 100.0
    return ExperienceScoreResult(
        score=round(_clamp_0_100(score), 2),
        candidate_years=candidate_exp,
        required_years=required_exp,
    )


ROLE_KEYWORDS: dict[str, set[str]] = {
    "data analyst": {"dashboard", "kpi", "reporting", "tableau", "power bi", "analytics"},
    "data scientist": {"machine learning", "model", "prediction", "feature engineering", "experiment"},
    "backend engineer": {"api", "fastapi", "microservices", "postgresql", "system design"},
    "frontend engineer": {"react", "next.js", "typescript", "ui", "ux"},
}


def compute_role_alignment_boost(resume_text: str, job_description: str) -> float:
    jd = job_description.lower()
    resume = resume_text.lower()
    target_role = None
    for role in ROLE_KEYWORDS:
        if role in jd:
            target_role = role
            break
    if not target_role:
        return 0.0
    keywords = ROLE_KEYWORDS[target_role]
    hit_count = sum(1 for kw in keywords if kw in resume)
    coverage = hit_count / max(1, len(keywords))
    return round(min(10.0, coverage * 10.0), 2)


def compile_insights(
    semantic_score: float,
    skill: SkillScoreResult,
    experience: ExperienceScoreResult,
) -> list[str]:
    insights: list[str] = []
    if semantic_score >= 75:
        insights.append("Strong semantic match with job role.")
    elif semantic_score >= 55:
        insights.append("Moderate semantic relevance; profile aligns partially with role context.")
    else:
        insights.append("Low semantic relevance to the role context.")

    critical_missing = [s for s, w in skill.required_skills_with_weights.items() if w == 3 and s in skill.missing_skills]
    if critical_missing:
        insights.append(f"Missing critical skills: {', '.join(critical_missing[:4])}.")
    elif skill.missing_skills:
        insights.append(f"Missing some non-critical skills: {', '.join(skill.missing_skills[:4])}.")
    else:
        insights.append("Skill coverage is complete for listed requirements.")

    if experience.required_years is None:
        insights.append("Experience requirement was not explicit in the job description.")
    elif experience.candidate_years >= experience.required_years:
        insights.append("Experience meets or exceeds the role requirement.")
    else:
        insights.append("Experience is below the required threshold for this role.")

    return insights
