# Standalone MCQ Generator Engine

Production-oriented FastAPI service that creates unique, job-specific technical MCQ sets per candidate.

## Features

- JD parser for `skills`, `tools`, `domains`, `topics`
- LLM-driven MCQ generation with strict schema
- MongoDB-backed reusable question pool
- Redis-backed recency tracking and anti-duplication
- Uniqueness constraints:
  - max overlap <= 2 questions with prior candidate sets
  - Jaccard similarity <= 0.20 with any recent set
- Difficulty balance per candidate:
  - 5 medium + 5 hard

## API

- `POST /mcq/parse-job`
- `POST /mcq/generate`
- `POST /mcq/generate-batch`

### Generate Request

```json
{
  "job_id": "backend-python-001",
  "job_description": "We are hiring a Python backend engineer with FastAPI, Redis, MongoDB...",
  "candidate_id": "candidate-123",
  "candidate_performance_score": 0.62,
  "company_tier": "startup"
}
```

### Generate Response

```json
{
  "candidate_id": "candidate-123",
  "test_id": "f4d88a4c-9b3f-4d8b-b0f2-a7f2acfe50e4",
  "questions": [
    {
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "A",
      "explanation": "...",
      "difficulty": "medium",
      "topic": "fastapi",
      "hash_id": "..."
    }
  ]
}
```

### Generate Batch Request

```json
{
  "job_id": "backend-python-001",
  "job_description": "We are hiring a Python backend engineer with FastAPI, Redis, MongoDB...",
  "candidate_ids": ["candidate-1", "candidate-2", "candidate-3"],
  "candidate_performance_score": 0.62,
  "company_tier": "startup"
}
```

## Run

Install dependencies, then:

```bash
uvicorn mcq_engine.api.main:app --host 0.0.0.0 --port 8001 --reload
```

## Docker Run

From `ai-backend/`:

```bash
docker compose -f docker-compose.mcq.yml up --build
```

## Environment Variables

- `MCQ_MONGO_URI`
- `MCQ_DB_NAME`
- `MCQ_REDIS_URL`
- `MCQ_USE_IN_MEMORY` (set `1` to run without Mongo/Redis for local demos)

### LLM (OpenAI-compatible)

The engine uses the **OpenAI Python SDK** against any **OpenAI-compatible** HTTP API.

- **`MCQ_LLM_API_KEY`** or **`OPENAI_API_KEY`** — API key (required).
- **`MCQ_LLM_BASE_URL`** or **`OPENAI_BASE_URL`** — optional. Default is OpenAI. For **Groq (free tier)**: `https://api.groq.com/openai/v1`
- **`MCQ_LLM_MODEL`** or **`OPENAI_MODEL`** — model id. OpenAI default: `gpt-4o-mini`. Groq examples: `llama-3.1-8b-instant`, `llama-3.3-70b-versatile`

Example (Groq): set `MCQ_LLM_BASE_URL=https://api.groq.com/openai/v1`, `MCQ_LLM_MODEL=llama-3.1-8b-instant`, and `MCQ_LLM_API_KEY` from [Groq Console](https://console.groq.com/).

If generation fails with “0 valid questions”, lower batch size and/or raise output cap: `MCQ_LLM_BATCH_SIZE=8`, `MCQ_LLM_MAX_TOKENS=16384`, or use a larger Groq model (e.g. `llama-3.3-70b-versatile`).

If you see **429** or **413 `rate_limit_exceeded`** (Groq uses both), the engine retries with backoff. Defaults favor free tier: `MCQ_LLM_BATCH_SIZE=8`, `MCQ_LLM_SLEEP_BETWEEN_BATCHES=2`, `MCQ_LLM_MAX_TOKENS=8192`. Tighten further with `MCQ_LLM_BATCH_SIZE=6` and `MCQ_LLM_SLEEP_BETWEEN_BATCHES=3` if needed.

- `MCQ_POOL_THRESHOLD`
- `MCQ_LLM_BATCH_SIZE`
- `MCQ_OVERLAP_LIMIT`
- `MCQ_JACCARD_THRESHOLD`
- `MCQ_RANDOMIZATION_ATTEMPTS`

## Test

```bash
pytest mcq_engine/tests -q
```

