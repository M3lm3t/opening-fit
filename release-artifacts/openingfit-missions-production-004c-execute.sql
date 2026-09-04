-- frtjfvhiimgruenqcuon 004C; Missions disabled.
BEGIN;
DO $precondition$ begin if not (to_regclass('public.openingfit_mission_events') is not null and to_regclass('public.openingfit_mission_activity_outbox') is not null and to_regclass('public.openingfit_mission_allowances') is not null and to_regclass('public.openingfit_mission_notification_candidates') is not null and (select count(*) from pg_class where oid=any(array[to_regclass('public.openingfit_mission_events'),to_regclass('public.openingfit_mission_activity_outbox'),to_regclass('public.openingfit_mission_allowances'),to_regclass('public.openingfit_mission_notification_candidates')]) and relrowsecurity)=4 and not has_table_privilege(0,'public.openingfit_mission_events','select,insert,update,delete') and not has_table_privilege('anon','public.openingfit_mission_events','select,insert,update,delete') and has_table_privilege('authenticated','public.openingfit_mission_events','select') and not has_table_privilege('authenticated','public.openingfit_mission_events','insert,update,delete') and has_table_privilege('service_role','public.openingfit_mission_events','select,insert,update') and not has_table_privilege('service_role','public.openingfit_mission_events','delete,truncate,references,trigger') and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notification_preferences' and column_name='mission_reminders' and is_nullable='NO' and column_default='false'::text) and to_regprocedure('public.record_openingfit_mission_event(uuid,uuid,text,text,jsonb)') is not null and not exists(select 1 from (values(0::oid),('anon'::regrole::oid),('authenticated'::regrole::oid),('service_role'::regrole::oid))r(oid) where has_function_privilege(r.oid,to_regprocedure('public.record_openingfit_mission_event(uuid,uuid,text,text,jsonb)'),'execute'))) then raise exception 'contained 004B is required'; end if; end $precondition$;
-- SOURCE MIGRATION 004 STAGE BEGIN
create or replace function public.complete_openingfit_mission_training_session(p_user_id uuid,p_mission_id uuid,p_session_id uuid,p_idempotency_key text)
returns public.openingfit_mission_training_sessions language plpgsql security definer set search_path=public as $$
declare s public.openingfit_mission_training_sessions; total integer; attempted integer; solved integer; unassisted integer; core_ok boolean; summary jsonb;
begin
 if auth.role()<>'service_role' and current_user<>'postgres' then raise exception 'Service authority required'; end if;
 select * into s from public.openingfit_mission_training_sessions where id=p_session_id and user_id=p_user_id and mission_id=p_mission_id for update;
 if s.id is null then raise exception 'Session not found'; end if;
 if s.status='completed' then return s; end if;
 if nullif(btrim(p_idempotency_key),'') is null or length(p_idempotency_key)>200 then raise exception 'Invalid idempotency key'; end if;
 total:=jsonb_array_length(s.exercise_manifest);
 select count(*) filter(where has_attempt),count(*) filter(where has_correct),count(*) filter(where has_unassisted),bool_and(not is_core or has_unassisted) into attempted,solved,unassisted,core_ok from (
  select coalesce((e->>'isCore')::boolean,false) is_core,
   exists(select 1 from public.openingfit_mission_training_attempts a where a.user_id=p_user_id and a.session_id=s.id and a.exercise_key=e->>'exerciseKey') has_attempt,
   exists(select 1 from public.openingfit_mission_training_attempts a where a.user_id=p_user_id and a.session_id=s.id and a.exercise_key=e->>'exerciseKey' and a.result='correct') has_correct,
   exists(select 1 from public.openingfit_mission_training_attempts a where a.user_id=p_user_id and a.session_id=s.id and a.exercise_key=e->>'exerciseKey' and a.result='correct' and not a.assistance_used) has_unassisted
  from jsonb_array_elements(s.exercise_manifest)e)q;
 if attempted<>total or not core_ok or (total<=2 and solved<>total) or (total>2 and(solved*100<total*80 or unassisted*100<total*60)) then raise exception 'Session requirements unmet'; end if;
 summary:=jsonb_build_object('exerciseCount',total,'attemptedCount',attempted,'solvedCount',solved,'unassistedSolvedCount',unassisted);
 perform set_config('openingfit.training_transition','allowed',true);
 update public.openingfit_mission_training_sessions set status='completed',completed_at=now(),last_activity_at=now(),meaningful_activity_recorded_at=now(),completion_idempotency_key=p_idempotency_key,completion_summary=summary where id=s.id returning * into s;
 insert into public.openingfit_mission_activity_outbox(user_id,mission_id,session_id,source_completed_at) values(p_user_id,p_mission_id,s.id,s.completed_at) on conflict(user_id,session_id) do nothing;
 perform public.record_openingfit_mission_event(p_user_id,p_mission_id,'mission_training_completed','training-completed:'||s.id,jsonb_build_object('status','completed'));
 perform public.transition_openingfit_mission(p_user_id,p_mission_id,'awaiting_evidence','training_session_completed',s.id::text,'session-complete:'||p_idempotency_key,summary);
 return s;
end; $$;

-- SOURCE MIGRATION 004 STAGE END
revoke all on function public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
DO $assert$ begin if not (to_regprocedure('public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text)') is not null and not exists(select 1 from (values(0::oid),('anon'::regrole::oid),('authenticated'::regrole::oid),('service_role'::regrole::oid))r(oid) where has_function_privilege(r.oid,to_regprocedure('public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text)'),'execute'))) then raise exception '004C postcondition failed'; end if; end $assert$;
COMMIT;
