alter table public.jobs
  add column if not exists submission_deadline_at timestamp with time zone,
  add column if not exists shortlist_status varchar(20) not null default 'pending',
  add column if not exists shortlist_ran_at timestamp with time zone,
  add column if not exists shortlist_error text,
  add column if not exists shortlist_selected_count int not null default 0,
  add column if not exists shortlist_total_submissions int not null default 0;

create index if not exists idx_jobs_submission_deadline
  on public.jobs(submission_deadline_at);

create index if not exists idx_jobs_shortlist_status
  on public.jobs(shortlist_status);

alter table public.jobs
  add constraint jobs_shortlist_status_check
  check (shortlist_status in ('pending', 'running', 'completed', 'failed'));
