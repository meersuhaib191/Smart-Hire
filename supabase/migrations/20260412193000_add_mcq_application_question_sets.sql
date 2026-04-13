create table if not exists public.mcq_question_sets (
  id uuid default gen_random_uuid() primary key,
  application_id uuid references public.applications(id) on delete cascade not null unique,
  question_ids uuid[] not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_mcq_question_sets_application_id
  on public.mcq_question_sets(application_id);

