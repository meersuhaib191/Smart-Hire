# Resume Screening Module (Standalone)

This module runs a production-style ATS ranking engine as an isolated component before app integration.

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
  - `0.45 * semantic_score`
  - `0.30 * skill_score`
  - `0.15 * experience_score`
  - `0.10 * domain_score`
- Hard controls for realistic ranking:
  - No-skill penalty
  - Critical-skill cap
  - Domain mismatch penalty
  - Final score capped at `95`
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
- `engine/` - production ranking architecture (semantic, skills, experience, domain, orchestration)

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

Single job endpoint (`/score`):

```bash
curl -X POST "http://127.0.0.1:8010/score" \
  -F "resume=@K:/path/to/resume.pdf" \
  -F "job_title=Data Analyst" \
  -F "job_description=Need SQL, Tableau, dashboards, and reporting skills."
```

Multi-job ranking endpoint (`/analyze`):

```bash
curl -X POST "http://127.0.0.1:8010/analyze" \
  -F "resume=@K:/path/to/resume.pdf" \
  -F "job_titles_blob=Data Analyst\nData Scientist" \
  -F "job_descriptions_blob=JD one\n---\nJD two"
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
  "overall_score": 72.5,
  "semantic_score": 68.0,
  "skill_score": 75.0,
  "experience_score": 55.0,
  "domain_score": 80.0,
  "domain_match": true,
  "matched_skills": ["python", "sql"],
  "missing_skills": ["tableau"],
  "insights": [
    "Strong match for Data Scientist role.",
    "Good project-based experience boosts data-role fit.",
    "Missing skills reduce match quality: tableau."
  ],
  "confidence_score": 78.2,
  "percentile_rank": 90.0,
  "engine": "sentence_transformer",
  "rank": 1
}
```

## Notes

- This is intentionally standalone and does not depend on Supabase or app routes.
- After validation, we can wire this into your existing ATS pipeline endpoints.
