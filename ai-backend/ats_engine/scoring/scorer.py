from __future__ import annotations

from dataclasses import dataclass
import math

from ..models.schemas import FeatureVector, ScoreBreakdown


@dataclass(frozen=True)
class ScoringWeights:
    semantic: float = 0.30
    skills: float = 0.45
    experience: float = 0.15
    text: float = 0.1

    @property
    def total(self) -> float:
        return self.semantic + self.skills + self.experience + self.text


class AtsScorer:
    def __init__(self, weights: ScoringWeights | None = None) -> None:
        self.weights = weights or ScoringWeights()
        if abs(self.weights.total - 1.0) > 1e-6:
            raise ValueError("Scoring weights must sum to 1.0")

    def score(
        self,
        features: FeatureVector,
        matched_skills: list[str],
        missing_skills: list[str],
    ) -> ScoreBreakdown:
        final_score = (
            self.weights.semantic * features.semantic_similarity
            + self.weights.skills * features.skill_overlap
            + self.weights.experience * features.experience_score
            + self.weights.text * features.text_similarity
        )
        final_score = min(final_score, 0.95)
        consistency = self._consistency_score(features)
        confidence = self._confidence_score(features, consistency)
        insights = self.generate_insights(features)

        return ScoreBreakdown(
            score=round(max(0.0, min(1.0, final_score)), 4),
            features=features,
            confidence=round(confidence, 4),
            consistency_score=round(consistency, 4),
            matched_skills=matched_skills,
            missing_skills=missing_skills,
            insights=insights,
        )

    @staticmethod
    def generate_insights(features: FeatureVector) -> list[str]:
        insights: list[str] = []
        insights.append(f"Semantic similarity: {features.semantic_similarity:.2f}")
        insights.append(f"Skill overlap: {features.skill_overlap:.2f}")
        insights.append(f"Experience score: {features.experience_score:.2f}")
        if features.semantic_similarity > 0.7:
            insights.append("Strong alignment with job responsibilities")
        elif features.semantic_similarity > 0.4:
            insights.append("Moderate alignment with job role")
        else:
            insights.append("Weak alignment with job expectations")

        if features.skill_overlap > 0.8:
            insights.append("Most required skills are present")
        elif features.skill_overlap > 0.5:
            insights.append("Partial skill match; some gaps exist")
        else:
            insights.append("Significant skill gaps detected")

        if features.experience_score >= 1.0:
            insights.append("Meets or exceeds experience requirements")
        else:
            insights.append("Experience slightly below requirement")
        return insights

    @staticmethod
    def _consistency_score(features: FeatureVector) -> float:
        values = [
            features.semantic_similarity,
            features.skill_overlap,
            features.experience_score,
            features.text_similarity,
        ]
        mean = sum(values) / len(values)
        var = sum((x - mean) ** 2 for x in values) / len(values)
        std = math.sqrt(var)
        # std in [0, ~0.5] for bounded [0,1] values.
        return max(0.0, min(1.0, 1.0 - (std / 0.5)))

    @staticmethod
    def _confidence_score(features: FeatureVector, consistency_score: float) -> float:
        conf = (
            0.5 * features.skill_overlap
            + 0.3 * features.semantic_similarity
            + 0.2 * consistency_score
        )
        return max(0.0, min(1.0, conf))

