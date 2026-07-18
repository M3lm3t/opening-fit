alter table public.report_history
  add column if not exists report_schema_version integer not null default 1,
  add column if not exists analysis_id text,
  add column if not exists analysis_fingerprint text,
  add column if not exists snapshot jsonb not null default '{}'::jsonb,
  add column if not exists generated_at timestamptz,
  add column if not exists source_platform text,
  add column if not exists source_username text;

create unique index if not exists report_history_user_analysis_id
on public.report_history(user_id, analysis_id)
where analysis_id is not null;

create unique index if not exists report_history_user_analysis_fingerprint
on public.report_history(user_id, analysis_fingerprint)
where analysis_fingerprint is not null;

create index if not exists report_history_user_generated_idx
on public.report_history(user_id, generated_at desc);

comment on column public.report_history.snapshot is
  'Normalized, versioned comparison snapshot. The original report and summary remain unchanged for backward compatibility.';
