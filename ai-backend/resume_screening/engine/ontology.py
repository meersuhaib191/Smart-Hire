from __future__ import annotations

SKILL_ONTOLOGY: dict[str, list[str]] = {
    "data": ["python", "sql", "pandas", "machine learning", "analysis", "tableau", "power bi", "dashboarding", "reporting"],
    "frontend": ["react", "next.js", "typescript", "javascript", "html", "css", "ui"],
    "backend": ["api", "fastapi", "node", "database", "postgresql", "docker", "kubernetes", "microservices"],
    "business": ["stakeholder", "requirements", "process", "documentation", "reporting"],
    "marketing": ["seo", "campaign", "analytics", "content", "growth"],
    "hr": ["recruitment", "onboarding", "talent", "sourcing", "interviewing"],
    "finance": ["accounting", "budget", "excel", "forecasting", "financial reporting"],
}

DOMAINS = ["data", "engineering", "frontend", "backend", "business", "marketing", "hr", "finance"]

ROLE_TO_DOMAIN_HINTS: dict[str, str] = {
    "data analyst": "data",
    "data scientist": "data",
    "ml engineer": "engineering",
    "machine learning engineer": "engineering",
    "data engineer": "engineering",
    "backend engineer": "backend",
    "frontend engineer": "frontend",
    "full stack engineer": "engineering",
    "business analyst": "business",
    "marketing specialist": "marketing",
    "marketing manager": "marketing",
    "hr manager": "hr",
    "recruiter": "hr",
    "finance analyst": "finance",
    "accountant": "finance",
}

