from __future__ import annotations

import json
import re
from pathlib import Path

from ..models.schemas import ParsedJobDescription

_DEFAULT_TOOLS = {
    "docker",
    "kubernetes",
    "aws",
    "azure",
    "gcp",
    "git",
    "postgresql",
    "mysql",
    "mongodb",
    "redis",
    "fastapi",
    "django",
    "flask",
    "node.js",
    "react",
    "next.js",
    "tensorflow",
    "pytorch",
}

_DEFAULT_DOMAINS = {
    "machine learning",
    "data engineering",
    "backend",
    "frontend",
    "devops",
    "cloud",
    "nlp",
    "computer vision",
    "fintech",
    "healthcare",
    "e-commerce",
    "security",
}


class JDParserService:
    def __init__(self) -> None:
        self._ontology_skills = self._load_ontology_skills()

    def parse(self, job_description: str) -> ParsedJobDescription:
        text = job_description.lower()
        matched_skills = self._extract_matches(text, self._ontology_skills)
        matched_tools = self._extract_matches(text, _DEFAULT_TOOLS)
        matched_domains = self._extract_matches(text, _DEFAULT_DOMAINS)

        raw_topics = self._extract_topic_candidates(job_description)
        topics = list(dict.fromkeys([*matched_skills[:6], *raw_topics]))

        return ParsedJobDescription(
            skills=matched_skills[:15],
            tools=matched_tools[:10],
            domains=matched_domains[:8],
            topics=topics[:15],
        )

    def _load_ontology_skills(self) -> list[str]:
        ontology_path = Path(__file__).resolve().parents[2] / "ats_engine" / "parser" / "skill_ontology.json"
        if not ontology_path.exists():
            return []
        data = json.loads(ontology_path.read_text(encoding="utf-8"))
        skills = data.get("skills", [])
        return [str(skill).strip().lower() for skill in skills if str(skill).strip()]

    @staticmethod
    def _extract_matches(text: str, candidates: list[str] | set[str]) -> list[str]:
        matches: list[str] = []
        for candidate in candidates:
            escaped = re.escape(candidate.lower())
            if re.search(rf"(?<![\w-]){escaped}(?![\w-])", text):
                matches.append(candidate)
        return sorted(set(matches), key=matches.index)

    @staticmethod
    def _extract_topic_candidates(job_description: str) -> list[str]:
        patterns = [
            r"experience with ([^.;\n]+)",
            r"knowledge of ([^.;\n]+)",
            r"familiar with ([^.;\n]+)",
            r"build(?:ing)? ([^.;\n]+)",
        ]
        chunks: list[str] = []
        for pattern in patterns:
            chunks.extend(re.findall(pattern, job_description, flags=re.IGNORECASE))

        topics: list[str] = []
        for chunk in chunks:
            for topic in re.split(r",|/| and ", chunk, flags=re.IGNORECASE):
                cleaned = re.sub(r"[^a-zA-Z0-9\-\+\.\s]", "", topic).strip().lower()
                if len(cleaned) >= 3:
                    topics.append(cleaned)
        return list(dict.fromkeys(topics))

