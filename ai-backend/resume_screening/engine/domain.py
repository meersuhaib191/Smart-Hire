from __future__ import annotations

from math import sqrt

from .ontology import DOMAINS, ROLE_TO_DOMAIN_HINTS, SKILL_ONTOLOGY
from .types import DomainScoreDetails


DOMAIN_KEYWORDS: dict[str, set[str]] = {
    "data": set(SKILL_ONTOLOGY["data"]) | {"data", "analytics", "kpi"},
    "frontend": set(SKILL_ONTOLOGY["frontend"]) | {"frontend", "web ui"},
    "backend": set(SKILL_ONTOLOGY["backend"]) | {"backend", "service"},
    "business": set(SKILL_ONTOLOGY["business"]) | {"business"},
    "marketing": set(SKILL_ONTOLOGY["marketing"]) | {"marketing"},
    "hr": set(SKILL_ONTOLOGY["hr"]) | {"human resources"},
    "finance": set(SKILL_ONTOLOGY["finance"]) | {"finance"},
    "engineering": set(SKILL_ONTOLOGY["frontend"] + SKILL_ONTOLOGY["backend"]) | {"engineering", "developer"},
}


def _domain_vector(text: str) -> dict[str, float]:
    content = text.lower()
    vector: dict[str, float] = {d: 0.0 for d in DOMAINS}
    # Add derived domains that can still influence similarity.
    if "engineering" not in vector:
        vector["engineering"] = 0.0
    for domain, keywords in DOMAIN_KEYWORDS.items():
        vector[domain] = float(sum(1 for k in keywords if k in content))
    return vector


def _top_domain(vector: dict[str, float]) -> str:
    items = sorted(vector.items(), key=lambda kv: kv[1], reverse=True)
    if not items or items[0][1] <= 0:
        return "unknown"
    return items[0][0]


def _cosine(a: dict[str, float], b: dict[str, float]) -> float:
    keys = sorted(set(a.keys()) | set(b.keys()))
    dot = sum(a.get(k, 0.0) * b.get(k, 0.0) for k in keys)
    norm_a = sqrt(sum((a.get(k, 0.0) ** 2) for k in keys))
    norm_b = sqrt(sum((b.get(k, 0.0) ** 2) for k in keys))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def detect_role_domain(role_or_jd_text: str) -> str:
    text = role_or_jd_text.lower()
    for hint, domain in ROLE_TO_DOMAIN_HINTS.items():
        if hint in text:
            return domain
    return _top_domain(_domain_vector(text))


def detect_resume_domain(resume_text: str) -> str:
    return _top_domain(_domain_vector(resume_text))


def compute_domain_score(resume_text: str, job_text: str) -> DomainScoreDetails:
    resume_vector = _domain_vector(resume_text)
    job_vector = _domain_vector(job_text)
    score = max(0.0, min(100.0, _cosine(resume_vector, job_vector) * 100.0))

    resume_domain = _top_domain(resume_vector)
    role_domain = detect_role_domain(job_text)
    domain_match = resume_domain == role_domain or "unknown" in {resume_domain, role_domain}
    return DomainScoreDetails(
        score=round(score, 2),
        role_domain=role_domain,
        resume_domain=resume_domain,
        domain_match=domain_match,
    )

