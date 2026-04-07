alter table public.users
  add column if not exists is_profile_complete boolean not null default false;

alter table public.users
  add column if not exists profile jsonb not null default '{}'::jsonb;
