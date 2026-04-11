from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pymongo.errors import DuplicateKeyError

from ..config import settings
from ..db.mongo import question_sets_collection, questions_collection
from ..db.redis_client import get_redis
from ..models.schemas import GenerateBatchMCQRequest, GenerateBatchMCQResponse, GenerateMCQRequest, GenerateMCQResponse, MCQQuestion
from .jd_parser_service import JDParserService
from .llm_service import LLMService
from .randomization_service import RandomizationService


class QuestionService:
    def __init__(self) -> None:
        self._question_collection = questions_collection()
        self._question_set_collection = question_sets_collection()
        self._redis = get_redis()
        self._jd_parser = JDParserService()
        self._llm_service = LLMService()
        self._randomization_service = RandomizationService()

    def generate_candidate_test(self, payload: GenerateMCQRequest) -> GenerateMCQResponse:
        parsed_jd = self._jd_parser.parse(payload.job_description)
        medium_count, hard_count = self._resolve_difficulty_mix(payload.candidate_performance_score)
        self._ensure_pool(payload.job_id, payload.job_description, parsed_jd.topics, payload.company_tier)
        pool = self._fetch_candidate_pool(payload.job_id, parsed_jd.topics, payload.company_tier)

        for _ in range(3):
            history_sets = self._fetch_history_sets(payload.job_id)
            recent_ids = self._fetch_recent_ids(payload.job_id)
            selected = self._randomization_service.select_questions(
                pool,
                history_sets,
                recent_ids,
                medium_count=medium_count,
                hard_count=hard_count,
            )
            if selected:
                return self._finalize_selection(payload.job_id, payload.candidate_id, selected)

            self._generate_more_questions(
                payload.job_id,
                payload.job_description,
                parsed_jd.topics,
                batch_size=20,
                company_tier=payload.company_tier,
            )
            pool = self._fetch_candidate_pool(payload.job_id, parsed_jd.topics, payload.company_tier)

        raise RuntimeError("Unable to create a unique test set with current pool constraints.")

    def generate_batch_tests(self, payload: GenerateBatchMCQRequest) -> GenerateBatchMCQResponse:
        tests: list[GenerateMCQResponse] = []
        for candidate_id in payload.candidate_ids:
            single_payload = GenerateMCQRequest(
                job_id=payload.job_id,
                job_description=payload.job_description,
                candidate_id=candidate_id,
                candidate_performance_score=payload.candidate_performance_score,
                company_tier=payload.company_tier,
            )
            tests.append(self.generate_candidate_test(single_payload))

        return GenerateBatchMCQResponse(
            job_id=payload.job_id,
            generated_count=len(tests),
            tests=tests,
        )

    def _ensure_pool(self, job_id: str, job_description: str, topics: list[str], company_tier: str) -> None:
        count = self._question_collection.count_documents({"job_id": job_id, "company_tier": company_tier})
        if count >= settings.question_pool_threshold:
            return

        zero_insert_rounds = 0
        while count < settings.question_pool_threshold:
            generated = self._generate_more_questions(
                job_id,
                job_description,
                topics,
                batch_size=settings.llm_generation_batch_size,
                company_tier=company_tier,
            )
            if generated == 0:
                zero_insert_rounds += 1
                if zero_insert_rounds >= 3:
                    break
                continue
            zero_insert_rounds = 0
            count += generated

    def _generate_more_questions(
        self,
        job_id: str,
        job_description: str,
        topics: list[str],
        batch_size: int,
        company_tier: str,
    ) -> int:
        medium_target = max(batch_size // 2, 1)
        hard_target = max(batch_size - medium_target, 1)
        excluded = set(self._question_collection.distinct("hash_id", {"job_id": job_id, "company_tier": company_tier}))

        parsed_jd = self._jd_parser.parse(job_description)
        if topics:
            parsed_jd.topics = topics
        generated = self._llm_service.generate_questions(
            job_description=job_description,
            parsed_jd=parsed_jd,
            medium_count=medium_target,
            hard_count=hard_target,
            excluded_hashes=excluded,
        )

        inserted = 0
        now = datetime.now(timezone.utc)
        for question in generated:
            doc = {
                "job_id": job_id,
                "question": question.question,
                "options": question.options,
                "correct_answer": question.correct_answer,
                "explanation": question.explanation,
                "difficulty": question.difficulty,
                "topic": question.topic,
                "hash_id": question.hash_id,
                "company_tier": company_tier,
                "usage_count": 0,
                "created_at": now,
            }
            try:
                self._question_collection.insert_one(doc)
                inserted += 1
            except DuplicateKeyError:
                continue
        return inserted

    def _fetch_candidate_pool(self, job_id: str, topics: list[str], company_tier: str) -> list[dict[str, Any]]:
        if topics:
            pool = list(
                self._question_collection.find(
                    {"job_id": job_id, "company_tier": company_tier, "topic": {"$in": topics}},
                    {"_id": 0},
                )
            )
            if len(pool) >= settings.candidate_test_size:
                return pool

        return list(self._question_collection.find({"job_id": job_id, "company_tier": company_tier}, {"_id": 0}))

    def _fetch_history_sets(self, job_id: str) -> list[set[str]]:
        cursor = self._question_set_collection.find(
            {"job_id": job_id},
            {"_id": 0, "question_ids": 1},
        ).sort("created_at", -1).limit(settings.history_compare_limit)
        return [set(row.get("question_ids", [])) for row in cursor]

    def _fetch_recent_ids(self, job_id: str) -> set[str]:
        key = f"mcq:recent:{job_id}"
        rows = self._redis.zrevrange(key, 0, settings.recent_window_size - 1)
        return set(rows)

    def _finalize_selection(self, job_id: str, candidate_id: str, selected: list[dict[str, Any]]) -> GenerateMCQResponse:
        test_id = str(uuid4())
        question_ids = [row["hash_id"] for row in selected]

        for qid in question_ids:
            self._question_collection.update_one({"hash_id": qid}, {"$inc": {"usage_count": 1}})
        self._question_set_collection.insert_one(
            {
                "test_id": test_id,
                "job_id": job_id,
                "candidate_id": candidate_id,
                "question_ids": question_ids,
                "created_at": datetime.now(timezone.utc),
            }
        )

        now_ts = datetime.now(timezone.utc).timestamp()
        recent_key = f"mcq:recent:{job_id}"
        candidate_key = f"mcq:candidate:{job_id}:{candidate_id}"
        self._redis.zadd(recent_key, {qid: now_ts for qid in question_ids})
        self._redis.expire(recent_key, settings.recent_cache_ttl_seconds)
        self._redis.set(candidate_key, test_id, ex=settings.recent_cache_ttl_seconds)

        questions = [MCQQuestion(**row) for row in selected]
        return GenerateMCQResponse(candidate_id=candidate_id, test_id=test_id, questions=questions)

    @staticmethod
    def _resolve_difficulty_mix(score: float | None) -> tuple[int, int]:
        if score is None:
            return settings.medium_questions_per_test, settings.hard_questions_per_test
        if score >= 0.75:
            return 4, 6
        if score <= 0.35:
            return 6, 4
        return settings.medium_questions_per_test, settings.hard_questions_per_test

