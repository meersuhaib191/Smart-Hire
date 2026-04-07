-- Computes cosine similarity for ATS scoring using pgvector.
-- Returns value in [0, 1], where 1 is best match.
create or replace function public.compute_ats_similarity(
  resume_embedding vector,
  job_embedding vector
)
returns double precision
language sql
immutable
as $$
  select greatest(0::double precision, 1 - (resume_embedding <=> job_embedding));
$$;
