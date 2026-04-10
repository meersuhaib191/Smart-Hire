from __future__ import annotations

from dataclasses import dataclass
import re

from ..embedding.embedder import Embedder


SKILL_NORMALIZATION_MAP: dict[str, str] = {
    "scikit learn": "scikit-learn",
    "mysql": "sql",
}

PROJECT_SKILL_MAP: dict[str, list[str]] = {
    "scikit-learn": ["machine learning", "model evaluation"],
    "regression": ["machine learning"],
    "classification": ["machine learning"],
    "prediction": ["machine learning"],
    "pandas": ["data analysis"],
    "matplotlib": ["data visualization"],
}


def _normalize(s: str) -> str:
    base = " ".join((s or "").strip().lower().split())
    return SKILL_NORMALIZATION_MAP.get(base, base)


def infer_skills_from_projects(project_texts: list[str]) -> list[str]:
    """
    Infer skills from strong project signals only (keyword-triggered mapping).
    """
    text_blob = " ".join(project_texts or [])
    text_norm = _normalize(text_blob)
    if not text_norm:
        return []

    inferred: set[str] = set()
    for signal, targets in PROJECT_SKILL_MAP.items():
        signal_n = _normalize(signal)
        if not signal_n:
            continue
        if not re.search(rf"(?<![a-z0-9]){re.escape(signal_n)}(?![a-z0-9])", text_norm):
            continue
        for target in targets:
            target_n = _normalize(target)
            if target_n:
                inferred.add(target_n)
    return sorted(inferred)


@dataclass
class SkillMatchResult:
    score: float
    matched_skills: list[str]
    missing_skills: list[str]


def compute_skill_overlap(required_skills: list[str], resume_skills: list[str], embedder: Embedder) -> SkillMatchResult:
    # `embedder` is intentionally unused in strict set-based matching.
    _ = embedder

    required_set = {_normalize(s) for s in required_skills if _normalize(s)}
    resume_set = {_normalize(s) for s in resume_skills if _normalize(s)}
    if not required_set:
        return SkillMatchResult(score=0.0, matched_skills=[], missing_skills=[])

    matched = sorted(required_set.intersection(resume_set))
    missing = sorted(required_set.difference(resume_set))

    score = len(matched) / len(required_set)
    return SkillMatchResult(
        score=max(0.0, min(1.0, round(score, 4))),
        matched_skills=matched,
        missing_skills=missing,
    )

