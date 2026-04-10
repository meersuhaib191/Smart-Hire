from __future__ import annotations

import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from ..embedding.embedder import Embedder
from ..evaluation.metrics import evaluate_ranking
from ..models.schemas import (
    ErrorLogRecord,
    EvaluationRequest,
    ParsedJob,
    RankRequest,
)
from ..parser.job_parser import parse_job_text
from ..parser.resume_parser import parse_resume_text
from ..ranking.ranker import AtsRanker
from ..scoring.feature_engineering import compute_features
from ..scoring.scorer import AtsScorer, ScoringWeights
from ..utils.text import extract_text_from_file
from ..utils.error_logger import log_error_record

app = FastAPI(title="ATS Core Engine API", version="1.0.0")

allowed_origins = [
    origin.strip()
    for origin in os.getenv("AI_ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

embedder = Embedder()
scorer = AtsScorer()
ranker = AtsRanker(scorer=scorer, embedder=embedder)


async def _save_upload(upload: UploadFile) -> str:
    suffix = Path(upload.filename or "resume.txt").suffix.lower()
    if suffix not in {".pdf", ".txt", ".md", ".docx"}:
        suffix = ".txt"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        path = tmp.name
    Path(path).write_bytes(await upload.read())
    return path


def _parse_rank_payload(raw: str) -> list[str]:
    import json

    text = (raw or "").strip()
    # Handle escaped newlines from form tools/curl payloads.
    text = text.replace("\\n", "\n")
    if not text:
        return []
    # JSON list format
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return [str(x).strip() for x in parsed if str(x).strip()]
    except Exception:
        pass
    # Delimiter format
    if "\n---\n" in text:
        return [chunk.strip() for chunk in text.split("\n---\n") if chunk.strip()]
    # one line per job format
    return [line.strip() for line in text.splitlines() if line.strip()]


@app.get("/")
def root() -> dict:
    """Avoid 404 when opening the base URL in a browser; API is JSON-only at paths below."""
    return {
        "service": "ATS Core Engine API",
        "version": "1.0.0",
        "docs": "/docs",
        "openapi": "/openapi.json",
        "health": "/health",
        "endpoints": {
            "POST /parse-resume": "multipart: resume file",
            "POST /parse-job": "text/plain body or form job_text, or JSON {job_text}",
            "POST /score": "multipart: resume + form job_text",
            "POST /rank": "multipart: resume + form payload (JD list or --- delimited)",
            "POST /evaluate": "JSON EvaluationRequest",
            "POST /log-error": "JSON ErrorLogRecord",
        },
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "engine": embedder.engine}


@app.post("/parse-resume")
async def parse_resume(resume: UploadFile = File(...)) -> dict:
    path = await _save_upload(resume)
    try:
        text = extract_text_from_file(path)
        parsed = parse_resume_text(text)
        # Public parser output intentionally excludes raw full text.
        return {
            "skills": parsed.skills,
            "experience_years": parsed.experience_years,
            "projects": parsed.projects,
            "education": parsed.education,
        }
    finally:
        if os.path.exists(path):
            os.remove(path)


@app.post("/parse-job")
async def parse_job(request: Request, job_text: str | None = Form(default=None)) -> dict:
    # Accept JD input directly as plain text/form while keeping JSON support.
    jd_text = (job_text or "").strip()
    if not jd_text:
        content_type = (request.headers.get("content-type") or "").lower()
        if "application/json" in content_type:
            payload = await request.json()
            if isinstance(payload, dict):
                jd_text = str(payload.get("job_text", "")).strip()
            elif isinstance(payload, str):
                jd_text = payload.strip()
        else:
            raw = (await request.body()).decode("utf-8", errors="ignore")
            jd_text = raw.strip()

    if not jd_text:
        raise HTTPException(status_code=422, detail="Missing JD input. Provide text/plain body or job_text.")

    parsed = parse_job_text(jd_text)
    return parsed.model_dump()


@app.post("/score")
async def score(
    resume: UploadFile = File(...),
    job_text: str = Form(...),
    semantic_weight: float = Form(0.3),
    skills_weight: float = Form(0.45),
    experience_weight: float = Form(0.15),
    text_weight: float = Form(0.1),
) -> dict:
    local_scorer = AtsScorer(
        ScoringWeights(
            semantic=semantic_weight,
            skills=skills_weight,
            experience=experience_weight,
            text=text_weight,
        )
    )
    path = await _save_upload(resume)
    try:
        resume_parsed = parse_resume_text(extract_text_from_file(path))
        job_parsed = parse_job_text(job_text)
        features, matched, missing = compute_features(resume_parsed, job_parsed, embedder)
        result = local_scorer.score(features, matched, missing)
        return result.model_dump()
    finally:
        if os.path.exists(path):
            os.remove(path)


@app.post("/rank")
async def rank(
    resume: UploadFile = File(...),
    payload: str = Form(...),
) -> dict:
    request = RankRequest(job_descriptions=_parse_rank_payload(payload))
    path = await _save_upload(resume)
    try:
        resume_parsed = parse_resume_text(extract_text_from_file(path))
        jobs: list[ParsedJob] = [parse_job_text(jd) for jd in request.job_descriptions]
        ranked = ranker.rank_jobs(resume_parsed, jobs)
        return {"results": [x.model_dump() for x in ranked]}
    finally:
        if os.path.exists(path):
            os.remove(path)


@app.post("/evaluate")
def evaluate(payload: EvaluationRequest) -> dict:
    result = evaluate_ranking(payload.samples, ranker)
    return result.to_dict()


@app.post("/log-error")
def log_error(payload: ErrorLogRecord) -> dict:
    log_error_record(payload)
    return {"status": "logged"}

