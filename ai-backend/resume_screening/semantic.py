from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Literal

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


SemanticEngine = Literal["sentence_transformer", "tfidf_fallback"]


@dataclass
class SemanticResult:
    score: float
    engine: SemanticEngine


class SemanticScorer:
    def __init__(self) -> None:
        self._model = _load_embedding_model()
        self._engine: SemanticEngine = "sentence_transformer" if self._model is not None else "tfidf_fallback"

    @staticmethod
    def _normalize_similarity_to_100(similarity: float) -> float:
        # Cosine similarity can be in [-1, 1]. Normalize to [0, 100].
        normalized = ((similarity + 1.0) / 2.0) * 100.0
        return max(0.0, min(100.0, normalized))

    def score(self, resume_text: str, job_description: str) -> SemanticResult:
        if not resume_text.strip() or not job_description.strip():
            return SemanticResult(score=0.0, engine=self._engine)

        if self._engine == "sentence_transformer" and self._model is not None:
            vectors = self._model.encode([resume_text, job_description])
            sim = float(cosine_similarity([vectors[0]], [vectors[1]])[0][0])
            return SemanticResult(score=self._normalize_similarity_to_100(sim), engine=self._engine)

        vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1)
        matrix = vectorizer.fit_transform([resume_text, job_description])
        sim = float(cosine_similarity(matrix[0], matrix[1])[0][0])
        return SemanticResult(score=self._normalize_similarity_to_100(sim), engine="tfidf_fallback")


@lru_cache(maxsize=1)
def _load_embedding_model():
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore

        return SentenceTransformer("all-MiniLM-L6-v2")
    except Exception:
        return None

