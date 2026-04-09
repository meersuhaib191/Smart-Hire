from __future__ import annotations

import re

from .types import ExperienceScoreDetails


def _clamp(value: float) -> float:
    return max(0.0, min(100.0, value))


def _required_years(job_text: str) -> float | None:
    text = job_text.lower()
    patterns = [
        r"(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)\s+(?:of\s+)?experience",
        r"(?:minimum|min)\s+(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)",
        r"(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(?:years|yrs)",
    ]
    for p in patterns:
        m = re.search(p, text)
        if not m:
            continue
        if len(m.groups()) == 2:
            return float(max(float(m.group(1)), float(m.group(2))))
        return float(m.group(1))
    return None


def _candidate_years(resume_text: str) -> float:
    t = resume_text.lower()
    explicit = [float(x) for x in re.findall(r"(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)\s+(?:of\s+)?experience", t)]
    if explicit:
        return max(explicit)
    ranges = re.findall(r"(20\d{2})\s*[-–]\s*(20\d{2}|present|current)", t)
    years = []
    for s, e in ranges:
        end = 2026 if e in {"present", "current"} else int(e)
        years.append(float(max(0, end - int(s))))
    return max(years) if years else 0.0


def _has_projects(text: str) -> bool:
    t = text.lower()
    return any(k in t for k in ("project", "capstone", "github", "portfolio", "built"))


def _has_real_experience(text: str) -> bool:
    t = text.lower()
    return any(k in t for k in ("worked at", "employment", "company", "full-time", "engineer at", "analyst at"))


def _has_production_experience(text: str) -> bool:
    t = text.lower()
    return any(k in t for k in ("production", "deployed", "serving", "live system", "monitoring", "mlops"))


def compute_experience_score(resume_text: str, job_text: str, role_name: str) -> ExperienceScoreDetails:
    role = role_name.lower()
    candidate_exp = _candidate_years(resume_text)
    required_exp = _required_years(job_text)
    fresher = candidate_exp < 1.0 or any(x in resume_text.lower() for x in ("fresher", "student", "entry level"))
    has_projects = _has_projects(resume_text)
    no_real_experience = not _has_real_experience(resume_text)
    no_production_experience = not _has_production_experience(resume_text)

    if fresher:
        score = 50.0
    else:
        req = required_exp if required_exp and required_exp > 0 else max(1.0, candidate_exp)
        score = min(100.0, (candidate_exp / req) * 100.0)

    if "ml engineer" in role or "machine learning engineer" in role:
        if no_production_experience:
            score *= 0.7
    if "business analyst" in role:
        if no_real_experience:
            score *= 0.6
    if ("data analyst" in role or "data scientist" in role) and has_projects:
        score += 10.0

    return ExperienceScoreDetails(
        score=round(_clamp(score), 2),
        candidate_years=round(candidate_exp, 2),
        required_years=required_exp,
        fresher=fresher,
        has_projects=has_projects,
        no_real_experience=no_real_experience,
        no_production_experience=no_production_experience,
    )

