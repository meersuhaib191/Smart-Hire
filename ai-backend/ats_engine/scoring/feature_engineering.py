from __future__ import annotations

from dataclasses import dataclass

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from ..embedding.embedder import Embedder
from ..models.schemas import FeatureVector, ParsedJob, ParsedResume
from .skill_matching import compute_skill_overlap, infer_skills_from_projects


def _clamp01(v: float) -> float:
    return max(0.0, min(1.0, v))


def _experience_feature(resume: ParsedResume, job: ParsedJob) -> float:
    candidate_exp = resume.experience_years
    if resume.work_experiences:
        candidate_exp *= 1.0
    elif resume.internships:
        candidate_exp *= 0.75
    elif resume.projects:
        candidate_exp *= 0.6

    if job.required_experience <= 0:
        return 1.0
    if candidate_exp <= 0:
        return 0.3
    return _clamp01(candidate_exp / job.required_experience)


def _text_similarity(resume_text: str, job_text: str) -> float:
    matrix = TfidfVectorizer(ngram_range=(1, 2), min_df=1).fit_transform([resume_text, job_text])
    return _clamp01(float(cosine_similarity(matrix[0], matrix[1])[0][0]))


def compute_features(
    resume: ParsedResume,
    job: ParsedJob,
    embedder: Embedder,
) -> tuple[FeatureVector, list[str], list[str]]:
    sem_cos = embedder.semantic_similarity(resume.text, job.text)
    sem = _clamp01((sem_cos + 1.0) / 2.0)
    if sem > 0.8:
        sem *= 0.95

    project_context = list(resume.projects) + list(getattr(resume, "project_descriptions", []))
    inferred_skills = infer_skills_from_projects(project_context)
    final_skills = sorted(set(resume.skills).union(inferred_skills))

    overlap_result = compute_skill_overlap(job.required_skills, final_skills, embedder)
    overlap, matched, missing = overlap_result.score, overlap_result.matched_skills, overlap_result.missing_skills
    total_required = len(matched) + len(missing)
    # Anti-inflation: if a long required list appears "perfect", keep overlap realistic.
    if total_required >= 8 and overlap >= 0.999:
        overlap = 0.92

    exp = _experience_feature(resume, job)
    txt = _text_similarity(resume.text, job.text)
    features = FeatureVector(
        semantic_similarity=round(sem, 4),
        skill_overlap=round(overlap, 4),
        experience_score=round(exp, 4),
        text_similarity=round(txt, 4),
    )
    return features, matched, missing

