from __future__ import annotations

from dataclasses import dataclass

from .config import FINAL_SCORE_MAX, ScoreWeights
from .domain import compute_domain_score, detect_role_domain
from .experience import compute_experience_score
from .role_specific import compute_role_specific_score
from .semantic import SemanticMatcher
from .skills import compute_skill_score
from .types import RankedJobResult


@dataclass
class JobInput:
    title: str
    description: str


def _clamp(v: float) -> float:
    return max(0.0, min(100.0, v))


def _insights(
    role: str,
    semantic: float,
    skill_missing: list[str],
    missing_critical: list[str],
    exp_score: float,
    domain_score: float,
    role_specific_score: float,
    has_projects: bool,
    strengths: list[str],
    weaknesses: list[str],
) -> list[str]:
    out: list[str] = []
    if semantic >= 70:
        out.append(f"Strong match for {role.title()} role.")
    elif semantic >= 50:
        out.append(f"Moderate contextual relevance for {role.title()} role.")
    else:
        out.append(f"Low semantic alignment for {role.title()} role.")

    if missing_critical:
        out.append(f"Missing critical skills: {', '.join(missing_critical[:4])}.")
    elif skill_missing:
        out.append(f"Missing skills reduce match quality: {', '.join(skill_missing[:4])}.")
    else:
        out.append("All listed required skills are covered.")

    if exp_score >= 75:
        out.append("Experience profile is strong for role expectations.")
    elif exp_score >= 50:
        out.append("Experience is acceptable but not dominant.")
    else:
        out.append("Experience gap is significant for this role.")

    if domain_score < 30:
        out.append("Domain mismatch penalty applied.")
    elif has_projects and "data" in role:
        out.append("Good project-based experience boosts data-role fit.")
    if role_specific_score >= 70:
        out.append("Role-specific competency checks are strong.")
    elif role_specific_score < 45:
        out.append("Role-specific competency checks are weak.")
    if weaknesses:
        out.append(f"Role gaps: {', '.join(weaknesses[:3])}.")
    elif strengths:
        out.append(f"Top strengths: {', '.join(strengths[:3])}.")
    return out


class AtsRankingEngine:
    def __init__(self, weights: ScoreWeights | None = None) -> None:
        self.weights = weights or ScoreWeights()
        if abs(self.weights.total - 1.0) > 0.001:
            raise ValueError("weights must sum to 1.0")
        self.semantic = SemanticMatcher()

    def score_one(self, resume_text: str, job: JobInput) -> RankedJobResult:
        return self.rank_many(resume_text, [job])[0]

    def rank_many(self, resume_text: str, jobs: list[JobInput]) -> list[RankedJobResult]:
        if not jobs:
            return []

        semantic_batch = self.semantic.similarity_batch(resume_text, [j.description for j in jobs])
        raw_results: list[tuple[int, RankedJobResult]] = []

        for idx, job in enumerate(jobs):
            role = detect_role_domain(f"{job.title}\n{job.description}")
            skill = compute_skill_score(job.description, resume_text)
            domain = compute_domain_score(resume_text, f"{job.title}\n{job.description}")
            experience = compute_experience_score(resume_text, job.description, job.title)
            role_specific = compute_role_specific_score(job.title, resume_text, job.description)

            semantic_score = semantic_batch.scores[idx] if idx < len(semantic_batch.scores) else 0.0
            if skill.score < 20:
                semantic_score *= 0.5

            base = (
                self.weights.semantic * semantic_score
                + self.weights.skill * skill.score
                + self.weights.experience * experience.score
                + self.weights.domain * domain.score
                + self.weights.role_specific * role_specific.score
            )

            final_score = base
            # Domain hard penalty
            if domain.score < 30:
                final_score *= 0.7
            # No-skill hard filter
            if len(skill.matched_skills) == 0:
                final_score *= 0.4
                semantic_score *= 0.5
            # Critical-skill hard filter
            if len(skill.missing_critical_skills) >= 2:
                final_score *= 0.6
            # Critical-skill cap for at least one missing critical.
            if skill.final_score_cap is not None:
                final_score = min(final_score, skill.final_score_cap)

            # role-based boost (data roles + projects)
            if role == "data" and experience.has_projects and experience.score >= 60:
                final_score += 8.0
            if experience.fresher:
                final_score = min(final_score, 85.0)

            final_score = min(FINAL_SCORE_MAX, _clamp(final_score))

            confidence = _clamp(
                0.35 * (100.0 - min(100.0, len(skill.missing_skills) * 10.0))
                + 0.35 * domain.score
                + 0.15 * experience.score
                + 0.15 * role_specific.score
            )
            insights = _insights(
                role=role,
                semantic=semantic_score,
                skill_missing=skill.missing_skills,
                missing_critical=skill.missing_critical_skills,
                exp_score=experience.score,
                domain_score=domain.score,
                role_specific_score=role_specific.score,
                has_projects=experience.has_projects,
                strengths=role_specific.strengths,
                weaknesses=role_specific.weaknesses,
            )

            result = RankedJobResult(
                rank=0,
                job_title=job.title,
                job_description=job.description,
                overall_score=round(final_score, 2),
                semantic_score=round(_clamp(semantic_score), 2),
                skill_score=round(skill.score, 2),
                experience_score=round(experience.score, 2),
                domain_score=round(domain.score, 2),
                role_specific_score=round(role_specific.score, 2),
                domain_match=domain.domain_match,
                matched_skills=skill.matched_skills,
                missing_skills=skill.missing_skills,
                strengths=role_specific.strengths,
                weaknesses=role_specific.weaknesses,
                score_breakdown={
                    "semantic_component": round(self.weights.semantic * semantic_score, 2),
                    "skill_component": round(self.weights.skill * skill.score, 2),
                    "experience_component": round(self.weights.experience * experience.score, 2),
                    "domain_component": round(self.weights.domain * domain.score, 2),
                    "role_specific_component": round(self.weights.role_specific * role_specific.score, 2),
                },
                insights=insights,
                confidence_score=round(confidence, 2),
                percentile_rank=0.0,
                engine=semantic_batch.engine,
            )
            raw_results.append((idx, result))

        # Stable deterministic sort: score desc, original index asc
        raw_results.sort(key=lambda x: (-x[1].overall_score, x[0]))
        ordered = [r for _, r in raw_results]
        total = max(1, len(ordered) - 1)
        for i, item in enumerate(ordered, start=1):
            item.rank = i
            item.percentile_rank = round(100.0 if total == 0 else (1 - ((i - 1) / total)) * 100.0, 2)
        return ordered

