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
