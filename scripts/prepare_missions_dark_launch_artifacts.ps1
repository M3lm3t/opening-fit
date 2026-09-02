$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'release-artifacts'
$project = 'frtjfvhiimgruenqcuon'
$expected = @{
  '001'='59D2FD81213240A4B98B4AE5A467B6830825B69448BA29AB87B0E03490A2E352'
  '002'='8EE99CA86E2DB640FD378ABA2F21CC24BE7E209F0DED2691B20AFA4A2A7519BA'
  '003'='64BF2C323496F7857C9B0CD6ACA8D7397D0BC1768E058A3A67769CED58169A5F'
  '004'='29137DC5989F57BCB641663E059DCB9F5BC208228999657921F1900D13EA8AEB'
}
$sources = @{
  '001'='202608310001_openingfit_missions_foundation.sql'; '002'='202608310002_openingfit_missions_readiness.sql'
  '003'='202608310003_openingfit_mission_training.sql'; '004'='202608310004_openingfit_missions_rollout.sql'
}
function Write-Utf8($path, $text) { [IO.File]::WriteAllText($path, ($text.TrimEnd()+"`n"), [Text.UTF8Encoding]::new($false)) }
foreach($n in $sources.Keys) {
  $path=Join-Path $root "supabase/migrations/$($sources[$n])"
  if((Get-FileHash -Algorithm SHA256 $path).Hash -ne $expected[$n]) { throw "Migration $n checksum mismatch" }
  $sql=[IO.File]::ReadAllText($path)
  if($sql -match '(?im)^\s*(create\s+index\s+concurrently|vacuum|alter\s+type)') { throw "Migration $n contains a non-transactional statement" }
  $assert = switch($n) {
    '001' { "if to_regclass('public.openingfit_missions') is null or to_regclass('public.openingfit_mission_training_attempts') is null or to_regclass('public.openingfit_mission_encounters') is null or to_regclass('public.openingfit_mission_status_events') is null or to_regprocedure('public.transition_openingfit_mission(uuid,uuid,text,text,text,text,jsonb)') is null or (select count(*) from pg_class where oid=any(array[to_regclass('public.openingfit_missions'),to_regclass('public.openingfit_mission_training_attempts'),to_regclass('public.openingfit_mission_encounters'),to_regclass('public.openingfit_mission_status_events')]) and relrowsecurity)<>4 then raise exception '001 postcondition failed'; end if;" }
    '002' { "if not exists(select 1 from pg_proc where oid=to_regprocedure('public.openingfit_missions_schema_readiness()') and prosecdef and proconfig @> array['search_path=public']) then raise exception '002 postcondition failed'; end if;" }
    '003' { "if to_regclass('public.openingfit_mission_training_sessions') is null or not (select relrowsecurity from pg_class where oid=to_regclass('public.openingfit_mission_training_sessions')) or to_regprocedure('public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text)') is null or not exists(select 1 from pg_constraint where conrelid=to_regclass('public.openingfit_mission_training_attempts') and conname='openingfit_attempt_session_owner_fk') then raise exception '003 postcondition failed'; end if;" }
    '004' { "if to_regclass('public.openingfit_mission_activity_outbox') is null or to_regclass('public.openingfit_mission_events') is null or to_regprocedure('public.project_openingfit_mission_activity(uuid)') is null or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='notification_preferences' and column_name='mission_reminders' and is_nullable='NO' and column_default='false') or (select count(*) from pg_class where oid=any(array[to_regclass('public.openingfit_mission_events'),to_regclass('public.openingfit_mission_activity_outbox'),to_regclass('public.openingfit_mission_allowances'),to_regclass('public.openingfit_mission_notification_candidates')]) and relrowsecurity)<>4 then raise exception '004 postcondition failed'; end if;" }
  }
  $header="-- PRODUCTION WARNING: target $project only; migration $n.`n-- Required: prior baseline and preceding verification passed; Missions disabled; rollout 0%; notifications disabled.`n-- On failure before COMMIT the transaction should roll back. After uncertain connection failure, do not rerun; run read-only inspection first.`nBEGIN;`n"
  $tail="`nDO `$assert`$ begin $assert end `$assert`$;`nCOMMIT;"
  Write-Utf8 (Join-Path $out "openingfit-missions-production-$n-execute.sql") ($header+$sql+$tail)
}

# SQL Editor-safe split of 001. Boundaries are checksum-locked and occur only
# after complete statements: base objects; access/protection; lifecycle RPCs.
$source001=Join-Path $root 'supabase/migrations/202608310001_openingfit_missions_foundation.sql'
$lines=[IO.File]::ReadAllLines($source001)
if($lines.Count -ne 251){throw 'Migration 001 line contract changed'}
$stages = @(
  @{Name='001a'; From=0; To=119; Requires="select 1"; Assert="if to_regclass('public.openingfit_missions') is null or to_regclass('public.openingfit_mission_training_attempts') is null or to_regclass('public.openingfit_mission_encounters') is null or to_regclass('public.openingfit_mission_status_events') is null or (select count(*) from pg_indexes where schemaname='public' and indexname like 'openingfit_mission%')<>8 then raise exception '001A postcondition failed'; end if;"},
  @{Name='001b'; From=120; To=184; Requires="if to_regclass('public.openingfit_missions') is null then raise exception '001A is required'; end if;"; Assert="if (select count(*) from pg_class where oid=any(array[to_regclass('public.openingfit_missions'),to_regclass('public.openingfit_mission_training_attempts'),to_regclass('public.openingfit_mission_encounters'),to_regclass('public.openingfit_mission_status_events')]) and relrowsecurity)<>4 or (select count(*) from pg_policies where schemaname='public' and policyname like 'openingfit_mission%select_own')<>4 or not exists(select 1 from pg_trigger where tgrelid=to_regclass('public.openingfit_missions') and tgname='openingfit_protect_mission_identity' and not tgisinternal) then raise exception '001B postcondition failed'; end if;"},
  @{Name='001c'; From=185; To=250; Requires="if not exists(select 1 from pg_trigger where tgrelid=to_regclass('public.openingfit_missions') and tgname='openingfit_protect_mission_identity' and not tgisinternal) then raise exception '001B is required'; end if;"; Assert="if not exists(select 1 from pg_proc where oid=to_regprocedure('public.transition_openingfit_mission(uuid,uuid,text,text,text,text,jsonb)') and prosecdef and proconfig @> array['search_path=public']) or not exists(select 1 from pg_proc where oid=to_regprocedure('public.dismiss_openingfit_mission(uuid,text,text)') and prosecdef and proconfig @> array['search_path=public']) or has_function_privilege('public',to_regprocedure('public.transition_openingfit_mission(uuid,uuid,text,text,text,text,jsonb)'),'execute') or has_function_privilege('anon',to_regprocedure('public.dismiss_openingfit_mission(uuid,text,text)'),'execute') then raise exception '001C postcondition failed'; end if;"}
)
foreach($stage in $stages){
 $body=($lines[$stage.From..$stage.To] -join "`n")+"`n"
 $warning="-- PRODUCTION WARNING: target $project only; split stage $($stage.Name.ToUpper()).`n-- Required prior-stage verification must pass. Missions disabled; rollout 0%; notifications disabled.`n-- Do not rerun after an uncertain failure; inspect this stage read-only first.`nBEGIN;`nDO `$precondition`$ begin $($stage.Requires) end `$precondition`$;`n-- SOURCE MIGRATION 001 STAGE BEGIN`n"
 $ending="-- SOURCE MIGRATION 001 STAGE END`nDO `$assert`$ begin $($stage.Assert) end `$assert`$;`nCOMMIT;"
 Write-Utf8 (Join-Path $out "openingfit-missions-production-$($stage.Name)-execute.sql") ($warning+$body+$ending)
}

$baseline=@'
-- READ ONLY. Production Mission baseline. Run each numbered SELECT independently.
-- 1. Dependencies and every expected relation.
select name, to_regclass(name) as object from unnest(array['auth.users','public.report_history','public.activity_history','public.notification_preferences','public.openingfit_missions','public.openingfit_mission_training_attempts','public.openingfit_mission_encounters','public.openingfit_mission_status_events','public.openingfit_mission_training_sessions','public.openingfit_mission_events','public.openingfit_mission_activity_outbox','public.openingfit_mission_allowances','public.openingfit_mission_notification_candidates']) name;
-- 2. Expected procedures and collision signatures.
select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) arguments,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%openingfit_mission%' order by 2,3;
-- 3. Existing Mission columns and types.
select table_name,column_name,data_type,udt_name,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name like 'openingfit_mission%' order by table_name,ordinal_position;
-- 4. Constraints and foreign keys.
select c.conrelid::regclass table_name,c.conname,c.contype,pg_get_constraintdef(c.oid) definition from pg_constraint c where c.connamespace='public'::regnamespace and c.conrelid::regclass::text like 'openingfit_mission%' order by 1,2;
-- 5. Indexes.
select tablename,indexname,indexdef from pg_indexes where schemaname='public' and tablename like 'openingfit_mission%' order by 1,2;
-- 6. RLS and policies.
select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'openingfit_mission%' order by 1;
select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' and tablename like 'openingfit_mission%' order by 1,2;
-- 7. Table grants.
select table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and table_name like 'openingfit_mission%' order by 1,2,3;
-- 8. Function definitions and execution authority.
select p.proname,pg_get_function_identity_arguments(p.oid) arguments,p.prosecdef,p.proconfig,has_function_privilege('public',p.oid,'execute') public_execute,has_function_privilege('anon',p.oid,'execute') anon_execute,has_function_privilege('authenticated',p.oid,'execute') authenticated_execute,has_function_privilege('service_role',p.oid,'execute') service_execute,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%openingfit_mission%' order by 1,2;
-- 9. Triggers.
select event_object_table,trigger_name,action_timing,event_manipulation,action_statement from information_schema.triggers where event_object_schema='public' and event_object_table like 'openingfit_mission%' order by 1,2;
-- 10. Reminder column and migration-history metadata.
select column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name='notification_preferences' and column_name='mission_reminders';
select version,name from supabase_migrations.schema_migrations where version in ('202608310001','202608310002','202608310003','202608310004') order by version;
-- 11. Safe aggregate counts for existing Mission tables.
select c.relname as table_name,c.reltuples::bigint as estimated_rows from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'openingfit_mission%' order by 1;
-- 12. Compatibility required by 004.
select table_name,column_name,data_type from information_schema.columns where table_schema='public' and ((table_name='activity_history' and column_name in ('id','user_id','type','action_type','coaching_activity_type','dedupe_key','payload','evidence_refs','occurred_at','activity_local_date','updated_at')) or (table_name='notification_preferences' and column_name='user_id')) order by 1,2;
select to_regprocedure('public.coaching_timezone(uuid)') coaching_timezone;
-- 13. Classification aid only; definitions still require manual comparison.
select case when count(*)=0 then 'no_mission_objects_present' when count(*)=9 then 'apparently_complete' else 'partially_present' end classification from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname=any(array['openingfit_missions','openingfit_mission_training_attempts','openingfit_mission_encounters','openingfit_mission_status_events','openingfit_mission_training_sessions','openingfit_mission_events','openingfit_mission_activity_outbox','openingfit_mission_allowances','openingfit_mission_notification_candidates']);
'@
Write-Utf8 (Join-Path $out 'openingfit-missions-production-baseline-inspection.sql') $baseline

function Verification($n,$relations,$procedures,$notes) {
@"
-- READ ONLY. Migration $n verification. Run each numbered SELECT independently.
-- 1. Relations and exact columns.
select name,to_regclass('public.'||name) object from unnest(array[$relations]) name;
select table_name,column_name,data_type,udt_name,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name=any(array[$relations]) order by 1,ordinal_position;
-- 2. Constraints, foreign keys and idempotency.
select c.conrelid::regclass table_name,c.conname,c.contype,pg_get_constraintdef(c.oid) definition from pg_constraint c where c.conrelid=any(array[$relations]::regclass[]) order by 1,2;
-- 3. Indexes, including partial uniqueness.
select tablename,indexname,indexdef from pg_indexes where schemaname='public' and tablename=any(array[$relations]) order by 1,2;
-- 4. RLS, policies and direct grants.
select c.relname,c.relrowsecurity from pg_class c join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' and c.relname=any(array[$relations]) order by 1;
select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' and tablename=any(array[$relations]) order by 1,2;
select table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and table_name=any(array[$relations]) order by 1,2,3;
-- 5. Procedure security, safe search path, exact definitions and grants.
select p.proname,pg_get_function_identity_arguments(p.oid) arguments,p.prosecdef,p.proconfig,has_function_privilege('public',p.oid,'execute') public_execute,has_function_privilege('anon',p.oid,'execute') anon_execute,has_function_privilege('authenticated',p.oid,'execute') authenticated_execute,has_function_privilege('service_role',p.oid,'execute') service_execute,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='public' and p.proname=any(array[$procedures]) order by 1,2;
-- 6. Triggers and safe aggregate estimates.
select event_object_table,trigger_name,action_timing,event_manipulation,action_statement from information_schema.triggers where event_object_schema='public' and event_object_table=any(array[$relations]) order by 1,2;
select c.relname,c.reltuples::bigint estimated_rows from pg_class c join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' and c.relname=any(array[$relations]) order by 1;
-- Expected results: $notes
"@
}
Write-Utf8 (Join-Path $out 'openingfit-missions-production-001-verification.sql') (Verification '001' "'openingfit_missions','openingfit_mission_training_attempts','openingfit_mission_encounters','openingfit_mission_status_events'" "'openingfit_protect_mission_identity','transition_openingfit_mission','dismiss_openingfit_mission'" 'four tables; owner FKs; one-primary index; owner SELECT only; protected transition; authenticated dismiss only')
Write-Utf8 (Join-Path $out 'openingfit-missions-production-002-verification.sql') (Verification '002' "'openingfit_missions'" "'openingfit_missions_schema_readiness'" 'exact zero-argument readiness; SECURITY DEFINER; search_path=public; service_role execute only')
Write-Utf8 (Join-Path $out 'openingfit-missions-production-003-verification.sql') (Verification '003' "'openingfit_mission_training_sessions','openingfit_mission_training_attempts'" "'openingfit_protect_training_session','start_openingfit_mission_training_session','record_openingfit_mission_training_attempt','complete_openingfit_mission_training_session','openingfit_missions_schema_readiness'" 'session ownership FK; one active session; immutable manifest trigger; service-only mutation; readiness schemaVersion 3 in definition')
$v4=Verification '004' "'openingfit_mission_events','openingfit_mission_activity_outbox','openingfit_mission_allowances','openingfit_mission_notification_candidates'" "'record_openingfit_mission_event','complete_openingfit_mission_training_session','project_openingfit_mission_activity','project_openingfit_mission_session_activity','assign_openingfit_mission_with_allowance','openingfit_missions_operator_diagnostics','openingfit_missions_schema_readiness'" 'four tables; event/session dedupe; allowance PK; service-only mutation; readiness schemaVersion 4 in definition'
$v4 += "`n-- 7. Reminder opt-in default.`nselect column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name='notification_preferences' and column_name='mission_reminders';"
Write-Utf8 (Join-Path $out 'openingfit-missions-production-004-verification.sql') $v4

function StageVerification($name,$relations,$procedures,$completeTest,$expected){
@"
-- READ ONLY. Split stage $($name.ToUpper()) verification. Run each numbered SELECT independently.
-- 1. Stage relations, columns and constraints.
select name,to_regclass('public.'||name) object from unnest(array[$relations]) name;
select table_name,column_name,data_type,udt_name,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name=any(array[$relations]) order by 1,ordinal_position;
select c.conrelid::regclass,c.conname,c.contype,pg_get_constraintdef(c.oid) from pg_constraint c where c.conrelid=any(array[$relations]::regclass[]) order by 1,2;
-- 2. Indexes, RLS, policies, grants and triggers relevant to this and prior stages.
select tablename,indexname,indexdef from pg_indexes where schemaname='public' and tablename=any(array[$relations]) order by 1,2;
select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(array[$relations]) order by 1;
select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' and tablename=any(array[$relations]) order by 1,2;
select table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and table_name=any(array[$relations]) order by 1,2,3;
select event_object_table,trigger_name,action_timing,event_manipulation,action_statement from information_schema.triggers where event_object_schema='public' and event_object_table=any(array[$relations]) order by 1,2;
-- 3. Functions and execution privileges.
select p.proname,pg_get_function_identity_arguments(p.oid),p.prosecdef,p.proconfig,has_function_privilege('public',p.oid,'execute') public_execute,has_function_privilege('anon',p.oid,'execute') anon_execute,has_function_privilege('authenticated',p.oid,'execute') authenticated_execute,has_function_privilege('service_role',p.oid,'execute') service_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array[$procedures]) order by 1,2;
-- 4. Stage classification aid. Expected: $expected.
select case when not ($completeTest) then case when to_regclass('public.openingfit_missions') is null then 'stage_absent' else 'stage_partial' end else 'stage_complete' end classification;
"@
}
$allRelations="'openingfit_missions','openingfit_mission_training_attempts','openingfit_mission_encounters','openingfit_mission_status_events'"
Write-Utf8 (Join-Path $out 'openingfit-missions-production-001a-verification.sql') (StageVerification '001a' $allRelations "'openingfit_protect_mission_identity'" "(select count(*) from pg_class where oid=any(array[to_regclass('public.openingfit_missions'),to_regclass('public.openingfit_mission_training_attempts'),to_regclass('public.openingfit_mission_encounters'),to_regclass('public.openingfit_mission_status_events')]))=4 and (select count(*) from pg_indexes where schemaname='public' and indexname like 'openingfit_mission%')=8" 'four tables and eight indexes; no authenticated grants yet')
Write-Utf8 (Join-Path $out 'openingfit-missions-production-001b-verification.sql') (StageVerification '001b' $allRelations "'openingfit_protect_mission_identity'" "(select count(*) from pg_policies where schemaname='public' and policyname like 'openingfit_mission%select_own')=4 and exists(select 1 from pg_trigger where tgrelid=to_regclass('public.openingfit_missions') and tgname='openingfit_protect_mission_identity' and not tgisinternal)" 'prior tables plus RLS, four owner-select policies, narrow grants and identity trigger')
Write-Utf8 (Join-Path $out 'openingfit-missions-production-001c-verification.sql') (StageVerification '001c' $allRelations "'openingfit_protect_mission_identity','transition_openingfit_mission','dismiss_openingfit_mission'" "to_regprocedure('public.transition_openingfit_mission(uuid,uuid,text,text,text,text,jsonb)') is not null and to_regprocedure('public.dismiss_openingfit_mission(uuid,text,text)') is not null" 'complete protected lifecycle functions and exact execution grants; then run final 001 verification')

$audit=@'
-- READ ONLY. Final Mission security audit. Run each numbered SELECT independently.
-- 1. Missing relations, RLS, policies and grants.
select e.name,to_regclass('public.'||e.name) object,c.relrowsecurity from unnest(array['openingfit_missions','openingfit_mission_training_attempts','openingfit_mission_encounters','openingfit_mission_status_events','openingfit_mission_training_sessions','openingfit_mission_events','openingfit_mission_activity_outbox','openingfit_mission_allowances','openingfit_mission_notification_candidates']) e(name) left join pg_class c on c.oid=to_regclass('public.'||e.name);
select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' and tablename like 'openingfit_mission%' order by 1,2;
select table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and table_name like 'openingfit_mission%' order by 1,2,3;
-- 2. All function overloads/security; PUBLIC and anon must be false, authenticated true only for dismiss.
select p.proname,pg_get_function_identity_arguments(p.oid),p.prosecdef,p.proconfig,has_function_privilege('public',p.oid,'execute') public_execute,has_function_privilege('anon',p.oid,'execute') anon_execute,has_function_privilege('authenticated',p.oid,'execute') authenticated_execute,has_function_privilege('service_role',p.oid,'execute') service_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%openingfit_mission%' order by 1,2;
-- 3. Uniqueness/ownership/deduplication indexes and constraints.
select c.conrelid::regclass,c.conname,pg_get_constraintdef(c.oid) from pg_constraint c where c.connamespace='public'::regnamespace and c.conrelid::regclass::text like 'openingfit_mission%' order by 1,2;
select tablename,indexname,indexdef from pg_indexes where schemaname='public' and tablename like 'openingfit_mission%' order by 1,2;
-- 4. Trigger functions must all have owning triggers.
select p.proname,count(t.oid) owning_triggers from pg_proc p join pg_namespace n on n.oid=p.pronamespace left join pg_trigger t on t.tgfoid=p.oid and not t.tgisinternal where n.nspname='public' and p.proname like 'openingfit_protect_%' group by p.proname;
-- 5. Reminder default and aggregate Mission estimates only.
select column_name,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name='notification_preferences' and column_name='mission_reminders';
select c.relname,c.reltuples::bigint estimated_rows from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'openingfit_mission%' order by 1;
-- 6. Existing non-Mission security surfaces: inspect metadata only and compare with recorded preflight.
select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('premium_entitlements','coaching_priorities') order by 1;
select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' and tablename in ('premium_entitlements','coaching_priorities') order by 1,2;
'@
Write-Utf8 (Join-Path $out 'openingfit-missions-production-final-security-audit.sql') $audit

$runbook=@'
# OpeningFit Missions production dark-launch runbook

Target: Supabase project `frtjfvhiimgruenqcuon`. This is production. Never use `supabase db push`, migration repair, or migration-history writes.

## Preconditions

1. Confirm openingfit.com and `/api/health` work; record `/api/readiness`.
2. Confirm `OPENINGFIT_MISSIONS_ENABLED` is absent/false, rollout is `0`, and notification delivery is disabled.
3. Confirm the Dashboard project reference exactly matches the target above.
4. Open Supabase Dashboard → Database → Backups and record backup/PITR availability. If a manual/downloadable backup exists, take it. If no recovery option exists, stop until the risk is explicitly accepted.

## Baseline

Run `openingfit-missions-production-baseline-inspection.sql` one numbered SELECT at a time and export results without private rows. Continue only for `no_mission_objects_present`, or after every existing object is independently proven exact. Stop on `partially_present`.

## Execution

The complete 001 wrapper was submitted twice through SQL Editor and both requests ended near line 208, before a function completed; the read-only baseline showed no persisted Mission objects. Do not use that full wrapper again in SQL Editor.

Confirm the baseline is `no_mission_objects_present`. Run 001A, then its verification; stop on mismatch. Run 001B and verify; then 001C and verify. Run the final combined 001 verification and stop before migration 002. A verified intermediate stage may remain committed. Never rerun a stage classified `stage_complete`; never proceed from `stage_partial`. Missions remains disabled throughout.

Only after separate approval, repeat the execute-then-verify pattern for 002, 003, and 004. Never paste wrappers together and never continue after failed verification.

## Final verification

Run the final security audit. Recheck public health/readiness, Missions disabled, subscriptions unchanged, one ordinary report analysis, and absence of Mission UI for normal users.

## Containment

Do not rerun blindly. Keep Missions disabled, rollout zero, and notifications disabled. Preserve exact error text; run baseline/partial-state inspection. Do not drop objects, edit migration history, deploy, or expose secrets. A connection failure near COMMIT is an uncertain state requiring metadata inspection.

## Approval—not yet granted

- [ ] I understand this is the production database, no separate staging environment exists, and backup/PITR may be unavailable. The migrations are additive, but production SQL still carries risk. I approve executing only migration 001 first while Missions remains disabled.
'@
Write-Utf8 (Join-Path $out 'openingfit-missions-production-dark-launch-runbook.md') $runbook
