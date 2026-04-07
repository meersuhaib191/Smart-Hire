create table if not exists public.coding_challenges (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.jobs(id) on delete cascade not null,
  title varchar(255) not null,
  description text not null,
  starter_code text,
  language varchar(20) not null default 'javascript',
  difficulty varchar(20) default 'medium',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_coding_challenges_job_id on public.coding_challenges(job_id);

create table if not exists public.coding_test_cases (
  id uuid default gen_random_uuid() primary key,
  challenge_id uuid references public.coding_challenges(id) on delete cascade not null,
  input text not null,
  expected_output text not null,
  is_hidden boolean not null default true
);

create index if not exists idx_coding_test_cases_challenge_id on public.coding_test_cases(challenge_id);

create table if not exists public.coding_submissions (
  id uuid default gen_random_uuid() primary key,
  application_id uuid references public.applications(id) on delete cascade not null,
  challenge_id uuid references public.coding_challenges(id) on delete cascade not null,
  language varchar(20) not null,
  source_code text not null,
  score decimal(5,2) not null default 0,
  passed_count int not null default 0,
  total_count int not null default 0,
  execution_log jsonb,
  submitted_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_coding_submissions_application_id on public.coding_submissions(application_id);
