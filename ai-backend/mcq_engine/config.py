from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    mongo_uri: str = os.getenv("MCQ_MONGO_URI", "mongodb://localhost:27017")
    mongo_db_name: str = os.getenv("MCQ_DB_NAME", "mcq_engine")
    redis_url: str = os.getenv("MCQ_REDIS_URL", "redis://localhost:6379/0")
    use_in_memory_store: bool = os.getenv("MCQ_USE_IN_MEMORY", "0") == "1"
    # LLM: OpenAI SDK-compatible API (OpenAI, Groq free tier, Together, etc.)
    llm_api_key: str | None = os.getenv("MCQ_LLM_API_KEY") or os.getenv("OPENAI_API_KEY")
    llm_base_url: str | None = (os.getenv("MCQ_LLM_BASE_URL") or os.getenv("OPENAI_BASE_URL") or "").strip() or None
    llm_model: str = os.getenv("MCQ_LLM_MODEL") or os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    # Smaller batches + spacing reduce Groq 413/429 rate_limit_exceeded on free tier.
    llm_generation_batch_size: int = int(os.getenv("MCQ_LLM_BATCH_SIZE", "8"))
    llm_max_output_tokens: int = int(os.getenv("MCQ_LLM_MAX_TOKENS", "8192"))
    # Pause between pool refill batches to reduce Groq RPM bursts (seconds).
    llm_sleep_between_batches: float = float(os.getenv("MCQ_LLM_SLEEP_BETWEEN_BATCHES", "2.0"))
    question_pool_threshold: int = int(os.getenv("MCQ_POOL_THRESHOLD", "80"))
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

