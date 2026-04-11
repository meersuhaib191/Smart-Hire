from __future__ import annotations

import json
import random
import re
from typing import Any

from ..config import settings
from ..models.schemas import Difficulty, MCQQuestion, ParsedJobDescription
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
    ) -> list[MCQQuestion]:
        excluded_hashes = excluded_hashes or set()
        target_total = medium_count + hard_count

        if not self._client:
            return self._fallback_questions(parsed_jd, medium_count, hard_count, excluded_hashes)

        prompt = self._build_prompt(job_description, parsed_jd, medium_count, hard_count, excluded_hashes)
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
    ) -> str:
        payload = {
            "job_description": job_description,
            "skills": parsed_jd.skills,
            "tools": parsed_jd.tools,
            "domains": parsed_jd.domains,
            "topics": parsed_jd.topics,
            "requirements": {
                "medium_questions": medium_count,
                "hard_questions": hard_count,
                "must_include_fields": [
                    "question",
                    "options",
                    "correct_answer",
                    "explanation",
                    "difficulty",
                    "topic",
                ],
                "difficulty_allowed": ["medium", "hard"],
                "options_count": 4,
                "focus": [
                    "real-world troubleshooting",
                    "coding logic",
                    "edge cases",
                    "system behavior scenarios",
                ],
            },
            "avoid_hashes": list(excluded_hashes)[:120],
            "output_format": "Return only a JSON array. No markdown.",
        }
        return (
            "Generate unique, high-quality technical MCQs.\n"
            "Use practical situations over pure theory.\n"
            "Ensure one and only one correct option.\n"
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
                options = [str(x).strip() for x in row.get("options", []) if str(x).strip()]
                if len(options) != 4:
                    continue
                correct = str(row.get("correct_answer", "")).strip()
                explanation = str(row.get("explanation", "")).strip()
                difficulty = str(row.get("difficulty", "medium")).strip().lower()
                if difficulty not in {"medium", "hard"}:
                    continue
                topic = str(row.get("topic", "general")).strip().lower()
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
    ) -> list[MCQQuestion]:
        topics = parsed_jd.topics or parsed_jd.skills or ["backend systems", "apis", "databases", "debugging"]
        generated: list[MCQQuestion] = []
        generated_ids: set[str] = set()
        plan: list[Difficulty] = ["medium"] * medium_count + ["hard"] * hard_count

        for difficulty in plan:
            attempts = 0
            while attempts < 20:
                topic = random.choice(topics)
                question, options, answer, explanation = self._template_question(topic, difficulty)
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
    def _template_question(topic: str, difficulty: Difficulty) -> tuple[str, list[str], str, str]:
        if difficulty == "medium":
            systems = ["REST API gateway", "event consumer", "batch ingestion job", "webhook processor"]
            scenarios = [
                "latency spikes after a release",
                "error rates increase only for one tenant",
                "background jobs start missing SLA windows",
                "API p95 doubles during peak traffic",
            ]
            constraints = ["without impacting current traffic", "within a 15-minute incident window", "before the next deploy", "while preserving auditability"]
            action = random.choice(
                [
                    "best isolates the root cause without rolling back immediately",
                    "gives the strongest first diagnostic signal",
                    "most safely narrows down whether the issue is code or infrastructure",
                    "provides the fastest evidence for a targeted fix",
                ]
            )
            question = (
                f"In a production {random.choice(systems)} using {topic}, {random.choice(scenarios)} {random.choice(constraints)}. "
                f"Which first step {action}?"
            )
            options = random.choice(
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
            f"Your team adds {topic} to a high-traffic pipeline, and {random.choice(failures)} {random.choice(contexts)}. "
            "What is the most robust fix?"
        )
        options = random.choice(
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

