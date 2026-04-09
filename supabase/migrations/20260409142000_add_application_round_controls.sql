create table if not exists public.application_round_controls (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.applications(id) on delete cascade not null,
  stage_type varchar(20) not null,
  deadline_at timestamp with time zone,
  directives text,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint application_round_controls_stage_check check (upper(stage_type) in ('MCQ', 'CODING', 'INTERVIEW'))
);

create unique index if not exists ux_round_controls_app_stage
  on public.application_round_controls(application_id, upper(stage_type));

create index if not exists idx_round_controls_application
  on public.application_round_controls(application_id, updated_at desc);
