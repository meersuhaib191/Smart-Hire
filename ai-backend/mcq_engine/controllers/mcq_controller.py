from __future__ import annotations

from functools import lru_cache

from fastapi import APIRouter, HTTPException

from ..models.schemas import (
    GenerateBatchMCQRequest,
    GenerateBatchMCQResponse,
    GenerateMCQRequest,
    GenerateMCQResponse,
    ParseJobDescriptionRequest,
    ParsedJobDescription,
)
from ..services.jd_parser_service import JDParserService
from ..services.question_service import QuestionService

router = APIRouter(prefix="/mcq", tags=["mcq-generator"])
_jd_parser = JDParserService()


@lru_cache(maxsize=1)
def _question_service() -> QuestionService:
    return QuestionService()


@router.post("/parse-job", response_model=ParsedJobDescription)
def parse_job_description(payload: ParseJobDescriptionRequest) -> ParsedJobDescription:
    return _jd_parser.parse(payload.job_description)


@router.post("/generate", response_model=GenerateMCQResponse)
def generate_mcq(payload: GenerateMCQRequest) -> GenerateMCQResponse:
    try:
        return _question_service().generate_candidate_test(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"MCQ generation failed: {exc}") from exc


@router.post("/generate-batch", response_model=GenerateBatchMCQResponse)
def generate_mcq_batch(payload: GenerateBatchMCQRequest) -> GenerateBatchMCQResponse:
    try:
        return _question_service().generate_batch_tests(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Batch MCQ generation failed: {exc}") from exc

