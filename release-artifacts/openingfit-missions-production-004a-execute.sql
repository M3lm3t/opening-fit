-- frtjfvhiimgruenqcuon 004A; Missions disabled.
BEGIN;
DO $precondition$ begin if public.openingfit_missions_schema_readiness()->>'schemaVersion'<>'3' then raise exception 'completed migration 003 is required'; end if; end $precondition$;
-- SOURCE MIGRATION 004 STAGE BEGIN
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
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select,insert,update on public.%I to service_role',t);
 end loop;
end; $$;

create policy openingfit_mission_events_select_own on public.openingfit_mission_events for select to authenticated using(auth.uid()=user_id);
create policy openingfit_mission_allowances_select_own on public.openingfit_mission_allowances for select to authenticated using(auth.uid()=user_id);
grant select on public.openingfit_mission_events,public.openingfit_mission_allowances to authenticated;

-- SOURCE MIGRATION 004 STAGE END
DO $assert$ begin if not (to_regclass('public.openingfit_mission_events') is not null and to_regclass('public.openingfit_mission_activity_outbox') is not null and to_regclass('public.openingfit_mission_allowances') is not null and to_regclass('public.openingfit_mission_notification_candidates') is not null and (select count(*) from pg_class where oid=any(array[to_regclass('public.openingfit_mission_events'),to_regclass('public.openingfit_mission_activity_outbox'),to_regclass('public.openingfit_mission_allowances'),to_regclass('public.openingfit_mission_notification_candidates')]) and relrowsecurity)=4 and not has_table_privilege(0,'public.openingfit_mission_events','select,insert,update,delete') and not has_table_privilege('anon','public.openingfit_mission_events','select,insert,update,delete') and has_table_privilege('authenticated','public.openingfit_mission_events','select') and not has_table_privilege('authenticated','public.openingfit_mission_events','insert,update,delete') and has_table_privilege('service_role','public.openingfit_mission_events','select,insert,update') and not has_table_privilege('service_role','public.openingfit_mission_events','delete,truncate,references,trigger') and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notification_preferences' and column_name='mission_reminders' and is_nullable='NO' and column_default='false'::text)) then raise exception '004A postcondition failed'; end if; end $assert$;
COMMIT;
