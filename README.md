# Smart Hire AI: End-to-End AI Recruitment Platform 

## Abstract

Smart Hire AI is a production-oriented hiring platform that combines a web application, an ATS/NLP backend, and automated deadline-based orchestration for candidate progression. The system evaluates applicants across ATS semantic matching, MCQ, coding, and interview stages, then computes weighted outcomes for HR decision-making.  
This document is written as a research-style implementation report covering architecture, evolution, experiments, replacements, and practical differentiators versus conventional hiring systems.

## 1. Problem Statement

Traditional hiring tools often suffer from: 

- weak resume parsing (noisy extraction, inconsistent skills),
- static/manual shortlisting workflows,
- disconnected assessments (ATS, tests, interviews as separate products),
- low explainability of candidate ranking,
- poor deadline automation and weak operational observability.

Smart Hire AI was built to provide one coherent pipeline where shortlisting is deadline-triggered, data-backed, explainable, and integrated with downstream assessment rounds.

## 2. Research Objectives

1. Build a robust ATS scoring core with realistic ranking behavior.
2. Normalize resume and JD parsing with strict, section-aware extraction.
3. Automate shortlisting after submission deadlines.
4. Progress top candidates to advanced MCQ/coding/interview rounds.
5. Provide HR-facing observability and operational controls.
6. Keep deployment practical on Vercel + Render + Supabase.

## 3. System Architecture

### 3.1 Application Stack

- Frontend + APIs: `Next.js` (App Router, TypeScript)
- Database: `Supabase/PostgreSQL`
- ATS Engine Backend: `FastAPI` in `ai-backend/ats_engine`
- Hosting:
  - Frontend: Vercel
  - ATS backend: Render
  - DB + auth/storage: Supabase
- Scheduling:
  - GitHub Actions cron -> internal sweep endpoint

### 3.2 Core Modules

- ATS parsing/scoring/ranking engine: `ai-backend/ats_engine/*`
- ATS integration service: `src/server/ats/screening.ts`
- Deadline shortlist orchestrator: `src/server/pipeline/shortlist.ts`
- Sweep API: `src/app/api/internal/shortlist/sweep/route.ts`
- HR operations APIs: `src/app/api/hr/jobs/*`
- HR dashboards: `src/app/dashboard/hr/*`

## 4. Methodology and Evolution

### 4.1 ATS Parsing and Scoring Evolution

We iterated from broad parsing to strict extraction rules:

- resume parser moved to section-aware extraction (skills/projects/education/experience),
- JD parser now handles required/preferred/generic prose sections robustly,
- skill matching moved to strict normalized intersection logic,
- fallback inflation logic was removed (no synthetic overlap boosts),
- experience logic calibrated for realistic low-experience handling,
- project-context implicit skill inference added using controlled mappings.

### 4.2 Shortlist Automation Evolution

We introduced deadline-native orchestration:

- per-job `submission_deadline_at`,
- shortlist state machine (`pending`, `running`, `completed`, `failed`),
- ATS scoring batch before shortlist selection,
- top-20% selection with min/max constraints,
- applicant notifications (selected + rejected),
- MCQ round control + advanced question seeding.

Then improved reliability:

- sweep now includes jobs with `shortlist_status = null`,
- scheduler cadence improved to every 5 minutes,
- idempotent re-runs and explicit status/error columns.

### 4.3 HR Workflow Evolution

Initial UI had mixed responsibilities and duplicated routing behavior.  
Current flow separates concerns:

- Jobs page = posting + management + status context,
- Candidates page = ranked candidate list by job,
- Pipeline page = stage board and movement view,
- Analytics page = hiring metrics and automation state.

Manual "Smart Actions" were removed to align with fully automated deadline orchestration.

## 5. What Was Replaced and Why

### 5.1 Deprecated Module Replacement

- Removed legacy `ai-backend/resume_screening`
- Replaced by modular `ai-backend/ats_engine`

Why:

- better modularity,
- stricter extraction/matching,
- clearer API boundaries,
- more testable and maintainable architecture.

### 5.2 Scoring Logic Replacements

Replaced:

- fuzzy/fallback-heavy skill overlap logic,
- permissive ranking assumptions.

With:

- strict normalized set matching,
- calibrated weighted scoring,
- deterministic shortlist ranking + tie-break behavior.

## 6. Experimental Iterations and Lessons

### 6.1 Parsing Experiments

Tried:

- broad regex-based capture,
- loose project/education extraction.

Observed:

- noisy project titles and weak educational normalization.

Final:

- stricter normalization heuristics and section guards.

### 6.2 JD Skill Extraction Experiments

Tried:

- simple required-skills detection.

Observed:

- required skills dropped in prose-heavy JDs.

Final:

- section bucketing + promotion rules to ensure required skill coverage.

### 6.3 Deployment Experiments

Tried:

- direct Vercel cron scheduling.

Observed:

- hobby-plan cron frequency constraints.

Final:

- GitHub Actions cron hitting secured internal sweep endpoint.

## 7. Differentiators vs Typical Systems

1. **Deadline-first automation**  
   ATS scoring + ranking + shortlist are orchestrated by deadline state, not manual HR triggers.

2. **Strict ATS integrity**  
   Parsing and skill matching avoid hidden score inflation heuristics.

3. **Explainable multi-stage progression**  
   ATS results feed directly into staged controls and applicant notifications.

4. **Operational rollback support**  
   HR can edit job config and rollback ATS/shortlist so new deadlines/rules re-apply cleanly.

5. **Integrated full funnel**  
   ATS -> MCQ -> Coding -> Interview lives in one pipeline with shared data lineage.

## 8. Current Operational Flow (Production)

1. HR publishes a job with `submission_deadline_at`.
2. Applicants submit resumes before deadline.
3. Scheduler sweeps due jobs every 5 minutes.
4. For each due job:
   - ATS batch scoring runs,
   - candidates are ranked,
   - top 20% (bounded by min/max) are shortlisted,
   - selected candidates receive MCQ round controls + notifications,
   - rejected candidates receive outcome notifications.

## 9. HR Controls and Safety

- Edit posted jobs (deadline, description, skills, weights, status)
- Rollback ATS/shortlist state to re-run against updated constraints
- Separate jobs/candidates/pipeline/analytics views for role clarity

## 10. Deployment Documentation

### 10.1 Frontend (Vercel)

- Production URL: `https://smart-hire-pearl.vercel.app`
- Internal sweep endpoint:
  - `/api/internal/shortlist/sweep`
- Required server env (minimum shortlist-related):
  - `SHORTLIST_CRON_SECRET`
  - optional: `SHORTLIST_MAX`, `SHORTLIST_MIN`, `SHORTLIST_MCQ_WINDOW_HOURS`, `ATS_ENGINE_BASE_URL`

### 10.2 Scheduler (GitHub Actions)

- Workflow: `.github/workflows/shortlist-sweep.yml`
- Cron: `*/5 * * * *`
- Required GitHub secrets:
  - `SHORTLIST_SWEEP_URL`
  - `SHORTLIST_CRON_SECRET`

### 10.3 ATS Backend (Render)

- Service root: `ai-backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn ats_engine.api.main:app --host 0.0.0.0 --port $PORT`
- Health endpoint: `/health`

## 11. Local Development

### 11.1 Next.js app

```bash
npm install
npm run dev -- --webpack
```

### 11.2 ATS backend

```bash
cd ai-backend
pip install -r requirements.txt
uvicorn ats_engine.api.main:app --host 0.0.0.0 --port 8020 --reload
```

## 12. Limitations and Future Work

- Improve ATS backend cold-start and dependency footprint further.
- Add richer analytics (conversion, time-to-stage, cohort trends).
- Add transactional rollback/audit snapshots for high-volume operations.
- Add admin UI for scheduler run telemetry and failure triage.

## 13. Reproducibility and Traceability

- Source of truth branch: `main`
- Migrations: `supabase/migrations/*`
- ATS engine: `ai-backend/ats_engine/*`
- Pipeline automation: `src/server/pipeline/shortlist.ts`

---

For implementation-level ATS internals, see `ai-backend/ats_engine/README.md`.
