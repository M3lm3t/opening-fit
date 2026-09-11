-- Forward repair for environments that applied Mission migration 004 before
-- the transition result was explicitly converted from its composite row type.

do $precondition$
declare
  fn oid := to_regprocedure('public.assign_openingfit_mission_with_allowance(uuid,uuid,boolean,text)');
begin
  if fn is null
     or (select md5(regexp_replace(lower(pg_get_functiondef(fn)),'\s+',' ','g')))
        not in ('30dbcf29a48c79c62d4a06ce2f279660','f39bdc12016b0b7e8ac21d6d705ca3c4')
     or (select pg_get_userbyid(proowner)<>'postgres' or not prosecdef or provolatile<>'v'
                or proisstrict or proparallel<>'u' or proconfig is distinct from array['search_path=public']::text[]
                or pg_get_function_result(oid)<>'jsonb'
         from pg_proc where oid=fn)
  then raise exception 'Mission assignment repair refused: unexpected function contract'; end if;
end
$precondition$;

create or replace function public.assign_openingfit_mission_with_allowance(p_user_id uuid,p_mission_id uuid,p_paid_access boolean,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare allowance public.openingfit_mission_allowances; mission public.openingfit_missions; assigned jsonb;
begin
 if auth.role()<>'service_role' and current_user<>'postgres' then raise exception 'Service authority required'; end if;
 insert into public.openingfit_mission_allowances(user_id) values(p_user_id) on conflict(user_id) do nothing;
 select * into allowance from public.openingfit_mission_allowances where user_id=p_user_id for update;
 if not p_paid_access and allowance.assignment_count>0 and allowance.next_available_at>now() then
  return jsonb_build_object('assigned',false,'reasonCode','free_allowance_exhausted','nextMissionAvailableAt',allowance.next_available_at);
 end if;
 select * into mission from public.openingfit_missions where id=p_mission_id and user_id=p_user_id for update;
 if mission.id is null or mission.status<>'candidate' then raise exception 'Mission not assignable'; end if;
 assigned:=to_jsonb(public.transition_openingfit_mission(p_user_id,p_mission_id,'assigned','candidate_selected',null,p_idempotency_key,'{}'));
 update public.openingfit_mission_allowances set assignment_count=assignment_count+1,last_assigned_at=now(),next_available_at=case when p_paid_access then null else now()+interval '30 days' end,updated_at=now() where user_id=p_user_id;
 perform public.record_openingfit_mission_event(p_user_id,p_mission_id,'mission_assigned','mission-assigned:'||p_mission_id||':'||(mission.generation)::text,jsonb_build_object('status','assigned'));
 return jsonb_build_object('assigned',true,'mission',assigned);
end; $$;

do $postcondition$
declare fn oid := 'public.assign_openingfit_mission_with_allowance(uuid,uuid,boolean,text)'::regprocedure;
begin
  if (select md5(regexp_replace(lower(pg_get_functiondef(fn)),'\s+',' ','g'))) <> 'f39bdc12016b0b7e8ac21d6d705ca3c4'
     or (select pg_get_userbyid(proowner)<>'postgres' or not prosecdef or provolatile<>'v'
                or proisstrict or proparallel<>'u' or proconfig is distinct from array['search_path=public']::text[]
                or pg_get_function_result(oid)<>'jsonb'
         from pg_proc where oid=fn)
  then raise exception 'Mission assignment repair postcondition failed'; end if;
end
$postcondition$;
