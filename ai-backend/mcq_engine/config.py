from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    mongo_uri: str = os.getenv("MCQ_MONGO_URI", "mongodb://localhost:27017")
    mongo_db_name: str = os.getenv("MCQ_DB_NAME", "mcq_engine")
    redis_url: str = os.getenv("MCQ_REDIS_URL", "redis://localhost:6379/0")
    use_in_memory_store: bool = os.getenv("MCQ_USE_IN_MEMORY", "0") == "1"
    openai_api_key: str | None = os.getenv("OPENAI_API_KEY")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    question_pool_threshold: int = int(os.getenv("MCQ_POOL_THRESHOLD", "80"))
    llm_generation_batch_size: int = int(os.getenv("MCQ_LLM_BATCH_SIZE", "24"))
    overlap_limit: int = int(os.getenv("MCQ_OVERLAP_LIMIT", "2"))
    jaccard_threshold: float = float(os.getenv("MCQ_JACCARD_THRESHOLD", "0.2"))
    candidate_test_size: int = int(os.getenv("MCQ_TEST_SIZE", "10"))
    medium_questions_per_test: int = int(os.getenv("MCQ_MEDIUM_COUNT", "5"))
    hard_questions_per_test: int = int(os.getenv("MCQ_HARD_COUNT", "5"))
    randomization_attempts: int = int(os.getenv("MCQ_RANDOMIZATION_ATTEMPTS", "120"))
    recent_window_size: int = int(os.getenv("MCQ_RECENT_WINDOW_SIZE", "250"))
    history_compare_limit: int = int(os.getenv("MCQ_HISTORY_COMPARE_LIMIT", "400"))
    recent_cache_ttl_seconds: int = int(os.getenv("MCQ_RECENT_TTL_SECONDS", "86400"))


settings = Settings()

