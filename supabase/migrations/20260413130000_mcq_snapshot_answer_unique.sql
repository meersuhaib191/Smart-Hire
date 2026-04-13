-- Ensure one answer row per snapshot question per attempt (Postgres UNIQUE allows multiple NULL question_ids)
create unique index if not exists mcq_attempt_answers_attempt_snapshot_key_uniq
  on public.mcq_attempt_answers (attempt_id, snapshot_question_key)
  where snapshot_question_key is not null;
