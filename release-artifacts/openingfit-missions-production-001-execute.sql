-- PRODUCTION WARNING: target frtjfvhiimgruenqcuon only; migration 001.
-- Required: prior baseline and preceding verification passed; Missions disabled; rollout 0%; notifications disabled.
-- On failure before COMMIT the transaction should roll back. After uncertain connection failure, do not rerun; run read-only inspection first.
BEGIN;
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

alter table public.openingfit_missions enable row level security;
alter table public.openingfit_mission_training_attempts enable row level security;
alter table public.openingfit_mission_encounters enable row level security;
alter table public.openingfit_mission_status_events enable row level security;

create policy openingfit_missions_select_own on public.openingfit_missions
for select to authenticated using (auth.uid() = user_id);
create policy openingfit_mission_attempts_select_own on public.openingfit_mission_training_attempts
for select to authenticated using (auth.uid() = user_id);
create policy openingfit_mission_encounters_select_own on public.openingfit_mission_encounters
for select to authenticated using (auth.uid() = user_id);
create policy openingfit_mission_status_events_select_own on public.openingfit_mission_status_events
for select to authenticated using (auth.uid() = user_id);

revoke all on public.openingfit_missions from public, anon, authenticated;
revoke all on public.openingfit_mission_training_attempts from public, anon, authenticated;
revoke all on public.openingfit_mission_encounters from public, anon, authenticated;
revoke all on public.openingfit_mission_status_events from public, anon, authenticated;
grant select on public.openingfit_missions, public.openingfit_mission_training_attempts, public.openingfit_mission_encounters, public.openingfit_mission_status_events to authenticated;
grant select, insert, update on public.openingfit_missions to service_role;
grant select, insert on public.openingfit_mission_training_attempts, public.openingfit_mission_encounters, public.openingfit_mission_status_events to service_role;

create or replace function public.openingfit_protect_mission_identity()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.user_id is distinct from old.user_id
     or new.candidate_id is distinct from old.candidate_id
     or new.candidate_key is distinct from old.candidate_key
     or new.algorithm_version is distinct from old.algorithm_version
     or new.generation is distinct from old.generation
     or new.mission_type is distinct from old.mission_type
     or new.role is distinct from old.role
     or new.opening_id is distinct from old.opening_id
     or new.exact_position_key is distinct from old.exact_position_key
     or new.position_fen is distinct from old.position_fen
     or new.player_turn is distinct from old.player_turn
     or new.repeated_played_move_uci is distinct from old.repeated_played_move_uci
     or new.accepted_correction_moves is distinct from old.accepted_correction_moves
     or new.correction_source is distinct from old.correction_source
     or new.baseline_cutoff_at is distinct from old.baseline_cutoff_at
     or new.recurrence_of_mission_id is distinct from old.recurrence_of_mission_id
     or new.supersedes_mission_id is distinct from old.supersedes_mission_id then
    raise exception 'OpeningFit mission identity is immutable';
  end if;
  if (new.status is distinct from old.status
      or new.is_primary is distinct from old.is_primary
      or new.assigned_at is distinct from old.assigned_at
      or new.learning_started_at is distinct from old.learning_started_at
      or new.training_completed_at is distinct from old.training_completed_at
      or new.awaiting_evidence_at is distinct from old.awaiting_evidence_at
      or new.repaired_at is distinct from old.repaired_at
      or new.dismissed_at is distinct from old.dismissed_at
      or new.dismissed_reason is distinct from old.dismissed_reason
      or new.superseded_at is distinct from old.superseded_at)
     and coalesce(current_setting('openingfit.mission_transition', true), '') <> 'allowed' then
    raise exception 'OpeningFit mission lifecycle must use the protected transition function';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger openingfit_protect_mission_identity
before update on public.openingfit_missions
for each row execute function public.openingfit_protect_mission_identity();

create or replace function public.transition_openingfit_mission(
  p_user_id uuid, p_mission_id uuid, p_to_status text, p_cause_type text, p_cause_id text,
  p_idempotency_key text, p_evidence_summary jsonb default '{}'::jsonb
) returns public.openingfit_missions language plpgsql security definer set search_path = public as $$
declare current_mission public.openingfit_missions; prior_status text; prior_event public.openingfit_mission_status_events;
begin
  if auth.role() <> 'service_role' and current_user <> 'postgres' then raise exception 'Service authority required'; end if;
  if nullif(btrim(p_idempotency_key), '') is null or length(p_idempotency_key) > 200 then raise exception 'A valid idempotency key is required'; end if;
  select * into prior_event from public.openingfit_mission_status_events where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if prior_event.id is not null then
    if prior_event.mission_id <> p_mission_id or prior_event.to_status <> p_to_status then raise exception 'Idempotency key conflict'; end if;
    select * into current_mission from public.openingfit_missions where id = p_mission_id and user_id = p_user_id;
    return current_mission;
  end if;
  select * into current_mission from public.openingfit_missions where id = p_mission_id and user_id = p_user_id for update;
  if current_mission.id is null then raise exception 'Mission not found'; end if;
  prior_status := current_mission.status;
  if not case prior_status
    when 'candidate' then p_to_status in ('assigned','dismissed','superseded')
    when 'assigned' then p_to_status in ('learning','dismissed','superseded')
    when 'learning' then p_to_status in ('awaiting_evidence','dismissed','superseded')
    when 'awaiting_evidence' then p_to_status in ('improving','needs_review','repaired','dismissed','superseded')
    when 'improving' then p_to_status in ('repaired','needs_review','dismissed','superseded')
    when 'needs_review' then p_to_status in ('learning','dismissed','superseded')
    when 'repaired' then p_to_status = 'superseded'
    else false end then raise exception 'Illegal mission transition'; end if;
  perform set_config('openingfit.mission_transition', 'allowed', true);
  update public.openingfit_missions set status = p_to_status,
    is_primary = p_to_status in ('assigned','learning','awaiting_evidence','improving','needs_review'),
    assigned_at = case when p_to_status='assigned' then coalesce(assigned_at,now()) else assigned_at end,
    learning_started_at = case when p_to_status='learning' then now() else learning_started_at end,
    training_completed_at = case when prior_status='learning' and p_to_status='awaiting_evidence' then now() else training_completed_at end,
    awaiting_evidence_at = case when p_to_status='awaiting_evidence' then coalesce(awaiting_evidence_at,now()) else awaiting_evidence_at end,
    repaired_at = case when p_to_status='repaired' then now() else repaired_at end,
    dismissed_at = case when p_to_status='dismissed' then now() else dismissed_at end,
    superseded_at = case when p_to_status='superseded' then now() else superseded_at end
  where id=p_mission_id returning * into current_mission;
  insert into public.openingfit_mission_status_events(user_id,mission_id,from_status,to_status,cause_type,cause_id,idempotency_key,evidence_summary)
  values(p_user_id,p_mission_id,prior_status,p_to_status,btrim(p_cause_type),p_cause_id,p_idempotency_key,coalesce(p_evidence_summary,'{}'::jsonb));
  return current_mission;
end $$;

create or replace function public.dismiss_openingfit_mission(
  p_mission_id uuid, p_reason text, p_idempotency_key text
) returns public.openingfit_missions language plpgsql security definer set search_path = public as $$
declare owner_id uuid := auth.uid(); saved public.openingfit_missions;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if p_reason not in ('not_relevant','wrong_opening','prefer_another','other') then raise exception 'Unsupported dismissal reason'; end if;
  saved := public.transition_openingfit_mission(owner_id,p_mission_id,'dismissed','user_dismissed',p_reason,p_idempotency_key,jsonb_build_object('reason',p_reason));
  update public.openingfit_missions set dismissed_reason=p_reason where id=saved.id and user_id=owner_id returning * into saved;
  return saved;
end $$;

revoke all on function public.transition_openingfit_mission(uuid,uuid,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.transition_openingfit_mission(uuid,uuid,text,text,text,text,jsonb) to service_role;
revoke all on function public.dismiss_openingfit_mission(uuid,text,text) from public, anon;
grant execute on function public.dismiss_openingfit_mission(uuid,text,text) to authenticated, service_role;

comment on table public.openingfit_missions is 'Server-authoritative OpeningFit Mission aggregates. Legacy coaching_priorities are intentionally separate.';
comment on table public.openingfit_mission_status_events is 'Append-only lifecycle audit written transactionally by protected functions; ordinary clients have SELECT only.';
comment on column public.openingfit_mission_encounters.qualifies_for_verification is 'Server-derived cutoff decision; old encounters may be retained for idempotency but cannot advance lifecycle.';
comment on column public.openingfit_missions.baseline_evidence_game_ids is 'Bounded stable game identifiers only; raw PGNs and opponent identities are not stored.';

-- Rollback (manual, not executed): revoke functions/grants, drop the two functions,
-- then drop status_events, encounters, attempts and missions in dependency order.

DO $assert$ begin if to_regclass('public.openingfit_missions') is null or to_regclass('public.openingfit_mission_training_attempts') is null or to_regclass('public.openingfit_mission_encounters') is null or to_regclass('public.openingfit_mission_status_events') is null or to_regprocedure('public.transition_openingfit_mission(uuid,uuid,text,text,text,text,jsonb)') is null or (select count(*) from pg_class where oid=any(array[to_regclass('public.openingfit_missions'),to_regclass('public.openingfit_mission_training_attempts'),to_regclass('public.openingfit_mission_encounters'),to_regclass('public.openingfit_mission_status_events')]) and relrowsecurity)<>4 then raise exception '001 postcondition failed'; end if; end $assert$;
COMMIT;
