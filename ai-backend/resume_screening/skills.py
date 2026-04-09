from __future__ import annotations

from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Iterable
import re

CRITICAL_WEIGHT = 3
IMPORTANT_WEIGHT = 2
OPTIONAL_WEIGHT = 1
FUZZY_MATCH_THRESHOLD = 0.86

SKILL_ALIASES: dict[str, set[str]] = {
    "python": {"python"},
    "java": {"java"},
    "javascript": {"javascript", "js"},
    "typescript": {"typescript", "ts"},
    "react": {"react", "reactjs", "react.js"},
    "next.js": {"next.js", "nextjs"},
    "node.js": {"node.js", "nodejs", "node"},
    "express": {"express", "express.js"},
    "fastapi": {"fastapi"},
    "django": {"django"},
    "flask": {"flask"},
    "sql": {"sql", "structured query language"},
    "postgresql": {"postgresql", "postgres", "psql"},
    "mysql": {"mysql"},
    "mongodb": {"mongodb", "mongo"},
    "redis": {"redis"},
    "docker": {"docker"},
    "kubernetes": {"kubernetes", "k8s"},
    "aws": {"aws", "amazon web services"},
    "azure": {"azure"},
    "gcp": {"gcp", "google cloud", "google cloud platform"},
    "git": {"git"},
    "ci/cd": {"ci/cd", "ci cd", "continuous integration", "continuous delivery", "continuous deployment"},
    "jest": {"jest"},
    "playwright": {"playwright"},
    "pytest": {"pytest"},
    "tailwind": {"tailwind", "tailwindcss"},
    "html": {"html"},
    "css": {"css"},
    "rest": {"rest", "rest api", "restful"},
    "graphql": {"graphql"},
    "microservices": {"microservices", "microservice"},
    "system design": {"system design", "architecture design"},
    "machine learning": {"machine learning", "ml"},
    "nlp": {"nlp", "natural language processing"},
    "tableau": {"tableau"},
    "power bi": {"power bi", "powerbi"},
    "excel": {"excel", "spreadsheets"},
    "pandas": {"pandas"},
    "numpy": {"numpy"},
    "airflow": {"airflow"},
    "dbt": {"dbt"},
    "etl": {"etl", "elt"},
}

DEFAULT_SKILL_LEXICON = set(SKILL_ALIASES.keys())


def _normalize(term: str) -> str:
    cleaned = re.sub(r"[^a-z0-9.+/#\s-]", " ", term.strip().lower())
    return re.sub(r"\s+", " ", cleaned).strip()


def _tokenize(text: str) -> set[str]:
    text_norm = _normalize(text)
    tokens = set(text_norm.split())
    tokens |= set(re.findall(r"[a-z0-9.+/#-]{2,}", text_norm))
    return {t for t in tokens if len(t) > 1}


def _all_aliases() -> dict[str, set[str]]:
    return {skill: {_normalize(a) for a in aliases | {skill}} for skill, aliases in SKILL_ALIASES.items()}


def _extract_spacy_nouns(text: str) -> set[str]:
    try:
        import spacy  # type: ignore

        nlp = spacy.load("en_core_web_sm")
        doc = nlp(text.lower())
        noun_chunks = {
            _normalize(chunk.text)
            for chunk in doc.noun_chunks
            if len(chunk.text.strip()) > 2 and not any(t.is_stop for t in chunk)
        }
        entities = {
            _normalize(ent.text)
            for ent in doc.ents
            if ent.label_ in {"ORG", "PRODUCT"} and len(ent.text.strip()) > 2
        }
        return noun_chunks.union(entities)
    except Exception:
        return set()


def extract_skills(text: str, lexicon: Iterable[str] = DEFAULT_SKILL_LEXICON) -> set[str]:
    text_norm = _normalize(text)
    lexicon_norm = {_normalize(x) for x in lexicon}
    found = {skill for skill in lexicon_norm if skill in text_norm}
    # Add lightweight NLP extraction when available
    found |= {candidate for candidate in _extract_spacy_nouns(text) if candidate in lexicon_norm}
    # Alias-based skill detection for robust matching.
    aliases = _all_aliases()
    for skill, terms in aliases.items():
        if skill not in lexicon_norm:
            continue
        if any(alias in text_norm for alias in terms):
            found.add(skill)
    return found


def coverage_score(required: set[str], observed: set[str]) -> float:
    if not required:
        return 0.0
    return round((len(required.intersection(observed)) / len(required)) * 100.0, 2)


def _weight_from_context(line: str) -> int:
    line_norm = _normalize(line)
    critical_tokens = ("must", "required", "mandatory", "need to have")
    optional_tokens = ("nice to have", "preferred", "bonus", "optional", "plus")
    if any(token in line_norm for token in critical_tokens):
        return CRITICAL_WEIGHT
    if any(token in line_norm for token in optional_tokens):
        return OPTIONAL_WEIGHT
    return IMPORTANT_WEIGHT


def extract_required_skills_with_weights(job_description: str) -> dict[str, int]:
    aliases = _all_aliases()
    jd_lines = [line.strip() for line in job_description.splitlines() if line.strip()]
    weighted: dict[str, int] = {}
    for line in jd_lines:
        weight = _weight_from_context(line)
        line_norm = _normalize(line)
        for canonical, terms in aliases.items():
            if any(term in line_norm for term in terms):
                weighted[canonical] = max(weighted.get(canonical, OPTIONAL_WEIGHT), weight)
    # Fallback to important skills when no weighting cues were found.
    if not weighted:
        for skill in extract_skills(job_description):
            weighted[skill] = IMPORTANT_WEIGHT
    return weighted


def _fuzzy_contains(candidate: str, aliases: set[str], resume_tokens: set[str]) -> bool:
    if candidate in resume_tokens:
        return True
    for alias in aliases:
        if alias in resume_tokens:
            return True
        for token in resume_tokens:
            if len(token) < 3 or len(alias) < 3:
                continue
            if SequenceMatcher(None, token, alias).ratio() >= FUZZY_MATCH_THRESHOLD:
                return True
    return False


def extract_resume_skills(resume_text: str) -> set[str]:
    # Merge lexicon and optional NLP noun extraction.
    direct = extract_skills(resume_text)
    tokens = _tokenize(resume_text)
    aliases = _all_aliases()
    for canonical, terms in aliases.items():
        if _fuzzy_contains(canonical, terms, tokens):
            direct.add(canonical)
    return direct


@dataclass
class SkillScoreResult:
    score: float
    matched_skills: list[str]
    missing_skills: list[str]
    required_skills_with_weights: dict[str, int]
    matched_weight: int
    total_weight: int


def compute_skill_score(job_description: str, resume_text: str) -> SkillScoreResult:
    required = extract_required_skills_with_weights(job_description)
    observed = extract_resume_skills(resume_text)
    aliases = _all_aliases()

    matched: list[str] = []
    missing: list[str] = []
    matched_weight = 0
    total_weight = sum(required.values())
    critical_missing = 0

    resume_tokens = _tokenize(resume_text)
    for skill, weight in required.items():
        terms = aliases.get(skill, {skill})
        if _fuzzy_contains(skill, terms, resume_tokens) or skill in observed:
            matched.append(skill)
            matched_weight += weight
        else:
            missing.append(skill)
            if weight == CRITICAL_WEIGHT:
                critical_missing += 1

    if total_weight == 0:
        return SkillScoreResult(
            score=0.0,
            matched_skills=[],
            missing_skills=[],
            required_skills_with_weights={},
            matched_weight=0,
            total_weight=0,
        )

    raw_score = (matched_weight / total_weight) * 100.0
    if critical_missing > 0:
        # Penalize missing criticals aggressively; multiplicative penalty avoids unrealistic highs.
        raw_score *= max(0.4, 1.0 - (0.25 * critical_missing))

    # Anti-inflation rule: never 100 unless all required skills matched.
    if len(missing) > 0:
        raw_score = min(raw_score, 99.0)

    return SkillScoreResult(
        score=round(max(0.0, min(100.0, raw_score)), 2),
        matched_skills=sorted(set(matched)),
        missing_skills=sorted(set(missing)),
        required_skills_with_weights=required,
        matched_weight=matched_weight,
        total_weight=total_weight,
    )

