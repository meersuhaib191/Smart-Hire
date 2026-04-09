from __future__ import annotations

from collections import OrderedDict
from dataclasses import dataclass
import hashlib
from typing import Iterable

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from .types import SemanticScoreDetails


@dataclass
class SemanticBatchResult:
    scores: list[float]
    engine: str


class EmbeddingCache:
    def __init__(self, max_items: int = 2048) -> None:
        self.max_items = max_items
        self._store: "OrderedDict[str, np.ndarray]" = OrderedDict()

    def _key(self, text: str) -> str:
        return hashlib.sha1(text.encode("utf-8", errors="ignore")).hexdigest()

    def get(self, text: str) -> np.ndarray | None:
        key = self._key(text)
        value = self._store.get(key)
        if value is not None:
            self._store.move_to_end(key)
        return value

    def put(self, text: str, vec: np.ndarray) -> None:
        key = self._key(text)
        self._store[key] = vec
        self._store.move_to_end(key)
        while len(self._store) > self.max_items:
            self._store.popitem(last=False)


class SemanticMatcher:
    def __init__(self) -> None:
        self.model = None
        self.engine = "tfidf_fallback"
        self.cache = EmbeddingCache()
        try:
            from sentence_transformers import SentenceTransformer  # type: ignore

            self.model = SentenceTransformer("all-MiniLM-L6-v2")
            self.engine = "sentence_transformer"
        except Exception:
            self.model = None
            self.engine = "tfidf_fallback"

    @staticmethod
    def _normalize(sim: float) -> float:
        # Normalize cosine [-1, 1] to [0, 100]
        return max(0.0, min(100.0, ((sim + 1.0) / 2.0) * 100.0))

    def _encode_batch(self, texts: Iterable[str]) -> list[np.ndarray]:
        entries = list(texts)
        if self.model is None:
            raise RuntimeError("Embedding model unavailable.")

        out: list[np.ndarray | None] = [None] * len(entries)
        missing_indices: list[int] = []
        missing_texts: list[str] = []
        for idx, text in enumerate(entries):
            cached = self.cache.get(text)
            if cached is not None:
                out[idx] = cached
            else:
                missing_indices.append(idx)
                missing_texts.append(text)

        if missing_texts:
            vectors = self.model.encode(missing_texts)
            for i, vec in enumerate(vectors):
                idx = missing_indices[i]
                arr = np.array(vec)
                self.cache.put(entries[idx], arr)
                out[idx] = arr

        return [x if x is not None else np.array([]) for x in out]

    def similarity_batch(self, resume_text: str, job_descriptions: list[str]) -> SemanticBatchResult:
        if not resume_text.strip() or not job_descriptions:
            return SemanticBatchResult(scores=[], engine=self.engine)

        if self.model is not None:
            vectors = self._encode_batch([resume_text] + job_descriptions)
            resume_vec = vectors[0]
            scores = []
            for jd_vec in vectors[1:]:
                sim = float(cosine_similarity([resume_vec], [jd_vec])[0][0])
                scores.append(round(self._normalize(sim), 2))
            return SemanticBatchResult(scores=scores, engine=self.engine)

        corpus = [resume_text] + job_descriptions
        matrix = TfidfVectorizer(ngram_range=(1, 2), min_df=1).fit_transform(corpus)
        resume_vec = matrix[0]
        scores = []
        for i in range(1, matrix.shape[0]):
            sim = float(cosine_similarity(resume_vec, matrix[i])[0][0])
            scores.append(round(self._normalize(sim), 2))
        return SemanticBatchResult(scores=scores, engine="tfidf_fallback")

    def similarity_single(self, resume_text: str, job_description: str) -> SemanticScoreDetails:
        batch = self.similarity_batch(resume_text, [job_description])
        score = batch.scores[0] if batch.scores else 0.0
        return SemanticScoreDetails(score=score, engine=batch.engine)

