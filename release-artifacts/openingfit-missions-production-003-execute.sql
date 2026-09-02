-- PRODUCTION WARNING: target frtjfvhiimgruenqcuon only; migration 003.
-- Required: prior baseline and preceding verification passed; Missions disabled; rollout 0%; notifications disabled.
-- On failure before COMMIT the transaction should roll back. After uncertain connection failure, do not rerun; run read-only inspection first.
BEGIN;
-- Phase 4: server-authoritative, resumable Mission training. Apply after 001 and 002.
create table public.openingfit_mission_training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id uuid not null,
  session_key text not null check (length(session_key) between 1 and 200),
  status text not null default 'active' check (status in ('active','completed')),
  exercise_set_version text not null,
  exercise_manifest jsonb not null check (jsonb_typeof(exercise_manifest)='array' and jsonb_array_length(exercise_manifest) between 1 and 5 and pg_column_size(exercise_manifest)<=32768),
  required_exercise_count integer not null check (required_exercise_count between 1 and 5),
  required_correct_count integer not null check (required_correct_count between 1 and 5),
  assistance_policy text not null default 'disabled' check (assistance_policy='disabled'),
  completion_summary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  completed_at timestamptz,
  meaningful_activity_recorded_at timestamptz,
  completion_idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id,mission_id), unique(user_id,session_key),
  foreign key(mission_id,user_id) references public.openingfit_missions(id,user_id) on delete cascade
);
create unique index openingfit_mission_one_active_training_session_idx
on public.openingfit_mission_training_sessions(user_id,mission_id) where status='active';
create index openingfit_mission_training_session_history_idx
on public.openingfit_mission_training_sessions(user_id,mission_id,created_at desc);

alter table public.openingfit_mission_training_attempts add column session_id uuid;
alter table public.openingfit_mission_training_attempts add constraint openingfit_attempt_session_owner_fk
foreign key(session_id,user_id,mission_id) references public.openingfit_mission_training_sessions(id,user_id,mission_id) on delete cascade;
create index openingfit_mission_attempt_session_idx on public.openingfit_mission_training_attempts(user_id,session_id,created_at);

alter table public.openingfit_mission_training_sessions enable row level security;
create policy openingfit_mission_training_sessions_select_own on public.openingfit_mission_training_sessions
for select to authenticated using(auth.uid()=user_id);
revoke all on public.openingfit_mission_training_sessions from public,anon,authenticated;
grant select on public.openingfit_mission_training_sessions to authenticated;
grant select,insert,update on public.openingfit_mission_training_sessions to service_role;
revoke insert,update,delete on public.openingfit_mission_training_sessions from authenticated;
revoke insert,update,delete on public.openingfit_mission_training_attempts from authenticated;

create or replace function public.openingfit_protect_training_session()
returns trigger language plpgsql set search_path=public as $$
begin
 if new.user_id is distinct from old.user_id or new.mission_id is distinct from old.mission_id
    or new.session_key is distinct from old.session_key or new.exercise_set_version is distinct from old.exercise_set_version
    or new.exercise_manifest is distinct from old.exercise_manifest or new.required_exercise_count is distinct from old.required_exercise_count
    or new.required_correct_count is distinct from old.required_correct_count or new.assistance_policy is distinct from old.assistance_policy then
   raise exception 'Training session identity and manifest are immutable';
 end if;
 if (new.status is distinct from old.status or new.completed_at is distinct from old.completed_at
     or new.meaningful_activity_recorded_at is distinct from old.meaningful_activity_recorded_at
     or new.completion_idempotency_key is distinct from old.completion_idempotency_key)
    and coalesce(current_setting('openingfit.training_transition',true),'')<>'allowed' then
   raise exception 'Training completion must use protected authority';
 end if;
 new.updated_at:=now();
 return new;
end $$;
create trigger openingfit_protect_training_session before update on public.openingfit_mission_training_sessions
for each row execute function public.openingfit_protect_training_session();

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
end $$;

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
end $$;

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
end $$;

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

DO $assert$ begin if to_regclass('public.openingfit_mission_training_sessions') is null or not (select relrowsecurity from pg_class where oid=to_regclass('public.openingfit_mission_training_sessions')) or to_regprocedure('public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text)') is null or not exists(select 1 from pg_constraint where conrelid=to_regclass('public.openingfit_mission_training_attempts') and conname='openingfit_attempt_session_owner_fk') then raise exception '003 postcondition failed'; end if; end $assert$;
COMMIT;
