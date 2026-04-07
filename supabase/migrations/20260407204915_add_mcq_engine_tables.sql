create table if not exists public.mcq_questions (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.jobs(id) on delete cascade not null,
  question_text text not null,
  options jsonb not null,
  correct_option int not null check (correct_option between 0 and 3),
  skill_tag varchar(100),
  difficulty varchar(20) default 'medium',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_mcq_questions_job_id on public.mcq_questions(job_id);

create table if not exists public.mcq_attempts (
  id uuid default gen_random_uuid() primary key,
  application_id uuid references public.applications(id) on delete cascade not null unique,
  score decimal(5,2) not null default 0,
  total_questions int not null default 0,
  correct_answers int not null default 0,
  submitted_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_mcq_attempts_application_id on public.mcq_attempts(application_id);

create table if not exists public.mcq_attempt_answers (
  id uuid default gen_random_uuid() primary key,
  attempt_id uuid references public.mcq_attempts(id) on delete cascade not null,
  question_id uuid references public.mcq_questions(id) on delete cascade not null,
  selected_option int not null check (selected_option between 0 and 3),
  is_correct boolean not null,
  unique(attempt_id, question_id)
);

create index if not exists idx_mcq_attempt_answers_attempt_id on public.mcq_attempt_answers(attempt_id);
