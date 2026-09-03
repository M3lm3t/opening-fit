-- PRODUCTION WARNING: target frtjfvhiimgruenqcuon; SQL Editor split stage 003C.
-- Missions must remain disabled. Never rerun migrations 001 or 002.
BEGIN;
DO $precondition$ begin if not (to_regclass('public.openingfit_mission_training_sessions') is not null and (select relrowsecurity from pg_class where oid=to_regclass('public.openingfit_mission_training_sessions')) and exists(select 1 from pg_constraint where conrelid=to_regclass('public.openingfit_mission_training_attempts') and conname='openingfit_attempt_session_owner_fk') and exists(select 1 from pg_policies where schemaname='public' and tablename='openingfit_mission_training_sessions' and policyname='openingfit_mission_training_sessions_select_own' and cmd='SELECT' and roles=array['authenticated']::name[]) and exists(select 1 from pg_trigger where tgrelid=to_regclass('public.openingfit_mission_training_sessions') and tgname='openingfit_protect_training_session' and not tgisinternal) and not has_table_privilege(0,'public.openingfit_mission_training_sessions','select,insert,update,delete') and not has_table_privilege('anon','public.openingfit_mission_training_sessions','select,insert,update,delete') and has_table_privilege('authenticated','public.openingfit_mission_training_sessions','select') and not has_table_privilege('authenticated','public.openingfit_mission_training_sessions','insert,update,delete') and has_table_privilege('service_role','public.openingfit_mission_training_sessions','select,insert,update') and not has_table_privilege('service_role','public.openingfit_mission_training_sessions','delete,truncate,references,trigger') and (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['start_openingfit_mission_training_session','record_openingfit_mission_training_attempt']))=2 and exists(select 1 from pg_proc where oid=to_regprocedure('public.start_openingfit_mission_training_session(uuid,uuid,text,text,jsonb,integer,integer)') and prorettype=to_regtype('jsonb') and prosecdef and proconfig @> array['search_path=public']) and exists(select 1 from pg_proc where oid=to_regprocedure('public.record_openingfit_mission_training_attempt(uuid,uuid,uuid,text,text,text,text,integer,integer,timestamptz,jsonb)') and prorettype=to_regtype('public.openingfit_mission_training_attempts') and prosecdef and proconfig @> array['search_path=public']) and not exists(select 1 from (values(0::oid),('anon'::regrole::oid),('authenticated'::regrole::oid),('service_role'::regrole::oid)) r(oid) cross join (values(to_regprocedure('public.start_openingfit_mission_training_session(uuid,uuid,text,text,jsonb,integer,integer)')), (to_regprocedure('public.record_openingfit_mission_training_attempt(uuid,uuid,uuid,text,text,text,text,integer,integer,timestamptz,jsonb)'))) f(oid) where has_function_privilege(r.oid,f.oid,'execute')) and to_regprocedure('public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text)') is null and public.openingfit_missions_schema_readiness() is not distinct from jsonb_build_object('ready',true,'schemaVersion',1)) then raise exception 'contained 003B is required'; end if; end $precondition$;
-- SOURCE MIGRATION 003 STAGE BEGIN
create or replace function public.complete_openingfit_mission_training_session(
 p_user_id uuid,p_mission_id uuid,p_session_id uuid,p_idempotency_key text
) returns public.openingfit_mission_training_sessions language plpgsql security definer set search_path=public as $$
declare s public.openingfit_mission_training_sessions; total integer; attempted integer; solved integer; unassisted integer; core_ok boolean; summary jsonb;
begin
 if auth.role()<>'service_role' and current_user<>'postgres' then raise exception 'Service authority required'; end if;
 select * into s from public.openingfit_mission_training_sessions where id=p_session_id and user_id=p_user_id and mission_id=p_mission_id for update;
 if s.id is null then raise exception 'Session not found'; end if;
 if s.status='completed' then return s; end if;
 if nullif(btrim(p_idempotency_key),'') is null or length(p_idempotency_key)>200 then raise exception 'Invalid idempotency key'; end if;
 total:=jsonb_array_length(s.exercise_manifest);
 select count(*) filter(where has_attempt),count(*) filter(where has_correct),count(*) filter(where has_unassisted),bool_and(not is_core or has_unassisted)
 into attempted,solved,unassisted,core_ok from (
   select e->>'exerciseKey' exercise_key,coalesce((e->>'isCore')::boolean,false) is_core,
    exists(select 1 from public.openingfit_mission_training_attempts a where a.user_id=p_user_id and a.session_id=s.id and a.exercise_key=e->>'exerciseKey') has_attempt,
    exists(select 1 from public.openingfit_mission_training_attempts a where a.user_id=p_user_id and a.session_id=s.id and a.exercise_key=e->>'exerciseKey' and a.result='correct') has_correct,
    exists(select 1 from public.openingfit_mission_training_attempts a where a.user_id=p_user_id and a.session_id=s.id and a.exercise_key=e->>'exerciseKey' and a.result='correct' and not a.assistance_used) has_unassisted
   from jsonb_array_elements(s.exercise_manifest) e
 ) q;
 if attempted<>total or not core_ok or (total<=2 and solved<>total) or (total>2 and (solved*100<total*80 or unassisted*100<total*60)) then raise exception 'Session requirements unmet'; end if;
 summary:=jsonb_build_object('exerciseCount',total,'attemptedCount',attempted,'solvedCount',solved,'unassistedSolvedCount',unassisted);
 perform set_config('openingfit.training_transition','allowed',true);
 update public.openingfit_mission_training_sessions set status='completed',completed_at=now(),last_activity_at=now(),updated_at=now(),
  meaningful_activity_recorded_at=now(),completion_idempotency_key=p_idempotency_key,completion_summary=summary where id=s.id returning * into s;
 perform public.transition_openingfit_mission(p_user_id,p_mission_id,'awaiting_evidence','training_session_completed',s.id::text,'session-complete:'||p_idempotency_key,summary);
 return s;
end;
$$;

revoke all on function public.start_openingfit_mission_training_session(uuid,uuid,text,text,jsonb,integer,integer) from public,anon,authenticated;
revoke all on function public.record_openingfit_mission_training_attempt(uuid,uuid,uuid,text,text,text,text,integer,integer,timestamptz,jsonb) from public,anon,authenticated;
revoke all on function public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.start_openingfit_mission_training_session(uuid,uuid,text,text,jsonb,integer,integer) to service_role;
grant execute on function public.record_openingfit_mission_training_attempt(uuid,uuid,uuid,text,text,text,text,integer,integer,timestamptz,jsonb) to service_role;
grant execute on function public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text) to service_role;

create or replace function public.openingfit_missions_schema_readiness()
returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object(
  'ready', to_regclass('public.openingfit_missions') is not null and to_regclass('public.openingfit_mission_training_sessions') is not null
    and to_regprocedure('public.transition_openingfit_mission(uuid,uuid,text,text,text,text,jsonb)') is not null
    and to_regprocedure('public.start_openingfit_mission_training_session(uuid,uuid,text,text,jsonb,integer,integer)') is not null
    and to_regprocedure('public.record_openingfit_mission_training_attempt(uuid,uuid,uuid,text,text,text,text,integer,integer,timestamptz,jsonb)') is not null
    and to_regprocedure('public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text)') is not null,
  'schemaVersion',3,
  'trainingReady',to_regclass('public.openingfit_mission_training_sessions') is not null
    and to_regprocedure('public.start_openingfit_mission_training_session(uuid,uuid,text,text,jsonb,integer,integer)') is not null
    and to_regprocedure('public.record_openingfit_mission_training_attempt(uuid,uuid,uuid,text,text,text,text,integer,integer,timestamptz,jsonb)') is not null
    and to_regprocedure('public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text)') is not null
 )
$$;
revoke all on function public.openingfit_missions_schema_readiness() from public,anon,authenticated;
grant execute on function public.openingfit_missions_schema_readiness() to service_role;

-- Rollback (manual, not executed): revoke/drop the three functions, drop attempt session FK/column, then drop the session table.
-- SOURCE MIGRATION 003 STAGE END
DO $assert$ begin if to_regprocedure('public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text)') is null or public.openingfit_missions_schema_readiness()->>'schemaVersion'<>'3' or public.openingfit_missions_schema_readiness()->>'trainingReady'<>'true' or has_function_privilege(0,to_regprocedure('public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text)'),'execute') or has_function_privilege('authenticated',to_regprocedure('public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text)'),'execute') or not has_function_privilege('service_role',to_regprocedure('public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text)'),'execute') then raise exception '003C postcondition failed'; end if; end $assert$;
COMMIT;
