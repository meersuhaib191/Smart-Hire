from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ScoreWeights:
    semantic: float = 0.40
    skill: float = 0.25
    experience: float = 0.15
    domain: float = 0.10
    role_specific: float = 0.10

    @property
    def total(self) -> float:
        return self.semantic + self.skill + self.experience + self.domain + self.role_specific


FINAL_SCORE_MAX = 95.0
CRITICAL_GAP_FINAL_CAP = 65.0

