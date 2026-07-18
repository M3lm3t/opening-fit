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
