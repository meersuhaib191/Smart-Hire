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
- Weighted ATS score with explainable breakdown
- Standalone CLI and FastAPI endpoint for testing

## Folder Structure

- `service.py` - orchestration logic (parse + semantic + skills + final score)
- `parser.py` - resume text extraction
- `semantic.py` - semantic similarity engines
- `skills.py` - skill normalization and matching
- `app.py` - FastAPI app
- `cli.py` - terminal runner

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

## API Test

Run server:

```bash
uvicorn resume_screening.app:app --host 0.0.0.0 --port 8010
```

Call endpoint:

```bash
curl -X POST "http://127.0.0.1:8010/screen" \
  -F "resume=@K:/path/to/resume.pdf" \
  -F "job_description=Need Python, FastAPI, PostgreSQL, Docker"
```

## Response Shape

```json
{
  "overall_score": 74.2,
  "semantic_score": 81.1,
  "skill_coverage_score": 58.3,
  "matched_skills": ["fastapi", "postgresql", "python"],
  "missing_skills": ["docker"],
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
