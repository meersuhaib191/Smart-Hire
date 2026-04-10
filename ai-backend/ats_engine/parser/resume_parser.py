from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

import spacy
from spacy.language import Language
from spacy.matcher import PhraseMatcher

from ..models.schemas import ParsedResume
from ..utils.text import normalize_whitespace, safe_lower

SKILL_ALIASES = {
    "structured query language": "sql",
    "powerbi": "power bi",
    "nextjs": "next.js",
    "js": "javascript",
    "ts": "typescript",
    "scikit learn": "scikit-learn"
}

SECTION_PATTERNS: dict[str, tuple[str, ...]] = {
    "summary": ("summary", "profile", "objective", "about"),
    "education": ("education", "academics", "academic background"),
    "projects": ("projects", "project experience"),
    "skills": ("skills", "technical skills", "core skills", "key skills"),
    "experience": ("experience", "work experience", "professional experience", "employment history"),
    "certifications": ("certifications", "certificates", "licenses"),
}

GENERIC_SKILL_NOISE = {"analysis", "growth", "communication"}

DEGREE_PATTERNS = (
    r"\bb\.?\s?tech\b",
    r"\bb\.?\s?e\b",
    r"\bbachelor",
    r"\bm\.?\s?tech\b",
    r"\bm\.?\s?e\b",
    r"\bmaster",
    r"\bmba\b",
    r"\bphd\b",
)

PROJECT_ACTION_PREFIXES = (
    "developed", "built", "created", "designed", "implemented", "analyzed",
    "currently", "using", "worked", "integrated", "deployed", "trained"
)

PROJECT_TITLE_STOPWORDS = {
    "covid", "bootstrap", "python", "react", "scikit", "sql", "javascript", "html", "css"
}


def _normalize_skill(skill: str) -> str:
    s = safe_lower(skill)
    return SKILL_ALIASES.get(s, s)


@lru_cache(maxsize=1)
def _load_ontology_skills() -> tuple[str, ...]:
    ontology_path = Path(__file__).resolve().parent / "skill_ontology.json"
    payload = json.loads(ontology_path.read_text(encoding="utf-8"))
    skills = [safe_lower(str(x)) for x in payload.get("skills", []) if str(x).strip()]
    # Deduplicate and normalize aliases.
    normalized = sorted(set(_normalize_skill(x) for x in skills))
    return tuple(normalized)


@lru_cache(maxsize=1)
def _get_nlp() -> Language:
    try:
        nlp = spacy.load("en_core_web_sm")
    except Exception:
        nlp = spacy.blank("en")
    # Add sentence boundaries for line heuristics in fallback model.
    if "sentencizer" not in nlp.pipe_names:
        nlp.add_pipe("sentencizer")
    # EntityRuler for degree and job title markers.
    if "entity_ruler" not in nlp.pipe_names:
        ruler = nlp.add_pipe("entity_ruler", before="ner" if "ner" in nlp.pipe_names else "sentencizer")
        degree_patterns = [
            {"label": "DEGREE", "pattern": [{"LOWER": {"REGEX": "b\\.?tech|bachelor|master|mba|phd|m\\.?tech"}}]},
            {"label": "DEGREE", "pattern": "Bachelor of Technology"},
            {"label": "DEGREE", "pattern": "Bachelor of Science"},
            {"label": "DEGREE", "pattern": "Master of Science"}
        ]
        job_patterns = [
            {"label": "JOB_TITLE", "pattern": "Data Analyst"},
            {"label": "JOB_TITLE", "pattern": "Data Scientist"},
            {"label": "JOB_TITLE", "pattern": "Software Engineer"},
            {"label": "JOB_TITLE", "pattern": "Backend Engineer"},
            {"label": "JOB_TITLE", "pattern": "Frontend Engineer"},
            {"label": "JOB_TITLE", "pattern": "Business Analyst"}
        ]
        ruler.add_patterns(degree_patterns + job_patterns)
    return nlp


@lru_cache(maxsize=1)
def _get_skill_matcher() -> PhraseMatcher:
    nlp = _get_nlp()
    matcher = PhraseMatcher(nlp.vocab, attr="LOWER")
    skills = _load_ontology_skills()
    patterns = [nlp.make_doc(s) for s in skills]
    matcher.add("SKILL", patterns)
    return matcher


def _is_section_header(line: str) -> str | None:
    clean = safe_lower(line).strip(": -")
    for section, labels in SECTION_PATTERNS.items():
        for label in labels:
            if clean == label:
                return section
    return None


def _split_sections(text: str) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {k: [] for k in SECTION_PATTERNS}
    current = "summary"
    lines = [x.rstrip() for x in text.splitlines()]
    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        hit = _is_section_header(line)
        if hit is not None:
            current = hit
            continue
        sections[current].append(line)
    return sections


def _extract_experience_years(experience_lines: list[str]) -> float:
    # STRICT: if no explicit experience section, return 0.
    if not experience_lines:
        return 0.0
    t = " ".join(experience_lines).lower()
    matches = [float(x) for x in re.findall(r"(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)\s+(?:of\s+)?experience", t)]
    if matches:
        return max(matches)
    spans = re.findall(r"(20\d{2})\s*[-–]\s*(20\d{2}|present|current)", t)
    if not spans:
        return 0.0
    durations: list[float] = []
    for start, end in spans:
        end_y = 2026 if end in {"present", "current"} else int(end)
        durations.append(float(max(0, end_y - int(start))))
    return max(durations) if durations else 0.0


def _normalize_project_title(raw: str) -> str | None:
    cleaned = re.sub(r"^[\-\*\d\.\)\(]+\s*", "", raw).strip()
    cleaned_l = safe_lower(cleaned)
    if not cleaned:
        return None
    if cleaned_l.startswith(PROJECT_ACTION_PREFIXES):
        return None

    candidate = cleaned
    if "—" in cleaned:
        candidate = cleaned.split("—", 1)[0].strip()
    elif ":" in cleaned:
        candidate = cleaned.split(":", 1)[0].strip()
    elif " - " in cleaned:
        candidate = cleaned.split(" - ", 1)[0].strip()

    # Reject long descriptive lines.
    if len(candidate) > 70:
        return None
    words = [w for w in re.split(r"\s+", candidate) if w]
    if len(words) == 0 or len(words) > 8:
        return None
    if len(words) == 1 and safe_lower(words[0]) in PROJECT_TITLE_STOPWORDS:
        return None
    if candidate.endswith("."):
        return None
    if candidate and candidate[0].islower():
        return None
    if not any(ch.isupper() for ch in candidate):
        return None

    candidate = normalize_whitespace(candidate)
    if len(candidate) < 3:
        return None
    return candidate


def _extract_project_titles(project_lines: list[str]) -> list[str]:
    if not project_lines:
        return []

    titles: list[str] = []
    for line in project_lines:
        candidate = _normalize_project_title(line)
        if candidate:
            titles.append(candidate)
    return sorted(set(titles))[:8]


def _extract_project_descriptions(project_lines: list[str]) -> list[str]:
    descriptions: list[str] = []
    for line in project_lines:
        cleaned = normalize_whitespace(re.sub(r"^[\-\*\d\.\)\(]+\s*", "", line).strip())
        if len(cleaned) < 8:
            continue
        # If line is exactly a title token, skip it; keep content-bearing description lines.
        title = _normalize_project_title(line)
        if title and safe_lower(cleaned) == safe_lower(title):
            continue
        descriptions.append(cleaned)
    return sorted(set(descriptions))[:20]


def _extract_internships(experience_lines: list[str]) -> list[str]:
    lines = [x.strip() for x in experience_lines if x.strip()]
    intern_lines = [x for x in lines if any(k in x.lower() for k in ("intern", "internship", "trainee"))]
    return intern_lines[:8]


def _extract_work_experiences(experience_lines: list[str]) -> list[str]:
    lines = [x.strip() for x in experience_lines if x.strip()]
    work_lines = [
        x for x in lines
        if any(k in x.lower() for k in ("worked", "engineer", "analyst", "manager", "developer", "employment", "company"))
        and not any(k in x.lower() for k in ("intern", "internship", "project", "capstone"))
    ]
    return work_lines[:10]


def _extract_education(education_lines: list[str]) -> list[str]:
    nlp = _get_nlp()
    records: list[str] = []
    i = 0
    while i < len(education_lines):
        line = education_lines[i]
        line_l = safe_lower(line)
        doc = nlp(line)
        degree_entity = next((ent.text for ent in doc.ents if ent.label_ == "DEGREE"), None)
        degree_regex_hit = any(re.search(pattern, line_l) for pattern in DEGREE_PATTERNS)
        if not degree_entity and not degree_regex_hit:
            i += 1
            continue

        institution = ""
        institution_entity = next((ent.text for ent in doc.ents if ent.label_ in {"ORG", "FAC"}), None)
        institution_hit = re.search(r"(?:at|from)\s+([A-Za-z][A-Za-z0-9&\.\-\s]{2,})$", line.strip(), flags=re.IGNORECASE)
        if institution_entity:
            institution = institution_entity.strip()
        elif institution_hit:
            institution = institution_hit.group(1).strip()
        elif i + 1 < len(education_lines):
            next_line = education_lines[i + 1]
            next_l = safe_lower(next_line)
            if any(x in next_l for x in ("university", "college", "institute", "school")):
                institution = normalize_whitespace(next_line)
                i += 1

        degree = degree_entity or re.split(r"(?:at|from)\s+", line, maxsplit=1, flags=re.IGNORECASE)[0].strip()
        # Remove trailing date fragments from degree text.
        degree = re.sub(r"[, ]+\d{1,2}/\d{2,4}\s*[-–]\s*(?:\d{1,2}/\d{2,4}|present|current)", "", degree, flags=re.IGNORECASE)
        degree = re.sub(r"[, ]+\d{4}\s*[-–]\s*(?:\d{4}|present|current)", "", degree, flags=re.IGNORECASE)
        degree = normalize_whitespace(degree)
        if institution:
            records.append(f"{degree} - {normalize_whitespace(institution)}")
        else:
            records.append(degree)
        i += 1
    return sorted(set(records))[:6]


def _extract_skills(skills_lines: list[str]) -> list[str]:
    # STRICT: extract only from explicit skills section if present.
    if not skills_lines:
        return []
    nlp = _get_nlp()
    matcher = _get_skill_matcher()
    skill_text = "\n".join(skills_lines)
    doc = nlp(skill_text)
    matches = matcher(doc)
    found: set[str] = set()
    for _, start, end in matches:
        span = doc[start:end].text
        normalized = _normalize_skill(span)
        if normalized in GENERIC_SKILL_NOISE:
            continue
        found.add(normalized)
    # Also accept explicit aliases appearing in skills section.
    text_l = safe_lower(skill_text)
    for alias, canonical in SKILL_ALIASES.items():
        if re.search(rf"(?<![a-z0-9]){re.escape(alias)}(?![a-z0-9])", text_l):
            if canonical not in GENERIC_SKILL_NOISE:
                found.add(canonical)
    return sorted(found)


def parse_resume_text(text: str) -> ParsedResume:
    sections = _split_sections(text)
    experience_lines = sections["experience"]
    skill_lines = sections["skills"]
    project_lines = sections["projects"]
    education_lines = sections["education"]

    return ParsedResume(
        skills=_extract_skills(skill_lines),
        experience_years=round(_extract_experience_years(experience_lines), 2),
        projects=_extract_project_titles(project_lines),
        project_descriptions=_extract_project_descriptions(project_lines),
        internships=_extract_internships(experience_lines),
        work_experiences=_extract_work_experiences(experience_lines),
        education=_extract_education(education_lines),
        text=text,
    )

