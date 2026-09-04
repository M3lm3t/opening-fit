-- frtjfvhiimgruenqcuon 004B; Missions disabled.
BEGIN;
DO $precondition$ begin if not (to_regclass('public.openingfit_mission_events') is not null and to_regclass('public.openingfit_mission_activity_outbox') is not null and to_regclass('public.openingfit_mission_allowances') is not null and to_regclass('public.openingfit_mission_notification_candidates') is not null and (select count(*) from pg_class where oid=any(array[to_regclass('public.openingfit_mission_events'),to_regclass('public.openingfit_mission_activity_outbox'),to_regclass('public.openingfit_mission_allowances'),to_regclass('public.openingfit_mission_notification_candidates')]) and relrowsecurity)=4 and not has_table_privilege(0,'public.openingfit_mission_events','select,insert,update,delete') and not has_table_privilege('anon','public.openingfit_mission_events','select,insert,update,delete') and has_table_privilege('authenticated','public.openingfit_mission_events','select') and not has_table_privilege('authenticated','public.openingfit_mission_events','insert,update,delete') and has_table_privilege('service_role','public.openingfit_mission_events','select,insert,update') and not has_table_privilege('service_role','public.openingfit_mission_events','delete,truncate,references,trigger') and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notification_preferences' and column_name='mission_reminders' and is_nullable='NO' and column_default='false'::text)) then raise exception '004A is required'; end if; end $precondition$;
-- SOURCE MIGRATION 004 STAGE BEGIN
create or replace function public.record_openingfit_mission_event(p_user_id uuid,p_mission_id uuid,p_event_name text,p_deduplication_key text,p_properties jsonb default '{}'::jsonb)
returns public.openingfit_mission_events language plpgsql security definer set search_path=public as $$
declare saved public.openingfit_mission_events; mission public.openingfit_missions; safe_properties jsonb;
begin
 if auth.role()<>'service_role' and current_user<>'postgres' then raise exception 'Service authority required'; end if;
 if p_event_name not in ('mission_candidate_generated','mission_candidate_rejected','mission_assigned','mission_training_started','mission_training_completed','mission_awaiting_evidence','mission_encounter_detected','mission_correct_response','mission_repeated_mistake','mission_other_legal_response','mission_improving','mission_needs_review','mission_repaired','mission_dismissed','mission_superseded','mission_activity_projected','mission_activity_projection_failed','mission_schema_unavailable','mission_processing_failed') then raise exception 'Unsupported Mission event'; end if;
 if nullif(btrim(p_deduplication_key),'') is null or length(p_deduplication_key)>200 or jsonb_typeof(coalesce(p_properties,'{}'))<>'object' or pg_column_size(coalesce(p_properties,'{}'))>4096 then raise exception 'Invalid Mission event'; end if;
 if p_mission_id is not null then select * into mission from public.openingfit_missions where id=p_mission_id and user_id=p_user_id; end if;
 safe_properties:=jsonb_build_object('status',coalesce(mission.status::text,'unknown'),'algorithmVersion',coalesce(mission.algorithm_version,'unknown'),
  'missionType',coalesce(mission.mission_type,'unknown'),'role',coalesce(mission.role,'unknown'),'confidenceBand',coalesce(mission.confidence->>'level','unknown'),
  'evidenceCount',least(50,greatest(0,coalesce(mission.baseline_evidence_count,0))),'tier',coalesce(p_properties->>'tier','unknown'),
  'cohort',coalesce(p_properties->>'cohort','unknown'))||(p_properties-'tier'-'cohort'-'evidenceCount');
 insert into public.openingfit_mission_events(user_id,mission_id,event_name,deduplication_key,properties)
 values(p_user_id,p_mission_id,p_event_name,p_deduplication_key,safe_properties)
 on conflict(user_id,deduplication_key) do nothing returning * into saved;
 if saved.id is null then select * into saved from public.openingfit_mission_events where user_id=p_user_id and deduplication_key=p_deduplication_key; end if;
 return saved;
end; $$;

-- Replaces Phase 4 completion only to append an outbox record in the same transaction.
-- SOURCE MIGRATION 004 STAGE END
revoke all on function public.record_openingfit_mission_event(uuid,uuid,text,text,jsonb) from public,anon,authenticated,service_role;
DO $assert$ begin if not (to_regprocedure('public.record_openingfit_mission_event(uuid,uuid,text,text,jsonb)') is not null and not exists(select 1 from (values(0::oid),('anon'::regrole::oid),('authenticated'::regrole::oid),('service_role'::regrole::oid))r(oid) where has_function_privilege(r.oid,to_regprocedure('public.record_openingfit_mission_event(uuid,uuid,text,text,jsonb)'),'execute'))) then raise exception '004B postcondition failed'; end if; end $assert$;
COMMIT;
