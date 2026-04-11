from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, field_validator


Difficulty = Literal["medium", "hard"]


class ParsedJobDescription(BaseModel):
    skills: list[str] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)
    domains: list[str] = Field(default_factory=list)
    topics: list[str] = Field(default_factory=list)


class GenerateMCQRequest(BaseModel):
    job_id: str = Field(min_length=1)
    job_description: str = Field(min_length=30)
    candidate_id: str = Field(min_length=1)
    candidate_performance_score: float | None = Field(default=None, ge=0.0, le=1.0)
    company_tier: Literal["faang", "startup", "enterprise", "general"] = "general"


class ParseJobDescriptionRequest(BaseModel):
    job_description: str = Field(min_length=30)


class MCQQuestion(BaseModel):
    question: str = Field(min_length=10)
    options: list[str] = Field(min_length=4, max_length=4)
    correct_answer: str = Field(min_length=1)
    explanation: str = Field(min_length=10)
    difficulty: Difficulty
    topic: str = Field(min_length=1)
    hash_id: str

    @field_validator("correct_answer")
    @classmethod
    def answer_must_be_in_options(cls, value: str, info):
        options = info.data.get("options", [])
        if options and value not in options:
            raise ValueError("correct_answer must match one of the options")
        return value


class GenerateMCQResponse(BaseModel):
    candidate_id: str
    test_id: str
    questions: list[MCQQuestion]


class GenerateBatchMCQRequest(BaseModel):
    job_id: str = Field(min_length=1)
    job_description: str = Field(min_length=30)
    candidate_ids: list[str] = Field(min_length=1)
    candidate_performance_score: float | None = Field(default=None, ge=0.0, le=1.0)
    company_tier: Literal["faang", "startup", "enterprise", "general"] = "general"

    @field_validator("candidate_ids")
    @classmethod
    def unique_candidate_ids(cls, value: list[str]) -> list[str]:
        cleaned = [candidate_id.strip() for candidate_id in value if candidate_id.strip()]
        unique = list(dict.fromkeys(cleaned))
        if not unique:
            raise ValueError("candidate_ids must include at least one valid id")
        return unique


class GenerateBatchMCQResponse(BaseModel):
    job_id: str
    generated_count: int
    tests: list[GenerateMCQResponse]


class QuestionDocument(MCQQuestion):
    job_id: str
    company_tier: Literal["faang", "startup", "enterprise", "general"] = "general"
    usage_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class QuestionSetDocument(BaseModel):
    test_id: str
    job_id: str
    candidate_id: str
    question_ids: list[str]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

