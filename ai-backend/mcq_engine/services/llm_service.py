from __future__ import annotations

import json
import random
import re
from typing import Any

from ..config import settings
from ..models.schemas import Difficulty, ExperienceLevel, MCQQuestion, ParsedJobDescription
from ..utils.hashing import question_hash

try:
    from openai import OpenAI
except Exception:  # pragma: no cover - optional dependency at runtime
    OpenAI = None


class LLMService:
    def __init__(self) -> None:
        self._client = OpenAI(api_key=settings.openai_api_key) if OpenAI and settings.openai_api_key else None

    def generate_questions(
        self,
        job_description: str,
        parsed_jd: ParsedJobDescription,
        medium_count: int,
        hard_count: int,
        excluded_hashes: set[str] | None = None,
        job_role: str | None = None,
        experience_level: ExperienceLevel | None = None,
        seed: str | None = None,
    ) -> list[MCQQuestion]:
        excluded_hashes = excluded_hashes or set()
        target_total = medium_count + hard_count

        if not self._client:
            return self._fallback_questions(
                parsed_jd,
                medium_count,
                hard_count,
                excluded_hashes,
                job_role=job_role,
                experience_level=experience_level,
                seed=seed,
            )

        prompt = self._build_prompt(
            job_description,
            parsed_jd,
            medium_count,
            hard_count,
            excluded_hashes,
            job_role=job_role,
            experience_level=experience_level,
            seed=seed,
        )
        response = self._client.chat.completions.create(
            model=settings.openai_model,
            temperature=0.8,
            messages=[
                {"role": "system", "content": "You create practical, scenario-based technical MCQs in strict JSON."},
                {"role": "user", "content": prompt},
            ],
        )
        raw = response.choices[0].message.content or "[]"
        parsed = self._extract_json_array(raw)
        questions = self._sanitize_questions(parsed, excluded_hashes)

        if len(questions) < target_total:
            questions.extend(
                self._fallback_questions(parsed_jd, medium_count, hard_count, excluded_hashes | {q.hash_id for q in questions})
            )

        medium = [q for q in questions if q.difficulty == "medium"][:medium_count]
        hard = [q for q in questions if q.difficulty == "hard"][:hard_count]
        return [*medium, *hard][:target_total]

    def _build_prompt(
        self,
        job_description: str,
        parsed_jd: ParsedJobDescription,
        medium_count: int,
        hard_count: int,
        excluded_hashes: set[str],
        job_role: str | None = None,
        experience_level: ExperienceLevel | None = None,
        seed: str | None = None,
    ) -> str:
        level = experience_level or "mid"
        role = (job_role or "").strip() or "Software Engineer"
        payload = {
            "job_description": job_description,
            "job_role": role,
            "experience_level": level,
            "seed": seed or "default-seed",
            "skills": parsed_jd.skills,
            "tools": parsed_jd.tools,
            "domains": parsed_jd.domains,
            "topics": parsed_jd.topics,
            "requirements": {
                "total_questions": medium_count + hard_count,
                "must_include_fields": [
                    "question",
                    "options",
                    "correct_answer",
                    "difficulty_level",
                    "skill_tag",
                ],
                "difficulty_distribution": (
                    {"basic": 4, "intermediate": 4, "advanced": 2}
                    if level == "fresher"
                    else {"intermediate": 4, "advanced": 4, "difficult": 2}
                ),
                "options_count": 4,
                "options_shape": "object with keys A,B,C,D",
                "correct_answer_shape": "one of A/B/C/D",
                "style": "scenario-based, practical, judgement-focused",
                "focus": [
                    "output-based reasoning",
                    "debugging scenarios",
                    "real-world failures",
                    "async and integration issues",
                ],
                "role_coverage_examples": {
                    "Frontend Developer": [
                        "HTML/CSS",
                        "JavaScript",
                        "React",
                        "Debugging",
                        "Browser behavior",
                    ],
                    "Backend Developer": [
                        "APIs",
                        "Databases",
                        "Authentication",
                        "Server logic",
                        "Error handling",
                    ],
                    "Full Stack Developer": [
                        "Frontend behavior",
                        "Backend APIs",
                        "Database interactions",
                        "Integration debugging",
                    ],
                },
                "uniqueness_rules": [
                    "Use seed to vary wording and data values.",
                    "Allow overlap but avoid near-identical set.",
                    "Keep difficulty and skill coverage consistent.",
                ],
                "constraints": [
                    "Exactly 10 questions",
                    "One correct answer only",
                    "No explanations",
                    "edge cases",
                ],
            },
            "avoid_hashes": list(excluded_hashes)[:120],
            "output_format": "Return only a JSON array. No markdown.",
        }
        return (
            "Generate unique, high-quality technical MCQs for ATS assessments.\n"
            "All questions must be role-relevant and scenario-based.\n"
            "Return strict JSON only.\n"
            f"{json.dumps(payload, ensure_ascii=True)}"
        )

    @staticmethod
    def _extract_json_array(raw: str) -> list[dict[str, Any]]:
        text = raw.strip()
        try:
            parsed = json.loads(text)
            return parsed if isinstance(parsed, list) else []
        except json.JSONDecodeError:
            match = re.search(r"\[.*\]", text, flags=re.DOTALL)
            if not match:
                return []
            try:
                parsed = json.loads(match.group(0))
                return parsed if isinstance(parsed, list) else []
            except json.JSONDecodeError:
                return []

    def _sanitize_questions(self, rows: list[dict[str, Any]], excluded_hashes: set[str]) -> list[MCQQuestion]:
        clean: list[MCQQuestion] = []
        for row in rows:
            try:
                question = str(row.get("question", "")).strip()
                raw_options = row.get("options", [])
                options: list[str]
                if isinstance(raw_options, dict):
                    options = [str(raw_options.get(k, "")).strip() for k in ["A", "B", "C", "D"]]
                else:
                    options = [str(x).strip() for x in raw_options if str(x).strip()]
                if len(options) != 4:
                    continue
                correct = str(row.get("correct_answer", "")).strip()
                if correct in {"A", "B", "C", "D"}:
                    correct_index = {"A": 0, "B": 1, "C": 2, "D": 3}[correct]
                    correct = options[correct_index]
                explanation = str(row.get("explanation", "")).strip()
                if not explanation:
                    explanation = "Scenario-based technical judgment."
                raw_difficulty = str(row.get("difficulty", row.get("difficulty_level", "medium"))).strip().lower()
                difficulty_map = {
                    "basic": "medium",
                    "intermediate": "medium",
                    "medium": "medium",
                    "advanced": "hard",
                    "difficult": "hard",
                    "hard": "hard",
                }
                difficulty = difficulty_map.get(raw_difficulty)
                if not difficulty:
                    continue
                topic = str(row.get("topic", row.get("skill_tag", "general"))).strip().lower()
                hash_id = question_hash(question, options, difficulty, topic)
                if hash_id in excluded_hashes:
                    continue
                clean.append(
                    MCQQuestion(
                        question=question,
                        options=options,
                        correct_answer=correct,
                        explanation=explanation,
                        difficulty=difficulty,  # type: ignore[arg-type]
                        topic=topic,
                        hash_id=hash_id,
                    )
                )
            except Exception:
                continue
        return clean

    def _fallback_questions(
        self,
        parsed_jd: ParsedJobDescription,
        medium_count: int,
        hard_count: int,
        excluded_hashes: set[str],
        job_role: str | None = None,
        experience_level: ExperienceLevel | None = None,
        seed: str | None = None,
    ) -> list[MCQQuestion]:
        topics = self._role_skill_pool(job_role, parsed_jd)
        generated: list[MCQQuestion] = []
        generated_ids: set[str] = set()
        plan: list[Difficulty] = ["medium"] * medium_count + ["hard"] * hard_count
        rng = random.Random(str(seed or "fallback"))

        for difficulty in plan:
            attempts = 0
            while attempts < 20:
                topic = rng.choice(topics)
                question, options, answer, explanation = self._template_question(topic, difficulty, rng)
                hash_id = question_hash(question, options, difficulty, topic)
                attempts += 1
                if hash_id in excluded_hashes or hash_id in generated_ids:
                    continue
                generated.append(
                    MCQQuestion(
                        question=question,
                        options=options,
                        correct_answer=answer,
                        explanation=explanation,
                        difficulty=difficulty,
                        topic=topic,
                        hash_id=hash_id,
                    )
                )
                generated_ids.add(hash_id)
                break
        return generated

    @staticmethod
    def _template_question(topic: str, difficulty: Difficulty, rng: random.Random) -> tuple[str, list[str], str, str]:
        if difficulty == "medium":
            systems = ["REST API gateway", "event consumer", "batch ingestion job", "webhook processor"]
            scenarios = [
                "latency spikes after a release",
                "error rates increase only for one tenant",
                "background jobs start missing SLA windows",
                "API p95 doubles during peak traffic",
            ]
            constraints = ["without impacting current traffic", "within a 15-minute incident window", "before the next deploy", "while preserving auditability"]
            action = rng.choice(
                [
                    "best isolates the root cause without rolling back immediately",
                    "gives the strongest first diagnostic signal",
                    "most safely narrows down whether the issue is code or infrastructure",
                    "provides the fastest evidence for a targeted fix",
                ]
            )
            question = (
                f"In a production {rng.choice(systems)} using {topic}, {rng.choice(scenarios)} {rng.choice(constraints)}. "
                f"Which first step {action}?"
            )
            options = rng.choice(
                [
                    [
                        "Compare request traces and error rates before/after deployment for affected endpoints",
                        "Increase server CPU limits and wait for stabilization",
                        "Restart all services to clear stale processes",
                        "Disable monitoring temporarily to reduce overhead",
                    ],
                    [
                        "Correlate deployment diff with endpoint-level logs, traces, and recent config changes",
                        "Scale replicas by 2x and observe if alarms stop",
                        "Purge cache cluster data to reset state",
                        "Raise request timeouts for all clients",
                    ],
                ]
            )
            correct = options[0]
            explanation = "Tracing and comparative telemetry validates whether code-path changes introduced regressions."
            return question, options, correct, explanation

        failures = [
            "intermittent data corruption appears under concurrency",
            "duplicate records appear only during retries",
            "cross-region writes occasionally overwrite newer values",
            "parallel workers produce non-deterministic state",
        ]
        contexts = ["during blue/green deploys", "under traffic burst conditions", "while replaying failed events", "across multi-region writes"]
        question = (
            f"Your team adds {topic} to a high-traffic pipeline, and {rng.choice(failures)} {rng.choice(contexts)}. "
            "What is the most robust fix?"
        )
        options = rng.choice(
            [
                [
                    "Introduce idempotency keys and transactional boundaries around write operations",
                    "Increase retry count for all failed operations",
                    "Scale worker replicas to reduce queue wait times",
                    "Switch logs to async mode so workers process faster",
                ],
                [
                    "Enforce optimistic locking/version checks plus idempotent handlers on write paths",
                    "Shard the queue by candidate ID to reduce contention",
                    "Disable retries to avoid duplicates",
                    "Route writes through read replicas for lower latency",
                ],
            ]
        )
        correct = options[0]
        explanation = "Idempotency plus transactional guarantees prevents duplicate and partial writes under concurrent execution."
        return question, options, correct, explanation

    @staticmethod
    def _role_skill_pool(job_role: str | None, parsed_jd: ParsedJobDescription) -> list[str]:
        role = (job_role or "").lower()
        if "front" in role:
            base = ["html/css", "javascript", "react", "debugging", "browser behavior", "async ui state"]
        elif "full" in role:
            base = ["react", "javascript", "apis", "databases", "authentication", "integration debugging"]
        elif "back" in role:
            base = ["apis", "databases", "authentication", "server logic", "error handling", "concurrency"]
        else:
            base = []
        jd_topics = parsed_jd.topics or parsed_jd.skills or []
        combined = [*base, *jd_topics]
        unique = [topic for topic in dict.fromkeys([t.strip().lower() for t in combined if t.strip()])]
        return unique or ["apis", "databases", "debugging", "integration"]

