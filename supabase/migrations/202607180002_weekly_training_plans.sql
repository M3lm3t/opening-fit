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
