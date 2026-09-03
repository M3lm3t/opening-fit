-- PRODUCTION WARNING: target frtjfvhiimgruenqcuon; SQL Editor split stage 003A.
-- Missions must remain disabled. Never rerun migrations 001 or 002.
BEGIN;
DO $precondition$ begin if to_regprocedure('public.openingfit_missions_schema_readiness()') is null or public.openingfit_missions_schema_readiness() is distinct from jsonb_build_object('ready',true,'schemaVersion',1) then raise exception 'completed migrations 001 and 002 are required'; end if; end $precondition$;
-- SOURCE MIGRATION 003 STAGE BEGIN
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
revoke all on public.openingfit_mission_training_sessions from service_role;
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
end;
$$;
create trigger openingfit_protect_training_session before update on public.openingfit_mission_training_sessions
for each row execute function public.openingfit_protect_training_session();

-- SOURCE MIGRATION 003 STAGE END
DO $assert$ begin if to_regclass('public.openingfit_mission_training_sessions') is null or not (select relrowsecurity from pg_class where oid=to_regclass('public.openingfit_mission_training_sessions')) or not exists(select 1 from pg_constraint where conrelid=to_regclass('public.openingfit_mission_training_attempts') and conname='openingfit_attempt_session_owner_fk') or not exists(select 1 from pg_trigger where tgrelid=to_regclass('public.openingfit_mission_training_sessions') and tgname='openingfit_protect_training_session' and not tgisinternal) or has_table_privilege('anon','public.openingfit_mission_training_sessions','select') or has_table_privilege('authenticated','public.openingfit_mission_training_sessions','insert') or not has_table_privilege('service_role','public.openingfit_mission_training_sessions','select,insert,update') then raise exception '003A postcondition failed'; end if; end $assert$;
COMMIT;
