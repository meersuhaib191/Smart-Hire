from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Optional

from .parser import extract_resume_text, load_job_description
from .semantic import SemanticScorer
from .scoring import (
    compile_insights,
    detect_domain,
    compute_experience_score,
    infer_role_from_job_description,
    role_domain,
    compute_role_alignment_boost,
    compute_semantic_score,
)
from .skills import SkillScoreResult, compute_skill_score


@dataclass
class ScreeningWeights:
    semantic_weight: float = 0.50
    skill_weight: float = 0.30
    experience_weight: float = 0.20


@dataclass
class ScreeningResult:
    overall_score: float
    semantic_score: float
    skill_score: float
    matched_skills: list[str]
    missing_skills: list[str]
    matched_skill_count: int
    missing_skill_count: int
    experience_score: float
    candidate_experience_years: float
    required_experience_years: float | None
    role_boost: float
    domain_match: bool
    insights: list[str]
    resume_chars: int
    job_description_chars: int
    engine: str
    weights: dict
    required_skills_with_weights: dict[str, int]

    def to_dict(self) -> dict:
        payload = asdict(self)
        # Backward compatibility for older clients expecting previous field name.
        payload["skill_coverage_score"] = payload["skill_score"]
        return payload


class ResumeScreeningService:
    def __init__(self) -> None:
        self.semantic = SemanticScorer()

    def screen(
        self,
        resume_path: str,
        job_description_text: Optional[str] = None,
        job_description_path: Optional[str] = None,
        weights: Optional[ScreeningWeights] = None,
        use_role_boost: bool = True,
    ) -> ScreeningResult:
        config = weights or ScreeningWeights()
        weight_total = config.semantic_weight + config.skill_weight + config.experience_weight
        if abs(weight_total - 1.0) > 0.01:
            raise ValueError("semantic_weight + skill_weight + experience_weight must be ~1.0")

        resume_text = extract_resume_text(resume_path)
        jd_text = load_job_description(job_description_path, job_description_text)

        skill: SkillScoreResult = compute_skill_score(jd_text, resume_text)
        role = infer_role_from_job_description(jd_text)
        resume_domain = detect_domain(resume_text)
        target_domain = role_domain(role)
        domain_match = target_domain == "unknown" or resume_domain == "unknown" or target_domain == resume_domain

        # Controlled semantic influence when domain intent is mismatched.
        semantic = compute_semantic_score(self.semantic, resume_text, jd_text, domain_match=domain_match)
        experience = compute_experience_score(resume_text, jd_text, role=role)
        role_boost = compute_role_alignment_boost(resume_text, role) if use_role_boost else 0.0

        overall = (
            semantic.score * config.semantic_weight
            + skill.score * config.skill_weight
            + experience.score * config.experience_weight
        )

        # Hard constraint from ATS policy.
        final_score_cap = 95.0
        if len(skill.missing_critical_skills) >= 1:
            final_score_cap = min(final_score_cap, 65.0)
        if not domain_match:
            overall *= 0.75
        if len(skill.matched_skills) == 0:
            overall *= 0.5
        overall = min(100.0, overall + role_boost)
        overall = min(overall, final_score_cap)
        overall = min(overall, 95.0)
        insights = compile_insights(semantic.score, skill, experience, domain_match=domain_match, role=role)

        return ScreeningResult(
            overall_score=round(overall, 2),
            semantic_score=round(semantic.score, 2),
            skill_score=round(skill.score, 2),
            matched_skills=skill.matched_skills,
            missing_skills=skill.missing_skills,
            matched_skill_count=len(skill.matched_skills),
            missing_skill_count=len(skill.missing_skills),
            experience_score=experience.score,
            candidate_experience_years=experience.candidate_years,
            required_experience_years=experience.required_years,
            role_boost=role_boost,
            domain_match=domain_match,
            insights=insights,
            resume_chars=len(resume_text),
            job_description_chars=len(jd_text),
            engine=semantic.engine,
            weights={
                "semantic_weight": config.semantic_weight,
                "skill_weight": config.skill_weight,
                "experience_weight": config.experience_weight,
            },
            required_skills_with_weights=skill.required_skills_with_weights,
        )

