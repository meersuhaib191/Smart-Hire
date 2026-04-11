-- Computes cosine similarity for ATS scoring using pgvector.
-- Returns value in [0, 1], where 1 is best match.
create extension if not exists vector with schema extensions;

create or replace function public.compute_ats_similarity(
  resume_embedding extensions.vector,
  job_embedding extensions.vector
)
returns double precision
language sql
immutable
as $$
  select greatest(0::double precision, 1 - (resume_embedding OPERATOR(extensions.<=>) job_embedding));
$$;
