# ATS Engine (Standalone Backend Core)

Standalone ATS parser/scoring/ranking backend used by Smart Hire.

## Core Components

```text
ats_engine/
  parser/                 # section-aware resume + JD parsing
  embedding/              # semantic similarity backend
  scoring/                # feature engineering + weighted score
  ranking/                # multi-job ranking support
  models/                 # request/response schemas
  api/                    # FastAPI routes
  tests/                  # ATS unit tests
```

## API Endpoints

- `GET /` -> API metadata
- `GET /health` -> runtime health
- `POST /parse-resume`
- `POST /parse-job`
- `POST /score`
- `POST /rank`
- `POST /evaluate`
- `POST /log-error`

## Run Locally

From `ai-backend`:

```bash
pip install -r requirements.txt
uvicorn ats_engine.api.main:app --host 0.0.0.0 --port 8020 --reload
```

## Design Notes (Current)

- Resume parser is section-aware and outputs structured fields.
- Job parser normalizes required/preferred/generic skill sections.
- Skill matching is strict normalized set logic (no synthetic fallback boosts).
- Project-context skill inference is supported via controlled mappings.
- Shortlist orchestration is handled in app server (`src/server/pipeline/shortlist.ts`), not in this module.

## Testing

```bash
python -m unittest ats_engine.tests.test_core -v
python -m unittest ats_engine.tests.test_job_parser -v
```

For full platform-level architecture and change history, see root `README.md`.

