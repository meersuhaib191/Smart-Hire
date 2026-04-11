from __future__ import annotations

from collections import OrderedDict
import hashlib
import os
from typing import Iterable

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


class _VectorCache:
    def __init__(self, size: int = 2048) -> None:
        self.size = size
        self.store: "OrderedDict[str, np.ndarray]" = OrderedDict()

    @staticmethod
    def _key(text: str) -> str:
        return hashlib.sha1(text.encode("utf-8", errors="ignore")).hexdigest()

    def get(self, text: str) -> np.ndarray | None:
        k = self._key(text)
        v = self.store.get(k)
        if v is not None:
            self.store.move_to_end(k)
        return v

    def put(self, text: str, vec: np.ndarray) -> None:
        k = self._key(text)
        self.store[k] = vec
        self.store.move_to_end(k)
        while len(self.store) > self.size:
            self.store.popitem(last=False)


class Embedder:
    def __init__(self) -> None:
        self.cache = _VectorCache()
        self.model = None
        self.engine = "tfidf_fallback"
        configured_engine = (os.getenv("ATS_EMBEDDER_ENGINE") or os.getenv("EMBEDDER_ENGINE") or "").strip().lower()
        if configured_engine in {"tfidf", "tfidf_fallback"}:
            self.model = None
            self.engine = "tfidf_fallback"
            return
        try:
            from sentence_transformers import SentenceTransformer  # type: ignore

            self.model = SentenceTransformer("all-MiniLM-L6-v2")
            self.engine = "sentence_transformer"
        except Exception:
            self.model = None
            self.engine = "tfidf_fallback"

    def _encode_batch(self, texts: list[str]) -> list[np.ndarray]:
        if self.model is None:
            raise RuntimeError("No embedding model available.")
        out: list[np.ndarray | None] = [None] * len(texts)
        miss_idx: list[int] = []
        miss_texts: list[str] = []
        for i, t in enumerate(texts):
            c = self.cache.get(t)
            if c is not None:
                out[i] = c
            else:
                miss_idx.append(i)
                miss_texts.append(t)
        if miss_texts:
            vecs = self.model.encode(miss_texts)
            for idx, vec in enumerate(vecs):
                real_idx = miss_idx[idx]
                arr = np.array(vec)
                self.cache.put(texts[real_idx], arr)
                out[real_idx] = arr
        return [x if x is not None else np.array([]) for x in out]

    @staticmethod
    def cosine(a: np.ndarray, b: np.ndarray) -> float:
        return float(cosine_similarity([a], [b])[0][0])

    def semantic_similarity(self, text_a: str, text_b: str) -> float:
        if self.model is not None:
            va, vb = self._encode_batch([text_a, text_b])
            return self.cosine(va, vb)
        matrix = TfidfVectorizer(ngram_range=(1, 2), min_df=1).fit_transform([text_a, text_b])
        return float(cosine_similarity(matrix[0], matrix[1])[0][0])

    def semantic_similarity_batch(self, base_text: str, other_texts: Iterable[str]) -> list[float]:
        others = list(other_texts)
        if not others:
            return []
        if self.model is not None:
            vecs = self._encode_batch([base_text] + others)
            base = vecs[0]
            return [self.cosine(base, v) for v in vecs[1:]]
        corpus = [base_text] + others
        matrix = TfidfVectorizer(ngram_range=(1, 2), min_df=1).fit_transform(corpus)
        base = matrix[0]
        return [float(cosine_similarity(base, matrix[i])[0][0]) for i in range(1, matrix.shape[0])]

