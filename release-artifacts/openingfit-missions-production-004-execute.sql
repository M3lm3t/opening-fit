-- PRODUCTION WARNING: target frtjfvhiimgruenqcuon only; migration 004.
-- Required: prior baseline and preceding verification passed; Missions disabled; rollout 0%; notifications disabled.
-- On failure before COMMIT the transaction should roll back. After uncertain connection failure, do not rerun; run read-only inspection first.
BEGIN;
-- Phase 6: durable projection, idempotent lifecycle measurement and atomic free allowance.
-- Additive only. Apply after 001, 002 and 003. This migration is not executed by this change.

alter table public.notification_preferences add column if not exists mission_reminders boolean not null default false;

create table public.openingfit_mission_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 mission_id uuid references public.openingfit_missions(id) on delete cascade, event_name text not null,
 deduplication_key text not null check(length(deduplication_key) between 1 and 200),
 properties jsonb not null default '{}'::jsonb check(jsonb_typeof(properties)='object' and pg_column_size(properties)<=4096),
 occurred_at timestamptz not null default now(), unique(user_id,deduplication_key)
);
create index openingfit_mission_events_recent_idx on public.openingfit_mission_events(occurred_at desc);

create table public.openingfit_mission_activity_outbox (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 mission_id uuid not null references public.openingfit_missions(id) on delete cascade,
 session_id uuid not null references public.openingfit_mission_training_sessions(id) on delete cascade,
 source_completed_at timestamptz not null, status text not null default 'pending' check(status in ('pending','projected','failed')),
 attempt_count integer not null default 0 check(attempt_count between 0 and 100), next_attempt_at timestamptz not null default now(),
 projected_activity_id uuid references public.activity_history(id) on delete set null, projected_at timestamptz,
 last_error_code text check(last_error_code is null or length(last_error_code)<=100), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,session_id)
);
create index openingfit_mission_activity_backlog_idx on public.openingfit_mission_activity_outbox(status,next_attempt_at,created_at) where status<>'projected';

create table public.openingfit_mission_allowances (
 user_id uuid primary key references auth.users(id) on delete cascade, assignment_count integer not null default 0 check(assignment_count>=0),
 last_assigned_at timestamptz, next_available_at timestamptz, updated_at timestamptz not null default now()
);

create table public.openingfit_mission_notification_candidates (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 mission_id uuid references public.openingfit_missions(id) on delete cascade, source_event_id uuid not null references public.openingfit_mission_events(id) on delete cascade,
 notification_type text not null check(notification_type in ('ready','progress','review')), status text not null default 'pending' check(status in ('pending','deferred','delivered','cancelled')),
 not_before timestamptz not null default now(), created_at timestamptz not null default now(), unique(user_id,source_event_id,notification_type)
);

do $$ declare t text; begin
 foreach t in array array['openingfit_mission_events','openingfit_mission_activity_outbox','openingfit_mission_allowances','openingfit_mission_notification_candidates'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update on public.%I to service_role',t);
 end loop;
end $$;

create policy openingfit_mission_events_select_own on public.openingfit_mission_events for select to authenticated using(auth.uid()=user_id);
create policy openingfit_mission_allowances_select_own on public.openingfit_mission_allowances for select to authenticated using(auth.uid()=user_id);
grant select on public.openingfit_mission_events,public.openingfit_mission_allowances to authenticated;

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
end $$;

-- Replaces Phase 4 completion only to append an outbox record in the same transaction.
create or replace function public.complete_openingfit_mission_training_session(p_user_id uuid,p_mission_id uuid,p_session_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.openingfit_mission_training_sessions; total integer; attempted integer; solved integer; unassisted integer; core_ok boolean; summary jsonb;
begin
 if auth.role()<>'service_role' and current_user<>'postgres' then raise exception 'Service authority required'; end if;
 select * into s from public.openingfit_mission_training_sessions where id=p_session_id and user_id=p_user_id and mission_id=p_mission_id for update;
 if s.id is null then raise exception 'Session not found'; end if;
 if s.status='completed' then return to_jsonb(s); end if;
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
 return to_jsonb(s);
end $$;

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
end $$;

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
end $$;

create or replace function public.project_openingfit_mission_session_activity(p_user_id uuid,p_session_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare outbox_id uuid;
begin
 if auth.role()<>'service_role' and current_user<>'postgres' then raise exception 'Service authority required'; end if;
 select id into outbox_id from public.openingfit_mission_activity_outbox where user_id=p_user_id and session_id=p_session_id;
 if outbox_id is null then return jsonb_build_object('status','missing','retryable',true); end if;
 return public.project_openingfit_mission_activity(outbox_id);
end $$;

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
end $$;

create or replace function public.openingfit_missions_schema_readiness() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('ready',to_regclass('public.openingfit_missions') is not null and to_regclass('public.openingfit_mission_training_sessions') is not null and to_regclass('public.openingfit_mission_activity_outbox') is not null and to_regclass('public.openingfit_mission_events') is not null,'schemaVersion',4,'trainingReady',to_regprocedure('public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text)') is not null,'activityProjectorReady',to_regprocedure('public.project_openingfit_mission_activity(uuid)') is not null,'analyticsReady',to_regprocedure('public.record_openingfit_mission_event(uuid,uuid,text,text,jsonb)') is not null,'notificationSchedulingReady',to_regclass('public.openingfit_mission_notification_candidates') is not null)
$$;

revoke all on function public.record_openingfit_mission_event(uuid,uuid,text,text,jsonb),public.project_openingfit_mission_activity(uuid),public.project_openingfit_mission_session_activity(uuid,uuid),public.assign_openingfit_mission_with_allowance(uuid,uuid,boolean,text),public.openingfit_missions_operator_diagnostics(integer) from public,anon,authenticated;
grant execute on function public.record_openingfit_mission_event(uuid,uuid,text,text,jsonb),public.project_openingfit_mission_activity(uuid),public.project_openingfit_mission_session_activity(uuid,uuid),public.assign_openingfit_mission_with_allowance(uuid,uuid,boolean,text),public.openingfit_missions_operator_diagnostics(integer) to service_role;
revoke all on function public.openingfit_missions_schema_readiness() from public,anon,authenticated; grant execute on function public.openingfit_missions_schema_readiness() to service_role;

-- Rollback (manual, not executed): restore Phase 3 readiness and Phase 4 completion, then drop Phase 6 functions and tables in reverse dependency order.

DO $assert$ begin if to_regclass('public.openingfit_mission_activity_outbox') is null or to_regclass('public.openingfit_mission_events') is null or to_regprocedure('public.project_openingfit_mission_activity(uuid)') is null or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='notification_preferences' and column_name='mission_reminders' and is_nullable='NO' and column_default='false') or (select count(*) from pg_class where oid=any(array[to_regclass('public.openingfit_mission_events'),to_regclass('public.openingfit_mission_activity_outbox'),to_regclass('public.openingfit_mission_allowances'),to_regclass('public.openingfit_mission_notification_candidates')]) and relrowsecurity)<>4 then raise exception '004 postcondition failed'; end if; end $assert$;
COMMIT;
