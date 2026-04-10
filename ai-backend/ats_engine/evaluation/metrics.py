from __future__ import annotations

from dataclasses import dataclass

from ..models.schemas import EvaluationItem
from ..parser.job_parser import parse_job_text
from ..parser.resume_parser import parse_resume_text
from ..ranking.ranker import AtsRanker


@dataclass
class EvaluationResult:
    top1_accuracy: float
    top3_accuracy: float
    mrr: float
    samples: int

    def to_dict(self) -> dict:
        return {
            "top1_accuracy": round(self.top1_accuracy, 4),
            "top3_accuracy": round(self.top3_accuracy, 4),
            "mrr": round(self.mrr, 4),
            "samples": self.samples,
        }


def _truth_match(item_role: str, item_text: str, true_role: str) -> bool:
    t = true_role.lower().strip()
    return t in item_role.lower() or t in item_text.lower()


def evaluate_ranking(samples: list[EvaluationItem], ranker: AtsRanker) -> EvaluationResult:
    if not samples:
        return EvaluationResult(top1_accuracy=0.0, top3_accuracy=0.0, mrr=0.0, samples=0)

    top1 = 0
    top3 = 0
    rr_total = 0.0

    for sample in samples:
        resume = parse_resume_text(sample.resume_text)
        jobs = [parse_job_text(jd) for jd in sample.jobs]
        ranked = ranker.rank_jobs(resume, jobs)

        true_rank = None
        for item in ranked:
            if _truth_match(item.role, item.job_text, sample.true_role):
                true_rank = item.rank
                break
        if true_rank is None:
            continue
        if true_rank == 1:
            top1 += 1
        if true_rank <= 3:
            top3 += 1
        rr_total += 1.0 / true_rank

    n = len(samples)
    return EvaluationResult(
        top1_accuracy=top1 / n,
        top3_accuracy=top3 / n,
        mrr=rr_total / n,
        samples=n,
    )

