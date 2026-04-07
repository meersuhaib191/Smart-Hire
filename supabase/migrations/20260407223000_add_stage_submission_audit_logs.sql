create table if not exists public.stage_submission_audit_logs (
  id uuid default gen_random_uuid() primary key,
  application_id uuid references public.applications(id) on delete cascade not null,
  stage_type varchar(32) not null check (stage_type in ('ATS', 'MCQ', 'CODING', 'INTERVIEW')),
  status varchar(20) not null check (status in ('SUCCESS', 'FAILED', 'BLOCKED')),
  actor_user_id uuid references public.users(id) on delete set null,
  ip_address text,
  user_agent text,
  detail jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_stage_submission_audit_logs_application_id
  on public.stage_submission_audit_logs(application_id);

create index if not exists idx_stage_submission_audit_logs_stage_type
  on public.stage_submission_audit_logs(stage_type);

create index if not exists idx_stage_submission_audit_logs_created_at
  on public.stage_submission_audit_logs(created_at desc);
