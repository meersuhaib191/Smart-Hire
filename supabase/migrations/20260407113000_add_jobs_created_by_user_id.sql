alter table public.jobs
add column if not exists created_by_user_id uuid references public.users(id) on delete set null;

create index if not exists idx_jobs_created_by_user_id on public.jobs(created_by_user_id);
