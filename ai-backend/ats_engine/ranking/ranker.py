from __future__ import annotations

from dataclasses import dataclass

from ..embedding.embedder import Embedder
from ..models.schemas import ParsedJob, ParsedResume, RankItem
from ..scoring.feature_engineering import compute_features
from ..scoring.scorer import AtsScorer


@dataclass
class RankerConfig:
    stable_sort: bool = True


class AtsRanker:
    def __init__(self, scorer: AtsScorer, embedder: Embedder, config: RankerConfig | None = None) -> None:
        self.scorer = scorer
        self.embedder = embedder
        self.config = config or RankerConfig()

    def rank_jobs(self, resume: ParsedResume, jobs: list[ParsedJob]) -> list[RankItem]:
        raw: list[tuple[int, RankItem]] = []
        for idx, job in enumerate(jobs):
            features, matched, missing = compute_features(resume, job, self.embedder)
            scored = self.scorer.score(features, matched, missing)
            raw.append((
                idx,
                RankItem(
                    rank=0,
                    role=job.role,
                    domain=job.domain,
                    score=scored.score,
                    features=scored.features,
                    confidence=scored.confidence,
                    consistency_score=scored.consistency_score,
                    matched_skills=scored.matched_skills,
                    missing_skills=scored.missing_skills,
                    insights=scored.insights,
                    job_text=job.text,
                ),
            ))
        if self.config.stable_sort:
            raw.sort(key=lambda x: (-x[1].score, x[0]))
        else:
            raw.sort(key=lambda x: -x[1].score)
        ordered = [x for _, x in raw]
        for i, item in enumerate(ordered, start=1):
            item.rank = i
        return ordered

