from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ..config import settings
from ..controllers.mcq_controller import router as mcq_router

app = FastAPI(title="Standalone MCQ Generator Engine", version="1.0.0")

allowed_origins = [
    origin.strip()
    for origin in os.getenv("MCQ_ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(mcq_router)


@app.get("/")
def root() -> dict:
    return {
        "service": "Standalone MCQ Generator Engine",
        "version": "1.0.0",
        "docs": "/docs",
        "openapi": "/openapi.json",
        "health": "/health",
        "endpoints": {
            "POST /mcq/parse-job": "Extract skills/tools/topics/domains from JD",
            "POST /mcq/generate": "Generate 10 unique MCQs for one candidate",
            "POST /mcq/generate-batch": "Generate unique MCQ tests for many candidates",
        },
    }


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "db": settings.mongo_db_name,
        "model": settings.llm_model,
        "llm_base_url": settings.llm_base_url or "https://api.openai.com/v1",
        "pool_threshold": settings.question_pool_threshold,
    }

