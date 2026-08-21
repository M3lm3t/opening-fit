param(
  [string]$OutputPath = "release-artifacts/openingfit-repertoire-preferences-production-bundle.sql"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$migrationName = "202608170001_user_repertoire_preferences.sql"
$migrationPath = Join-Path $repoRoot "supabase/migrations/$migrationName"
$resolvedOutput = Join-Path $repoRoot $OutputPath
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $resolvedOutput) | Out-Null
$migrationHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $migrationPath).Hash
$migrationSql = Get-Content -Raw -LiteralPath $migrationPath

$header = @"
-- OpeningFit user repertoire preferences production SQL Editor bundle
-- Target project: frtjfvhiimgruenqcuon
-- Source migration: $migrationName
-- Source SHA-256: $migrationHash
-- This bundle deliberately excludes retention migrations 202608200001-005.
-- Run each labelled section separately. Do not align migration history.

-- SECTION 1: READ-ONLY BASELINE PRECONDITIONS (expect one PRECONDITION_PASS row)
begin read only;
do `$preconditions`$
declare
  existing_table regclass := to_regclass('public.user_repertoire_preferences');
  missing text[] := array[]::text[];
  index_definition text;
begin
  if to_regclass('auth.users') is null then missing := array_append(missing, 'auth.users'); end if;
  if to_regprocedure('auth.uid()') is null then missing := array_append(missing, 'auth.uid()'); end if;
  if array_length(missing, 1) is not null then
    raise exception 'STOP: missing required baseline objects: %', array_to_string(missing, ', ');
  end if;

  if existing_table is not null then
    select array_agg(required.column_name order by required.column_name) into missing
    from (values
      ('user_id','uuid','NO'), ('repertoire_role','text','NO'),
      ('canonical_opening_id','text','NO'), ('preference','text','NO'),
      ('created_at','timestamp with time zone','NO'), ('updated_at','timestamp with time zone','NO')
    ) required(column_name, data_type, nullable)
    where not exists (
      select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name='user_repertoire_preferences'
        and c.column_name=required.column_name and c.data_type=required.data_type and c.is_nullable=required.nullable
    );
    if missing is not null then raise exception 'STOP: incompatible existing preference columns: %', array_to_string(missing, ', '); end if;
    if not exists (
      select 1 from pg_constraint
      where conrelid=existing_table and contype='p'
        and pg_get_constraintdef(oid) ilike '%user_id%repertoire_role%canonical_opening_id%'
    ) then raise exception 'STOP: existing preference table lacks the canonical primary key'; end if;
    if not exists (select 1 from pg_class where oid=existing_table and relrowsecurity) then
      raise exception 'STOP: existing preference table does not have RLS enabled';
    end if;
  end if;

  select pg_get_indexdef(indexrelid) into index_definition
  from pg_index join pg_class on pg_class.oid=indexrelid
  where pg_class.relname='user_repertoire_preferences_one_main_role_idx';
  if index_definition is not null and not (
    index_definition ilike '%unique index%user_repertoire_preferences%(user_id, repertoire_role)%'
    and index_definition ilike '%preference = ''main''%'
  ) then raise exception 'STOP: incompatible existing one-main-role index'; end if;

  if to_regprocedure('public.set_user_repertoire_preference(text,text,text)') is not null and not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='set_user_repertoire_preference'
      and pg_get_function_identity_arguments(p.oid)='p_repertoire_role text, p_canonical_opening_id text, p_preference text'
      and pg_get_function_result(p.oid)='jsonb'
  ) then raise exception 'STOP: incompatible existing repertoire preference function'; end if;
end
`$preconditions`$;
select 'PRECONDITION_PASS' as result,
  to_regclass('public.user_repertoire_preferences') is not null as compatible_table_already_exists;
rollback;

-- SECTION 2: MIGRATION TRANSACTION. Execute only after Section 1 passes.
begin;
create temporary table repertoire_preferences_release_baseline(row_count bigint) on commit drop;
do `$capture_baseline`$
declare existing_count bigint := 0;
begin
  -- A CASE expression is not a parse-safe guard for an absent relation. Keep the
  -- optional relation name inside dynamic SQL until the catalogue proves it exists.
  if to_regclass('public.user_repertoire_preferences') is not null then
    execute 'select count(*) from public.user_repertoire_preferences' into existing_count;
  end if;
  insert into repertoire_preferences_release_baseline values (existing_count);
end
`$capture_baseline`$;

-- ===== BEGIN EXACT SOURCE MIGRATION $migrationName =====
$migrationSql
-- ===== END EXACT SOURCE MIGRATION $migrationName =====

do `$postconditions`$
declare before_count bigint; after_count bigint;
begin
  select row_count into before_count from repertoire_preferences_release_baseline;
  select count(*) into after_count from public.user_repertoire_preferences;
  if after_count <> before_count then raise exception 'STOP: migration unexpectedly changed preference row count'; end if;
  if not exists (select 1 from pg_class where oid='public.user_repertoire_preferences'::regclass and relrowsecurity) then raise exception 'STOP: RLS is disabled'; end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_repertoire_preferences' and policyname='user_repertoire_preferences_select_own' and cmd='SELECT' and qual like '%auth.uid()%user_id%') then raise exception 'STOP: owner SELECT policy missing'; end if;
  if has_table_privilege('anon','public.user_repertoire_preferences','INSERT') or has_table_privilege('authenticated','public.user_repertoire_preferences','INSERT') or has_table_privilege('authenticated','public.user_repertoire_preferences','UPDATE') or has_table_privilege('authenticated','public.user_repertoire_preferences','DELETE') then raise exception 'STOP: direct writes remain granted'; end if;
  if not has_table_privilege('authenticated','public.user_repertoire_preferences','SELECT') then raise exception 'STOP: authenticated owner SELECT grant missing'; end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='set_user_repertoire_preference' and p.prosecdef and pg_get_function_result(p.oid)='jsonb') then raise exception 'STOP: canonical security-definer RPC missing'; end if;
  if has_function_privilege('anon','public.set_user_repertoire_preference(text,text,text)','EXECUTE') or not has_function_privilege('authenticated','public.set_user_repertoire_preference(text,text,text)','EXECUTE') then raise exception 'STOP: RPC grants are incompatible'; end if;
  if exists (select 1 from public.user_repertoire_preferences where repertoire_role not in ('white','black_vs_e4','black_vs_d4') or preference not in ('main','experimenting','ignore') or canonical_opening_id <> btrim(canonical_opening_id) or canonical_opening_id='') then raise exception 'STOP: incompatible existing preference rows'; end if;
end
`$postconditions`$;
select 'MIGRATION_POSTCONDITION_PASS' as result;
commit;

-- SECTION 3: FINAL METADATA-ONLY VERIFICATION. No user rows are returned.
select 'FINAL_TABLE_METADATA' as check_name, c.relrowsecurity as rls_enabled,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='user_repertoire_preferences') as column_count
from pg_class c where c.oid='public.user_repertoire_preferences'::regclass;

select 'FINAL_POLICY_METADATA' as check_name, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname='public' and tablename='user_repertoire_preferences'
order by policyname;

select 'FINAL_FUNCTION_METADATA' as check_name, p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as result_type, p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='set_user_repertoire_preference';

select 'FINAL_GRANT_METADATA' as check_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name='user_repertoire_preferences'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

select 'FINAL_RPC_GRANT_METADATA' as check_name, grantee, privilege_type
from information_schema.role_routine_grants
where routine_schema='public' and routine_name='set_user_repertoire_preference'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

-- Migration-history alignment is intentionally absent. Do not use supabase db push.
"@

Set-Content -LiteralPath $resolvedOutput -Value $header -Encoding utf8
Write-Output $resolvedOutput
