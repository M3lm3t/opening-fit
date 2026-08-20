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
