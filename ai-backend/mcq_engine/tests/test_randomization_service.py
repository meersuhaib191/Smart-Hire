from __future__ import annotations

import random

from mcq_engine.services.randomization_service import RandomizationService
from mcq_engine.utils.similarity import jaccard_similarity


def _question(hash_id: str, difficulty: str, usage_count: int = 0) -> dict:
    return {
        "hash_id": hash_id,
        "difficulty": difficulty,
        "usage_count": usage_count,
    }


def test_rejects_candidate_when_overlap_exceeds_limit() -> None:
    service = RandomizationService()
    candidate_ids = {f"q{i}" for i in range(10)}
    history = [{f"q{i}" for i in range(3)}]  # overlap=3 (>2)

    assert service._passes_uniqueness(candidate_ids, history) is False


def test_rejects_candidate_when_jaccard_exceeds_limit() -> None:
    service = RandomizationService()
    candidate_ids = {"q0", "q1", "q2", "q3"}
    # overlap=2 (within limit), union=4 -> jaccard=0.5 (>0.2)
    history = [{"q0", "q1"}]

    assert jaccard_similarity(candidate_ids, history[0]) > 0.20
    assert service._passes_uniqueness(candidate_ids, history) is False


def test_select_questions_returns_mixed_unique_set() -> None:
    random.seed(7)
    service = RandomizationService()

    pool = [_question(f"m{i}", "medium") for i in range(20)] + [_question(f"h{i}", "hard") for i in range(20)]
    history = [
        {"m0", "m1", "m2", "m3", "m4", "h0", "h1", "h2", "h3", "h4"},
        {"m5", "m6", "m7", "m8", "m9", "h5", "h6", "h7", "h8", "h9"},
    ]

    selected = service.select_questions(pool, history, recent_ids=set(), medium_count=5, hard_count=5)
    selected_ids = {row["hash_id"] for row in selected}
    selected_medium = [row for row in selected if row["difficulty"] == "medium"]
    selected_hard = [row for row in selected if row["difficulty"] == "hard"]

    assert len(selected) == 10
    assert len(selected_ids) == 10
    assert len(selected_medium) == 5
    assert len(selected_hard) == 5
    assert service._passes_uniqueness(selected_ids, history) is True

