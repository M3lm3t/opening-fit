$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'release-artifacts'
$project = 'frtjfvhiimgruenqcuon'
$expected = @{
  '001'='9A63F98DD176FF685B642305A41CD5144BFFCDADA65839999645A24783791C7E'
  '002'='8EE99CA86E2DB640FD378ABA2F21CC24BE7E209F0DED2691B20AFA4A2A7519BA'
  '003'='73981592838A56F16C9B8E25A6A69FFCF0E6180F6EF8FF1C0DD1080EC3168DFE'
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
    '002' { "if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='openingfit_missions_schema_readiness')<>1 or not exists(select 1 from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=to_regprocedure('public.openingfit_missions_schema_readiness()') and p.prorettype='jsonb'::regtype and l.lanname='sql' and p.provolatile='s' and p.prosecdef and p.proconfig @> array['search_path=public']) or has_function_privilege(0,to_regprocedure('public.openingfit_missions_schema_readiness()'),'execute') or has_function_privilege('anon',to_regprocedure('public.openingfit_missions_schema_readiness()'),'execute') or has_function_privilege('authenticated',to_regprocedure('public.openingfit_missions_schema_readiness()'),'execute') or not has_function_privilege('service_role',to_regprocedure('public.openingfit_missions_schema_readiness()'),'execute') or public.openingfit_missions_schema_readiness() is distinct from jsonb_build_object('ready',true,'schemaVersion',1) then raise exception '002 postcondition failed'; end if;" }
    '003' { "if to_regclass('public.openingfit_mission_training_sessions') is null or not (select relrowsecurity from pg_class where oid=to_regclass('public.openingfit_mission_training_sessions')) or (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['start_openingfit_mission_training_session','record_openingfit_mission_training_attempt','complete_openingfit_mission_training_session']))<>3 or not exists(select 1 from pg_constraint where conrelid=to_regclass('public.openingfit_mission_training_attempts') and conname='openingfit_attempt_session_owner_fk') or not exists(select 1 from pg_index where indexrelid=to_regclass('public.openingfit_mission_one_active_training_session_idx') and indisunique and indpred is not null) or exists(select 1 from pg_proc where oid=any(array[to_regprocedure('public.start_openingfit_mission_training_session(uuid,uuid,text,text,jsonb,integer,integer)'),to_regprocedure('public.record_openingfit_mission_training_attempt(uuid,uuid,uuid,text,text,text,text,integer,integer,timestamptz,jsonb)'),to_regprocedure('public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text)')]) and (not prosecdef or not proconfig @> array['search_path=public'])) or has_function_privilege(0,to_regprocedure('public.start_openingfit_mission_training_session(uuid,uuid,text,text,jsonb,integer,integer)'),'execute') or has_function_privilege('anon',to_regprocedure('public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text)'),'execute') or has_function_privilege('authenticated',to_regprocedure('public.record_openingfit_mission_training_attempt(uuid,uuid,uuid,text,text,text,text,integer,integer,timestamptz,jsonb)'),'execute') or not has_function_privilege('service_role',to_regprocedure('public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text)'),'execute') or public.openingfit_missions_schema_readiness()->>'schemaVersion'<>'3' or public.openingfit_missions_schema_readiness()->>'trainingReady'<>'true' then raise exception '003 postcondition failed'; end if;" }
    '004' { "if to_regclass('public.openingfit_mission_activity_outbox') is null or to_regclass('public.openingfit_mission_events') is null or to_regprocedure('public.project_openingfit_mission_activity(uuid)') is null or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='notification_preferences' and column_name='mission_reminders' and is_nullable='NO' and column_default='false') or (select count(*) from pg_class where oid=any(array[to_regclass('public.openingfit_mission_events'),to_regclass('public.openingfit_mission_activity_outbox'),to_regclass('public.openingfit_mission_allowances'),to_regclass('public.openingfit_mission_notification_candidates')]) and relrowsecurity)<>4 then raise exception '004 postcondition failed'; end if;" }
  }
  $precondition = switch($n){
   '002' {"DO `$precondition`$ begin if (select count(*) from pg_class where oid=any(array[to_regclass('public.openingfit_missions'),to_regclass('public.openingfit_mission_training_attempts'),to_regclass('public.openingfit_mission_encounters'),to_regclass('public.openingfit_mission_status_events')]) and relrowsecurity)<>4 or (select count(*) from pg_policies where schemaname='public' and tablename=any(array['openingfit_missions','openingfit_mission_training_attempts','openingfit_mission_encounters','openingfit_mission_status_events']))<>4 or to_regprocedure('public.transition_openingfit_mission(uuid,uuid,text,text,text,text,jsonb)') is null or to_regprocedure('public.dismiss_openingfit_mission(uuid,text,text)') is null or not exists(select 1 from pg_trigger where tgrelid=to_regclass('public.openingfit_missions') and tgname='openingfit_protect_mission_identity' and not tgisinternal) then raise exception 'completed migration 001 is required'; end if; end `$precondition`$;`n"}
   '003' {"DO `$precondition`$ begin if to_regprocedure('public.openingfit_missions_schema_readiness()') is null or public.openingfit_missions_schema_readiness() is distinct from jsonb_build_object('ready',true,'schemaVersion',1) then raise exception 'completed migrations 001 and 002 are required'; end if; end `$precondition`$;`n"}
   default {''}
  }
  $header="-- PRODUCTION WARNING: target $project only; migration $n.`n-- Required: prior baseline and preceding verification passed; Missions disabled; rollout 0%; notifications disabled.`n-- On failure before COMMIT the transaction should roll back. After uncertain connection failure, do not rerun; run read-only inspection first.`nBEGIN;`n$precondition"
  $tail="`nDO `$assert`$ begin $assert end `$assert`$;`nCOMMIT;"
  Write-Utf8 (Join-Path $out "openingfit-missions-production-$n-execute.sql") ($header+$sql+$tail)
}

# SQL Editor-safe split of 001. Boundaries are checksum-locked and occur only
# after complete statements: base objects; access/protection; lifecycle RPCs.
$source001=Join-Path $root 'supabase/migrations/202608310001_openingfit_missions_foundation.sql'
$lines=[IO.File]::ReadAllLines($source001)
if($lines.Count -ne 254){throw 'Migration 001 line contract changed'}
$stageAIndexValues=((@'
(values
('openingfit_missions','openingfit_missions_one_primary_active_idx',$idx$CREATE UNIQUE INDEX openingfit_missions_one_primary_active_idx ON public.openingfit_missions USING btree (user_id) WHERE (is_primary AND (status = ANY (ARRAY['assigned'::text, 'learning'::text, 'awaiting_evidence'::text, 'improving'::text, 'needs_review'::text])))$idx$),
('openingfit_missions','openingfit_missions_current_lookup_idx',$idx$CREATE INDEX openingfit_missions_current_lookup_idx ON public.openingfit_missions USING btree (user_id, status, updated_at DESC) WHERE is_primary$idx$),
('openingfit_missions','openingfit_missions_history_idx',$idx$CREATE INDEX openingfit_missions_history_idx ON public.openingfit_missions USING btree (user_id, created_at DESC)$idx$),
('openingfit_missions','openingfit_missions_position_idx',$idx$CREATE INDEX openingfit_missions_position_idx ON public.openingfit_missions USING btree (user_id, exact_position_key, status)$idx$),
('openingfit_missions','openingfit_missions_source_report_idx',$idx$CREATE INDEX openingfit_missions_source_report_idx ON public.openingfit_missions USING btree (user_id, source_report_id) WHERE (source_report_id IS NOT NULL)$idx$),
('openingfit_mission_training_attempts','openingfit_mission_attempts_history_idx',$idx$CREATE INDEX openingfit_mission_attempts_history_idx ON public.openingfit_mission_training_attempts USING btree (user_id, mission_id, created_at DESC)$idx$),
('openingfit_mission_encounters','openingfit_mission_encounters_verification_idx',$idx$CREATE INDEX openingfit_mission_encounters_verification_idx ON public.openingfit_mission_encounters USING btree (user_id, mission_id, qualifies_for_verification, played_at)$idx$),
('openingfit_mission_status_events','openingfit_mission_status_events_history_idx',$idx$CREATE INDEX openingfit_mission_status_events_history_idx ON public.openingfit_mission_status_events USING btree (user_id, mission_id, created_at)$idx$))
'@) -replace '\r?\n',' ')
$stageATables="(select count(*) from pg_class r join pg_namespace n on n.oid=r.relnamespace where n.nspname='public' and r.relkind='r' and r.relname=any(array['openingfit_missions','openingfit_mission_training_attempts','openingfit_mission_encounters','openingfit_mission_status_events']))=4"
$stageAIndexes="not exists(select 1 from $stageAIndexValues e(tablename,indexname,indexdef) left join pg_indexes a on a.schemaname='public' and a.indexname=e.indexname where a.tablename is distinct from e.tablename or a.indexdef is distinct from e.indexdef)"
$stageAIndexFingerprint="(select count(*)=8 and md5(string_agg(tablename||'|'||indexname||'|'||indexdef,chr(10) order by indexname))='7f724464ada49aa0ddca4f128d419715' from pg_indexes where schemaname='public' and indexname=any(array['openingfit_missions_one_primary_active_idx','openingfit_missions_current_lookup_idx','openingfit_missions_history_idx','openingfit_missions_position_idx','openingfit_missions_source_report_idx','openingfit_mission_attempts_history_idx','openingfit_mission_encounters_verification_idx','openingfit_mission_status_events_history_idx']))"
$stageAConstraints="(select count(*)=46 and md5(string_agg(n.nspname||'.'||r.relname||'|'||c.conname||'|'||c.contype::text||'|'||pg_get_constraintdef(c.oid,false),chr(10) order by n.nspname,r.relname,c.conname))='cb93fc8e4263fd7b74d89d8fc1527d02' from pg_constraint c join pg_class r on r.oid=c.conrelid join pg_namespace n on n.oid=r.relnamespace where n.nspname='public' and r.relname=any(array['openingfit_missions','openingfit_mission_training_attempts','openingfit_mission_encounters','openingfit_mission_status_events']))"
$stageAComplete="$stageATables and $stageAIndexes and $stageAConstraints"
$stageAAbsent="not exists(select 1 from pg_class r join pg_namespace n on n.oid=r.relnamespace where n.nspname='public' and r.relname=any(array['openingfit_missions','openingfit_mission_training_attempts','openingfit_mission_encounters','openingfit_mission_status_events','openingfit_missions_one_primary_active_idx','openingfit_missions_current_lookup_idx','openingfit_missions_history_idx','openingfit_missions_position_idx','openingfit_missions_source_report_idx','openingfit_mission_attempts_history_idx','openingfit_mission_encounters_verification_idx','openingfit_mission_status_events_history_idx']))"
$missionTables="(values('openingfit_missions'),('openingfit_mission_training_attempts'),('openingfit_mission_encounters'),('openingfit_mission_status_events'))"
$tablePrivileges="(values('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'))"
$ordinaryRoles="(values(0::oid),('anon'::regrole::oid),('authenticated'::regrole::oid))"
$ordinaryNoPrivileges="not exists(select 1 from $missionTables t(name) cross join $ordinaryRoles r(oid) cross join $tablePrivileges p(name) where has_table_privilege(r.oid,to_regclass('public.'||t.name),p.name))"
$rlsAll="(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(array['openingfit_missions','openingfit_mission_training_attempts','openingfit_mission_encounters','openingfit_mission_status_events']) and c.relrowsecurity)=4"
$zeroRows="(select count(*) from public.openingfit_missions)+(select count(*) from public.openingfit_mission_training_attempts)+(select count(*) from public.openingfit_mission_encounters)+(select count(*) from public.openingfit_mission_status_events)=0"
$noPolicies="not exists(select 1 from pg_policies where schemaname='public' and tablename=any(array['openingfit_missions','openingfit_mission_training_attempts','openingfit_mission_encounters','openingfit_mission_status_events']))"
$noMissionFunctions="not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%openingfit_mission%')"
$noMissionTriggers="not exists(select 1 from pg_trigger t where t.tgrelid=any(array[to_regclass('public.openingfit_missions'),to_regclass('public.openingfit_mission_training_attempts'),to_regclass('public.openingfit_mission_encounters'),to_regclass('public.openingfit_mission_status_events')]) and not t.tgisinternal)"
$containmentPreserved="$stageATables and $stageAIndexFingerprint and $stageAConstraints and $rlsAll and $zeroRows and $noPolicies and $noMissionFunctions and $noMissionTriggers"
$containmentComplete="$containmentPreserved and $ordinaryNoPrivileges"
$stageAContained="$containmentComplete and not exists(select 1 from $missionTables t(name) cross join $tablePrivileges p(name) where has_table_privilege('service_role',to_regclass('public.'||t.name),p.name))"
$stageAExecutionContained="$stageATables and $rlsAll and not exists(select 1 from information_schema.role_table_grants where table_schema='public' and table_name=any(array['openingfit_missions','openingfit_mission_training_attempts','openingfit_mission_encounters','openingfit_mission_status_events']) and grantee=any(array['PUBLIC','anon','authenticated','service_role']))"
$forbiddenEveryTable="(select count(*) from $missionTables t(name) where exists(select 1 from $ordinaryRoles r(oid) cross join $tablePrivileges p(name) where has_table_privilege(r.oid,to_regclass('public.'||t.name),p.name)))=4"
$stageBPrivileges="not exists(select 1 from $missionTables t(name) cross join (values(0::oid,'public'),('anon'::regrole::oid,'anon'),('authenticated'::regrole::oid,'authenticated'),('service_role'::regrole::oid,'service_role')) r(oid,name) cross join $tablePrivileges p(name) where has_table_privilege(r.oid,to_regclass('public.'||t.name),p.name) is distinct from (case when r.name='authenticated' then p.name='SELECT' when r.name='service_role' then p.name in ('SELECT','INSERT') or (t.name='openingfit_missions' and p.name='UPDATE') else false end))"
$stages = @(
  @{Name='001a'; Ranges=@(@(0,124),@(134,138)); Requires="perform 1;"; Assert="if not ($stageAExecutionContained) then raise exception '001A failed'; end if;"},
  @{Name='001b'; Ranges=@(@(125,133),@(139,185)); Requires="if not ($stageAContained) then raise exception 'clean contained 001A is required'; end if;"; Assert="if (select count(*) from pg_class where oid=any(array[to_regclass('public.openingfit_missions'),to_regclass('public.openingfit_mission_training_attempts'),to_regclass('public.openingfit_mission_encounters'),to_regclass('public.openingfit_mission_status_events')]) and relrowsecurity)<>4 or (select count(*) from pg_policies where schemaname='public' and policyname like 'openingfit_mission%select_own')<>4 or not exists(select 1 from pg_trigger where tgrelid=to_regclass('public.openingfit_missions') and tgname='openingfit_protect_mission_identity' and not tgisinternal) or not ($stageBPrivileges) then raise exception '001B postcondition failed'; end if;"},
  @{Name='001c'; Ranges=@(@(186,253)); Requires="if not exists(select 1 from pg_trigger where tgrelid=to_regclass('public.openingfit_missions') and tgname='openingfit_protect_mission_identity' and not tgisinternal) then raise exception '001B is required'; end if;"; Assert="if not exists(select 1 from pg_proc where oid=to_regprocedure('public.transition_openingfit_mission(uuid,uuid,text,text,text,text,jsonb)') and prosecdef and proconfig @> array['search_path=public']) or not exists(select 1 from pg_proc where oid=to_regprocedure('public.dismiss_openingfit_mission(uuid,text,text)') and prosecdef and proconfig @> array['search_path=public']) or has_function_privilege('public',to_regprocedure('public.transition_openingfit_mission(uuid,uuid,text,text,text,text,jsonb)'),'execute') or has_function_privilege('anon',to_regprocedure('public.dismiss_openingfit_mission(uuid,text,text)'),'execute') then raise exception '001C postcondition failed'; end if;"}
)
foreach($stage in $stages){
 $bodyParts=switch($stage.Name){
  '001a' {@($lines[0..124]) + @($lines[134..138])}
  '001b' {@($lines[125..133]) + @($lines[139..185])}
  '001c' {@($lines[186..253])}
 }
 $body=$bodyParts -join "`n"
 $body+="`n"
 $warning="-- PRODUCTION WARNING: target $project; stage $($stage.Name.ToUpper()).`n-- Required prior-stage verification must pass. Missions disabled; rollout 0%; notifications disabled.`n-- Do not rerun after an uncertain failure; inspect this stage read-only first.`nBEGIN;`nDO `$precondition`$ begin $($stage.Requires) end `$precondition`$;`n$($stage.Before)-- SOURCE MIGRATION 001 STAGE BEGIN`n"
 $ending="-- SOURCE MIGRATION 001 STAGE END`nDO `$assert`$ begin $($stage.Assert) end `$assert`$;`nCOMMIT;"
 Write-Utf8 (Join-Path $out "openingfit-missions-production-$($stage.Name)-execute.sql") ($warning+$body+$ending)
}
$containmentExecute=@"
-- PRODUCTION WARNING: target $project only; Mission 001A ordinary-client privilege containment.
-- Do not rerun after an uncertain result; run the read-only containment verification first.
BEGIN;
DO `$precondition`$ begin if not ($stageATables) then raise exception '001A containment requires all four exact tables'; end if; end `$precondition`$;
revoke all on table public.openingfit_missions,public.openingfit_mission_training_attempts,public.openingfit_mission_encounters,public.openingfit_mission_status_events from public,anon,authenticated;
DO `$assert`$ begin if not ($ordinaryNoPrivileges and $rlsAll and $zeroRows) then raise exception '001A containment postcondition failed'; end if; end `$assert`$;
COMMIT;
"@
Write-Utf8 (Join-Path $out 'openingfit-missions-production-001a-containment-execute.sql') $containmentExecute

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
$verification002=@'
-- READ ONLY. Migration 002 verification. Run each numbered SELECT independently.
-- 1. Exact signature, return type, language, volatility, owner and security configuration; exactly one same-name function is allowed.
select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) arguments,pg_get_function_result(p.oid) result_type,l.lanname language,p.provolatile,p.proowner::regrole owner,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname='public' and p.proname='openingfit_missions_schema_readiness' order by 3;
-- 2. Effective execute privileges for every API/backend role.
select r.role_name,has_function_privilege(r.role_oid,to_regprocedure('public.openingfit_missions_schema_readiness()'),'execute') execute from (values(0::oid,'PUBLIC'),('anon'::regrole::oid,'anon'),('authenticated'::regrole::oid,'authenticated'),('service_role'::regrole::oid,'service_role')) r(role_oid,role_name) order by 2;
-- 3. Exact secret-free aggregate readiness output. Expected: {"ready": true, "schemaVersion": 1}.
select public.openingfit_missions_schema_readiness() readiness;
-- 4. Exact fail-closed classification. Expected: stage_complete.
select case when (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='openingfit_missions_schema_readiness')=1 and exists(select 1 from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=to_regprocedure('public.openingfit_missions_schema_readiness()') and p.prorettype='jsonb'::regtype and l.lanname='sql' and p.provolatile='s' and p.prosecdef and p.proconfig @> array['search_path=public']) and not has_function_privilege(0,to_regprocedure('public.openingfit_missions_schema_readiness()'),'execute') and not has_function_privilege('anon',to_regprocedure('public.openingfit_missions_schema_readiness()'),'execute') and not has_function_privilege('authenticated',to_regprocedure('public.openingfit_missions_schema_readiness()'),'execute') and has_function_privilege('service_role',to_regprocedure('public.openingfit_missions_schema_readiness()'),'execute') and public.openingfit_missions_schema_readiness() is not distinct from jsonb_build_object('ready',true,'schemaVersion',1) then 'stage_complete' else 'stage_partial' end classification;
'@
Write-Utf8 (Join-Path $out 'openingfit-missions-production-002-verification.sql') $verification002
$verification003=Verification '003' "'openingfit_mission_training_sessions','openingfit_mission_training_attempts'" "'openingfit_protect_training_session','start_openingfit_mission_training_session','record_openingfit_mission_training_attempt','complete_openingfit_mission_training_session','openingfit_missions_schema_readiness'" 'session ownership FK; one active session; immutable manifest trigger; service-only mutation; readiness schemaVersion 3'
$verification003 += @'

-- 7. Exact secret-free readiness output.
select public.openingfit_missions_schema_readiness() readiness;
-- 8. Fail-closed classification. Expected: stage_complete.
select case when to_regclass('public.openingfit_mission_training_sessions') is not null and (select relrowsecurity from pg_class where oid=to_regclass('public.openingfit_mission_training_sessions')) and (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['start_openingfit_mission_training_session','record_openingfit_mission_training_attempt','complete_openingfit_mission_training_session']))=3 and exists(select 1 from pg_constraint where conrelid=to_regclass('public.openingfit_mission_training_attempts') and conname='openingfit_attempt_session_owner_fk') and exists(select 1 from pg_index where indexrelid=to_regclass('public.openingfit_mission_one_active_training_session_idx') and indisunique and indpred is not null) and not exists(select 1 from pg_proc where oid=any(array[to_regprocedure('public.start_openingfit_mission_training_session(uuid,uuid,text,text,jsonb,integer,integer)'),to_regprocedure('public.record_openingfit_mission_training_attempt(uuid,uuid,uuid,text,text,text,text,integer,integer,timestamptz,jsonb)'),to_regprocedure('public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text)')]) and (not prosecdef or not proconfig @> array['search_path=public'])) and not has_function_privilege(0,to_regprocedure('public.start_openingfit_mission_training_session(uuid,uuid,text,text,jsonb,integer,integer)'),'execute') and not has_function_privilege('anon',to_regprocedure('public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text)'),'execute') and not has_function_privilege('authenticated',to_regprocedure('public.record_openingfit_mission_training_attempt(uuid,uuid,uuid,text,text,text,text,integer,integer,timestamptz,jsonb)'),'execute') and has_function_privilege('service_role',to_regprocedure('public.complete_openingfit_mission_training_session(uuid,uuid,uuid,text)'),'execute') and public.openingfit_missions_schema_readiness()->>'schemaVersion'='3' and public.openingfit_missions_schema_readiness()->>'trainingReady'='true' then 'stage_complete' else 'stage_partial' end classification;
'@
Write-Utf8 (Join-Path $out 'openingfit-missions-production-003-verification.sql') $verification003
$v4=Verification '004' "'openingfit_mission_events','openingfit_mission_activity_outbox','openingfit_mission_allowances','openingfit_mission_notification_candidates'" "'record_openingfit_mission_event','complete_openingfit_mission_training_session','project_openingfit_mission_activity','project_openingfit_mission_session_activity','assign_openingfit_mission_with_allowance','openingfit_missions_operator_diagnostics','openingfit_missions_schema_readiness'" 'four tables; event/session dedupe; allowance PK; service-only mutation; readiness schemaVersion 4 in definition'
$v4 += "`n-- 7. Reminder opt-in default.`nselect column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name='notification_preferences' and column_name='mission_reminders';"
Write-Utf8 (Join-Path $out 'openingfit-missions-production-004-verification.sql') $v4

function StageVerification($name,$relations,$procedures,$completeTest,$expected,$absentTest){
if($absentTest){$classification="case when ($absentTest) then 'stage_absent' when ($completeTest) then 'stage_complete' else 'stage_partial' end"}
else{$classification="case when not ($completeTest) then case when to_regclass('public.openingfit_missions') is null then 'stage_absent' else 'stage_partial' end else 'stage_complete' end"}
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
select $classification classification;
"@
}
$allRelations="'openingfit_missions','openingfit_mission_training_attempts','openingfit_mission_encounters','openingfit_mission_status_events'"
$stageAClassification="with checks as (select ($stageAAbsent) absent,($stageAComplete) structural,($rlsAll and $ordinaryNoPrivileges and $noPolicies and $noMissionFunctions and $noMissionTriggers) contained) select case when absent then 'stage_absent' when structural and contained then 'stage_complete' when structural then 'stage_complete_but_uncontained' else 'stage_partial' end classification from checks"
$stageAVerification=StageVerification '001a' $allRelations "'openingfit_protect_mission_identity'" $stageAComplete 'four tables, 46 exact constraints and eight exact explicit indexes; stage_complete also requires no ordinary-client privileges' $stageAAbsent
$stageAVerification=$stageAVerification -replace "select case when .* classification;","$stageAClassification;"
Write-Utf8 (Join-Path $out 'openingfit-missions-production-001a-verification.sql') $stageAVerification
$stageBComplete="(select count(*) from pg_policies where schemaname='public' and policyname like 'openingfit_mission%select_own')=4 and exists(select 1 from pg_trigger where tgrelid=to_regclass('public.openingfit_missions') and tgname='openingfit_protect_mission_identity' and not tgisinternal) and $stageBPrivileges"
Write-Utf8 (Join-Path $out 'openingfit-missions-production-001b-verification.sql') (StageVerification '001b' $allRelations "'openingfit_protect_mission_identity'" $stageBComplete 'prior tables plus RLS, four owner-select policies, exact grants and identity trigger')
Write-Utf8 (Join-Path $out 'openingfit-missions-production-001c-verification.sql') (StageVerification '001c' $allRelations "'openingfit_protect_mission_identity','transition_openingfit_mission','dismiss_openingfit_mission'" "to_regprocedure('public.transition_openingfit_mission(uuid,uuid,text,text,text,text,jsonb)') is not null and to_regprocedure('public.dismiss_openingfit_mission(uuid,text,text)') is not null" 'complete protected lifecycle functions and exact execution grants; then run final 001 verification')

$checkpointInspection=@"
-- READ ONLY. Inspect the already-applied production post-001B checkpoint; do not rerun 001A, containment or 001B.
-- 1. Exact structural inventory.
select (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname=any(array['openingfit_missions','openingfit_mission_training_attempts','openingfit_mission_encounters','openingfit_mission_status_events'])) table_count,(select count(*) from pg_constraint c where c.conrelid=any(array['openingfit_missions','openingfit_mission_training_attempts','openingfit_mission_encounters','openingfit_mission_status_events']::regclass[])) constraint_count,(select count(*) from pg_indexes where schemaname='public' and tablename=any(array['openingfit_missions','openingfit_mission_training_attempts','openingfit_mission_encounters','openingfit_mission_status_events'])) index_count;
-- 2. RLS, policies, triggers and exact effective table privileges.
select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(array['openingfit_missions','openingfit_mission_training_attempts','openingfit_mission_encounters','openingfit_mission_status_events']) order by 1;
select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' and tablename=any(array['openingfit_missions','openingfit_mission_training_attempts','openingfit_mission_encounters','openingfit_mission_status_events']) order by 1,2;
select t.name table_name,r.name role_name,p.name privilege,has_table_privilege(r.oid,to_regclass('public.'||t.name),p.name) effective from $missionTables t(name) cross join (values(0::oid,'PUBLIC'),('anon'::regrole::oid,'anon'),('authenticated'::regrole::oid,'authenticated'),('service_role'::regrole::oid,'service_role')) r(oid,name) cross join $tablePrivileges p(name) order by 1,2,3;
select event_object_table,trigger_name,action_timing,event_manipulation from information_schema.triggers where event_object_schema='public' and event_object_table=any(array['openingfit_missions','openingfit_mission_training_attempts','openingfit_mission_encounters','openingfit_mission_status_events']) order by 1,2;
-- 3. Functions expected at the checkpoint. Lifecycle functions must still be absent.
select to_regprocedure('public.openingfit_protect_mission_identity()') identity_protection,to_regprocedure('public.transition_openingfit_mission(uuid,uuid,text,text,text,text,jsonb)') transition_function,to_regprocedure('public.dismiss_openingfit_mission(uuid,text,text)') dismissal_function;
-- 4. Exact classification. Expected: post_001b_complete.
select case when $stageAComplete and $rlsAll and (select count(*) from pg_policies where schemaname='public' and policyname like 'openingfit_mission%select_own')=4 and exists(select 1 from pg_trigger where tgrelid=to_regclass('public.openingfit_missions') and tgname='openingfit_protect_mission_identity' and not tgisinternal) and $stageBPrivileges and to_regprocedure('public.transition_openingfit_mission(uuid,uuid,text,text,text,text,jsonb)') is null and to_regprocedure('public.dismiss_openingfit_mission(uuid,text,text)') is null then 'post_001b_complete' else 'checkpoint_mismatch' end classification;
"@
Write-Utf8 (Join-Path $out 'openingfit-missions-production-001-checkpoint-inspection.sql') $checkpointInspection

$containmentVerification=@"
-- READ ONLY. Mission 001A ordinary-client privilege containment verification. Run each SELECT independently.
-- 1. Exact tables and aggregate row counts only.
select t.name,to_regclass('public.'||t.name) object from $missionTables t(name) order by 1;
select 'openingfit_missions' table_name,count(*) row_count from public.openingfit_missions union all select 'openingfit_mission_training_attempts',count(*) from public.openingfit_mission_training_attempts union all select 'openingfit_mission_encounters',count(*) from public.openingfit_mission_encounters union all select 'openingfit_mission_status_events',count(*) from public.openingfit_mission_status_events order by 1;
-- 2. RLS and policies.
select c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(array[$allRelations]) order by 1;
select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' and tablename=any(array[$allRelations]) order by 1,2;
-- 3. Effective privileges. Every has_privilege value must be false.
select r.name role_name,t.name table_name,p.name privilege,has_table_privilege(r.oid,to_regclass('public.'||t.name),p.name) has_privilege from $missionTables t(name) cross join (values(0::oid,'PUBLIC'),('anon'::regrole::oid,'anon'),('authenticated'::regrole::oid,'authenticated')) r(oid,name) cross join $tablePrivileges p(name) order by 1,2,3;
-- 4. No Mission functions or non-internal triggers.
select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) arguments from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%openingfit_mission%' order by 2,3;
select c.relname,t.tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(array[$allRelations]) and not t.tgisinternal order by 1,2;
-- 5. Exact constraints and indexes remain available for definition review.
select c.conrelid::regclass,c.conname,c.contype,pg_get_constraintdef(c.oid) definition from pg_constraint c where c.conrelid=any(array[$allRelations]::regclass[]) order by 1,2;
select tablename,indexname,indexdef from pg_indexes where schemaname='public' and tablename=any(array[$allRelations]) order by 1,2;
-- 6. containment_absent requires the preserved pre-containment state with forbidden privileges on every table.
with checks as (select ($containmentPreserved) preserved,($forbiddenEveryTable) absent,($ordinaryNoPrivileges) complete) select case when preserved and absent then 'containment_absent' when preserved and complete then 'containment_complete' else 'containment_partial' end classification from checks;
"@
Write-Utf8 (Join-Path $out 'openingfit-missions-production-001a-containment-verification.sql') $containmentVerification

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

$psqlRunbook=@'
# Mission stage 001C psql execution runbook

Target project: `frtjfvhiimgruenqcuon`. Do not use Supabase SQL Editor or a transaction-pooler endpoint. This procedure requires separate 001C approval and preserves the artifact's own `BEGIN`, assertions and `COMMIT`.

## Connection selection and credentials

Use the Direct connection from Dashboard -> Connect when IPv6 is available. Otherwise use the Shared Pooler **Session mode** connection on port 5432. Never use port 6543. Copy the session host and server CA certificate path from the Dashboard; do not copy a URI or password into the shell.

```powershell
$psql = 'D:\opening-fit\.release-build\postgresql17\runtime\bin\psql.exe'
$artifact = (Resolve-Path 'D:\opening-fit\release-artifacts\openingfit-missions-production-001c-execute.sql').Path
$verification = (Resolve-Path 'D:\opening-fit\release-artifacts\openingfit-missions-production-001c-verification.sql').Path
$checkpoint = (Resolve-Path 'D:\opening-fit\release-artifacts\openingfit-missions-production-001-checkpoint-inspection.sql').Path
$env:PGDATABASE = 'postgres'
$env:PGPORT = '5432'
$env:PGSSLMODE = 'verify-full'
$env:PGSSLROOTCERT = '<ABSOLUTE PATH TO DASHBOARD SERVER CA CERTIFICATE>'
```

For Direct mode only:

```powershell
$env:PGHOST = 'db.frtjfvhiimgruenqcuon.supabase.co'
$env:PGUSER = 'postgres'
if ($env:PGHOST -cne 'db.frtjfvhiimgruenqcuon.supabase.co' -or $env:PGPORT -ne '5432') { throw 'Wrong direct target' }
```

For Shared Pooler Session mode only, copy the non-secret host from Dashboard -> Connect -> Session pooler:

```powershell
$env:PGHOST = '<SESSION POOLER HOST FROM DASHBOARD>'
$env:PGUSER = 'postgres.frtjfvhiimgruenqcuon'
if ($env:PGUSER -cne 'postgres.frtjfvhiimgruenqcuon' -or $env:PGPORT -ne '5432' -or $env:PGHOST -notlike '*.pooler.supabase.com') { throw 'Wrong session-pooler target' }
```

Do not set `PGPASSWORD`. Each command uses `-W` so psql prompts privately. Never paste the password into a command, URI, file, transcript or chat.

## Read-only preflight

```powershell
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $artifact).Hash -cne '05D545F448656E027CC182EF9CB5CA4D3AF73AE9507ECF89AA3FF6FB6839A45B') { throw '001C artifact hash mismatch' }
& $psql -X -W -v ON_ERROR_STOP=1 -c "select current_database(),current_user,session_user,inet_server_addr(),inet_server_port(),version(),pg_is_in_recovery();"
if ($LASTEXITCODE -ne 0) { throw 'Read-only identity check failed' }
& $psql -X -W -v ON_ERROR_STOP=1 -c "select to_regprocedure('public.transition_openingfit_mission(uuid,uuid,text,text,text,text,jsonb)') transition_function,to_regprocedure('public.dismiss_openingfit_mission(uuid,text,text)') dismiss_function;"
if ($LASTEXITCODE -ne 0) { throw 'Read-only 001C absence check failed' }
& $psql -X -W -v ON_ERROR_STOP=1 -f $checkpoint
if ($LASTEXITCODE -ne 0) { throw 'Read-only post-001B checkpoint inspection failed' }
```

Manually confirm database `postgres`, the expected `postgres` or `postgres.frtjfvhiimgruenqcuon` identity, a primary server (`pg_is_in_recovery = false`), the approved Dashboard host, both functions NULL, and final checkpoint classification `post_001b_complete`. Stop on any mismatch. Do not rerun 001A, containment or 001B.

## Approved execution

```powershell
$runLog = Join-Path ([IO.Path]::GetTempPath()) ('openingfit-001c-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
& $psql -X -W -v ON_ERROR_STOP=1 -f $artifact 2>&1 | Tee-Object -LiteralPath $runLog
if ($LASTEXITCODE -ne 0) { throw "001C failed or is uncertain; do not rerun. Inspect with the read-only procedure. Output: $runLog" }
```

The temporary log contains SQL status/error output only. Confirm it contains `BEGIN`, both `CREATE FUNCTION` results, privilege/comment results, the final assertion result, and `COMMIT`; then run the verification file one SELECT at a time. Delete the temporary log through the normal approved local cleanup process after review.

## Failure or uncertain result

Never rerun after any nonzero exit, disconnect, timeout or missing `COMMIT`. Re-run only the read-only identity and `to_regprocedure` checks above, then run the read-only 001C verification from disk with `& $psql -X -W -v ON_ERROR_STOP=1 -f $verification`. If both functions are NULL, rollback is consistent. If both exist, complete verification must prove definitions, grants and comments before treating 001C as committed. If only one exists or any check disagrees, classify the state as partial/uncertain and stop for diagnosis. Do not edit migration history or drop objects.

When finished, remove only the process-scoped non-secret connection variables:

```powershell
Remove-Item Env:PGHOST,Env:PGPORT,Env:PGDATABASE,Env:PGUSER,Env:PGSSLMODE,Env:PGSSLROOTCERT -ErrorAction SilentlyContinue
```
'@
Write-Utf8 (Join-Path $out 'openingfit-missions-production-001c-psql-runbook.md') $psqlRunbook

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

The containment artifact remains an idempotent recovery tool for an older or legacy 001A state that inherited forbidden privileges. Use it only with separate approval, and continue only from `containment_complete`; stop on `containment_absent` or `containment_partial`.

The revised 001A artifact is for future clean deployments only and now commits with RLS plus all ordinary and service-role table privileges revoked. A fresh revised 001A that verifies `stage_complete` does not require the recovery containment transaction. Current production has already completed 001A, containment and 001B: never rerun any of them; use the read-only post-001B checkpoint inspection before requesting 001C approval.

Only after containment is verified and 001B receives separate approval, run the revised 001B artifact, whose wrapper first removes inherited service-role privileges before the source grants its narrower contract. Verify exact grants, policies, RLS and the identity trigger before considering 001C.

Never submit 001C through SQL Editor. After separate approval, follow `openingfit-missions-production-001c-psql-runbook.md` and execute the exact artifact from disk using Direct or Shared Pooler Session mode on port 5432 with `psql -f` and `ON_ERROR_STOP=1`. Transaction-pooler port 6543 is prohibited for this DDL stage.

Only after separate approval, repeat the execute-then-verify pattern for 002, 003, and 004. Migration 003 is larger than the SQL Editor-safe threshold and contains multiple dollar-quoted functions: execute its checksum-approved artifact from disk with TLS-verified `psql -X -W -v ON_ERROR_STOP=1 -f`, never SQL Editor. Never paste wrappers together and never continue after failed verification.

## Final verification

Run the final security audit. Recheck public health/readiness, Missions disabled, subscriptions unchanged, one ordinary report analysis, and absence of Mission UI for normal users.

## Containment

Do not rerun blindly. Keep Missions disabled, rollout zero, and notifications disabled. Preserve exact error text; run containment verification after any uncertain result. Do not drop objects, edit migration history, deploy, or expose secrets. The containment transaction may revoke privileges only on the four exact 001A tables.

## Approval—not yet granted

- [ ] I understand this is the production database, no separate staging environment exists, and backup/PITR may be unavailable. The migrations are additive, but production SQL still carries risk. I approve executing only migration 001 first while Missions remains disabled.
'@
Write-Utf8 (Join-Path $out 'openingfit-missions-production-dark-launch-runbook.md') $runbook
