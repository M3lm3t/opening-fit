-- OpeningFit retention production SQL Editor bundle
-- Target project: frtjfvhiimgruenqcuon (https://frtjfvhiimgruenqcuon.supabase.co)
-- Generated from the five immutable repository migration files listed below.
-- Run the PRECONDITION transaction first. It is read-only and intentionally raises
-- an exception when a required production prerequisite is missing.

begin;
do $preconditions$
declare
  missing text[] := array[]::text[];
begin
  if to_regclass('public.activity_history') is null then missing := array_append(missing, 'public.activity_history'); end if;
  if to_regclass('public.report_history') is null then missing := array_append(missing, 'public.report_history'); end if;
  if to_regclass('public.settings') is null then missing := array_append(missing, 'public.settings'); end if;
  if to_regclass('public.notification_preferences') is null then missing := array_append(missing, 'public.notification_preferences'); end if;
  if array_length(missing, 1) is not null then
    raise exception 'STOP: missing required production objects: %', array_to_string(missing, ', ');
  end if;
end
$preconditions$;

do $baseline_columns$
declare missing text[] := array[]::text[];
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='activity_history' and column_name='user_id') then missing := array_append(missing, 'activity_history.user_id'); end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='activity_history' and column_name='type') then missing := array_append(missing, 'activity_history.type'); end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='activity_history' and column_name='action_type') then missing := array_append(missing, 'activity_history.action_type'); end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='activity_history' and column_name='dedupe_key') then missing := array_append(missing, 'activity_history.dedupe_key'); end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='activity_history' and column_name='payload') then missing := array_append(missing, 'activity_history.payload'); end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='activity_history' and column_name='related_report_id') then missing := array_append(missing, 'activity_history.related_report_id'); end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='activity_history' and column_name='created_at') then missing := array_append(missing, 'activity_history.created_at'); end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='activity_history' and column_name='updated_at') then missing := array_append(missing, 'activity_history.updated_at'); end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='settings' and column_name='preferences') then missing := array_append(missing, 'settings.preferences'); end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='report_history' and column_name='id') then missing := array_append(missing, 'report_history.id'); end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='notification_preferences' and column_name='user_id') then missing := array_append(missing, 'notification_preferences.user_id'); end if;
  if array_length(missing, 1) is not null then raise exception 'STOP: incompatible baseline schema: %', array_to_string(missing, ', '); end if;
  if to_regclass('public.coaching_priorities') is not null and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='coaching_priorities' and column_name='user_id') then raise exception 'STOP: incompatible existing coaching_priorities'; end if;
  if to_regclass('public.coaching_game_checkpoints') is not null and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='coaching_game_checkpoints' and column_name='checked_game_ids') then raise exception 'STOP: incompatible existing coaching_game_checkpoints'; end if;
  if to_regclass('public.coaching_response_plans') is not null and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='coaching_response_plans' and column_name='plan_text') then raise exception 'STOP: incompatible existing coaching_response_plans'; end if;
  if to_regclass('public.coaching_weekly_reviews') is not null and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='coaching_weekly_reviews' and column_name='review_key') then raise exception 'STOP: incompatible existing coaching_weekly_reviews'; end if;
end
$baseline_columns$;
rollback;

-- IMPORTANT: In SQL Editor, execute each BEGIN/COMMIT migration section separately,
-- in order. Verify the section's postcondition before continuing to the next section.

-- ===== BEGIN 202608200001_canonical_coaching_activity.sql (SHA-256 51311EBAE0D57B86972ED8079544014C7A2A7F3E5443017A844A023D53E92109) =====
begin;
-- Additive coaching-loop persistence. Existing activity/report/training rows remain unchanged.

alter table public.activity_history
  add column if not exists coaching_activity_type text,
  add column if not exists occurred_at timestamptz,
  add column if not exists task_id text,
  add column if not exists evidence_refs jsonb not null default '{}'::jsonb,
  add column if not exists coaching_schema_version integer not null default 1;

alter table public.activity_history drop constraint if exists activity_history_coaching_type_check;
alter table public.activity_history add constraint activity_history_coaching_type_check check (
  coaching_activity_type is null or coaching_activity_type in (
    'training_session_completed', 'source_game_review_completed', 'response_plan_saved',
    'response_plan_recalled', 'game_check_completed', 'position_review_completed'
  )
);

create or replace function public.protect_meaningful_coaching_activity()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.coaching_activity_type is not null and current_user not in ('postgres', 'service_role') then
    raise exception 'Meaningful coaching activity must use the canonical recorder';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_meaningful_coaching_activity on public.activity_history;
create trigger protect_meaningful_coaching_activity
before insert or update of coaching_activity_type on public.activity_history
for each row execute function public.protect_meaningful_coaching_activity();

create table if not exists public.coaching_priorities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid references public.report_history(id) on delete set null,
  diagnosis_id text,
  decision_id text,
  recommendation_id text,
  repertoire_role text not null,
  opening_id text,
  opening_name text,
  task_id text not null,
  status text not null default 'ready' check (status in ('ready', 'in_progress', 'completed', 'superseded', 'unavailable')),
  evidence_refs jsonb not null default '{}'::jsonb,
  schema_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, task_id)
);

create unique index if not exists coaching_priorities_one_current_idx
on public.coaching_priorities(user_id) where status in ('ready', 'in_progress');

create table if not exists public.coaching_game_checkpoints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  username text not null,
  last_completed_at timestamptz not null,
  last_imported_at timestamptz,
  latest_platform_game_id text,
  checked_game_ids jsonb not null default '[]'::jsonb,
  schema_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, username)
);

create table if not exists public.coaching_response_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  repertoire_role text not null,
  opening_id text,
  diagnosis_id text,
  plan_text text not null check (length(btrim(plan_text)) between 1 and 4000),
  status text not null default 'active' check (status in ('active', 'superseded')),
  report_id uuid references public.report_history(id) on delete set null,
  task_id text,
  schema_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  superseded_at timestamptz,
  check (opening_id is not null or diagnosis_id is not null)
);

create unique index if not exists coaching_response_plans_one_active_subject_idx
on public.coaching_response_plans(user_id, repertoire_role, coalesce(opening_id, ''), coalesce(diagnosis_id, ''))
where status = 'active';

do $$
declare owned_table text;
begin
  foreach owned_table in array array['coaching_priorities', 'coaching_game_checkpoints', 'coaching_response_plans'] loop
    execute format('alter table public.%I enable row level security', owned_table);
    execute format('drop policy if exists %I on public.%I', owned_table || '_select_own', owned_table);
    execute format('create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)', owned_table || '_select_own', owned_table);
    execute format('drop policy if exists %I on public.%I', owned_table || '_insert_own', owned_table);
    execute format('create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)', owned_table || '_insert_own', owned_table);
    execute format('drop policy if exists %I on public.%I', owned_table || '_update_own', owned_table);
    execute format('create policy %I on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', owned_table || '_update_own', owned_table);
    execute format('drop policy if exists %I on public.%I', owned_table || '_delete_own', owned_table);
    execute format('create policy %I on public.%I for delete to authenticated using (auth.uid() = user_id)', owned_table || '_delete_own', owned_table);
    execute format('grant select, insert, update, delete on public.%I to authenticated', owned_table);
    execute format('grant all on public.%I to service_role', owned_table);
  end loop;
end $$;

create or replace function public.record_meaningful_coaching_activity(
  p_activity_type text,
  p_idempotency_key text,
  p_payload jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default null
) returns public.activity_history
language plpgsql security definer set search_path = public
as $$
declare owner_id uuid := auth.uid(); saved public.activity_history;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if p_activity_type not in ('training_session_completed', 'source_game_review_completed', 'response_plan_saved', 'response_plan_recalled', 'game_check_completed', 'position_review_completed') then raise exception 'Unsupported meaningful coaching activity'; end if;
  p_idempotency_key := nullif(btrim(p_idempotency_key), '');
  if p_idempotency_key is null or length(p_idempotency_key) > 200 then raise exception 'A valid idempotency key is required'; end if;
  insert into public.activity_history(user_id, type, action_type, coaching_activity_type, dedupe_key, payload, evidence_refs, related_report_id, task_id, occurred_at, updated_at)
  values (owner_id, p_activity_type, p_activity_type, p_activity_type, p_idempotency_key, coalesce(p_payload, '{}'::jsonb), coalesce(p_payload->'evidenceRefs', '{}'::jsonb), nullif(p_payload->>'reportId', '')::uuid, nullif(p_payload->>'taskId', ''), case when auth.role() = 'service_role' then coalesce(p_occurred_at, now()) else now() end, now())
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
  returning * into saved;
  if saved.id is null then select * into saved from public.activity_history where user_id = owner_id and dedupe_key = p_idempotency_key; end if;
  return saved;
end;
$$;

create or replace function public.get_current_coaching_priority()
returns public.coaching_priorities
language sql stable security definer set search_path = public
as $$ select p.* from public.coaching_priorities p where p.user_id = auth.uid() and p.status in ('in_progress', 'ready') order by case p.status when 'in_progress' then 0 else 1 end, p.created_at desc limit 1 $$;

create or replace function public.get_weekly_coaching_goal()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare owner_id uuid := auth.uid(); zone text := 'UTC'; local_now timestamp; week_start timestamp; completed integer;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  select coalesce(nullif(s.preferences->>'timezone', ''), 'UTC') into zone from public.settings s where s.user_id = owner_id;
  if zone is null or not exists(select 1 from pg_timezone_names where name = zone) then zone := 'UTC'; end if;
  local_now := now() at time zone zone;
  week_start := date_trunc('week', local_now);
  select count(*) into completed from public.activity_history a where a.user_id = owner_id and a.coaching_activity_type is not null and (coalesce(a.occurred_at, a.created_at) at time zone zone) >= week_start and (coalesce(a.occurred_at, a.created_at) at time zone zone) < week_start + interval '7 days';
  return jsonb_build_object('target', 3, 'completed', completed, 'weekStart', week_start::date, 'weekEnd', (week_start + interval '6 days')::date, 'timezone', zone);
end;
$$;

revoke all on function public.record_meaningful_coaching_activity(text, text, jsonb, timestamptz) from public, anon;
revoke all on function public.get_current_coaching_priority() from public, anon;
revoke all on function public.get_weekly_coaching_goal() from public, anon;
grant execute on function public.record_meaningful_coaching_activity(text, text, jsonb, timestamptz) to authenticated, service_role;
grant execute on function public.get_current_coaching_priority() to authenticated, service_role;
grant execute on function public.get_weekly_coaching_goal() to authenticated, service_role;

comment on table public.coaching_priorities is 'Canonical current and historical coaching priorities; optional fields keep older clients compatible.';
comment on column public.activity_history.coaching_activity_type is 'Null for legacy activity; set only for meaningful coaching-loop completion types.';
comment on table public.coaching_game_checkpoints is 'Stable game IDs and import timestamps for post-Game-Check detection without duplicating game records.';

do $verify_001$
begin
  if to_regclass('public.coaching_priorities') is null or to_regclass('public.coaching_game_checkpoints') is null or to_regclass('public.coaching_response_plans') is null then raise exception 'STOP after 001: coaching tables missing'; end if;
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='coaching_priorities' and c.relrowsecurity) then raise exception 'STOP after 001: coaching_priorities RLS disabled'; end if;
  if to_regprocedure('public.record_meaningful_coaching_activity(text,text,jsonb,timestamp with time zone)') is null or to_regprocedure('public.get_current_coaching_priority()') is null or to_regprocedure('public.get_weekly_coaching_goal()') is null then raise exception 'STOP after 001: canonical functions missing'; end if;
  if not exists (select 1 from pg_trigger where tgname='protect_meaningful_coaching_activity' and not tgisinternal) then raise exception 'STOP after 001: protection trigger missing'; end if;
end
$verify_001$;
commit;
-- ===== END 202608200001_canonical_coaching_activity.sql =====


-- ===== BEGIN 202608200002_save_coaching_response_plan.sql (SHA-256 679554F1C0B825B2523298CD31604743835B83D6ABB325F3F312CC188CDF4221) =====
begin;
create or replace function public.save_coaching_response_plan(
  p_repertoire_role text,
  p_opening_id text default null,
  p_diagnosis_id text default null,
  p_report_id uuid default null,
  p_task_id text default null,
  p_plan_text text default null
) returns public.coaching_response_plans
language plpgsql
security invoker
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  saved public.coaching_response_plans;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if btrim(coalesce(p_repertoire_role, '')) = '' or length(btrim(coalesce(p_plan_text, ''))) not between 1 and 4000 then
    raise exception 'A role and a short response plan are required';
  end if;

  update public.coaching_response_plans
     set status = 'superseded', updated_at = now()
   where user_id = owner_id
     and repertoire_role = p_repertoire_role
     and opening_id is not distinct from p_opening_id
     and diagnosis_id is not distinct from p_diagnosis_id
     and status = 'active';

  insert into public.coaching_response_plans(user_id, repertoire_role, opening_id, diagnosis_id, report_id, task_id, plan_text)
  values (owner_id, p_repertoire_role, p_opening_id, p_diagnosis_id, p_report_id, p_task_id, btrim(p_plan_text))
  returning * into saved;
  return saved;
end;
$$;

revoke all on function public.save_coaching_response_plan(text,text,text,uuid,text,text) from public;
grant execute on function public.save_coaching_response_plan(text,text,text,uuid,text,text) to authenticated;

do $verify_002$ begin
  if to_regprocedure('public.save_coaching_response_plan(text,text,text,uuid,text,text)') is null then raise exception 'STOP after 002: response-plan function missing'; end if;
end $verify_002$;
commit;
-- ===== END 202608200002_save_coaching_response_plan.sql =====


-- ===== BEGIN 202608200003_complete_game_check.sql (SHA-256 BCFB4A8DE3A3CF7C9688DEBAF883A2CE9AC14BD5EB956E80F6AF5FBB1AFB19A1) =====
begin;
create or replace function public.complete_game_check(
  p_platform text,
  p_username text,
  p_checked_game_ids text[],
  p_idempotency_key text,
  p_payload jsonb default '{}'::jsonb,
  p_latest_platform_game_id text default null,
  p_last_imported_at timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  completed_at timestamptz := now();
  saved_activity public.activity_history;
  saved_checkpoint public.coaching_game_checkpoints;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if btrim(coalesce(p_platform, '')) = '' or btrim(coalesce(p_username, '')) = '' then raise exception 'Platform and username are required'; end if;
  if coalesce(array_length(p_checked_game_ids, 1), 0) = 0 then raise exception 'At least one checked game ID is required'; end if;

  saved_activity := public.record_meaningful_coaching_activity('game_check_completed', p_idempotency_key, p_payload, completed_at);

  insert into public.coaching_game_checkpoints(user_id, platform, username, last_completed_at, last_imported_at, latest_platform_game_id, checked_game_ids)
  values (owner_id, lower(btrim(p_platform)), lower(btrim(p_username)), completed_at, p_last_imported_at, p_latest_platform_game_id, to_jsonb(p_checked_game_ids))
  on conflict (user_id, platform, username) do update set
    last_completed_at = greatest(public.coaching_game_checkpoints.last_completed_at, excluded.last_completed_at),
    last_imported_at = coalesce(excluded.last_imported_at, public.coaching_game_checkpoints.last_imported_at),
    latest_platform_game_id = coalesce(excluded.latest_platform_game_id, public.coaching_game_checkpoints.latest_platform_game_id),
    checked_game_ids = (select coalesce(jsonb_agg(value order by value), '[]'::jsonb) from (select distinct value from jsonb_array_elements_text(public.coaching_game_checkpoints.checked_game_ids || excluded.checked_game_ids)) ids),
    updated_at = now()
  returning * into saved_checkpoint;

  return jsonb_build_object('activityId', saved_activity.id, 'checkpointId', saved_checkpoint.id, 'completedAt', saved_checkpoint.last_completed_at, 'checkedGameIds', saved_checkpoint.checked_game_ids);
end;
$$;

revoke all on function public.complete_game_check(text,text,text[],text,jsonb,text,timestamptz) from public, anon;
grant execute on function public.complete_game_check(text,text,text[],text,jsonb,text,timestamptz) to authenticated, service_role;

do $verify_003$ begin
  if to_regprocedure('public.complete_game_check(text,text,text[],text,jsonb,text,timestamp with time zone)') is null then raise exception 'STOP after 003: Game Check function missing'; end if;
end $verify_003$;
commit;
-- ===== END 202608200003_complete_game_check.sql =====


-- ===== BEGIN 202608200004_meaningful_consistency.sql (SHA-256 467D79B0466AC27E99C6DA9869E28542CCA2A3B9264B44138DB93067800D3717) =====
begin;
alter table public.activity_history add column if not exists activity_local_date date;

create or replace function public.coaching_timezone(p_user_id uuid)
returns text language plpgsql stable security definer set search_path = public
as $$
declare zone text := 'UTC';
begin
  select coalesce(nullif(s.preferences->>'timezone', ''), 'UTC') into zone from public.settings s where s.user_id = p_user_id;
  if zone is null or not exists(select 1 from pg_timezone_names where name = zone) then zone := 'UTC'; end if;
  return zone;
end;
$$;

update public.activity_history a
set activity_local_date = (coalesce(a.occurred_at, a.created_at) at time zone public.coaching_timezone(a.user_id))::date
where a.coaching_activity_type is not null and a.activity_local_date is null;

-- The legacy streak ledger was introduced after the baseline production schema
-- and may legitimately be absent. Preserve its verified training completions
-- when present, but do not make it a dependency of canonical consistency.
do $legacy_activity_migration$
begin
  if to_regclass('public.qualified_streak_activities') is not null then
    insert into public.activity_history(user_id, type, action_type, coaching_activity_type, dedupe_key, payload, occurred_at, activity_local_date, updated_at)
    select q.user_id,
           case when q.activity_type = 'repair_review_completed' then 'position_review_completed' else 'training_session_completed' end,
           case when q.activity_type = 'repair_review_completed' then 'position_review_completed' else 'training_session_completed' end,
           case when q.activity_type = 'repair_review_completed' then 'position_review_completed' else 'training_session_completed' end,
           'migrated-qualified:' || q.id::text,
           jsonb_build_object('migratedFrom', 'qualified_streak_activities', 'legacySourceId', q.source_id),
           q.created_at,
           q.activity_date,
           now()
    from public.qualified_streak_activities q
    where q.activity_type in ('today_training_completed', 'training_task_completed', 'repair_review_completed')
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;
end
$legacy_activity_migration$;

create or replace function public.record_meaningful_coaching_activity(
  p_activity_type text,
  p_idempotency_key text,
  p_payload jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default null
) returns public.activity_history
language plpgsql security definer set search_path = public
as $$
declare owner_id uuid := auth.uid(); saved public.activity_history; canonical_at timestamptz; local_day date;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if p_activity_type not in ('training_session_completed', 'source_game_review_completed', 'response_plan_saved', 'response_plan_recalled', 'game_check_completed', 'position_review_completed') then raise exception 'Unsupported meaningful coaching activity'; end if;
  p_idempotency_key := nullif(btrim(p_idempotency_key), '');
  if p_idempotency_key is null or length(p_idempotency_key) > 200 then raise exception 'A valid idempotency key is required'; end if;
  canonical_at := case when auth.role() = 'service_role' then coalesce(p_occurred_at, now()) else now() end;
  local_day := (canonical_at at time zone public.coaching_timezone(owner_id))::date;
  insert into public.activity_history(user_id, type, action_type, coaching_activity_type, dedupe_key, payload, evidence_refs, related_report_id, task_id, occurred_at, activity_local_date, updated_at)
  values (owner_id, p_activity_type, p_activity_type, p_activity_type, p_idempotency_key, coalesce(p_payload, '{}'::jsonb), coalesce(p_payload->'evidenceRefs', '{}'::jsonb), nullif(p_payload->>'reportId', '')::uuid, nullif(p_payload->>'taskId', ''), canonical_at, local_day, now())
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing returning * into saved;
  if saved.id is null then select * into saved from public.activity_history where user_id = owner_id and dedupe_key = p_idempotency_key; end if;
  return saved;
end;
$$;

create or replace function public.get_meaningful_consistency()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare owner_id uuid := auth.uid(); zone text; today date; dates date[]; day date; prior date; chain integer := 0; longest integer := 0; latest date; missed integer; status text; weekly integer;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  zone := public.coaching_timezone(owner_id); today := (now() at time zone zone)::date;
  select array_agg(distinct activity_local_date order by activity_local_date) into dates from public.activity_history where user_id = owner_id and coaching_activity_type is not null and activity_local_date is not null;
  if dates is not null then
    foreach day in array dates loop
      if prior is null or day - prior <= 3 then chain := chain + 1; else chain := 1; end if;
      longest := greatest(longest, chain); prior := day;
    end loop;
    latest := dates[array_length(dates, 1)]; missed := today - latest;
    if missed >= 3 then chain := 0; end if;
  else missed := null; chain := 0; end if;
  status := case when latest is null or missed >= 3 then 'reset' when missed = 0 then 'active' when missed = 1 then 'resting' when missed = 2 then 'at_risk' else 'reset' end;
  select count(*) into weekly from public.activity_history where user_id = owner_id and coaching_activity_type is not null and activity_local_date >= date_trunc('week', today::timestamp)::date and activity_local_date < date_trunc('week', today::timestamp)::date + 7;
  return jsonb_build_object('status', status, 'currentStreak', chain, 'longestStreak', longest, 'completedToday', coalesce(latest = today, false), 'lastQualifiedDate', latest, 'timezone', zone, 'weeklyCompleted', weekly, 'weeklyTarget', 3, 'milestones', array[3,7,14,30,50,100], 'latestMilestone', case when longest >= 100 then 100 when longest >= 50 then 50 when longest >= 30 then 30 when longest >= 14 then 14 when longest >= 7 then 7 when longest >= 3 then 3 else null end, 'recoveryAvailable', false, 'recoveryUsed', false);
end;
$$;

create or replace function public.get_training_streak() returns jsonb language sql stable security definer set search_path = public as $$ select public.get_meaningful_consistency() $$;
create or replace function public.get_weekly_coaching_goal() returns jsonb language sql stable security definer set search_path = public as $$ select jsonb_build_object('target', consistency->'weeklyTarget', 'completed', consistency->'weeklyCompleted', 'timezone', consistency->'timezone') from (select public.get_meaningful_consistency() as consistency) state $$;

revoke all on function public.coaching_timezone(uuid) from public, anon, authenticated;
revoke all on function public.get_meaningful_consistency() from public, anon;
grant execute on function public.get_meaningful_consistency() to authenticated, service_role;
comment on column public.activity_history.activity_local_date is 'Immutable local calendar day captured at completion so later timezone changes cannot duplicate or shift consistency days.';

do $verify_004$ begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='activity_history' and column_name='activity_local_date') then raise exception 'STOP after 004: activity_local_date missing'; end if;
  if to_regprocedure('public.coaching_timezone(uuid)') is null or to_regprocedure('public.get_meaningful_consistency()') is null or to_regprocedure('public.get_training_streak()') is null then raise exception 'STOP after 004: consistency functions missing'; end if;
end $verify_004$;
commit;
-- ===== END 202608200004_meaningful_consistency.sql =====


-- ===== BEGIN 202608200005_weekly_coaching_reviews_and_reminders.sql (SHA-256 93ED932D3EEE9327ACED51A7844857929FD31EE67A8C97B102ABA3B3EC98F404) =====
begin;
create table if not exists public.coaching_weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  review_key text not null,
  report_id uuid null,
  status text not null default 'ready' check (status in ('ready', 'read', 'dismissed')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start),
  unique (user_id, review_key)
);

alter table public.coaching_weekly_reviews enable row level security;
drop policy if exists coaching_weekly_reviews_owner_all on public.coaching_weekly_reviews;
create policy coaching_weekly_reviews_owner_all on public.coaching_weekly_reviews
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.notification_preferences add column if not exists reminders_enabled boolean not null default false;
alter table public.notification_preferences add column if not exists game_check_reminders boolean not null default true;
alter table public.notification_preferences add column if not exists weekly_plan_reminders boolean not null default true;
alter table public.notification_preferences add column if not exists consistency_reminders boolean not null default true;
alter table public.notification_preferences add column if not exists timezone text not null default 'UTC';
alter table public.notification_preferences add column if not exists quiet_hours_start smallint not null default 21 check (quiet_hours_start between 0 and 23);
alter table public.notification_preferences add column if not exists quiet_hours_end smallint not null default 8 check (quiet_hours_end between 0 and 23);
alter table public.notification_preferences add column if not exists permission_requested_at timestamptz;
alter table public.notification_preferences add column if not exists last_reminder_date date;
alter table public.notification_preferences add column if not exists last_reminder_type text;

create index if not exists coaching_weekly_reviews_user_week_idx on public.coaching_weekly_reviews(user_id, week_start desc);

comment on table public.coaching_weekly_reviews is 'Immutable-per-week deterministic coaching review snapshots owned by one authenticated user.';
comment on column public.notification_preferences.reminders_enabled is 'Explicit opt-in; legacy preference rows remain disabled until the user activates reminders.';

do $verify_005$
declare expected text[] := array['reminders_enabled','game_check_reminders','weekly_plan_reminders','consistency_reminders','timezone','quiet_hours_start','quiet_hours_end','permission_requested_at','last_reminder_date','last_reminder_type']; missing text[];
begin
  if to_regclass('public.coaching_weekly_reviews') is null then raise exception 'STOP after 005: weekly reviews table missing'; end if;
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='coaching_weekly_reviews' and c.relrowsecurity) then raise exception 'STOP after 005: weekly reviews RLS disabled'; end if;
  select array_agg(e) into missing from unnest(expected) e where not exists (select 1 from information_schema.columns where table_schema='public' and table_name='notification_preferences' and column_name=e);
  if missing is not null then raise exception 'STOP after 005: reminder columns missing: %', array_to_string(missing, ', '); end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='notification_preferences' and column_name='reminders_enabled' and is_nullable='NO' and column_default ilike '%false%') then raise exception 'STOP after 005: reminders_enabled default is not false/non-null'; end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='coaching_weekly_reviews' and policyname='coaching_weekly_reviews_owner_all' and qual like '%user_id%auth.uid()%' and with_check like '%user_id%auth.uid()%') then raise exception 'STOP after 005: owner policy missing or incompatible'; end if;
end
$verify_005$;
commit;
-- ===== END 202608200005_weekly_coaching_reviews_and_reminders.sql =====


-- FINAL READ-ONLY VERIFICATION. This returns metadata and aggregate counts only.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in (
  'coaching_priorities', 'coaching_game_checkpoints', 'coaching_response_plans',
  'coaching_weekly_reviews', 'activity_history', 'notification_preferences'
) order by c.relname;

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in (
  'coaching_priorities', 'coaching_game_checkpoints', 'coaching_response_plans',
  'coaching_weekly_reviews', 'notification_preferences'
) order by tablename, policyname;

select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and (
  (table_name = 'activity_history' and column_name in ('coaching_activity_type','occurred_at','task_id','evidence_refs','coaching_schema_version','activity_local_date')) or
  (table_name = 'notification_preferences' and column_name in ('reminders_enabled','game_check_reminders','weekly_plan_reminders','consistency_reminders','timezone','quiet_hours_start','quiet_hours_end','permission_requested_at','last_reminder_date','last_reminder_type'))
) order by table_name, ordinal_position;

select
  count(*) as notification_preference_rows,
  count(*) filter (where reminders_enabled) as reminders_enabled_rows,
  count(*) filter (where not reminders_enabled) as reminders_disabled_rows
from public.notification_preferences;

select p.proname, pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in (
  'record_meaningful_coaching_activity', 'get_current_coaching_priority',
  'get_weekly_coaching_goal', 'save_coaching_response_plan', 'complete_game_check',
  'coaching_timezone', 'get_meaningful_consistency', 'get_training_streak'
) order by p.proname, arguments;

-- Migration-history alignment is deliberately NOT included. Record versions only
-- after every SQL effect and policy above has been independently verified.
