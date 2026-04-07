-- Pipeline step for multi-stage recruitment (ATS → MCQ → CODING → INTERVIEW → COMPLETE)
alter table public.applications
  add column if not exists pipeline_step varchar(32) not null default 'ATS';

alter table public.applications
  drop constraint if exists applications_pipeline_step_check;

alter table public.applications
  add constraint applications_pipeline_step_check
  check (pipeline_step in ('ATS', 'MCQ', 'CODING', 'INTERVIEW', 'COMPLETE'));

create table if not exists public.interview_submissions (
  id uuid default gen_random_uuid() primary key,
  application_id uuid references public.applications(id) on delete cascade not null,
  question text not null,
  answer_text text not null,
  audio_url text,
  clarity decimal(5,2),
  relevance decimal(5,2),
  logic_score decimal(5,2),
  overall_score decimal(5,2) not null,
  feedback text,
  raw_evaluation jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_interview_submissions_application_id on public.interview_submissions(application_id);

create or replace function public.refresh_job_rankings(p_job_id uuid)
returns void
language plpgsql
as $$
begin
  with ranked as (
    select
      application_id,
      row_number() over (order by final_score desc nulls last) as rnk
    from public.rankings
    where job_id = p_job_id
  )
  update public.rankings r
  set rank_position = ranked.rnk,
      updated_at = timezone('utc'::text, now())
  from ranked
  where r.application_id = ranked.application_id
    and r.job_id = p_job_id;
end;
$$;
