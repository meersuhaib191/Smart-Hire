from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any


@dataclass
class SkillScoreDetails:
    score: float
    matched_skills: list[str]
    missing_skills: list[str]
    missing_critical_skills: list[str]
    required_skills_with_weights: dict[str, int]
    matched_weight: int
    total_weight: int
    total_required_skills: int
    matched_required_skills: int
    final_score_cap: float | None = None


@dataclass
class ExperienceScoreDetails:
    score: float
    candidate_years: float
    required_years: float | None
    fresher: bool
    has_projects: bool
    no_real_experience: bool
    no_production_experience: bool


@dataclass
class DomainScoreDetails:
    score: float
    role_domain: str
    resume_domain: str
    domain_match: bool


@dataclass
class SemanticScoreDetails:
    score: float
    engine: str


@dataclass
class RankedJobResult:
    rank: int
    job_title: str
    job_description: str
    overall_score: float
    semantic_score: float
    skill_score: float
    experience_score: float
    domain_score: float
    role_specific_score: float
    domain_match: bool
    matched_skills: list[str]
    missing_skills: list[str]
    strengths: list[str]
    weaknesses: list[str]
    score_breakdown: dict[str, float]
    insights: list[str]
    confidence_score: float
    percentile_rank: float
    engine: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

