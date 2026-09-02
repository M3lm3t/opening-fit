-- PRODUCTION WARNING: target frtjfvhiimgruenqcuon only; split stage 001A.
-- Required prior-stage verification must pass. Missions disabled; rollout 0%; notifications disabled.
-- Do not rerun after an uncertain failure; inspect this stage read-only first.
BEGIN;
DO $precondition$ begin perform 1; end $precondition$;
-- SOURCE MIGRATION 001 STAGE BEGIN
-- OpeningFit Missions Phase 2: additive persistence and protected lifecycle.
-- Existing coaching_priorities retain their legacy semantics and data unchanged.

create table public.openingfit_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_id text not null,
  candidate_key text not null,
  algorithm_version text not null,
  generation integer not null default 1 check (generation > 0),
  mission_type text not null check (mission_type in ('concrete_move_repair', 'repertoire_deviation')),
  status text not null default 'candidate' check (status in ('candidate', 'assigned', 'learning', 'awaiting_evidence', 'improving', 'repaired', 'needs_review', 'dismissed', 'superseded')),
  is_primary boolean not null default false,
  role text not null,
  opening_id text not null,
  opening_name text,
  exact_position_key text not null check (array_length(regexp_split_to_array(btrim(exact_position_key), E'\\s+'), 1) = 4),
  position_fen text not null,
  player_turn text not null check (player_turn in ('white', 'black')),
  repeated_played_move_uci text not null,
  repeated_played_move_san text,
  accepted_correction_moves jsonb not null check (jsonb_typeof(accepted_correction_moves) = 'array' and jsonb_array_length(accepted_correction_moves) > 0),
  correction_source text not null,
  correction_provenance jsonb not null default '[]'::jsonb check (jsonb_typeof(correction_provenance) = 'array'),
  candidate_score numeric(5,2) not null check (candidate_score between 0 and 100),
  score_components jsonb not null default '{}'::jsonb check (jsonb_typeof(score_components) = 'object'),
  confidence jsonb not null default '{}'::jsonb check (jsonb_typeof(confidence) = 'object'),
  confidence_reason_codes jsonb not null default '[]'::jsonb check (jsonb_typeof(confidence_reason_codes) = 'array'),
  conflicts jsonb not null default '[]'::jsonb check (jsonb_typeof(conflicts) = 'array'),
  evidence_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence_summary) = 'object'),
  baseline_evidence_game_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(baseline_evidence_game_ids) = 'array'),
  baseline_evidence_count integer not null check (baseline_evidence_count >= 2),
  first_evidence_at timestamptz,
  last_evidence_at timestamptz,
  baseline_cutoff_at timestamptz not null,
  assigned_at timestamptz,
  learning_started_at timestamptz,
  training_completed_at timestamptz,
  awaiting_evidence_at timestamptz,
  repaired_at timestamptz,
  dismissed_at timestamptz,
  dismissed_reason text,
  superseded_at timestamptz,
  supersedes_mission_id uuid references public.openingfit_missions(id) on delete set null,
  recurrence_of_mission_id uuid references public.openingfit_missions(id) on delete set null,
  source_report_id uuid references public.report_history(id) on delete set null,
  source_decision_id text,
  source_diagnosis_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, candidate_key, algorithm_version, generation),
  check (not is_primary or status in ('assigned', 'learning', 'awaiting_evidence', 'improving', 'needs_review'))
);

create unique index openingfit_missions_one_primary_active_idx
on public.openingfit_missions(user_id)
where is_primary and status in ('assigned', 'learning', 'awaiting_evidence', 'improving', 'needs_review');
create index openingfit_missions_current_lookup_idx on public.openingfit_missions(user_id, status, updated_at desc) where is_primary;
create index openingfit_missions_history_idx on public.openingfit_missions(user_id, created_at desc);
create index openingfit_missions_position_idx on public.openingfit_missions(user_id, exact_position_key, status);
create index openingfit_missions_source_report_idx on public.openingfit_missions(user_id, source_report_id) where source_report_id is not null;

create table public.openingfit_mission_training_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id uuid not null,
  exercise_key text not null,
  session_key text,
  attempt_key text not null check (length(attempt_key) between 1 and 200),
  attempted_move_uci text not null,
  result text not null check (result in ('correct', 'incorrect', 'assisted')),
  assistance_used boolean not null default false,
  review_number integer not null default 1 check (review_number > 0),
  due_at timestamptz,
  interval_days integer not null default 0 check (interval_days >= 0),
  validation_evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(validation_evidence) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (mission_id, user_id) references public.openingfit_missions(id, user_id) on delete cascade,
  unique (user_id, mission_id, attempt_key)
);
create index openingfit_mission_attempts_history_idx on public.openingfit_mission_training_attempts(user_id, mission_id, created_at desc);

create table public.openingfit_mission_encounters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id uuid not null,
  platform text not null,
  account_scope text not null,
  game_id text not null,
  played_at timestamptz not null,
  exact_position_key text not null check (array_length(regexp_split_to_array(btrim(exact_position_key), E'\\s+'), 1) = 4),
  observed_move_uci text not null,
  observed_move_san text,
  classification text not null check (classification in ('correct', 'repeated_mistake', 'other_legal')),
  qualifies_for_verification boolean not null default false,
  source_report_id uuid references public.report_history(id) on delete set null,
  evidence_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence_metadata) = 'object'),
  observed_at timestamptz not null default now(),
  foreign key (mission_id, user_id) references public.openingfit_missions(id, user_id) on delete cascade,
  unique (user_id, mission_id, platform, account_scope, game_id, exact_position_key)
);
create index openingfit_mission_encounters_verification_idx on public.openingfit_mission_encounters(user_id, mission_id, qualifies_for_verification, played_at);

create table public.openingfit_mission_status_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id uuid not null,
  from_status text not null,
  to_status text not null,
  cause_type text not null,
  cause_id text,
  idempotency_key text not null check (length(idempotency_key) between 1 and 200),
  evidence_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence_summary) = 'object' and pg_column_size(evidence_summary) <= 16384),
  created_at timestamptz not null default now(),
  foreign key (mission_id, user_id) references public.openingfit_missions(id, user_id) on delete cascade,
  unique (user_id, idempotency_key)
);
create index openingfit_mission_status_events_history_idx on public.openingfit_mission_status_events(user_id, mission_id, created_at);

-- SOURCE MIGRATION 001 STAGE END
DO $assert$ begin if not (not exists(select 1 from (values ('openingfit_missions','openingfit_missions_one_primary_active_idx',$idx$CREATE UNIQUE INDEX openingfit_missions_one_primary_active_idx ON public.openingfit_missions USING btree (user_id) WHERE (is_primary AND (status = ANY (ARRAY['assigned'::text, 'learning'::text, 'awaiting_evidence'::text, 'improving'::text, 'needs_review'::text])))$idx$), ('openingfit_missions','openingfit_missions_current_lookup_idx',$idx$CREATE INDEX openingfit_missions_current_lookup_idx ON public.openingfit_missions USING btree (user_id, status, updated_at DESC) WHERE is_primary$idx$), ('openingfit_missions','openingfit_missions_history_idx',$idx$CREATE INDEX openingfit_missions_history_idx ON public.openingfit_missions USING btree (user_id, created_at DESC)$idx$), ('openingfit_missions','openingfit_missions_position_idx',$idx$CREATE INDEX openingfit_missions_position_idx ON public.openingfit_missions USING btree (user_id, exact_position_key, status)$idx$), ('openingfit_missions','openingfit_missions_source_report_idx',$idx$CREATE INDEX openingfit_missions_source_report_idx ON public.openingfit_missions USING btree (user_id, source_report_id) WHERE (source_report_id IS NOT NULL)$idx$), ('openingfit_mission_training_attempts','openingfit_mission_attempts_history_idx',$idx$CREATE INDEX openingfit_mission_attempts_history_idx ON public.openingfit_mission_training_attempts USING btree (user_id, mission_id, created_at DESC)$idx$), ('openingfit_mission_encounters','openingfit_mission_encounters_verification_idx',$idx$CREATE INDEX openingfit_mission_encounters_verification_idx ON public.openingfit_mission_encounters USING btree (user_id, mission_id, qualifies_for_verification, played_at)$idx$), ('openingfit_mission_status_events','openingfit_mission_status_events_history_idx',$idx$CREATE INDEX openingfit_mission_status_events_history_idx ON public.openingfit_mission_status_events USING btree (user_id, mission_id, created_at)$idx$)) e(tablename,indexname,indexdef) left join pg_indexes a on a.schemaname='public' and a.indexname=e.indexname where a.tablename is distinct from e.tablename or a.indexdef is distinct from e.indexdef)) then raise exception '001A postcondition failed'; end if; end $assert$;
COMMIT;
