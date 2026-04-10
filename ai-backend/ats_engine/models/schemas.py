from __future__ import annotations

from pydantic import BaseModel, Field


class ParsedResume(BaseModel):
    skills: list[str] = Field(default_factory=list)
    experience_years: float = 0.0
    projects: list[str] = Field(default_factory=list)
    project_descriptions: list[str] = Field(default_factory=list)
    internships: list[str] = Field(default_factory=list)
    work_experiences: list[str] = Field(default_factory=list)
    education: list[str] = Field(default_factory=list)
    text: str


class ParsedJob(BaseModel):
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    required_experience: float = 0.0
    role: str = "unknown"
    domain: str = "unknown"
    text: str


class FeatureVector(BaseModel):
    semantic_similarity: float
    skill_overlap: float
    experience_score: float
    text_similarity: float


class ScoreBreakdown(BaseModel):
    score: float
    features: FeatureVector
    confidence: float = 0.0
    consistency_score: float = 0.0
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    insights: list[str] = Field(default_factory=list)


class RankItem(BaseModel):
    rank: int
    role: str
    domain: str
    score: float
    features: FeatureVector
    confidence: float
    consistency_score: float
    matched_skills: list[str]
    missing_skills: list[str]
    insights: list[str]
    job_text: str


class ParseJobRequest(BaseModel):
    job_text: str


class RankRequest(BaseModel):
    job_descriptions: list[str]


class EvaluationItem(BaseModel):
    resume_text: str
    jobs: list[str]
    true_role: str


class EvaluationRequest(BaseModel):
    samples: list[EvaluationItem]


class ErrorLogRecord(BaseModel):
    resume_id: str
    predicted_role: str
    true_role: str
    features: dict
    error_type: str

