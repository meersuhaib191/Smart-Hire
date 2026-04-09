from __future__ import annotations

from dataclasses import dataclass


@dataclass
class RoleSpecificResult:
    score: float
    strengths: list[str]
    weaknesses: list[str]


ROLE_CHECKS: dict[str, list[str]] = {
    "data analyst": ["sql", "dashboard", "reporting", "tableau", "power bi", "kpi"],
    "data scientist": ["machine learning", "model", "python", "statistics", "sql", "experiment"],
    "ml engineer": ["deployment", "api", "production", "monitoring", "model serving", "mlops"],
    "machine learning engineer": ["deployment", "api", "production", "monitoring", "model serving", "mlops"],
    "business analyst": ["stakeholder", "requirements", "documentation", "process", "reporting"],
    "backend engineer": ["api", "database", "fastapi", "docker", "microservices"],
    "frontend engineer": ["react", "next.js", "typescript", "ui", "css"],
    "marketing": ["seo", "campaign", "analytics", "content", "growth"],
    "hr": ["recruitment", "onboarding", "talent", "interview"],
    "finance": ["accounting", "budget", "excel", "forecasting", "financial"],
}


def _resolve_role_key(role_text: str) -> str:
    role = role_text.lower()
    for key in ROLE_CHECKS:
        if key in role:
            return key
    # fallbacks
    if "marketing" in role:
        return "marketing"
    if "hr" in role or "human resources" in role or "recruiter" in role:
        return "hr"
    if "finance" in role or "account" in role:
        return "finance"
    return "generic"


def compute_role_specific_score(role_text: str, resume_text: str, job_description: str) -> RoleSpecificResult:
    role_key = _resolve_role_key(f"{role_text}\n{job_description}")
    checks = ROLE_CHECKS.get(role_key)
    if not checks:
        return RoleSpecificResult(score=60.0, strengths=[], weaknesses=["No role-specific rubric found."])

    content = resume_text.lower()
    strengths: list[str] = []
    weaknesses: list[str] = []
    matched = 0
    for item in checks:
        if item in content:
            matched += 1
            strengths.append(item)
        else:
            weaknesses.append(item)
    score = (matched / max(1, len(checks))) * 100.0
    return RoleSpecificResult(
        score=round(max(0.0, min(100.0, score)), 2),
        strengths=strengths[:6],
        weaknesses=weaknesses[:6],
    )

