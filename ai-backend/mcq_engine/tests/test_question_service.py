from __future__ import annotations

from mcq_engine.services.question_service import QuestionService


def test_resolve_difficulty_mix_defaults() -> None:
    medium, hard = QuestionService._resolve_difficulty_mix(None)
    assert (medium, hard) == (5, 5)


def test_resolve_difficulty_mix_for_high_performer() -> None:
    medium, hard = QuestionService._resolve_difficulty_mix(0.92)
    assert (medium, hard) == (4, 6)


def test_resolve_difficulty_mix_for_low_performer() -> None:
    medium, hard = QuestionService._resolve_difficulty_mix(0.22)
    assert (medium, hard) == (6, 4)

