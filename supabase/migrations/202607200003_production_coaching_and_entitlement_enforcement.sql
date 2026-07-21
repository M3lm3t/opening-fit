-- Forward-only reconciliation for typed repertoire, weekly coaching, training
-- outcomes, and paid database enforcement. This migration deliberately retains
-- public.repertoire.repertoire for backwards compatibility and recovery.

begin;

do $$
begin
  if to_regclass('public.repertoire') is null
     or to_regclass('public.report_history') is null
     or to_regclass('public.premium_entitlements') is null then
    raise exception 'Reconciliation precondition failed: required foundation tables are missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'premium_entitlements'
      and column_name = 'access_type'
  ) then
    raise exception 'Reconciliation precondition failed: entitlement preservation migration must run first';
  end if;

  if exists (
    select 1
    from public.profiles profile
    where profile.is_premium is true
      and profile.user_id is not null
      and not exists (
        select 1 from public.premium_entitlements entitlement
        where entitlement.user_id = profile.user_id
          and (
            (entitlement.access_type = 'lifetime' and
              (entitlement.is_grandfathered_lifetime is true or entitlement.status in ('active', 'trialing')))
            or
            (entitlement.access_type in ('monthly_subscription', 'annual_subscription') and
              (entitlement.status in ('active', 'trialing') or
               (entitlement.status in ('canceled', 'past_due') and entitlement.current_period_end > now())))
          )
      )
  ) then
    raise exception 'Reconciliation precondition failed: premium profile lacks qualifying entitlement';
  end if;
end;
$$;

-- A retry may encounter enforcement installed by a previous successful run.
-- Temporarily remove only these reconciliation-owned triggers while structural
-- reconciliation runs; the reviewed definitions are recreated last below.
do $$
declare
  protected_table text;
begin
  foreach protected_table in array array['report_history', 'repertoire', 'weekly_training_plans'] loop
    if to_regclass(format('public.%I', protected_table)) is not null then
      execute format(
        'drop trigger if exists require_paid_mutation on public.%I',
        protected_table
      );
    end if;
  end loop;
end;
$$;

-- Reconciled from persistent repertoire model.
-- Evolve the existing repertoire table into the canonical persistent model.
-- The legacy `repertoire` jsonb column remains so old user data is preserved.

alter table public.repertoire drop constraint if exists repertoire_user_id_key;

alter table public.repertoire add column if not exists slot text;
alter table public.repertoire add column if not exists canonical_opening_id text;
alter table public.repertoire add column if not exists canonical_name text;
alter table public.repertoire add column if not exists display_name text;
alter table public.repertoire add column if not exists source text not null default 'imported';
alter table public.repertoire add column if not exists status text not null default 'archived';
alter table public.repertoire add column if not exists confidence text;
alter table public.repertoire add column if not exists sample_size integer;
alter table public.repertoire add column if not exists recent_score numeric(5, 2);
alter table public.repertoire add column if not exists key_strength text;
alter table public.repertoire add column if not exists key_weakness text;
alter table public.repertoire add column if not exists current_training_focus text;
alter table public.repertoire add column if not exists recommendation_reason text;
alter table public.repertoire add column if not exists expected_benefit text;
alter table public.repertoire add column if not exists added_at timestamptz not null default now();
alter table public.repertoire add column if not exists last_reviewed_at timestamptz;

update public.repertoire
set
  status = 'archived',
  source = 'imported',
  added_at = coalesce(added_at, created_at, now())
where slot is null;

alter table public.repertoire drop constraint if exists repertoire_slot_check;
alter table public.repertoire add constraint repertoire_slot_check check (
  slot is null or slot in ('white_primary', 'white_secondary', 'black_vs_e4', 'black_vs_d4', 'black_other')
);

alter table public.repertoire drop constraint if exists repertoire_source_check;
alter table public.repertoire add constraint repertoire_source_check check (
  source in ('recommended', 'user_selected', 'imported')
);

alter table public.repertoire drop constraint if exists repertoire_status_check;
alter table public.repertoire add constraint repertoire_status_check check (
  status in ('active', 'considering', 'archived')
);

alter table public.repertoire drop constraint if exists repertoire_sample_size_check;
alter table public.repertoire add constraint repertoire_sample_size_check check (
  sample_size is null or sample_size >= 0
);

alter table public.repertoire drop constraint if exists repertoire_recent_score_check;
alter table public.repertoire add constraint repertoire_recent_score_check check (
  recent_score is null or (recent_score >= 0 and recent_score <= 100)
);

alter table public.repertoire drop constraint if exists repertoire_entry_shape_check;
alter table public.repertoire add constraint repertoire_entry_shape_check check (
  (
    slot is null
    and status = 'archived'
  )
  or
  (
    slot is not null
    and nullif(trim(display_name), '') is not null
    and (
      nullif(trim(canonical_opening_id), '') is not null
      or nullif(trim(canonical_name), '') is not null
    )
  )
);

create unique index if not exists repertoire_one_active_slot_idx
on public.repertoire (user_id, slot)
where status = 'active';

create unique index if not exists repertoire_one_pending_recommendation_idx
on public.repertoire (
  user_id,
  slot,
  coalesce(canonical_opening_id, canonical_name)
)
where status = 'considering' and source = 'recommended';

create index if not exists repertoire_user_status_slot_idx
on public.repertoire (user_id, status, slot, updated_at desc);

-- Promote the previous cloud workspace into typed rows when it exists. This is
-- a migration of already-saved user choices, not automatic report creation.
with legacy_raw as (
  select
    state.user_id,
    state.updated_at as state_updated_at,
    item,
    case item->>'section'
      when 'white' then case when item->>'role' in ('Backup', 'Alternative') then 'white_secondary' else 'white_primary' end
      when 'blackE4' then 'black_vs_e4'
      when 'blackD4' then 'black_vs_d4'
      when 'other' then 'black_other'
      else null
    end as mapped_slot
  from public.openingfit_user_state state
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(state.coach_progress->'repertoireWorkspace'->'items') = 'array'
        then state.coach_progress->'repertoireWorkspace'->'items'
      else '[]'::jsonb
    end
  ) item
  where nullif(trim(item->>'name'), '') is not null
), legacy_items as (
  select
    user_id,
    item,
    mapped_slot,
    row_number() over (
      partition by user_id, mapped_slot
      order by
        case when item->>'role' in ('Main', 'Current') then 0 else 1 end,
        case when coalesce((item->>'locked')::boolean, false) then 0 else 1 end,
        state_updated_at desc
    ) as slot_rank
  from legacy_raw
  where mapped_slot is not null
)
insert into public.repertoire (
  user_id, slot, canonical_name, display_name, source, status, confidence,
  sample_size, recent_score, key_weakness, current_training_focus, added_at,
  last_reviewed_at
)
select
  user_id,
  mapped_slot,
  item->>'name',
  item->>'name',
  case when item->>'source' = 'manual' then 'user_selected' else 'imported' end,
  case
    when item->>'status' in ('Paused', 'Avoided') then 'archived'
    when slot_rank = 1 and not exists (
      select 1 from public.repertoire current_entry
      where current_entry.user_id = legacy_items.user_id
        and current_entry.slot = legacy_items.mapped_slot
        and current_entry.status = 'active'
    ) then 'active'
    else 'considering'
  end,
  nullif(item->>'confidence', ''),
  case when item->>'games' ~ '^\d+$' then (item->>'games')::integer else null end,
  case when item->>'fit' ~ '^\d+(\.\d+)?$' then (item->>'fit')::numeric else null end,
  nullif(item->>'weakness', ''),
  nullif(item->>'trainingFocus', ''),
  case when item->>'addedAt' ~ '^\d{4}-\d{2}-\d{2}T' then (item->>'addedAt')::timestamptz else now() end,
  now()
from legacy_items
where mapped_slot is not null
on conflict do nothing;

alter table public.repertoire enable row level security;

drop policy if exists repertoire_select_own on public.repertoire;
create policy repertoire_select_own
on public.repertoire for select to authenticated
using (auth.uid() = user_id);

drop policy if exists repertoire_insert_own on public.repertoire;
create policy repertoire_insert_own
on public.repertoire for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists repertoire_update_own on public.repertoire;
create policy repertoire_update_own
on public.repertoire for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists repertoire_delete_own on public.repertoire;

-- Reads use RLS directly. Mutations go through the transition functions below,
-- preventing clients from bypassing archive/history and active-slot rules.
revoke insert, update, delete on public.repertoire from authenticated;
grant select on public.repertoire to authenticated;

drop trigger if exists set_repertoire_updated_at on public.repertoire;
create trigger set_repertoire_updated_at
before update on public.repertoire
for each row execute function public.set_updated_at();

create or replace function public.initialise_repertoire_from_report(p_entries jsonb)
returns setof public.repertoire
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  entry jsonb;
  required_slot text;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then
    raise exception 'A report repertoire is required';
  end if;
  if exists (select 1 from public.repertoire where user_id = owner_id and status = 'active') then
    raise exception 'An active repertoire already exists';
  end if;

  foreach required_slot in array array['white_primary', 'black_vs_e4', 'black_vs_d4'] loop
    if not exists (select 1 from jsonb_array_elements(p_entries) item where item->>'slot' = required_slot) then
      raise exception 'Missing required repertoire slot: %', required_slot;
    end if;
  end loop;

  for entry in select value from jsonb_array_elements(p_entries) loop
    insert into public.repertoire (
      user_id, slot, canonical_opening_id, canonical_name, display_name,
      source, status, confidence, sample_size, recent_score, key_strength,
      key_weakness, current_training_focus, recommendation_reason, expected_benefit,
      added_at, last_reviewed_at
    ) values (
      owner_id, entry->>'slot', nullif(entry->>'canonical_opening_id', ''),
      nullif(entry->>'canonical_name', ''), entry->>'display_name',
      coalesce(nullif(entry->>'source', ''), 'recommended'), 'active',
      nullif(entry->>'confidence', ''), nullif(entry->>'sample_size', '')::integer,
      nullif(entry->>'recent_score', '')::numeric, nullif(entry->>'key_strength', ''),
      nullif(entry->>'key_weakness', ''), nullif(entry->>'current_training_focus', ''),
      nullif(entry->>'recommendation_reason', ''), nullif(entry->>'expected_benefit', ''),
      coalesce((entry->>'added_at')::timestamptz, now()), now()
    );
  end loop;

  return query select * from public.repertoire where user_id = owner_id and status = 'active' order by slot;
end;
$$;

create or replace function public.accept_repertoire_recommendation(p_recommendation_id uuid)
returns public.repertoire
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  recommendation public.repertoire;
begin
  select * into recommendation from public.repertoire
  where id = p_recommendation_id and user_id = owner_id
    and source = 'recommended' and status = 'considering'
  for update;
  if recommendation.id is null then raise exception 'Recommendation not found'; end if;

  update public.repertoire set status = 'archived', last_reviewed_at = now()
  where user_id = owner_id and slot = recommendation.slot and status = 'active';
  update public.repertoire set status = 'active', last_reviewed_at = now()
  where id = recommendation.id returning * into recommendation;
  return recommendation;
end;
$$;

create or replace function public.reject_repertoire_recommendation(p_recommendation_id uuid)
returns public.repertoire
language plpgsql
security definer
set search_path = public
as $$
declare rejected public.repertoire;
begin
  update public.repertoire set status = 'archived', last_reviewed_at = now()
  where id = p_recommendation_id and user_id = auth.uid()
    and source = 'recommended' and status = 'considering'
  returning * into rejected;
  if rejected.id is null then raise exception 'Recommendation not found'; end if;
  return rejected;
end;
$$;

create or replace function public.replace_repertoire_entry(p_slot text, p_entry jsonb)
returns public.repertoire
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  replacement public.repertoire;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if p_slot not in ('white_primary', 'white_secondary', 'black_vs_e4', 'black_vs_d4', 'black_other') then
    raise exception 'Invalid repertoire slot';
  end if;

  update public.repertoire set status = 'archived', last_reviewed_at = now()
  where user_id = owner_id and slot = p_slot and status = 'active';
  insert into public.repertoire (
    user_id, slot, canonical_opening_id, canonical_name, display_name,
    source, status, confidence, sample_size, recent_score, key_strength,
    key_weakness, current_training_focus, recommendation_reason, expected_benefit,
    last_reviewed_at
  ) values (
    owner_id, p_slot, nullif(p_entry->>'canonical_opening_id', ''),
    nullif(p_entry->>'canonical_name', ''), p_entry->>'display_name',
    'user_selected', 'active', nullif(p_entry->>'confidence', ''),
    nullif(p_entry->>'sample_size', '')::integer, nullif(p_entry->>'recent_score', '')::numeric,
    nullif(p_entry->>'key_strength', ''), nullif(p_entry->>'key_weakness', ''),
    nullif(p_entry->>'current_training_focus', ''), nullif(p_entry->>'recommendation_reason', ''),
    nullif(p_entry->>'expected_benefit', ''), now()
  ) returning * into replacement;
  return replacement;
end;
$$;

create or replace function public.archive_repertoire_entry(p_entry_id uuid)
returns public.repertoire
language plpgsql
security definer
set search_path = public
as $$
declare archived public.repertoire;
begin
  select * into archived from public.repertoire
  where id = p_entry_id and user_id = auth.uid() for update;
  if archived.id is null then raise exception 'Repertoire entry not found'; end if;
  if archived.status = 'active' and archived.slot in ('white_primary', 'black_vs_e4', 'black_vs_d4') then
    raise exception 'Replace a required active slot instead of archiving it';
  end if;
  update public.repertoire set status = 'archived', last_reviewed_at = now()
  where id = p_entry_id returning * into archived;
  return archived;
end;
$$;

create or replace function public.sync_repertoire_report(p_metrics jsonb, p_recommendations jsonb)
returns setof public.repertoire
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  item jsonb;
  active_entry public.repertoire;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;

  if jsonb_typeof(p_metrics) = 'array' then
    for item in select value from jsonb_array_elements(p_metrics) loop
      update public.repertoire set
        confidence = coalesce(nullif(item->>'confidence', ''), confidence),
        sample_size = coalesce(nullif(item->>'sample_size', '')::integer, sample_size),
        recent_score = coalesce(nullif(item->>'recent_score', '')::numeric, recent_score),
        key_strength = coalesce(nullif(item->>'key_strength', ''), key_strength),
        key_weakness = coalesce(nullif(item->>'key_weakness', ''), key_weakness),
        current_training_focus = coalesce(nullif(item->>'current_training_focus', ''), current_training_focus),
        last_reviewed_at = now()
      where user_id = owner_id and status = 'active'
        and (
          (nullif(item->>'canonical_opening_id', '') is not null and canonical_opening_id = item->>'canonical_opening_id')
          or (nullif(item->>'canonical_name', '') is not null and canonical_name = item->>'canonical_name')
        );
    end loop;
  end if;

  if jsonb_typeof(p_recommendations) = 'array' then
    for item in select value from jsonb_array_elements(p_recommendations) loop
      select * into active_entry from public.repertoire
      where user_id = owner_id and slot = item->>'slot' and status = 'active';
      if active_entry.id is not null
         and coalesce(active_entry.canonical_opening_id, active_entry.canonical_name)
             is distinct from coalesce(nullif(item->>'canonical_opening_id', ''), nullif(item->>'canonical_name', '')) then
        update public.repertoire set
          display_name = item->>'display_name',
          confidence = nullif(item->>'confidence', ''),
          sample_size = nullif(item->>'sample_size', '')::integer,
          recent_score = nullif(item->>'recent_score', '')::numeric,
          key_strength = nullif(item->>'key_strength', ''),
          key_weakness = nullif(item->>'key_weakness', ''),
          current_training_focus = nullif(item->>'current_training_focus', ''),
          recommendation_reason = nullif(item->>'recommendation_reason', ''),
          expected_benefit = nullif(item->>'expected_benefit', ''),
          last_reviewed_at = now()
        where user_id = owner_id
          and slot = item->>'slot'
          and status = 'considering'
          and source = 'recommended'
          and coalesce(canonical_opening_id, canonical_name)
              = coalesce(nullif(item->>'canonical_opening_id', ''), nullif(item->>'canonical_name', ''));

        insert into public.repertoire (
          user_id, slot, canonical_opening_id, canonical_name, display_name,
          source, status, confidence, sample_size, recent_score, key_strength,
          key_weakness, current_training_focus, recommendation_reason, expected_benefit,
          last_reviewed_at
        ) values (
          owner_id, item->>'slot', nullif(item->>'canonical_opening_id', ''),
          nullif(item->>'canonical_name', ''), item->>'display_name',
          'recommended', 'considering', nullif(item->>'confidence', ''),
          nullif(item->>'sample_size', '')::integer, nullif(item->>'recent_score', '')::numeric,
          nullif(item->>'key_strength', ''), nullif(item->>'key_weakness', ''),
          nullif(item->>'current_training_focus', ''), nullif(item->>'recommendation_reason', ''),
          nullif(item->>'expected_benefit', ''), now()
        ) on conflict do nothing;
      end if;
    end loop;
  end if;

  return query select * from public.repertoire where user_id = owner_id order by updated_at desc;
end;
$$;

revoke all on function public.initialise_repertoire_from_report(jsonb) from public, anon;
revoke all on function public.accept_repertoire_recommendation(uuid) from public, anon;
revoke all on function public.reject_repertoire_recommendation(uuid) from public, anon;
revoke all on function public.replace_repertoire_entry(text, jsonb) from public, anon;
revoke all on function public.archive_repertoire_entry(uuid) from public, anon;
revoke all on function public.sync_repertoire_report(jsonb, jsonb) from public, anon;
grant execute on function public.initialise_repertoire_from_report(jsonb) to authenticated;
grant execute on function public.accept_repertoire_recommendation(uuid) to authenticated;
grant execute on function public.reject_repertoire_recommendation(uuid) to authenticated;
grant execute on function public.replace_repertoire_entry(text, jsonb) to authenticated;
grant execute on function public.archive_repertoire_entry(uuid) to authenticated;
grant execute on function public.sync_repertoire_report(jsonb, jsonb) to authenticated;


-- Reconciled from weekly training plans.
create table if not exists public.weekly_training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  schema_version integer not null default 1 check (schema_version >= 1),
  week_start date not null,
  week_end date not null,
  report_id uuid references public.report_history(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'completed', 'expired')),
  primary_goal text not null,
  reason text not null,
  estimated_minutes integer not null check (estimated_minutes between 1 and 240),
  target_metric jsonb not null default '{}'::jsonb,
  tasks jsonb not null default '[]'::jsonb,
  completion_percent integer not null default 0 check (completion_percent between 0 and 100),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (week_end >= week_start),
  check (jsonb_typeof(tasks) = 'array'),
  check (jsonb_array_length(tasks) between 3 and 5)
);

create unique index if not exists weekly_training_plans_one_active_week_idx
on public.weekly_training_plans (user_id, week_start)
where status = 'active';

create index if not exists weekly_training_plans_user_week_idx
on public.weekly_training_plans (user_id, week_start desc, created_at desc);

alter table public.weekly_training_plans enable row level security;

drop policy if exists weekly_training_plans_select_own on public.weekly_training_plans;
create policy weekly_training_plans_select_own
on public.weekly_training_plans for select to authenticated
using (auth.uid() = user_id);

drop policy if exists weekly_training_plans_insert_own on public.weekly_training_plans;
drop policy if exists weekly_training_plans_update_own on public.weekly_training_plans;
drop policy if exists weekly_training_plans_delete_own on public.weekly_training_plans;

revoke insert, update, delete on public.weekly_training_plans from authenticated;
grant select on public.weekly_training_plans to authenticated;

drop trigger if exists set_weekly_training_plans_updated_at on public.weekly_training_plans;
create trigger set_weekly_training_plans_updated_at
before update on public.weekly_training_plans
for each row execute function public.set_updated_at();

create or replace function public.save_weekly_training_plan(p_plan jsonb, p_force_refresh boolean default false)
returns public.weekly_training_plans
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  existing_plan public.weekly_training_plans;
  saved_plan public.weekly_training_plans;
  requested_week date := (p_plan->>'weekStart')::date;
  requested_report uuid := nullif(p_plan->>'reportId', '')::uuid;
  task_count integer := jsonb_array_length(coalesce(p_plan->'tasks', '[]'::jsonb));
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if task_count < 3 or task_count > 5 then raise exception 'Weekly plans require 3 to 5 tasks'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_plan->'tasks') task
    where nullif(task->>'id', '') is null
      or task->>'type' not in ('position_drill', 'line_replay', 'game_review', 'concept_review')
      or nullif(task->>'title', '') is null
      or nullif(task->>'explanation', '') is null
      or nullif(task->>'successCriteria', '') is null
      or task->>'status' not in ('pending', 'completed')
  ) then raise exception 'Weekly plan contains an invalid task'; end if;
  if not exists (select 1 from public.repertoire where user_id = owner_id and status = 'active') then
    raise exception 'An active repertoire is required';
  end if;
  if requested_report is null or not exists (
    select 1 from public.report_history
    where id = requested_report and user_id = owner_id
      and coalesce(source_platform, snapshot->>'source_platform') in ('chesscom', 'lichess')
      and coalesce(source_username, snapshot->>'source_username') is not null
      and case
        when snapshot->>'total_games_analysed' ~ '^\d+$' then (snapshot->>'total_games_analysed')::integer > 0
        else true
      end
  ) then raise exception 'A valid saved report is required'; end if;

  select * into existing_plan from public.weekly_training_plans
  where user_id = owner_id and week_start = requested_week and status = 'active'
  for update;

  if existing_plan.id is not null
     and not p_force_refresh
     and existing_plan.report_id = requested_report then
    return existing_plan;
  end if;

  if existing_plan.id is not null then
    update public.weekly_training_plans set status = 'expired'
    where id = existing_plan.id;
  end if;

  insert into public.weekly_training_plans (
    user_id, schema_version, week_start, week_end, report_id, status,
    primary_goal, reason, estimated_minutes, target_metric, tasks,
    completion_percent, created_at, completed_at
  ) values (
    owner_id,
    coalesce((p_plan->>'schemaVersion')::integer, 1),
    requested_week,
    (p_plan->>'weekEnd')::date,
    requested_report,
    'active',
    p_plan->>'primaryGoal',
    p_plan->>'reason',
    (p_plan->>'estimatedMinutes')::integer,
    coalesce(p_plan->'targetMetric', '{}'::jsonb),
    p_plan->'tasks',
    0,
    coalesce((p_plan->>'createdAt')::timestamptz, now()),
    null
  ) returning * into saved_plan;
  return saved_plan;
end;
$$;

create or replace function public.set_weekly_training_task_status(
  p_plan_id uuid,
  p_task_id text,
  p_completed boolean default true
)
returns public.weekly_training_plans
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  current_plan public.weekly_training_plans;
  next_tasks jsonb;
  completed_count integer;
  task_count integer;
  percent integer;
begin
  select * into current_plan from public.weekly_training_plans
  where id = p_plan_id and user_id = owner_id and status in ('active', 'completed')
  for update;
  if current_plan.id is null then raise exception 'Weekly training plan not found'; end if;
  if not exists (select 1 from jsonb_array_elements(current_plan.tasks) task where task->>'id' = p_task_id) then
    raise exception 'Weekly training task not found';
  end if;

  select jsonb_agg(
    case when task->>'id' = p_task_id
      then jsonb_set(task, '{status}', to_jsonb(case when p_completed then 'completed' else 'pending' end::text))
      else task end
    order by coalesce((task->>'order')::integer, 0)
  ) into next_tasks
  from jsonb_array_elements(current_plan.tasks) task;

  select count(*), count(*) filter (where task->>'status' = 'completed')
  into task_count, completed_count
  from jsonb_array_elements(next_tasks) task;
  percent := case when task_count = 0 then 0 else round(completed_count * 100.0 / task_count)::integer end;

  update public.weekly_training_plans set
    tasks = next_tasks,
    completion_percent = percent,
    status = case when percent = 100 then 'completed' else 'active' end,
    completed_at = case when percent = 100 then now() else null end
  where id = current_plan.id
  returning * into current_plan;
  return current_plan;
end;
$$;

create or replace function public.complete_weekly_training_plan(p_plan_id uuid)
returns public.weekly_training_plans
language plpgsql
security definer
set search_path = public
as $$
declare completed_plan public.weekly_training_plans;
begin
  update public.weekly_training_plans set
    tasks = (select jsonb_agg(jsonb_set(task, '{status}', '"completed"'::jsonb) order by coalesce((task->>'order')::integer, 0)) from jsonb_array_elements(tasks) task),
    completion_percent = 100,
    status = 'completed',
    completed_at = now()
  where id = p_plan_id and user_id = auth.uid() and status = 'active'
  returning * into completed_plan;
  if completed_plan.id is null then raise exception 'Active weekly training plan not found'; end if;
  return completed_plan;
end;
$$;

revoke all on function public.save_weekly_training_plan(jsonb, boolean) from public, anon;
revoke all on function public.set_weekly_training_task_status(uuid, text, boolean) from public, anon;
revoke all on function public.complete_weekly_training_plan(uuid) from public, anon;
grant execute on function public.save_weekly_training_plan(jsonb, boolean) to authenticated;
grant execute on function public.set_weekly_training_task_status(uuid, text, boolean) to authenticated;
grant execute on function public.complete_weekly_training_plan(uuid) to authenticated;


-- Reconciled from training outcomes.
alter table public.repertoire
  add column if not exists training_outcome jsonb;

comment on column public.repertoire.training_outcome is
  'Latest conservative post-training measurement. Null means no completed focus has comparable evidence.';

create or replace function public.set_weekly_training_task_status(
  p_plan_id uuid,
  p_task_id text,
  p_completed boolean default true
)
returns public.weekly_training_plans
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  current_plan public.weekly_training_plans;
  next_tasks jsonb;
  completed_count integer;
  task_count integer;
  percent integer;
begin
  select * into current_plan from public.weekly_training_plans
  where id = p_plan_id and user_id = owner_id and status in ('active', 'completed')
  for update;
  if current_plan.id is null then raise exception 'Weekly training plan not found'; end if;
  if not exists (select 1 from jsonb_array_elements(current_plan.tasks) task where task->>'id' = p_task_id) then
    raise exception 'Weekly training task not found';
  end if;

  select jsonb_agg(
    case when task->>'id' = p_task_id then
      case when p_completed then
        jsonb_set(jsonb_set(task, '{status}', '"completed"'::jsonb), '{completedAt}', to_jsonb(now()))
      else
        (jsonb_set(task, '{status}', '"pending"'::jsonb) - 'completedAt')
      end
    else task end
    order by coalesce((task->>'order')::integer, 0)
  ) into next_tasks
  from jsonb_array_elements(current_plan.tasks) task;

  select count(*), count(*) filter (where task->>'status' = 'completed')
  into task_count, completed_count from jsonb_array_elements(next_tasks) task;
  percent := case when task_count = 0 then 0 else round(completed_count * 100.0 / task_count)::integer end;

  update public.weekly_training_plans set
    tasks = next_tasks,
    completion_percent = percent,
    status = case when percent = 100 then 'completed' else 'active' end,
    completed_at = case when percent = 100 then now() else null end
  where id = current_plan.id returning * into current_plan;
  return current_plan;
end;
$$;

create or replace function public.apply_repertoire_training_outcomes(p_metrics jsonb)
returns setof public.repertoire
language plpgsql
security definer
set search_path = public
as $$
declare owner_id uuid := auth.uid(); item jsonb;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_metrics) = 'array' then
    for item in select value from jsonb_array_elements(p_metrics) loop
      if item->'training_outcome' is not null and item->'training_outcome' <> 'null'::jsonb then
        update public.repertoire set training_outcome = item->'training_outcome', last_reviewed_at = now()
        where user_id = owner_id and status = 'active' and (
          (nullif(item->>'canonical_opening_id', '') is not null and canonical_opening_id = item->>'canonical_opening_id')
          or (nullif(item->>'canonical_name', '') is not null and canonical_name = item->>'canonical_name')
        );
      end if;
    end loop;
  end if;
  return query select * from public.repertoire where user_id = owner_id and status in ('active', 'considering');
end;
$$;

revoke all on function public.apply_repertoire_training_outcomes(jsonb) from public, anon;
grant execute on function public.apply_repertoire_training_outcomes(jsonb) to authenticated;


-- Reconciled from feature entitlement enforcement (installed last).
-- Trusted database enforcement for paid workspaces. Existing rows are retained;
-- access returns automatically when a subscription is active again.

create or replace function public.openingfit_has_paid_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    or exists (
      select 1
      from public.premium_entitlements entitlement
      where entitlement.user_id = auth.uid()
        and (
          (
            entitlement.access_type = 'lifetime'
            and (entitlement.is_grandfathered_lifetime is true or entitlement.status in ('active', 'trialing'))
          )
          or (
            entitlement.access_type in ('monthly_subscription', 'annual_subscription')
            and (
              entitlement.status in ('active', 'trialing')
              or (
                entitlement.status = 'canceled'
                and entitlement.current_period_end > now()
              )
              or (
                entitlement.status = 'past_due'
                and entitlement.premium_since is not null
                and entitlement.current_period_end > now()
              )
            )
          )
        )
    );
$$;

revoke all on function public.openingfit_has_paid_access() from public, anon;
grant execute on function public.openingfit_has_paid_access() to authenticated, service_role;

create or replace function public.require_openingfit_paid_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.openingfit_has_paid_access() then
    raise exception 'Paid OpeningFit access is required for this feature' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare protected_table text;
begin
  foreach protected_table in array array['repertoire', 'weekly_training_plans'] loop
    if to_regclass(format('public.%I', protected_table)) is not null then
      execute format('drop trigger if exists require_paid_mutation on public.%I', protected_table);
      execute format('create trigger require_paid_mutation before insert or update or delete on public.%I for each row execute function public.require_openingfit_paid_mutation()', protected_table);
    end if;
  end loop;
end;
$$;

drop policy if exists repertoire_select_own on public.repertoire;
create policy repertoire_select_own on public.repertoire for select to authenticated
using (auth.uid() = user_id and public.openingfit_has_paid_access());

drop policy if exists repertoire_insert_own on public.repertoire;
create policy repertoire_insert_own on public.repertoire for insert to authenticated
with check (auth.uid() = user_id and public.openingfit_has_paid_access());

drop policy if exists repertoire_update_own on public.repertoire;
create policy repertoire_update_own on public.repertoire for update to authenticated
using (auth.uid() = user_id and public.openingfit_has_paid_access())
with check (auth.uid() = user_id and public.openingfit_has_paid_access());

drop policy if exists weekly_training_plans_select_own on public.weekly_training_plans;
create policy weekly_training_plans_select_own on public.weekly_training_plans for select to authenticated
using (auth.uid() = user_id and public.openingfit_has_paid_access());

drop policy if exists report_history_select_own on public.report_history;
alter table public.report_history enable row level security;
-- Existing saved-history reads remain available to their authenticated owner
-- during this rollout. Premium gating applies to mutations and expanded history
-- functionality. Paid-only reads may be introduced only after a limited-free-
-- history UX and an explicit data-retention policy are available.
create policy report_history_select_own on public.report_history for select to authenticated
using (auth.uid() = user_id);

drop policy if exists report_history_insert_own on public.report_history;
create policy report_history_insert_own on public.report_history for insert to authenticated
with check (auth.uid() = user_id and public.openingfit_has_paid_access());

drop policy if exists report_history_update_own on public.report_history;
create policy report_history_update_own on public.report_history for update to authenticated
using (auth.uid() = user_id and public.openingfit_has_paid_access())
with check (auth.uid() = user_id and public.openingfit_has_paid_access());

drop policy if exists report_history_delete_own on public.report_history;
create policy report_history_delete_own on public.report_history for delete to authenticated
using (auth.uid() = user_id and public.openingfit_has_paid_access());

drop trigger if exists require_paid_mutation on public.report_history;
create trigger require_paid_mutation before insert or update or delete on public.report_history
for each row execute function public.require_openingfit_paid_mutation();


commit;
