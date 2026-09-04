-- frtjfvhiimgruenqcuon 004E; Missions disabled.
BEGIN;
DO $precondition$ begin if not (to_regprocedure('public.project_openingfit_mission_activity(uuid)') is not null and to_regprocedure('public.assign_openingfit_mission_with_allowance(uuid,uuid,boolean,text)') is not null and not exists(select 1 from (values(0::oid),('anon'::regrole::oid),('authenticated'::regrole::oid),('service_role'::regrole::oid))r(oid) cross join(values(to_regprocedure('public.project_openingfit_mission_activity(uuid)')),(to_regprocedure('public.assign_openingfit_mission_with_allowance(uuid,uuid,boolean,text)')))f(oid) where has_function_privilege(r.oid,f.oid,'execute'))) then raise exception '004D required'; end if; end $precondition$;
-- SOURCE MIGRATION 004 STAGE BEGIN
create or replace function public.project_openingfit_mission_session_activity(p_user_id uuid,p_session_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare outbox_id uuid;
begin
 if auth.role()<>'service_role' and current_user<>'postgres' then raise exception 'Service authority required'; end if;
 select id into outbox_id from public.openingfit_mission_activity_outbox where user_id=p_user_id and session_id=p_session_id;
 if outbox_id is null then return jsonb_build_object('status','missing','retryable',true); end if;
 return public.project_openingfit_mission_activity(outbox_id);
end; $$;

create or replace function public.openingfit_missions_operator_diagnostics(p_window_hours integer default 24)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare hours integer:=least(168,greatest(1,coalesce(p_window_hours,24))); result jsonb;
begin
 if auth.role()<>'service_role' and current_user<>'postgres' then raise exception 'Service authority required'; end if;
 select jsonb_build_object('windowHours',hours,'schemaVersion',4,'activityProjectorReady',true,'analyticsReady',true,'notificationSchedulingReady',true,
  'events',(select coalesce(jsonb_object_agg(event_name,total),'{}') from(select event_name,count(*) total from public.openingfit_mission_events where occurred_at>=now()-make_interval(hours=>hours) group by event_name)e),
  'activeByStatus',(select coalesce(jsonb_object_agg(status,total),'{}') from(select status,count(*) total from public.openingfit_missions where updated_at>=now()-make_interval(hours=>hours) group by status)s),
  'projectionBacklog',(select count(*) from public.openingfit_mission_activity_outbox where status<>'projected'),
  'oldestProjectionBacklogAt',(select min(created_at) from public.openingfit_mission_activity_outbox where status<>'projected'),
  'lastSuccessfulProcessingAt',(select max(projected_at) from public.openingfit_mission_activity_outbox where status='projected')) into result;
 return result;
end; $$;

create or replace function public.openingfit_missions_schema_readiness() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('ready',to_regclass('public.openingfit_missions') is not null and to_regclass('public.openingfit_mission_training_sessions') is not null and to_regclass('public.openingfit_mission_activity_outbox') is not null and to_regclass('public.openingfit_mission_events') is not null,'schemaVersion',4,'trainingReady',to_regprocedure('public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text)') is not null,'activityProjectorReady',to_regprocedure('public.project_openingfit_mission_activity(uuid)') is not null,'analyticsReady',to_regprocedure('public.record_openingfit_mission_event(uuid,uuid,text,text,jsonb)') is not null,'notificationSchedulingReady',to_regclass('public.openingfit_mission_notification_candidates') is not null)
$$;

revoke all on function public.record_openingfit_mission_event(uuid,uuid,text,text,jsonb),public.project_openingfit_mission_activity(uuid),public.project_openingfit_mission_session_activity(uuid,uuid),public.assign_openingfit_mission_with_allowance(uuid,uuid,boolean,text),public.openingfit_missions_operator_diagnostics(integer) from public,anon,authenticated;
grant execute on function public.record_openingfit_mission_event(uuid,uuid,text,text,jsonb),public.project_openingfit_mission_activity(uuid),public.project_openingfit_mission_session_activity(uuid,uuid),public.assign_openingfit_mission_with_allowance(uuid,uuid,boolean,text),public.openingfit_missions_operator_diagnostics(integer) to service_role;
revoke all on function public.openingfit_missions_schema_readiness() from public,anon,authenticated; grant execute on function public.openingfit_missions_schema_readiness() to service_role;

-- Rollback (manual, not executed): restore Phase 3 readiness and Phase 4 completion, then drop Phase 6 functions and tables in reverse dependency order.
-- SOURCE MIGRATION 004 STAGE END
grant execute on function public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text) to service_role;
DO $assert$ begin if not (public.openingfit_missions_schema_readiness()->>'schemaVersion'='4' and public.openingfit_missions_schema_readiness()->>'activityProjectorReady'='true' and (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['record_openingfit_mission_event','complete_openingfit_mission_training_session','project_openingfit_mission_activity','project_openingfit_mission_session_activity','assign_openingfit_mission_with_allowance','openingfit_missions_operator_diagnostics','openingfit_missions_schema_readiness']))=7 and not exists(select 1 from pg_proc p where p.oid=any(array[to_regprocedure('public.record_openingfit_mission_event(uuid,uuid,text,text,jsonb)'),to_regprocedure('public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text)'),to_regprocedure('public.project_openingfit_mission_activity(uuid)'),to_regprocedure('public.project_openingfit_mission_session_activity(uuid,uuid)'),to_regprocedure('public.assign_openingfit_mission_with_allowance(uuid,uuid,boolean,text)'),to_regprocedure('public.openingfit_missions_operator_diagnostics(integer)'),to_regprocedure('public.openingfit_missions_schema_readiness()')]) and (not p.prosecdef or not p.proconfig @> array['search_path=public'])) and not exists(select 1 from (values(0::oid),('anon'::regrole::oid),('authenticated'::regrole::oid))r(oid) cross join(values(to_regprocedure('public.record_openingfit_mission_event(uuid,uuid,text,text,jsonb)')),(to_regprocedure('public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text)')),(to_regprocedure('public.project_openingfit_mission_activity(uuid)')),(to_regprocedure('public.project_openingfit_mission_session_activity(uuid,uuid)')),(to_regprocedure('public.assign_openingfit_mission_with_allowance(uuid,uuid,boolean,text)')),(to_regprocedure('public.openingfit_missions_operator_diagnostics(integer)')),(to_regprocedure('public.openingfit_missions_schema_readiness()')))f(oid) where has_function_privilege(r.oid,f.oid,'execute')) and not exists(select 1 from (values(to_regprocedure('public.record_openingfit_mission_event(uuid,uuid,text,text,jsonb)')),(to_regprocedure('public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text)')),(to_regprocedure('public.project_openingfit_mission_activity(uuid)')),(to_regprocedure('public.project_openingfit_mission_session_activity(uuid,uuid)')),(to_regprocedure('public.assign_openingfit_mission_with_allowance(uuid,uuid,boolean,text)')),(to_regprocedure('public.openingfit_missions_operator_diagnostics(integer)')),(to_regprocedure('public.openingfit_missions_schema_readiness()')))f(oid) where not has_function_privilege('service_role',f.oid,'execute'))) then raise exception '004E postcondition failed'; end if; end $assert$;
COMMIT;
