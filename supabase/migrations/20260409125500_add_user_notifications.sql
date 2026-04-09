create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  application_id uuid references public.applications(id) on delete cascade,
  title varchar(200) not null,
  message text not null,
  route text,
  type varchar(50) not null default 'info',
  is_read boolean not null default false,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists idx_user_notifications_user_created
  on public.user_notifications(user_id, created_at desc);

create index if not exists idx_user_notifications_user_unread
  on public.user_notifications(user_id, is_read, created_at desc);
