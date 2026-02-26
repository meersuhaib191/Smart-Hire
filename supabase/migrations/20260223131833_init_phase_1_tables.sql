-- Enable pgvector extension for AI embeddings
create extension if not exists vector
with
  schema extensions;

-- Create Enum Types
create type user_role as enum ('APPLICANT', 'HR', 'COMPANY_ADMIN', 'PLATFORM_ADMIN');
create type job_status as enum ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED');
create type application_stage as enum ('APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'REJECTED', 'HIRED');

-- 1. Identity Domain

-- Note: We link to Supabase's built-in auth.users table for authentication. 
-- The public.users table extends it with application-specific data.
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email varchar(255) unique not null,
  role user_role default 'APPLICANT'::user_role not null,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.user_profiles (
  user_id uuid references public.users(id) on delete cascade primary key,
  full_name varchar(255) not null,
  location varchar(255),
  headline text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Company & Job Domain

create table public.companies (
  id uuid default gen_random_uuid() primary key,
  name varchar(255) not null,
  industry varchar(255),
  size varchar(50),
  verified boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
create index idx_companies_name on public.companies(name);

create table public.jobs (
  id uuid default gen_random_uuid() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  title varchar(255) not null,
  description text not null,
  experience_required int not null default 0,
  status job_status default 'DRAFT'::job_status not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
create index idx_jobs_company_id on public.jobs(company_id);
create index idx_jobs_status on public.jobs(status);

create table public.job_skills (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.jobs(id) on delete cascade not null,
  skill_name varchar(100) not null
);
create index idx_job_skills_job_id on public.job_skills(job_id);

create table public.job_weights (
  job_id uuid references public.jobs(id) on delete cascade primary key,
  ats_weight decimal(3,2) not null default 1.00,
  mcq_weight decimal(3,2) not null default 0.00,
  coding_weight decimal(3,2) not null default 0.00,
  interview_weight decimal(3,2) not null default 0.00,
  constraint check_weights_sum check (ats_weight + mcq_weight + coding_weight + interview_weight = 1.00)
);

-- 3. Application Domain

create table public.applications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  job_id uuid references public.jobs(id) on delete cascade not null,
  resume_snapshot_url text,
  current_stage application_stage default 'APPLIED'::application_stage not null,
  applied_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, job_id)
);
create index idx_applications_user_id on public.applications(user_id);
create index idx_applications_job_id on public.applications(job_id);

create type stage_type_enum as enum ('ATS', 'MCQ', 'CODING', 'INTERVIEW');

create table public.stage_results (
  id uuid default gen_random_uuid() primary key,
  application_id uuid references public.applications(id) on delete cascade not null,
  stage_type stage_type_enum not null,
  score decimal(5,3) not null,
  breakdown jsonb,
  passed boolean not null default false,
  evaluated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
create index idx_stage_results_application_id on public.stage_results(application_id);
create index idx_stage_results_stage_type on public.stage_results(stage_type);

-- 4. Ranking Domain

create table public.rankings (
  application_id uuid references public.applications(id) on delete cascade primary key,
  job_id uuid references public.jobs(id) on delete cascade not null,
  final_score decimal(5,3) not null,
  rank_position int,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
create index idx_rankings_job_id on public.rankings(job_id);
create index idx_rankings_combo on public.rankings(job_id, final_score desc);

-- 5. AI Vector Storage

create table public.resume_embeddings (
  application_id uuid references public.applications(id) on delete cascade primary key,
  embedding vector(768) not null
);
create index on public.resume_embeddings using hnsw (embedding vector_cosine_ops);

create table public.job_embeddings (
  job_id uuid references public.jobs(id) on delete cascade primary key,
  embedding vector(768) not null
);
create index on public.job_embeddings using hnsw (embedding vector_cosine_ops);

-- RLS (Row Level Security) Triggers & Policies Setup
-- By default tables are unprotected until RLS is explicitly enabled.
-- Phase 1 logic assumes a secure backend environment or basic public access.
alter table public.users enable row level security;
alter table public.user_profiles enable row level security;
alter table public.companies enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;