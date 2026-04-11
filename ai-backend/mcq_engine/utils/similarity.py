from __future__ import annotations


def overlap_count(left: set[str], right: set[str]) -> int:
    return len(left.intersection(right))


def jaccard_similarity(left: set[str], right: set[str]) -> float:
    union = left.union(right)
    if not union:
        return 0.0
    return len(left.intersection(right)) / len(union)

