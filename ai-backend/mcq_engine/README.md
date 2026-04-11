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
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `MCQ_POOL_THRESHOLD`
- `MCQ_LLM_BATCH_SIZE`
- `MCQ_OVERLAP_LIMIT`
- `MCQ_JACCARD_THRESHOLD`
- `MCQ_RANDOMIZATION_ATTEMPTS`

## Test

```bash
pytest mcq_engine/tests -q
```

