from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from .engine.ranking_engine import AtsRankingEngine, JobInput
from .parser import extract_resume_text

app = FastAPI(title="ATS Ranking Engine API", version="1.0.0")

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

engine = AtsRankingEngine()


class ScoreResponse(BaseModel):
    overall_score: float
    semantic_score: float
    skill_score: float
    experience_score: float
    domain_score: float
    role_specific_score: float
    domain_match: bool
    matched_skills: list[str]
    missing_skills: list[str]
    strengths: list[str]
    weaknesses: list[str]
    score_breakdown: dict
    insights: list[str]
    confidence_score: float
    percentile_rank: float
    engine: str
    job_title: str
    job_description: str
    rank: int


class AnalyzeResponse(BaseModel):
    results: list[ScoreResponse]


async def _store_upload_temp_file(upload: UploadFile) -> str:
    suffix = Path(upload.filename or "resume.pdf").suffix or ".pdf"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        temp_path = tmp.name
    payload = await upload.read()
    Path(temp_path).write_bytes(payload)
    return temp_path


def _parse_jobs_blob(job_descriptions_blob: str, job_titles_blob: str | None = None) -> list[JobInput]:
    cleaned = (job_descriptions_blob or "").strip()
    if not cleaned:
        return []

    titles: list[str] = []
    if job_titles_blob and job_titles_blob.strip():
        titles = [line.strip() for line in job_titles_blob.splitlines() if line.strip()]

    # Supported formats:
    # 1) JSON list of strings
    # 2) JSON list of {"title","description"}
    # 3) text blocks split by \n---\n
    # 4) one line = one JD
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, list):
            jobs: list[JobInput] = []
            for i, item in enumerate(parsed):
                if isinstance(item, dict):
                    title = str(item.get("title") or f"Job #{i+1}")
                    desc = str(item.get("description") or "").strip()
                    if desc:
                        jobs.append(JobInput(title=title, description=desc))
                else:
                    desc = str(item).strip()
                    if desc:
                        title = titles[i] if i < len(titles) else f"Job #{i+1}"
                        jobs.append(JobInput(title=title, description=desc))
            return jobs
    except Exception:
        pass

    blocks = [x.strip() for x in cleaned.split("\n---\n") if x.strip()] if "\n---\n" in cleaned else [
        x.strip() for x in cleaned.splitlines() if x.strip()
    ]
    jobs: list[JobInput] = []
    for i, desc in enumerate(blocks):
        title = titles[i] if i < len(titles) else f"Job #{i+1}"
        jobs.append(JobInput(title=title, description=desc))
    return jobs


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/score", response_model=ScoreResponse)
async def score(
    resume: UploadFile = File(...),
    job_description: str = Form(...),
    job_title: str = Form("Target Role"),
):
    temp_path = await _store_upload_temp_file(resume)
    try:
        resume_text = extract_resume_text(temp_path)
        result = engine.score_one(resume_text, JobInput(title=job_title, description=job_description))
        return result.to_dict()
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    resume: UploadFile = File(...),
    job_descriptions_blob: str = Form(...),
    job_titles_blob: str = Form(""),
):
    jobs = _parse_jobs_blob(job_descriptions_blob, job_titles_blob or None)
    if not jobs:
        return {"results": []}
    temp_path = await _store_upload_temp_file(resume)
    try:
        resume_text = extract_resume_text(temp_path)
        ranked = engine.rank_many(resume_text, jobs)
        return {"results": [x.to_dict() for x in ranked]}
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.get("/playground", response_class=HTMLResponse)
def playground() -> str:
    return """
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>ATS Ranking Playground</title>
    <style>
      body { font-family: Arial, sans-serif; max-width: 980px; margin: 24px auto; padding: 0 12px; }
      textarea, input[type="file"], button, input[type="text"] { width: 100%; margin-top: 8px; margin-bottom: 14px; }
      textarea { min-height: 130px; }
      .hint { color: #555; font-size: 13px; margin-top: -8px; margin-bottom: 12px; }
      .box { border: 1px solid #ddd; border-radius: 8px; padding: 16px; }
    </style>
  </head>
  <body>
    <h2>ATS Ranking Playground</h2>
    <p>Upload one resume and rank it against multiple jobs.</p>
    <div class="box">
      <form action="/playground/run" method="post" enctype="multipart/form-data">
        <label><strong>Resume</strong></label>
        <input type="file" name="resume" required />

        <label><strong>Job Titles (optional, one per line)</strong></label>
        <textarea name="job_titles_blob" placeholder="Data Analyst&#10;Data Scientist"></textarea>

        <label><strong>Job Descriptions</strong></label>
        <textarea name="job_descriptions_blob" placeholder="Paste one JD per line OR separate long JDs with ---"></textarea>
        <div class="hint">Tip: separate longer JDs using a line with exactly three dashes: ---</div>

        <button type="submit">Analyze Ranking</button>
      </form>
    </div>
  </body>
</html>
"""


@app.post("/playground/run", response_class=HTMLResponse)
async def playground_run(
    resume: UploadFile = File(...),
    job_descriptions_blob: str = Form(...),
    job_titles_blob: str = Form(""),
):
    payload = await analyze(resume=resume, job_descriptions_blob=job_descriptions_blob, job_titles_blob=job_titles_blob)
    rows = []
    for item in payload["results"]:
        rows.append(
            "<tr>"
            f"<td>{item['rank']}</td>"
            f"<td>{item['job_title']}</td>"
            f"<td>{item['overall_score']:.2f}</td>"
            f"<td>{item['semantic_score']:.2f}</td>"
            f"<td>{item['skill_score']:.2f}</td>"
            f"<td>{item['experience_score']:.2f}</td>"
            f"<td>{item['domain_score']:.2f}</td>"
            f"<td>{item['confidence_score']:.2f}</td>"
            "</tr>"
        )
    table_rows = "".join(rows) if rows else "<tr><td colspan='8'>No jobs provided.</td></tr>"
    return f"""
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>ATS Results</title>
    <style>
      body {{ font-family: Arial, sans-serif; max-width: 1200px; margin: 24px auto; padding: 0 12px; }}
      table {{ border-collapse: collapse; width: 100%; }}
      th, td {{ border: 1px solid #ddd; padding: 8px; vertical-align: top; }}
      th {{ background: #f7f7f7; }}
      a {{ display: inline-block; margin-top: 14px; }}
    </style>
  </head>
  <body>
    <h2>ATS Ranked Results</h2>
    <table>
      <thead>
        <tr>
          <th>Rank</th><th>Job Title</th><th>Overall</th><th>Semantic</th><th>Skill</th><th>Experience</th><th>Domain</th><th>Confidence</th>
        </tr>
      </thead>
      <tbody>{table_rows}</tbody>
    </table>
    <a href="/playground">Run another test</a>
  </body>
</html>
"""

