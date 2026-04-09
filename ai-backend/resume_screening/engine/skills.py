from __future__ import annotations

from difflib import SequenceMatcher
import re

from .config import CRITICAL_GAP_FINAL_CAP
from .ontology import SKILL_ONTOLOGY
from .types import SkillScoreDetails

CRITICAL_WEIGHT = 3
IMPORTANT_WEIGHT = 2
OPTIONAL_WEIGHT = 1
FUZZY_MATCH_THRESHOLD = 0.86

ALIASES: dict[str, set[str]] = {
    "python": {"python"},
    "sql": {"sql", "structured query language"},
    "tableau": {"tableau"},
    "power bi": {"power bi", "powerbi"},
    "excel": {"excel", "spreadsheets"},
    "pandas": {"pandas"},
    "numpy": {"numpy"},
    "machine learning": {"machine learning", "ml"},
    "react": {"react", "reactjs"},
    "next.js": {"next.js", "nextjs"},
    "javascript": {"javascript", "js"},
    "typescript": {"typescript", "ts"},
    "fastapi": {"fastapi"},
    "postgresql": {"postgresql", "postgres"},
    "docker": {"docker"},
    "kubernetes": {"kubernetes", "k8s"},
    "aws": {"aws", "amazon web services"},
    "git": {"git"},
    "ci/cd": {"ci/cd", "ci cd", "continuous integration", "continuous delivery"},
    "pytest": {"pytest"},
    "api": {"api", "rest api"},
    "requirements gathering": {"requirements gathering", "requirement elicitation", "requirements"},
    "stakeholder management": {"stakeholder", "stakeholder management"},
    "reporting": {"reporting"},
    "dashboarding": {"dashboard", "dashboarding", "kpi"},
    "seo": {"seo", "search engine optimization"},
    "campaign": {"campaign", "campaign management"},
    "analytics": {"analytics", "web analytics"},
    "content": {"content", "content marketing"},
    "growth": {"growth", "growth marketing"},
    "recruitment": {"recruitment", "hiring"},
    "onboarding": {"onboarding"},
    "talent": {"talent", "talent acquisition"},
    "sourcing": {"sourcing"},
    "interviewing": {"interviewing", "interview"},
    "accounting": {"accounting"},
    "budget": {"budget", "budgeting"},
    "forecasting": {"forecasting", "financial forecasting"},
    "financial reporting": {"financial reporting"},
}

# Ensure ontology skills are always represented even if aliases were not manually listed.
for skills in SKILL_ONTOLOGY.values():
    for skill in skills:
        ALIASES.setdefault(skill, {skill})


def _normalize(text: str) -> str:
    cleaned = re.sub(r"[^a-z0-9.+/#\s-]", " ", text.lower())
    return re.sub(r"\s+", " ", cleaned).strip()


def _tokens(text: str) -> set[str]:
    norm = _normalize(text)
    return set(norm.split()) | set(re.findall(r"[a-z0-9.+/#-]{2,}", norm))


def _contains_term(text_norm: str, term_norm: str) -> bool:
    pattern = r"(?<![a-z0-9])" + re.escape(term_norm) + r"(?![a-z0-9])"
    return re.search(pattern, text_norm) is not None


def _weight_from_line(line: str) -> int:
    l = _normalize(line)
    if any(x in l for x in ("must", "required", "mandatory", "need to have")):
        return CRITICAL_WEIGHT
    if any(x in l for x in ("preferred", "nice to have", "optional", "bonus", "plus")):
        return OPTIONAL_WEIGHT
    return IMPORTANT_WEIGHT


def extract_required_skills_with_weights(job_description: str) -> dict[str, int]:
    required: dict[str, int] = {}
    for line in [x.strip() for x in job_description.splitlines() if x.strip()]:
        weight = _weight_from_line(line)
        ln = _normalize(line)
        for skill, aliases in ALIASES.items():
            if any(_contains_term(ln, _normalize(alias)) for alias in aliases | {skill}):
                required[skill] = max(required.get(skill, OPTIONAL_WEIGHT), weight)

    if required:
        return required
    # fallback heuristic by raw mentions
    ln = _normalize(job_description)
    for skill, aliases in ALIASES.items():
        if any(_contains_term(ln, _normalize(alias)) for alias in aliases | {skill}):
            required[skill] = IMPORTANT_WEIGHT
    return required


def _fuzzy_has(skill: str, aliases: set[str], resume_tokens: set[str], resume_norm: str) -> bool:
    candidates = {_normalize(skill)} | {_normalize(a) for a in aliases}
    if any(_contains_term(resume_norm, c) for c in candidates):
        return True
    for c in candidates:
        if c in resume_tokens:
            return True
        for token in resume_tokens:
            if len(token) < 3 or len(c) < 3:
                continue
            if SequenceMatcher(None, token, c).ratio() >= FUZZY_MATCH_THRESHOLD:
                return True
    return False


def compute_skill_score(job_description: str, resume_text: str) -> SkillScoreDetails:
    required = extract_required_skills_with_weights(job_description)
    if not required:
        return SkillScoreDetails(
            score=0.0,
            matched_skills=[],
            missing_skills=[],
            missing_critical_skills=[],
            required_skills_with_weights={},
            matched_weight=0,
            total_weight=0,
            total_required_skills=0,
            matched_required_skills=0,
            final_score_cap=None,
        )

    resume_norm = _normalize(resume_text)
    resume_tokens = _tokens(resume_text)
    matched: list[str] = []
    missing: list[str] = []
    missing_critical: list[str] = []
    matched_weight = 0
    total_weight = sum(required.values())

    for skill, weight in required.items():
        aliases = ALIASES.get(skill, {skill})
        if _fuzzy_has(skill, aliases, resume_tokens, resume_norm):
            matched.append(skill)
            matched_weight += weight
        else:
            missing.append(skill)
            if weight == CRITICAL_WEIGHT:
                missing_critical.append(skill)

    matched_count = len(matched)
    total_required = len(required)
    if matched_count == 0:
        score = 0.0
    else:
        score = (matched_weight / max(1, total_weight)) * 100.0
        if matched_count < total_required:
            score = min(score, 85.0)

    final_score_cap: float | None = None
    if len(missing_critical) >= 1:
        score *= 0.6
        final_score_cap = CRITICAL_GAP_FINAL_CAP

    score = max(0.0, min(100.0, score))
    return SkillScoreDetails(
        score=round(score, 2),
        matched_skills=sorted(set(matched)),
        missing_skills=sorted(set(missing)),
        missing_critical_skills=sorted(set(missing_critical)),
        required_skills_with_weights=required,
        matched_weight=matched_weight,
        total_weight=total_weight,
        total_required_skills=total_required,
        matched_required_skills=matched_count,
        final_score_cap=final_score_cap,
    )

