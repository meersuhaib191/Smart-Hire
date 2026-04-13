from __future__ import annotations

import json
import re
import time
from typing import Any

from ..config import settings
from ..models.schemas import Difficulty, ExperienceLevel, MCQQuestion, ParsedJobDescription
from ..utils.hashing import question_hash

try:
    from openai import APIStatusError, OpenAI, RateLimitError
except Exception:  # pragma: no cover - optional dependency at runtime
    APIStatusError = Exception  # type: ignore[misc, assignment]
    OpenAI = None
    RateLimitError = Exception  # type: ignore[misc, assignment]


class LLMService:
    def __init__(self) -> None:
        if not OpenAI or not settings.llm_api_key:
            self._client = None
        else:
            kwargs: dict[str, str] = {"api_key": settings.llm_api_key}
            if settings.llm_base_url:
                kwargs["base_url"] = settings.llm_base_url.rstrip("/")
            self._client = OpenAI(**kwargs)

    @staticmethod
    def _is_transient_provider_throttle(exc: BaseException) -> bool:
        """Groq often uses HTTP 413 + rate_limit_exceeded (not only 429). Duck-type status_code."""
        code = getattr(exc, "status_code", None)
        if code == 429:
            return True
        if code == 413:
            msg = str(exc).lower()
            return "rate" in msg or "limit" in msg or "exceed" in msg
        return False

    def _create_chat_completion(self, **kwargs: Any):
        """Groq/OpenAI may return 429 or 413 (rate_limit_exceeded); retry with backoff."""
        assert self._client is not None
        max_retries = 8
        last_exc: BaseException | None = None
        for attempt in range(max_retries):
            try:
                return self._client.chat.completions.create(**kwargs)
            except RateLimitError as exc:
                last_exc = exc
            except APIStatusError as exc:
                if self._is_transient_provider_throttle(exc):
                    last_exc = exc
                else:
                    raise
            if attempt < max_retries - 1:
                base = min(2**attempt, 60)
                if getattr(last_exc, "status_code", None) == 413:
                    base = max(base, 4)
                time.sleep(base)
            elif last_exc is not None:
                raise last_exc
        assert False, "unreachable"

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
            raise RuntimeError(
                "No LLM API key on the MCQ engine. Set MCQ_LLM_API_KEY or OPENAI_API_KEY. "
                "For Groq (free tier), also set MCQ_LLM_BASE_URL=https://api.groq.com/openai/v1 "
                "and MCQ_LLM_MODEL=llama-3.1-8b-instant (or another Groq model id)."
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
        last_err: str | None = None
        for attempt, temperature in enumerate((0.75, 0.35), start=1):
            response = self._create_chat_completion(
                model=settings.llm_model,
                temperature=temperature,
                max_tokens=settings.llm_max_output_tokens,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You output ONLY valid JSON. No markdown fences around the JSON. "
                            "Each MCQ must include difficulty_level medium or hard and a short explanation."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
            )
            raw = response.choices[0].message.content or "[]"
            parsed = self._extract_question_rows(raw)
            questions = self._sanitize_questions(parsed, excluded_hashes)
            if len(questions) >= target_total:
                break
            last_err = f"attempt {attempt}: parsed {len(parsed)} rows, {len(questions)} valid (need {target_total})"

        if len(questions) < target_total:
            raise RuntimeError(
                f"LLM returned only {len(questions)} valid question(s); need {target_total}. "
                f"{last_err or ''} "
                "If using Groq, try MCQ_LLM_BATCH_SIZE=8, MCQ_LLM_MAX_TOKENS=16384, or a larger model."
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
                    f"Exactly {medium_count + hard_count} questions in the output array",
                    "One correct answer only",
                    "Each question must include a short explanation (one sentence)",
                    "edge cases",
                ],
            },
            "avoid_hashes": list(excluded_hashes)[:120],
            "output_format": (
                'Return a JSON array only. Example shape: [{"question":"...","options":["a","b","c","d"],'
                '"correct_answer":"a","difficulty_level":"medium","skill_tag":"python","explanation":"..."}]'
            ),
        }
        return (
            "Generate unique, high-quality technical MCQs for ATS assessments.\n"
            "All questions must be role-relevant and scenario-based.\n"
            "Return strict JSON only (no markdown code fences).\n"
            f"{json.dumps(payload, ensure_ascii=True)}"
        )

    @staticmethod
    def _strip_code_fences(text: str) -> str:
        t = text.strip()
        if "```" not in t:
            return t
        m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", t, flags=re.IGNORECASE)
        return m.group(1).strip() if m else t

    @classmethod
    def _extract_question_rows(cls, raw: str) -> list[dict[str, Any]]:
        text = cls._strip_code_fences(raw)
        for candidate in (text, raw.strip()):
            if not candidate:
                continue
            try:
                parsed = json.loads(candidate)
                rows = cls._coerce_to_row_list(parsed)
                if rows:
                    return rows
            except json.JSONDecodeError:
                continue
        # Last resort: bracket slice (may fail on nested arrays)
        match = re.search(r"\[[\s\S]*\]", text)
        if match:
            try:
                parsed = json.loads(match.group(0))
                return cls._coerce_to_row_list(parsed)
            except json.JSONDecodeError:
                pass
        return []

    @staticmethod
    def _coerce_to_row_list(parsed: Any) -> list[dict[str, Any]]:
        if isinstance(parsed, list):
            return [x for x in parsed if isinstance(x, dict)]
        if isinstance(parsed, dict):
            for key in ("questions", "mcqs", "items", "data", "results"):
                v = parsed.get(key)
                if isinstance(v, list):
                    return [x for x in v if isinstance(x, dict)]
        return []

    def _sanitize_questions(self, rows: list[dict[str, Any]], excluded_hashes: set[str]) -> list[MCQQuestion]:
        clean: list[MCQQuestion] = []
        for row in rows:
            try:
                question = str(row.get("question", row.get("q", ""))).strip()
                if len(question) < 10:
                    continue
                raw_options = row.get("options", row.get("choices", []))
                options: list[str]
                if isinstance(raw_options, dict):
                    options = [str(raw_options.get(k, "")).strip() for k in ["A", "B", "C", "D"]]
                elif isinstance(raw_options, list):
                    options = [str(x).strip() for x in raw_options[:4]]
                else:
                    continue
                while len(options) < 4:
                    options.append("")
                options = options[:4]
                if not all(options):
                    continue
                raw_correct = row.get("correct_answer", row.get("answer", row.get("correct")))
                correct: str
                if isinstance(raw_correct, int) and 0 <= raw_correct <= 3:
                    correct = options[raw_correct]
                else:
                    correct = str(raw_correct or "").strip()
                if correct in {"A", "B", "C", "D"}:
                    correct_index = {"A": 0, "B": 1, "C": 2, "D": 3}[correct]
                    correct = options[correct_index]
                elif correct.isdigit() and len(correct) == 1:
                    idx = int(correct)
                    if 0 <= idx <= 3:
                        correct = options[idx]
                if correct not in options:
                    match_opt = next((o for o in options if o.lower() == correct.lower()), None)
                    if match_opt:
                        correct = match_opt
                    else:
                        continue
                explanation = str(row.get("explanation", row.get("rationale", ""))).strip()
                if not explanation:
                    explanation = "Scenario-based technical judgment."
                raw_difficulty = str(row.get("difficulty", row.get("difficulty_level", "medium"))).strip().lower()
                difficulty_map = {
                    "basic": "medium",
                    "easy": "medium",
                    "beginner": "medium",
                    "intermediate": "medium",
                    "medium": "medium",
                    "advanced": "hard",
                    "difficult": "hard",
                    "hard": "hard",
                    "expert": "hard",
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

