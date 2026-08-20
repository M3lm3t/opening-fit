param(
  [string]$OutputPath = "release-artifacts/openingfit-retention-production-bundle.sql"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$migrationNames = @(
  "202608200001_canonical_coaching_activity.sql",
  "202608200002_save_coaching_response_plan.sql",
  "202608200003_complete_game_check.sql",
  "202608200004_meaningful_consistency.sql",
  "202608200005_weekly_coaching_reviews_and_reminders.sql"
)
$resolvedOutput = Join-Path $repoRoot $OutputPath
$outputDirectory = Split-Path -Parent $resolvedOutput
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$header = @'
-- OpeningFit retention production SQL Editor bundle
-- Target project: frtjfvhiimgruenqcuon (https://frtjfvhiimgruenqcuon.supabase.co)
-- Generated from the five immutable repository migration files listed below.
-- Run the PRECONDITION transaction first. It is read-only and intentionally raises
-- an exception when a required production prerequisite is missing.

begin;
do $preconditions$
declare
  missing text[] := array[]::text[];
begin
  if to_regclass('public.activity_history') is null then missing := array_append(missing, 'public.activity_history'); end if;
  if to_regclass('public.report_history') is null then missing := array_append(missing, 'public.report_history'); end if;
  if to_regclass('public.settings') is null then missing := array_append(missing, 'public.settings'); end if;
  if to_regclass('public.notification_preferences') is null then missing := array_append(missing, 'public.notification_preferences'); end if;
  if array_length(missing, 1) is not null then
    raise exception 'STOP: missing required production objects: %', array_to_string(missing, ', ');
  end if;
end
$preconditions$;

do $baseline_columns$
declare missing text[] := array[]::text[];
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='activity_history' and column_name='user_id') then missing := array_append(missing, 'activity_history.user_id'); end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='activity_history' and column_name='type') then missing := array_append(missing, 'activity_history.type'); end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='activity_history' and column_name='action_type') then missing := array_append(missing, 'activity_history.action_type'); end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='activity_history' and column_name='dedupe_key') then missing := array_append(missing, 'activity_history.dedupe_key'); end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='activity_history' and column_name='payload') then missing := array_append(missing, 'activity_history.payload'); end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='activity_history' and column_name='related_report_id') then missing := array_append(missing, 'activity_history.related_report_id'); end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='activity_history' and column_name='created_at') then missing := array_append(missing, 'activity_history.created_at'); end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='activity_history' and column_name='updated_at') then missing := array_append(missing, 'activity_history.updated_at'); end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='settings' and column_name='preferences') then missing := array_append(missing, 'settings.preferences'); end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='report_history' and column_name='id') then missing := array_append(missing, 'report_history.id'); end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='notification_preferences' and column_name='user_id') then missing := array_append(missing, 'notification_preferences.user_id'); end if;
  if array_length(missing, 1) is not null then raise exception 'STOP: incompatible baseline schema: %', array_to_string(missing, ', '); end if;
  if to_regclass('public.coaching_priorities') is not null and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='coaching_priorities' and column_name='user_id') then raise exception 'STOP: incompatible existing coaching_priorities'; end if;
  if to_regclass('public.coaching_game_checkpoints') is not null and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='coaching_game_checkpoints' and column_name='checked_game_ids') then raise exception 'STOP: incompatible existing coaching_game_checkpoints'; end if;
  if to_regclass('public.coaching_response_plans') is not null and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='coaching_response_plans' and column_name='plan_text') then raise exception 'STOP: incompatible existing coaching_response_plans'; end if;
  if to_regclass('public.coaching_weekly_reviews') is not null and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='coaching_weekly_reviews' and column_name='review_key') then raise exception 'STOP: incompatible existing coaching_weekly_reviews'; end if;
end
$baseline_columns$;
rollback;

-- IMPORTANT: In SQL Editor, execute each BEGIN/COMMIT migration section separately,
-- in order. Verify the section's postcondition before continuing to the next section.
'@

$postconditionByMigration = @{
  "202608200001_canonical_coaching_activity.sql" = @'
do $verify_001$
begin
  if to_regclass('public.coaching_priorities') is null or to_regclass('public.coaching_game_checkpoints') is null or to_regclass('public.coaching_response_plans') is null then raise exception 'STOP after 001: coaching tables missing'; end if;
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='coaching_priorities' and c.relrowsecurity) then raise exception 'STOP after 001: coaching_priorities RLS disabled'; end if;
  if to_regprocedure('public.record_meaningful_coaching_activity(text,text,jsonb,timestamp with time zone)') is null or to_regprocedure('public.get_current_coaching_priority()') is null or to_regprocedure('public.get_weekly_coaching_goal()') is null then raise exception 'STOP after 001: canonical functions missing'; end if;
  if not exists (select 1 from pg_trigger where tgname='protect_meaningful_coaching_activity' and not tgisinternal) then raise exception 'STOP after 001: protection trigger missing'; end if;
end
$verify_001$;
'@
  "202608200002_save_coaching_response_plan.sql" = @'
do $verify_002$ begin
  if to_regprocedure('public.save_coaching_response_plan(text,text,text,uuid,text,text)') is null then raise exception 'STOP after 002: response-plan function missing'; end if;
end $verify_002$;
'@
  "202608200003_complete_game_check.sql" = @'
do $verify_003$ begin
  if to_regprocedure('public.complete_game_check(text,text,text[],text,jsonb,text,timestamp with time zone)') is null then raise exception 'STOP after 003: Game Check function missing'; end if;
end $verify_003$;
'@
  "202608200004_meaningful_consistency.sql" = @'
do $verify_004$ begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='activity_history' and column_name='activity_local_date') then raise exception 'STOP after 004: activity_local_date missing'; end if;
  if to_regprocedure('public.coaching_timezone(uuid)') is null or to_regprocedure('public.get_meaningful_consistency()') is null or to_regprocedure('public.get_training_streak()') is null then raise exception 'STOP after 004: consistency functions missing'; end if;
end $verify_004$;
'@
  "202608200005_weekly_coaching_reviews_and_reminders.sql" = @'
do $verify_005$
declare expected text[] := array['reminders_enabled','game_check_reminders','weekly_plan_reminders','consistency_reminders','timezone','quiet_hours_start','quiet_hours_end','permission_requested_at','last_reminder_date','last_reminder_type']; missing text[];
begin
  if to_regclass('public.coaching_weekly_reviews') is null then raise exception 'STOP after 005: weekly reviews table missing'; end if;
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='coaching_weekly_reviews' and c.relrowsecurity) then raise exception 'STOP after 005: weekly reviews RLS disabled'; end if;
  select array_agg(e) into missing from unnest(expected) e where not exists (select 1 from information_schema.columns where table_schema='public' and table_name='notification_preferences' and column_name=e);
  if missing is not null then raise exception 'STOP after 005: reminder columns missing: %', array_to_string(missing, ', '); end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='notification_preferences' and column_name='reminders_enabled' and is_nullable='NO' and column_default ilike '%false%') then raise exception 'STOP after 005: reminders_enabled default is not false/non-null'; end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='coaching_weekly_reviews' and policyname='coaching_weekly_reviews_owner_all' and qual like '%user_id%auth.uid()%' and with_check like '%user_id%auth.uid()%') then raise exception 'STOP after 005: owner policy missing or incompatible'; end if;
end
$verify_005$;
'@
}

$sections = @($header)
foreach ($migrationName in $migrationNames) {
  $migrationPath = Join-Path $repoRoot "supabase/migrations/$migrationName"
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $migrationPath).Hash
  $sql = Get-Content -Raw -LiteralPath $migrationPath
  $postcondition = $postconditionByMigration[$migrationName]
  $sections += "`n-- ===== BEGIN $migrationName (SHA-256 $hash) =====`nbegin;`n$sql`n$postcondition`ncommit;`n-- ===== END $migrationName =====`n"
}

$postconditions = @'

-- FINAL READ-ONLY VERIFICATION. This returns metadata and aggregate counts only.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in (
  'coaching_priorities', 'coaching_game_checkpoints', 'coaching_response_plans',
  'coaching_weekly_reviews', 'activity_history', 'notification_preferences'
) order by c.relname;

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in (
  'coaching_priorities', 'coaching_game_checkpoints', 'coaching_response_plans',
  'coaching_weekly_reviews', 'notification_preferences'
) order by tablename, policyname;

select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and (
  (table_name = 'activity_history' and column_name in ('coaching_activity_type','occurred_at','task_id','evidence_refs','coaching_schema_version','activity_local_date')) or
  (table_name = 'notification_preferences' and column_name in ('reminders_enabled','game_check_reminders','weekly_plan_reminders','consistency_reminders','timezone','quiet_hours_start','quiet_hours_end','permission_requested_at','last_reminder_date','last_reminder_type'))
) order by table_name, ordinal_position;

select
  count(*) as notification_preference_rows,
  count(*) filter (where reminders_enabled) as reminders_enabled_rows,
  count(*) filter (where not reminders_enabled) as reminders_disabled_rows
from public.notification_preferences;

select p.proname, pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in (
  'record_meaningful_coaching_activity', 'get_current_coaching_priority',
  'get_weekly_coaching_goal', 'save_coaching_response_plan', 'complete_game_check',
  'coaching_timezone', 'get_meaningful_consistency', 'get_training_streak'
) order by p.proname, arguments;

-- Migration-history alignment is deliberately NOT included. Record versions only
-- after every SQL effect and policy above has been independently verified.
'@
$sections += $postconditions
Set-Content -LiteralPath $resolvedOutput -Value ($sections -join "`n") -Encoding utf8
Write-Output $resolvedOutput
