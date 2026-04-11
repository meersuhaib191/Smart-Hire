from __future__ import annotations

import random
from typing import Any

from ..config import settings
from ..utils.similarity import jaccard_similarity, overlap_count


class RandomizationService:
    def select_questions(
        self,
        pool: list[dict[str, Any]],
        history_sets: list[set[str]],
        recent_ids: set[str],
        medium_count: int,
        hard_count: int,
    ) -> list[dict[str, Any]]:
        medium_pool = [item for item in pool if item.get("difficulty") == "medium"]
        hard_pool = [item for item in pool if item.get("difficulty") == "hard"]

        if len(medium_pool) < medium_count or len(hard_pool) < hard_count:
            return []

        for _ in range(settings.randomization_attempts):
            sampled_medium = self._weighted_sample(
                medium_pool,
                medium_count,
                recent_ids,
            )
            sampled_hard = self._weighted_sample(
                hard_pool,
                hard_count,
                recent_ids,
            )
            candidate = [*sampled_medium, *sampled_hard]
            random.shuffle(candidate)
            candidate_ids = {item["hash_id"] for item in candidate}

            if self._passes_uniqueness(candidate_ids, history_sets):
                return candidate
        return []

    def _weighted_sample(self, pool: list[dict[str, Any]], k: int, recent_ids: set[str]) -> list[dict[str, Any]]:
        available = pool[:]
        selected: list[dict[str, Any]] = []
        while available and len(selected) < k:
            weights = [self._score_question(item, recent_ids) for item in available]
            picked = random.choices(available, weights=weights, k=1)[0]
            selected.append(picked)
            available = [item for item in available if item["hash_id"] != picked["hash_id"]]
        return selected

    @staticmethod
    def _score_question(item: dict[str, Any], recent_ids: set[str]) -> float:
        usage_count = int(item.get("usage_count", 0))
        base = 1.0 / (1.0 + usage_count)
        novelty_boost = 1.5 if usage_count == 0 else 1.0
        recent_penalty = 0.25 if item["hash_id"] in recent_ids else 1.0
        return max(base * novelty_boost * recent_penalty, 0.05)

    @staticmethod
    def _passes_uniqueness(candidate_ids: set[str], history_sets: list[set[str]]) -> bool:
        for historic_ids in history_sets:
            if overlap_count(candidate_ids, historic_ids) > settings.overlap_limit:
                return False
            if jaccard_similarity(candidate_ids, historic_ids) > settings.jaccard_threshold:
                return False
        return True

