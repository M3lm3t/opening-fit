param(
  [string]$OutputPath = "release-artifacts/openingfit-repertoire-preferences-production-bundle.sql"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$migrationName = "202608170001_user_repertoire_preferences.sql"
$migrationPath = Join-Path $repoRoot "supabase/migrations/$migrationName"
$inspectionPath = Join-Path $repoRoot "release-artifacts/openingfit-repertoire-preferences-production-inspection.sql"
$resolvedOutput = Join-Path $repoRoot $OutputPath
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $resolvedOutput) | Out-Null
$migrationHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $migrationPath).Hash
$migrationSql = Get-Content -Raw -LiteralPath $migrationPath
$inspectionSql = Get-Content -Raw -LiteralPath $inspectionPath

$header = @"
-- OpeningFit user repertoire preferences production SQL Editor bundle
-- Target project: frtjfvhiimgruenqcuon
-- Source migration: $migrationName
-- Source SHA-256: $migrationHash
-- This bundle deliberately excludes retention migrations 202608200001-005.
-- Run each labelled section separately. Do not align migration history.
-- ARCHIVAL TEMPLATE ONLY: production already contains this migration. DO NOT EXECUTE.

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

-- ===== BEGIN EXACT SOURCE MIGRATION $migrationName =====
$migrationSql
-- ===== END EXACT SOURCE MIGRATION $migrationName =====

do `$postconditions`$
begin
  if not exists (select 1 from pg_class where oid='public.user_repertoire_preferences'::regclass and relrowsecurity) then raise exception 'STOP: RLS is disabled'; end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_repertoire_preferences' and policyname='user_repertoire_preferences_select_own' and cmd='SELECT' and qual like '%auth.uid()%user_id%') then raise exception 'STOP: owner SELECT policy missing'; end if;
  if has_table_privilege('anon','public.user_repertoire_preferences','INSERT') or has_table_privilege('authenticated','public.user_repertoire_preferences','INSERT') or has_table_privilege('authenticated','public.user_repertoire_preferences','UPDATE') or has_table_privilege('authenticated','public.user_repertoire_preferences','DELETE') then raise exception 'STOP: direct writes remain granted'; end if;
  if not has_table_privilege('authenticated','public.user_repertoire_preferences','SELECT') then raise exception 'STOP: authenticated owner SELECT grant missing'; end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='set_user_repertoire_preference' and p.prosecdef and pg_get_function_result(p.oid)='jsonb') then raise exception 'STOP: canonical security-definer RPC missing'; end if;
  if has_function_privilege('anon','public.set_user_repertoire_preference(text,text,text)','EXECUTE') or not has_function_privilege('authenticated','public.set_user_repertoire_preference(text,text,text)','EXECUTE') then raise exception 'STOP: RPC grants are incompatible'; end if;
end
`$postconditions`$;
select 'MIGRATION_POSTCONDITION_PASS' as result;
commit;

-- SECTION 3: FINAL METADATA-ONLY VERIFICATION.
-- Every numbered query below is independently executable in a fresh session.
$inspectionSql

-- Migration-history alignment is intentionally absent. Do not use supabase db push.
"@

Set-Content -LiteralPath $resolvedOutput -Value $header -Encoding utf8
Write-Output $resolvedOutput
