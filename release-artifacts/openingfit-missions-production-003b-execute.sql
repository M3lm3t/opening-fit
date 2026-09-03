-- PRODUCTION WARNING: target frtjfvhiimgruenqcuon; SQL Editor split stage 003B.
-- Missions must remain disabled. Never rerun migrations 001 or 002.
BEGIN;
DO $precondition$ begin if not (to_regclass('public.openingfit_mission_training_sessions') is not null and (select relrowsecurity from pg_class where oid=to_regclass('public.openingfit_mission_training_sessions')) and exists(select 1 from pg_constraint where conrelid=to_regclass('public.openingfit_mission_training_attempts') and conname='openingfit_attempt_session_owner_fk') and exists(select 1 from pg_policies where schemaname='public' and tablename='openingfit_mission_training_sessions' and policyname='openingfit_mission_training_sessions_select_own' and cmd='SELECT' and roles=array['authenticated']::name[]) and exists(select 1 from pg_trigger where tgrelid=to_regclass('public.openingfit_mission_training_sessions') and tgname='openingfit_protect_training_session' and not tgisinternal) and not has_table_privilege(0,'public.openingfit_mission_training_sessions','select,insert,update,delete') and not has_table_privilege('anon','public.openingfit_mission_training_sessions','select,insert,update,delete') and has_table_privilege('authenticated','public.openingfit_mission_training_sessions','select') and not has_table_privilege('authenticated','public.openingfit_mission_training_sessions','insert,update,delete') and has_table_privilege('service_role','public.openingfit_mission_training_sessions','select,insert,update') and not has_table_privilege('service_role','public.openingfit_mission_training_sessions','delete,truncate,references,trigger')) then raise exception '003A is required'; end if; end $precondition$;
-- SOURCE MIGRATION 003 STAGE BEGIN
create or replace function public.start_openingfit_mission_training_session(
 p_user_id uuid,p_mission_id uuid,p_session_key text,p_exercise_set_version text,p_exercise_manifest jsonb,
 p_required_exercise_count integer,p_required_correct_count integer
) returns jsonb language plpgsql security definer set search_path=public as $$
declare m public.openingfit_missions; s public.openingfit_mission_training_sessions; was_resumed boolean:=false;
begin
 if auth.role()<>'service_role' and current_user<>'postgres' then raise exception 'Service authority required'; end if;
 if nullif(btrim(p_session_key),'') is null or length(p_session_key)>200 then raise exception 'Invalid idempotency key'; end if;
 select * into m from public.openingfit_missions where id=p_mission_id and user_id=p_user_id for update;
 if m.id is null then raise exception 'Mission not found'; end if;
 select * into s from public.openingfit_mission_training_sessions where user_id=p_user_id and session_key=p_session_key;
 if s.id is not null then
   if s.mission_id<>p_mission_id then raise exception 'Idempotency key conflict'; end if;
   return to_jsonb(s)||jsonb_build_object('resumed',true);
 end if;
 select * into s from public.openingfit_mission_training_sessions where user_id=p_user_id and mission_id=p_mission_id and status='active' for update;
 if s.id is not null then return to_jsonb(s)||jsonb_build_object('resumed',true); end if;
 if m.status not in ('assigned','learning','needs_review') then raise exception 'Mission not trainable'; end if;
 if jsonb_typeof(p_exercise_manifest)<>'array' or jsonb_array_length(p_exercise_manifest) not between 1 and 5 then raise exception 'Training material unavailable'; end if;
 insert into public.openingfit_mission_training_sessions(user_id,mission_id,session_key,exercise_set_version,exercise_manifest,required_exercise_count,required_correct_count)
 values(p_user_id,p_mission_id,btrim(p_session_key),p_exercise_set_version,p_exercise_manifest,p_required_exercise_count,p_required_correct_count) returning * into s;
 if m.status in ('assigned','needs_review') then
   perform public.transition_openingfit_mission(p_user_id,p_mission_id,'learning','training_session_started',s.id::text,'session-start:'||p_session_key,'{}'::jsonb);
 end if;
 return to_jsonb(s)||jsonb_build_object('resumed',was_resumed);
end;
$$;

create or replace function public.record_openingfit_mission_training_attempt(
 p_user_id uuid,p_mission_id uuid,p_session_id uuid,p_exercise_key text,p_attempt_key text,p_attempted_move_uci text,
 p_result text,p_review_number integer,p_interval_days integer,p_due_at timestamptz,p_validation_evidence jsonb
) returns public.openingfit_mission_training_attempts language plpgsql security definer set search_path=public as $$
declare s public.openingfit_mission_training_sessions; a public.openingfit_mission_training_attempts;
begin
 if auth.role()<>'service_role' and current_user<>'postgres' then raise exception 'Service authority required'; end if;
 select * into s from public.openingfit_mission_training_sessions where id=p_session_id and user_id=p_user_id and mission_id=p_mission_id for update;
 if s.id is null then raise exception 'Session not found'; end if;
 select * into a from public.openingfit_mission_training_attempts where user_id=p_user_id and mission_id=p_mission_id and attempt_key=p_attempt_key;
 if a.id is not null then
   if a.session_id<>p_session_id or a.exercise_key<>p_exercise_key or a.attempted_move_uci<>p_attempted_move_uci then raise exception 'Idempotency key conflict'; end if;
   return a;
 end if;
 if s.status<>'active' then raise exception 'Session not active'; end if;
 if not exists(select 1 from jsonb_array_elements(s.exercise_manifest) e where e->>'exerciseKey'=p_exercise_key) then raise exception 'Exercise not in session'; end if;
 if p_result not in ('correct','incorrect') then raise exception 'Invalid result'; end if;
 insert into public.openingfit_mission_training_attempts(user_id,mission_id,session_id,exercise_key,session_key,attempt_key,attempted_move_uci,result,assistance_used,review_number,due_at,interval_days,validation_evidence)
 values(p_user_id,p_mission_id,p_session_id,p_exercise_key,p_session_id::text,p_attempt_key,p_attempted_move_uci,p_result,false,p_review_number,p_due_at,p_interval_days,coalesce(p_validation_evidence,'{}')) returning * into a;
 update public.openingfit_mission_training_sessions set last_activity_at=now(),updated_at=now() where id=s.id;
 return a;
end;
$$;

-- SOURCE MIGRATION 003 STAGE END
revoke all on function public.start_openingfit_mission_training_session(uuid,uuid,text,text,jsonb,integer,integer), public.record_openingfit_mission_training_attempt(uuid,uuid,uuid,text,text,text,text,integer,integer,timestamptz,jsonb) from public,anon,authenticated,service_role;
DO $assert$ begin if not ((select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['start_openingfit_mission_training_session','record_openingfit_mission_training_attempt']))=2 and exists(select 1 from pg_proc where oid=to_regprocedure('public.start_openingfit_mission_training_session(uuid,uuid,text,text,jsonb,integer,integer)') and prorettype=to_regtype('jsonb') and prosecdef and proconfig @> array['search_path=public']) and exists(select 1 from pg_proc where oid=to_regprocedure('public.record_openingfit_mission_training_attempt(uuid,uuid,uuid,text,text,text,text,integer,integer,timestamptz,jsonb)') and prorettype=to_regtype('public.openingfit_mission_training_attempts') and prosecdef and proconfig @> array['search_path=public']) and not exists(select 1 from (values(0::oid),('anon'::regrole::oid),('authenticated'::regrole::oid),('service_role'::regrole::oid)) r(oid) cross join (values(to_regprocedure('public.start_openingfit_mission_training_session(uuid,uuid,text,text,jsonb,integer,integer)')), (to_regprocedure('public.record_openingfit_mission_training_attempt(uuid,uuid,uuid,text,text,text,text,integer,integer,timestamptz,jsonb)'))) f(oid) where has_function_privilege(r.oid,f.oid,'execute')) and to_regprocedure('public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text)') is null and public.openingfit_missions_schema_readiness() is not distinct from jsonb_build_object('ready',true,'schemaVersion',1)) then raise exception '003B postcondition failed'; end if; end $assert$;
COMMIT;
