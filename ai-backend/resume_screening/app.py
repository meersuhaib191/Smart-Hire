from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from .service import ResumeScreeningService, ScreeningWeights

app = FastAPI(title="Resume Screening Module", version="0.1.0")

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

service = ResumeScreeningService()


class ScreeningResponse(BaseModel):
    overall_score: float
    semantic_score: float
    skill_score: float
    skill_coverage_score: float
    matched_skills: list[str]
    missing_skills: list[str]
    matched_skill_count: int
    missing_skill_count: int
    experience_score: float
    candidate_experience_years: float
    required_experience_years: float | None
    role_boost: float
    insights: list[str]
    resume_chars: int
    job_description_chars: int
    engine: str
    weights: dict
    required_skills_with_weights: dict


class MultiJdScreeningItem(ScreeningResponse):
    job_description: str
    rank: int


class MultiJdScreeningResponse(BaseModel):
    results: list[MultiJdScreeningItem]


async def _store_upload_temp_file(resume: UploadFile) -> str:
    suffix = Path(resume.filename or "resume.pdf").suffix or ".pdf"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        temp_path = tmp.name
    payload = await resume.read()
    Path(temp_path).write_bytes(payload)
    return temp_path


def _parse_job_descriptions_blob(raw: str) -> list[str]:
    # Supports either JSON array or plain text split by delimiter/newline.
    cleaned = (raw or "").strip()
    if not cleaned:
        return []
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, list):
            return [str(x).strip() for x in parsed if str(x).strip()]
    except Exception:
        pass

    if "\n---\n" in cleaned:
        return [chunk.strip() for chunk in cleaned.split("\n---\n") if chunk.strip()]
    return [line.strip() for line in cleaned.splitlines() if line.strip()]


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/playground", response_class=HTMLResponse)
def playground() -> str:
    return """
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Resume Screening Playground</title>
    <style>
      body { font-family: Arial, sans-serif; max-width: 900px; margin: 24px auto; padding: 0 12px; }
      textarea, input[type="file"], button { width: 100%; margin-top: 8px; margin-bottom: 16px; }
      textarea { min-height: 140px; }
      .hint { color: #555; font-size: 13px; margin-top: -10px; margin-bottom: 12px; }
      .box { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
      .mono { font-family: Consolas, monospace; white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <h2>Resume Screening Playground</h2>
    <p>Upload your resume once, paste multiple job descriptions, and get ranked ATS matches.</p>
    <div class="box">
      <form action="/playground/run" method="post" enctype="multipart/form-data">
        <label><strong>Resume File</strong></label>
        <input type="file" name="resume" required />

        <label><strong>Job Descriptions</strong></label>
        <textarea name="job_descriptions_blob" placeholder="Paste one JD per line OR separate blocks with ---"></textarea>
        <div class="hint">Tip: Use one line per JD, or separate longer JDs using a line with three dashes: ---</div>

        <label><strong>Semantic Weight</strong></label>
        <input type="text" name="semantic_weight" value="0.55" />

        <label><strong>Skill Weight</strong></label>
        <input type="text" name="skill_weight" value="0.30" />

        <label><strong>Experience Weight</strong></label>
        <input type="text" name="experience_weight" value="0.15" />

        <label><strong>Role Alignment Boost</strong></label>
        <input type="text" name="use_role_boost" value="true" />

        <button type="submit">Run Matching</button>
      </form>
    </div>
    <p class="hint">API alternative: POST /screen/multi-jd with <code>resume</code> + <code>job_descriptions_blob</code>.</p>
  </body>
</html>
"""


@app.post("/screen", response_model=ScreeningResponse)
async def screen_resume(
    resume: UploadFile = File(...),
    job_description: str = Form(...),
    semantic_weight: float = Form(0.55),
    skill_weight: float = Form(0.30),
    experience_weight: float = Form(0.15),
    use_role_boost: bool = Form(True),
):
    temp_path = await _store_upload_temp_file(resume)
    try:
        result = service.screen(
            resume_path=temp_path,
            job_description_text=job_description,
            weights=ScreeningWeights(
                semantic_weight=semantic_weight,
                skill_weight=skill_weight,
                experience_weight=experience_weight,
            ),
            use_role_boost=use_role_boost,
        )
        return result.to_dict()
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.post("/screen/multi-jd", response_model=MultiJdScreeningResponse)
async def screen_resume_against_multiple_jds(
    resume: UploadFile = File(...),
    job_descriptions_blob: str = Form(...),
    semantic_weight: float = Form(0.55),
    skill_weight: float = Form(0.30),
    experience_weight: float = Form(0.15),
    use_role_boost: bool = Form(True),
):
    job_descriptions = _parse_job_descriptions_blob(job_descriptions_blob)
    if not job_descriptions:
        return {"results": []}

    temp_path = await _store_upload_temp_file(resume)
    try:
        items: list[dict] = []
        weights = ScreeningWeights(
            semantic_weight=semantic_weight,
            skill_weight=skill_weight,
            experience_weight=experience_weight,
        )
        for jd in job_descriptions:
            result = service.screen(
                resume_path=temp_path,
                job_description_text=jd,
                weights=weights,
                use_role_boost=use_role_boost,
            ).to_dict()
            result["job_description"] = jd[:280]
            items.append(result)

        items.sort(key=lambda x: x["overall_score"], reverse=True)
        for idx, item in enumerate(items, start=1):
            item["rank"] = idx
        return {"results": items}
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.post("/playground/run", response_class=HTMLResponse)
async def run_playground(
    resume: UploadFile = File(...),
    job_descriptions_blob: str = Form(...),
    semantic_weight: float = Form(0.55),
    skill_weight: float = Form(0.30),
    experience_weight: float = Form(0.15),
    use_role_boost: bool = Form(True),
):
    payload = await screen_resume_against_multiple_jds(
        resume=resume,
        job_descriptions_blob=job_descriptions_blob,
        semantic_weight=semantic_weight,
        skill_weight=skill_weight,
        experience_weight=experience_weight,
        use_role_boost=use_role_boost,
    )
    rows = []
    for item in payload["results"]:
        rows.append(
            "<tr>"
            f"<td>{item['rank']}</td>"
            f"<td>{item['overall_score']:.2f}</td>"
            f"<td>{item['semantic_score']:.2f}</td>"
            f"<td>{item['skill_score']:.2f}</td>"
            f"<td>{item['experience_score']:.2f}</td>"
            f"<td>{item['matched_skill_count']}</td>"
            f"<td>{item['missing_skill_count']}</td>"
            f"<td>{item['job_description']}</td>"
            "</tr>"
        )
    rows_html = "".join(rows) if rows else "<tr><td colspan='8'>No job descriptions provided.</td></tr>"
    return f"""
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Screening Results</title>
    <style>
      body {{ font-family: Arial, sans-serif; max-width: 1100px; margin: 24px auto; padding: 0 12px; }}
      table {{ border-collapse: collapse; width: 100%; }}
      th, td {{ border: 1px solid #ddd; padding: 8px; vertical-align: top; }}
      th {{ background: #f7f7f7; }}
      a {{ display: inline-block; margin-top: 14px; }}
    </style>
  </head>
  <body>
    <h2>Resume vs Multiple Jobs</h2>
    <table>
      <thead>
        <tr>
          <th>Rank</th><th>Overall</th><th>Semantic</th><th>Skill</th><th>Experience</th><th>Matched</th><th>Missing</th><th>Job Description</th>
        </tr>
      </thead>
      <tbody>{rows_html}</tbody>
    </table>
    <a href="/playground">Run another test</a>
  </body>
</html>
"""

