# ATS Engine (Standalone Backend Core)

Production-grade ATS backend module with no UI dependency.

## Structure

```text
ats_engine/
  parser/
    resume_parser.py
    job_parser.py
  embedding/
    embedder.py
  scoring/
    feature_engineering.py
    scorer.py
  ranking/
    ranker.py
  models/
    schemas.py
  api/
    main.py
  utils/
```

## API Endpoints

- `POST /parse-resume`
- `POST /parse-job`
- `POST /score`
- `POST /rank`
- `POST /evaluate` (Top-1 / Top-3 / MRR)
- `POST /log-error` (prediction error logging)

## Run API

From `ai-backend`:

```bash
uvicorn ats_engine.api.main:app --host 0.0.0.0 --port 8020
```

## Sample Run

```bash
curl -X POST "http://127.0.0.1:8020/score" ^
  -F "resume=@K:/path/to/resume.pdf" ^
  -F "job_text=Data Analyst role. Required SQL, Tableau, reporting, 2 years experience."
```

```bash
curl -X POST "http://127.0.0.1:8020/rank" ^
  -F "resume=@K:/path/to/resume.pdf" ^
  -F "payload=[\"Data Analyst required SQL Tableau reporting\",\"Backend Engineer required Python FastAPI PostgreSQL\"]"
```

## Testing

```bash
python -m unittest ats_engine.tests.test_core -v
```

## Calibration Notes

- Skill matching uses strict hybrid logic:
  - exact match = `1.0`
  - synonym match = `0.9`
  - embedding similarity `> 0.75` = `0.8`
- Experience logic:
  - required exp missing -> `1.0`
  - candidate exp missing -> `0.5`
  - otherwise `min(candidate/required, 1.0)`
- Semantic calibration:
  - normalize cosine using `(cosine + 1) / 2`
  - damp high similarities (`>0.8`) by `0.95`
- Confidence:
  - `0.5 * skill + 0.3 * semantic + 0.2 * consistency`

