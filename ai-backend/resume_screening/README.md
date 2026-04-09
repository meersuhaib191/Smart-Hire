# Resume Screening Module (Standalone)

This module runs ATS-style resume parsing and semantic matching as an isolated component before app integration.

## Features

- Resume text extraction from:
  - PDF (`.pdf`)
  - Plain text (`.txt`)
  - Markdown (`.md`)
  - Word docs (`.docx`, optional dependency)
- Semantic similarity scoring using:
  - `sentence-transformers` (primary)
  - TF-IDF cosine fallback if transformer model is unavailable
- Skill extraction + gap analysis:
  - Matched skills
  - Missing skills
  - Coverage ratio
- Weighted ATS score with explainable breakdown:
  - `0.55 * semantic_score`
  - `0.30 * skill_score`
  - `0.15 * experience_score`
- Optional role alignment boost (`0-10`) with final score cap at `100`
- Standalone CLI and FastAPI endpoint for testing

## Folder Structure

- `service.py` - orchestration logic (parse + semantic + skills + final score)
- `parser.py` - resume text extraction
- `semantic.py` - semantic similarity engines
- `skills.py` - skill normalization and matching
- `app.py` - FastAPI app
- `cli.py` - terminal runner
- `benchmark.py` - compare many resumes against one JD
- `scoring.py` - semantic/skill/experience/boost scoring logic

## Quick Start

From `ai-backend`:

```bash
pip install -r requirements.txt
python -m pip install -r resume_screening/requirements.txt
```

If you want spaCy noun parsing:

```bash
python -m spacy download en_core_web_sm
```

## CLI Test

```bash
python -m resume_screening.cli --resume "K:/path/to/resume.pdf" --jd "K:/path/to/job_description.txt"
```

Or pass JD as inline text:

```bash
python -m resume_screening.cli --resume "K:/path/to/resume.pdf" --jd-text "Looking for a React + TypeScript developer with SQL and testing experience."
```

Match one resume against multiple JDs from a folder:

```bash
python -m resume_screening.cli \
  --resume "K:/path/to/your_resume.pdf" \
  --jd-dir "K:/path/to/job_descriptions_folder" \
  --pass-threshold 65
```

Disable role boost if needed:

```bash
python -m resume_screening.cli --resume "K:/path/to/your_resume.pdf" --jd "K:/path/to/jd.txt" --disable-role-boost
```

## API Test

Run server:

```bash
uvicorn resume_screening.app:app --host 0.0.0.0 --port 8010
```

Open browser playground:

- [http://127.0.0.1:8010/playground](http://127.0.0.1:8010/playground)
- Upload your resume once and paste multiple job descriptions.

Call endpoint:

```bash
curl -X POST "http://127.0.0.1:8010/screen" \
  -F "resume=@K:/path/to/resume.pdf" \
  -F "job_description=Need Python, FastAPI, PostgreSQL, Docker" \
  -F "semantic_weight=0.55" \
  -F "skill_weight=0.30" \
  -F "experience_weight=0.15" \
  -F "use_role_boost=true"
```

Multi-JD API:

```bash
curl -X POST "http://127.0.0.1:8010/screen/multi-jd" \
  -F "resume=@K:/path/to/resume.pdf" \
  -F "job_descriptions_blob=JD one line\nJD two line"
```

## Benchmark Test (Multiple Resumes)

Use this to validate ranking quality and threshold behavior before integration.

```bash
python -m resume_screening.benchmark \
  --resume-dir "K:/smart-hire-app/ai-backend/resume_screening/samples/benchmark" \
  --jd "K:/smart-hire-app/ai-backend/resume_screening/samples/benchmark/jd_backend.txt" \
  --pass-threshold 65 \
  --json-out "K:/smart-hire-app/ai-backend/resume_screening/samples/benchmark/output.json"
```

Expected outcome (roughly):

- `resume_strong.txt` ranks highest (PASS)
- `resume_medium.txt` middle
- `resume_weak.txt` lowest (REJECT)

## Response Shape

```json
{
  "overall_score": 74.2,
  "semantic_score": 81.1,
  "skill_score": 58.3,
  "experience_score": 70.0,
  "role_boost": 4.0,
  "matched_skills": ["fastapi", "postgresql", "python"],
  "missing_skills": ["docker"],
  "insights": [
    "Strong semantic match with job role.",
    "Missing some non-critical skills: docker.",
    "Experience meets or exceeds the role requirement."
  ],
  "matched_skill_count": 3,
  "missing_skill_count": 1,
  "resume_chars": 4821,
  "job_description_chars": 642,
  "engine": "sentence_transformer",
  "weights": {
    "semantic_weight": 0.7,
    "skill_weight": 0.3
  }
}
```

## Notes

- This is intentionally standalone and does not depend on Supabase or app routes.
- After validation, we can wire this into your existing ATS pipeline endpoints.
