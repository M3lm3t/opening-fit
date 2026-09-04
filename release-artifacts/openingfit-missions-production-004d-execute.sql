-- frtjfvhiimgruenqcuon 004D; Missions disabled.
BEGIN;
DO $precondition$ begin if not (to_regclass('public.openingfit_mission_events') is not null and to_regclass('public.openingfit_mission_activity_outbox') is not null and to_regclass('public.openingfit_mission_allowances') is not null and to_regclass('public.openingfit_mission_notification_candidates') is not null and (select count(*) from pg_class where oid=any(array[to_regclass('public.openingfit_mission_events'),to_regclass('public.openingfit_mission_activity_outbox'),to_regclass('public.openingfit_mission_allowances'),to_regclass('public.openingfit_mission_notification_candidates')]) and relrowsecurity)=4 and not has_table_privilege(0,'public.openingfit_mission_events','select,insert,update,delete') and not has_table_privilege('anon','public.openingfit_mission_events','select,insert,update,delete') and has_table_privilege('authenticated','public.openingfit_mission_events','select') and not has_table_privilege('authenticated','public.openingfit_mission_events','insert,update,delete') and has_table_privilege('service_role','public.openingfit_mission_events','select,insert,update') and not has_table_privilege('service_role','public.openingfit_mission_events','delete,truncate,references,trigger') and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notification_preferences' and column_name='mission_reminders' and is_nullable='NO' and column_default='false'::text) and to_regprocedure('public.record_openingfit_mission_event(uuid,uuid,text,text,jsonb)') is not null and not exists(select 1 from (values(0::oid),('anon'::regrole::oid),('authenticated'::regrole::oid),('service_role'::regrole::oid))r(oid) where has_function_privilege(r.oid,to_regprocedure('public.record_openingfit_mission_event(uuid,uuid,text,text,jsonb)'),'execute')) and to_regprocedure('public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text)') is not null and not exists(select 1 from (values(0::oid),('anon'::regrole::oid),('authenticated'::regrole::oid),('service_role'::regrole::oid))r(oid) where has_function_privilege(r.oid,to_regprocedure('public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text)'),'execute'))) then raise exception 'contained 004C is required'; end if; end $precondition$;
-- SOURCE MIGRATION 004 STAGE BEGIN
create or replace function public.project_openingfit_mission_activity(p_outbox_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare item public.openingfit_mission_activity_outbox; activity public.activity_history;
begin
 if auth.role()<>'service_role' and current_user<>'postgres' then raise exception 'Service authority required'; end if;
 select * into item from public.openingfit_mission_activity_outbox where id=p_outbox_id for update skip locked;
 if item.id is null then return jsonb_build_object('status','unavailable'); end if;
 if item.status='projected' then return jsonb_build_object('status','projected','activityId',item.projected_activity_id); end if;
 begin
  insert into public.activity_history(user_id,type,action_type,coaching_activity_type,dedupe_key,payload,evidence_refs,occurred_at,activity_local_date,updated_at)
  values(item.user_id,'training_session_completed','training_session_completed','training_session_completed','mission-session:'||item.session_id,jsonb_build_object('source','openingfit_mission'),'{}',item.source_completed_at,(item.source_completed_at at time zone public.coaching_timezone(item.user_id))::date,now())
  on conflict(user_id,dedupe_key) where dedupe_key is not null do nothing returning * into activity;
  if activity.id is null then select * into activity from public.activity_history where user_id=item.user_id and dedupe_key='mission-session:'||item.session_id; end if;
  update public.openingfit_mission_activity_outbox set status='projected',projected_activity_id=activity.id,projected_at=now(),attempt_count=attempt_count+1,last_error_code=null,updated_at=now() where id=item.id;
  perform public.record_openingfit_mission_event(item.user_id,item.mission_id,'mission_activity_projected','activity-projected:'||item.session_id,jsonb_build_object('status','projected'));
  return jsonb_build_object('status','projected','activityId',activity.id);
 exception when others then
  update public.openingfit_mission_activity_outbox set status='failed',attempt_count=least(attempt_count+1,100),next_attempt_at=now()+make_interval(mins=>least(60,greatest(1,attempt_count+1))),last_error_code=sqlstate,updated_at=now() where id=item.id;
  return jsonb_build_object('status','failed','retryable',true);
 end;
end; $$;

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
 assigned:=public.transition_openingfit_mission(p_user_id,p_mission_id,'assigned','candidate_selected',null,p_idempotency_key,'{}');
 update public.openingfit_mission_allowances set assignment_count=assignment_count+1,last_assigned_at=now(),next_available_at=case when p_paid_access then null else now()+interval '30 days' end,updated_at=now() where user_id=p_user_id;
 perform public.record_openingfit_mission_event(p_user_id,p_mission_id,'mission_assigned','mission-assigned:'||p_mission_id||':'||(mission.generation)::text,jsonb_build_object('status','assigned'));
 return jsonb_build_object('assigned',true,'mission',assigned);
end; $$;

-- SOURCE MIGRATION 004 STAGE END
revoke all on function public.project_openingfit_mission_activity(uuid),public.assign_openingfit_mission_with_allowance(uuid,uuid,boolean,text) from public,anon,authenticated,service_role;
DO $assert$ begin if not (to_regprocedure('public.project_openingfit_mission_activity(uuid)') is not null and to_regprocedure('public.assign_openingfit_mission_with_allowance(uuid,uuid,boolean,text)') is not null and not exists(select 1 from (values(0::oid),('anon'::regrole::oid),('authenticated'::regrole::oid),('service_role'::regrole::oid))r(oid) cross join(values(to_regprocedure('public.project_openingfit_mission_activity(uuid)')),(to_regprocedure('public.assign_openingfit_mission_with_allowance(uuid,uuid,boolean,text)')))f(oid) where has_function_privilege(r.oid,f.oid,'execute'))) then raise exception '004D postcondition failed'; end if; end $assert$;
COMMIT;
