-- Dynamic MCQ: global question bank + per-application snapshot tests

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  options jsonb not null,
  answer text not null,
  difficulty text not null check (difficulty in ('basic', 'intermediate', 'advanced')),
  tags text[] not null default '{}',
  type text not null default 'mcq' check (type = 'mcq'),
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_questions_difficulty on public.questions(difficulty);
create index if not exists idx_tags on public.questions using gin(tags);

create table if not exists public.candidate_tests (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  candidate_id uuid not null,
  job_id uuid not null references public.jobs(id) on delete cascade,
  questions jsonb not null default '[]'::jsonb,
  score int not null default 0,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (application_id)
);

create index if not exists idx_candidate_tests_job_id on public.candidate_tests(job_id);
create index if not exists idx_candidate_tests_candidate_id on public.candidate_tests(candidate_id);

-- Allow per-snapshot answers without legacy mcq_questions row
alter table public.mcq_attempt_answers alter column question_id drop not null;
alter table public.mcq_attempt_answers add column if not exists snapshot_question_key text;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'mcq_attempt_answers_question_id_fkey'
  ) then
    alter table public.mcq_attempt_answers drop constraint mcq_attempt_answers_question_id_fkey;
  end if;
end $$;

-- Seed bank (aptitude + general CS + common tags). Expand in production as needed.
insert into public.questions (question, options, answer, difficulty, tags)
select v.question, v.options, v.answer, v.difficulty, v.tags from (values
  ('What is the time complexity of binary search on a sorted array?', '["O(n)","O(log n)","O(n log n)","O(1)"]'::jsonb, 'O(log n)', 'basic', array['algorithms','complexity']),
  ('Which HTTP method is idempotent by convention?', '["POST","PATCH","PUT","GET"]'::jsonb, 'GET', 'basic', array['web','http']),
  ('What does ACID stand for in databases?', '["Atomicity, Consistency, Isolation, Durability","Append, Cache, Index, Delete","Auth, Control, Integrity, Data","None"]'::jsonb, 'Atomicity, Consistency, Isolation, Durability', 'basic', array['sql','databases']),
  ('In Git, what does `git merge` do?', '["Deletes a branch","Combines branch histories","Rebases commits","Stashes changes"]'::jsonb, 'Combines branch histories', 'basic', array['git','tools']),
  ('What is a closure in JavaScript?', '["A loop","A function with access to outer lexical scope","A class","A promise"]'::jsonb, 'A function with access to outer lexical scope', 'basic', array['javascript']),
  ('Which data structure is FIFO?', '["Stack","Queue","Heap","Tree"]'::jsonb, 'Queue', 'basic', array['algorithms','data-structures']),
  ('What is the purpose of an index in SQL?', '["Encrypt data","Speed up reads","Delete rows","Backup"]'::jsonb, 'Speed up reads', 'basic', array['sql']),
  ('What is REST?', '["A database","An architectural style for HTTP APIs","A JS framework","A testing tool"]'::jsonb, 'An architectural style for HTTP APIs', 'basic', array['web','apis']),
  ('What is polymorphism in OOP?', '["One interface many implementations","Hiding data","Multiple inheritance only","Compilation"]'::jsonb, 'One interface many implementations', 'basic', array['oop']),
  ('What does DNS resolve?', '["Ports","Hostnames to IP addresses","SSL keys","JWT tokens"]'::jsonb, 'Hostnames to IP addresses', 'basic', array['networking']),
  ('A process blocks waiting for I/O. What scheduling might help?', '["FCFS only","Priority inversion","I/O-bound awareness / async","Round-robin only"]'::jsonb, 'I/O-bound awareness / async', 'intermediate', array['os','systems']),
  ('What is a race condition?', '["Slow CPU","Two concurrent accesses without synchronization","Memory leak","Deadlock"]'::jsonb, 'Two concurrent accesses without synchronization', 'intermediate', array['concurrency']),
  ('In SQL, what is a LEFT JOIN?', '["Only matching rows","All rows from left + matches from right","Cartesian product","Union"]'::jsonb, 'All rows from left + matches from right', 'intermediate', array['sql']),
  ('What is eventual consistency?', '["Strong consistency","Guarantee that reads converge over time","ACID only","No replication"]'::jsonb, 'Guarantee that reads converge over time', 'intermediate', array['databases','distributed']),
  ('What is the CAP theorem about?', '["CPU caches","Consistency, Availability, Partition tolerance trade-offs","Cloud pricing","Containers"]'::jsonb, 'Consistency, Availability, Partition tolerance trade-offs', 'intermediate', array['distributed']),
  ('What is idempotency in APIs?', '["Calls are fast","Repeated calls have same effect as one","Calls are encrypted","Calls are batched"]'::jsonb, 'Repeated calls have same effect as one', 'intermediate', array['apis','web']),
  ('What is a JWT typically used for?', '["File storage","Stateless auth claims","SQL indexing","DNS"]'::jsonb, 'Stateless auth claims', 'intermediate', array['security','web']),
  ('In React, what is `useEffect` primarily for?', '["Styling","Side effects after render","Routing","State shape"]'::jsonb, 'Side effects after render', 'intermediate', array['react','frontend']),
  ('What is connection pooling?', '["Caching DNS","Reusing DB connections","HTTP/2 push","Load balancer SSL"]'::jsonb, 'Reusing DB connections', 'intermediate', array['databases','backend']),
  ('What is a deadlock?', '["Infinite loop","Circular wait for locks","Buffer overflow","OOM"]'::jsonb, 'Circular wait for locks', 'intermediate', array['concurrency']),
  ('What does `async/await` help express?', '["Synchronous code only","Asynchronous control flow","CSS layout","SQL joins"]'::jsonb, 'Asynchronous control flow', 'intermediate', array['javascript','async']),
  ('What is normalization in databases?', '["Encrypting tables","Reducing redundancy via relations","Adding indexes only","Sharding"]'::jsonb, 'Reducing redundancy via relations', 'intermediate', array['sql']),
  ('What is a reverse proxy?', '["Client-only","Server in front of backends","Database replica","CDN only"]'::jsonb, 'Server in front of backends', 'intermediate', array['devops','networking']),
  ('What is memoization?', '["Deleting cache","Caching function results","Garbage collection","Minification"]'::jsonb, 'Caching function results', 'intermediate', array['algorithms']),
  ('What is the difference between `let` and `var` in JS (classic)?', '["No difference","let is block-scoped, var is function-scoped","var is async","let is SQL only"]'::jsonb, 'let is block-scoped, var is function-scoped', 'intermediate', array['javascript']),
  ('What is horizontal scaling?', '["Bigger machine","More machines","Faster disk","Strong consistency only"]'::jsonb, 'More machines', 'intermediate', array['systems','cloud']),
  ('Explain a memory leak in web apps.', '["Too many tabs","Retained references preventing GC","Slow CPU","HTTPS"]'::jsonb, 'Retained references preventing GC', 'advanced', array['frontend','debugging']),
  ('How does two-phase commit help distributed transactions?', '["It removes locks","Coordinates prepare/commit across nodes","It speeds up reads","It replaces SQL"]'::jsonb, 'Coordinates prepare/commit across nodes', 'advanced', array['distributed','databases']),
  ('What is backpressure in stream processing?', '["CPU throttling","Signaling producers to slow when consumers lag","Encryption","DNS caching"]'::jsonb, 'Signaling producers to slow when consumers lag', 'advanced', array['systems','streaming']),
  ('Compare optimistic vs pessimistic locking.', '["Same thing","Optimistic assumes few conflicts; pessimistic locks early","Only SQL","Only NoSQL"]'::jsonb, 'Optimistic assumes few conflicts; pessimistic locks early', 'advanced', array['databases','concurrency']),
  ('What is tail latency and why does it matter in SRE?', '["Average only","Slow requests at high percentiles impact UX/SLOs","CPU brand","Log size"]'::jsonb, 'Slow requests at high percentiles impact UX/SLOs', 'advanced', array['sre','performance']),
  ('How would you mitigate a thundering herd on cache expiry?', '["Disable cache","Jittered TTL / single-flight / stale-while-revalidate","Use HTTP only","Drop DB indexes"]'::jsonb, 'Jittered TTL / single-flight / stale-while-revalidate', 'advanced', array['caching','backend']),
  ('What is the difference between authentication and authorization?', '["Same","Who you are vs what you can do","Encryption vs hashing","REST vs RPC"]'::jsonb, 'Who you are vs what you can do', 'basic', array['security']),
  ('If a log shows p99 latency spike after deploy, what is a good first step?', '["Ignore","Compare traces/metrics to pre-deploy; check rollout","Restart everything","Delete logs"]'::jsonb, 'Compare traces/metrics to pre-deploy; check rollout', 'advanced', array['debugging','sre']),
  ('Aptitude: If 20% of a number is 40, what is the number?', '["100","200","400","800"]'::jsonb, '200', 'basic', array['aptitude','math']),
  ('Aptitude: A train 120m long crosses a pole in 8s at constant speed. Speed in m/s?', '["10","15","12","20"]'::jsonb, '15', 'intermediate', array['aptitude','math']),
  ('Aptitude: If all Bloops are Razzies and all Razzies are Lazzies, are all Bloops Lazzies?', '["No","Yes","Cannot tell","Only some"]'::jsonb, 'Yes', 'basic', array['aptitude','logic']),
  ('General CS: What is Big-O mainly used to describe?', '["Exact runtime in ms","Growth of work vs input size","Memory in bytes","CPU model"]'::jsonb, 'Growth of work vs input size', 'basic', array['general_cs','complexity']),
  ('General CS: What is virtualization?', '["Only containers","Abstracting hardware via hypervisor/VMs","Only K8s","Only cloud billing"]'::jsonb, 'Abstracting hardware via hypervisor/VMs', 'intermediate', array['general_cs','systems'])
) as v(question, options, answer, difficulty, tags)
where not exists (select 1 from public.questions limit 1);

-- Tag normalization helper: ensure lowercase tags on insert (optional trigger skipped for brevity)
