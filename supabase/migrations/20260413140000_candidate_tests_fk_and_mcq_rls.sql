-- Link candidate_tests.candidate_id to public.users when every row is valid.
-- Lock down question bank + snapshots for direct anon/authenticated PostgREST access (service_role bypasses RLS).
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'candidate_tests'
  ) then
    if not exists (
      select 1
      from public.candidate_tests ct
      left join public.users u on u.id = ct.candidate_id
      where u.id is null
    ) then
      alter table public.candidate_tests
        drop constraint if exists candidate_tests_candidate_id_fkey;
      alter table public.candidate_tests
        add constraint candidate_tests_candidate_id_fkey
        foreign key (candidate_id) references public.users (id) on delete cascade;
    end if;
  end if;
end $$;

alter table public.questions enable row level security;
alter table public.candidate_tests enable row level security;
