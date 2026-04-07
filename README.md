# Smart Hire AI

Smart Hire AI is a Next.js + Supabase recruitment platform with ATS screening, MCQ, coding, AI interview, and final ranking pipeline.

## Local Development

### 1) Frontend/API (Next.js)

```bash
npm install
npm run dev -- --webpack
```

### 2) AI backend (FastAPI)

```bash
cd ai-backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill all required keys:

- `NEXT_PUBLIC_SUPABASE_PROJECT_ID` (or `NEXT_PUBLIC_SUPABASE_URL`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AI_BACKEND_URL` (public URL of deployed FastAPI service)
- `OPENAI_API_KEY` (recommended)
- `JUDGE0_API_URL` (+ `JUDGE0_API_KEY` if required)

For the AI backend service, set:

- `AI_ALLOWED_ORIGINS` as a comma-separated list of frontend origins

## Production Deployment

### A) Deploy Next.js app (recommended: Vercel)

1. Import this repo in Vercel.
2. Framework preset: `Next.js`.
3. Set environment variables from `.env.example`.
4. Deploy.
5. Note your frontend URL (for AI backend CORS).

### B) Deploy AI backend (recommended: Render or Railway)

Use `ai-backend` as service root.

- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Env var: `AI_ALLOWED_ORIGINS=https://your-frontend-domain`

After deploy, copy AI service URL and set it as:

- `AI_BACKEND_URL=https://your-ai-service-domain`

Then redeploy frontend.

### C) Supabase setup

Apply migrations from `supabase/migrations` in order, then verify tables:

- `stage_results`, `mcq_*`, `coding_*`, `interview_submissions`, `rankings`
- function `compute_ats_similarity`

## Notes

- `main` branch is intended to be the production branch.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to browser/client code.
- If push conflicts happen due remote history, use:

```bash
git push -u origin main --force-with-lease
```
