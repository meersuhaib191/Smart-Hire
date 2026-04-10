from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

from ..models.schemas import ParsedJob
from ..utils.text import safe_lower


# Order matters: more specific labels before loose ones (e.g. "required skills" before "skills").
JD_SECTION_LABELS: tuple[tuple[str, str], ...] = (
    ("required", "required skills"),
    ("required", "skills required"),
    ("required", "minimum qualifications"),
    ("required", "qualifications"),
    ("required", "must have"),
    ("required", "mandatory"),
    ("required", "required"),
    ("required", "requirements"),
    ("preferred", "preferred skills"),
    ("preferred", "preferred qualifications"),
    ("preferred", "nice to have"),
    ("preferred", "nice-to-have"),
    ("preferred", "optional"),
    ("preferred", "bonus"),
    ("preferred", "plus"),
    ("preferred", "preferred"),
    ("generic", "technical skills"),
    ("generic", "core skills"),
    ("generic", "key skills"),
    ("generic", "skills"),
)


@lru_cache(maxsize=1)
def _load_ontology() -> tuple[dict[str, list[str]], list[str]]:
    ontology_path = Path(__file__).resolve().parent / "skill_ontology.json"
    payload = json.loads(ontology_path.read_text(encoding="utf-8"))
    skills = [safe_lower(str(x)) for x in payload.get("skills", []) if str(x).strip()]
    skill_ontology = {
        "data": ["python", "sql", "pandas", "numpy", "machine learning", "tableau", "power bi", "excel", "r"],
        "frontend": ["react", "next.js", "typescript", "javascript", "html", "css"],
        "backend": ["api", "fastapi", "node.js", "postgresql", "docker", "kubernetes"],
        "business": ["stakeholder management", "requirements gathering", "process documentation", "reporting"],
        "marketing": ["seo", "campaign management", "google analytics", "content strategy"],
        "hr": ["recruitment", "onboarding", "talent acquisition", "interviewing"],
        "finance": ["accounting", "budgeting", "forecasting", "financial reporting", "excel"],
    }
    return skill_ontology, sorted(set(skills))


def _jd_section_from_line(line: str) -> str | None:
    """Return section key if this line is primarily a section header."""
    raw = line.strip()
    if not raw:
        return None
    head = raw.split(":", 1)[0].strip()
    head_l = safe_lower(head.rstrip(": "))
    head_l = head_l.rstrip(":-–—").strip()
    # "Skills & Qualifications" → primary token "skills"
    key = head_l.split("&")[0].split("/")[0].strip()
    for section, label in JD_SECTION_LABELS:
        if key == label or head_l == label:
            return section
        if head_l.startswith(label + " ") or head_l.startswith(label + ":"):
            return section
    return None


def _line_has_inline_required_pref(line: str) -> tuple[str | None, str]:
    """Detect (required|preferred) from same line as content; return (section, content)."""
    ln = safe_lower(line)
    content = line
    if any(k in ln for k in ("required skills", "must have", "mandatory", "qualifications required")):
        return "required", content
    # Do not use bare "plus" / "bonus" — they match "is a plus" on the whole JD line and mis-classify
    # all skills as preferred. Phrase-level "is a plus" / "nice to have" is handled in _split_core_and_plus_jd.
    if re.search(r"\bpreferred skills\b", ln):
        return "preferred", content
    if re.search(r"\bnice to have\b|\bnice-to-have\b", ln):
        return "preferred", content
    if re.search(r"\boptional skills\b|\bbonus skills\b", ln):
        return "preferred", content
    return None, content


def _split_core_and_plus_jd(text: str) -> tuple[str, str]:
    """
    Split JD into core (required context) vs trailing 'plus / nice-to-have' style sentences.
    Skills mentioned only in the plus blob are treated as preferred, not required.
    """
    spans = list(
        re.finditer(
            r"(?is)[^.!?]*\b(?:is a plus|nice to have|nice-to-have|as a bonus)\b[^.!?]*[.!?]?",
            text,
        )
    )
    if not spans:
        return text.strip(), ""
    plus_blob = " ".join(m.group(0).strip() for m in spans)
    main = text
    for m in reversed(spans):
        main = main[: m.start()] + " " + main[m.end() :]
    return main.strip(), plus_blob.strip()


def _extract_skills_from_text(text: str, all_skills: list[str]) -> set[str]:
    t = safe_lower(text)
    found: set[str] = set()
    for s in all_skills:
        if re.search(rf"(?<![a-z0-9]){re.escape(s)}(?![a-z0-9])", t):
            found.add(s)
    return found


def _split_jd_skill_sections(text: str) -> dict[str, list[str]]:
    """Bucket lines into required / preferred / generic / body."""
    buckets: dict[str, list[str]] = {
        "required": [],
        "preferred": [],
        "generic": [],
        "body": [],
    }
    current = "body"
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        sec = _jd_section_from_line(line)
        if sec is not None:
            current = sec
            after = line.split(":", 1)
            if len(after) > 1 and after[1].strip():
                buckets[current].append(after[1].strip())
            continue
        buckets[current].append(line)
    return buckets


def _normalize_job_skill_lists(
    req: set[str],
    pref: set[str],
    generic: set[str],
    body: set[str],
) -> tuple[list[str], list[str]]:
    """
    Enforce ATS-friendly lists:
    - Only preferred labeled → promote to required
    - Only generic labeled (no explicit required) → generic becomes required
    - Explicit required present → required ∪ generic ∪ body; preferred = P - required
    - Never leave required empty if any skills were found anywhere
    """
    R, P, G, B = set(req), set(pref), set(generic), set(body)
    all_found = R | P | G | B

    if R:
        required = set(R) | G | B
        preferred = set(P) - required
    elif G:
        required = set(G) | B
        preferred = set(P) - required
    elif B:
        required = set(B)
        preferred = set(P) - required
    elif P:
        # Only preferred-like skills found: promote to required.
        required = set(P)
        preferred = set()
    else:
        required, preferred = set(), set()

    if not required and all_found:
        required = set(all_found)
        preferred = set()

    preferred -= required
    return sorted(required), sorted(preferred)


def _required_experience(text: str) -> float:
    t = text.lower()
    patterns = [
        r"(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)\s+(?:of\s+)?experience",
        r"(?:minimum|min)\s+(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)",
    ]
    for p in patterns:
        m = re.search(p, t)
        if m:
            return float(m.group(1))
    return 0.0


def _infer_domain(text: str) -> str:
    t = safe_lower(text)
    skill_ontology, _ = _load_ontology()
    scores: dict[str, int] = {}
    for domain, skills in skill_ontology.items():
        scores[domain] = sum(1 for s in skills if re.search(rf"(?<![a-z0-9]){re.escape(s)}(?![a-z0-9])", t))
    domain, value = max(scores.items(), key=lambda kv: kv[1])
    return domain if value > 0 else "unknown"


def _infer_role(text: str) -> str:
    t = text.lower()
    role_patterns = [
        "data scientist",
        "data analyst",
        "ml engineer",
        "machine learning engineer",
        "data engineer",
        "backend engineer",
        "frontend engineer",
        "full stack engineer",
        "business analyst",
        "marketing specialist",
        "hr manager",
        "finance analyst",
        "qa engineer",
        "qa automation engineer",
    ]
    for role in role_patterns:
        if role in t:
            return role
    return "unknown"


def parse_job_text(text: str) -> ParsedJob:
    _, all_skills = _load_ontology()
    main_text, plus_blob = _split_core_and_plus_jd(text)
    buckets = _split_jd_skill_sections(text)

    req_lines = "\n".join(buckets["required"])
    pref_lines = "\n".join(buckets["preferred"])
    gen_lines = "\n".join(buckets["generic"])
    body_lines = "\n".join(buckets["body"])

    req_inline: set[str] = set()
    pref_inline: set[str] = set()
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        sec, _ = _line_has_inline_required_pref(stripped)
        if sec == "required":
            req_inline |= _extract_skills_from_text(stripped, all_skills)
        elif sec == "preferred":
            pref_inline |= _extract_skills_from_text(stripped, all_skills)

    R = _extract_skills_from_text(req_lines, all_skills) | req_inline
    P = _extract_skills_from_text(pref_lines, all_skills) | pref_inline
    G = _extract_skills_from_text(gen_lines, all_skills)
    B = _extract_skills_from_text(body_lines, all_skills)

    plus_skills = _extract_skills_from_text(plus_blob, all_skills)

    # No section headers: core JD (minus plus sentences) → required; plus sentences → preferred
    if not any(buckets["required"]) and not any(buckets["preferred"]) and not any(buckets["generic"]):
        B = _extract_skills_from_text(main_text, all_skills)
        R, P, G = set(), set(), set()
        P = plus_skills

    required_skills, preferred_skills = _normalize_job_skill_lists(R, P, G, B)

    return ParsedJob(
        required_skills=required_skills,
        preferred_skills=preferred_skills,
        required_experience=round(_required_experience(text), 2),
        role=_infer_role(text),
        domain=_infer_domain(text),
        text=text,
    )
