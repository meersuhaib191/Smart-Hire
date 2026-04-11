from __future__ import annotations

import hashlib
import re


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def question_hash(question: str, options: list[str], difficulty: str, topic: str) -> str:
    canonical = "||".join(
        [
            normalize_text(question),
            "|".join(sorted(normalize_text(option) for option in options)),
            normalize_text(difficulty),
            normalize_text(topic),
        ]
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

