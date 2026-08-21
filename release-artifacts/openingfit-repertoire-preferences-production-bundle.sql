-- OpeningFit user repertoire preferences production SQL Editor bundle
-- Target project: frtjfvhiimgruenqcuon
-- Source migration: 202608170001_user_repertoire_preferences.sql
-- Source SHA-256: D8F3BC16F11BFC8696114DCD00CE95DD47896A0058D5224EE0F117795331CAC6
-- This bundle deliberately excludes retention migrations 202608200001-005.
-- Run each labelled section separately. Do not align migration history.

-- SECTION 1: READ-ONLY BASELINE PRECONDITIONS (expect one PRECONDITION_PASS row)
begin read only;
do $preconditions$
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
$preconditions$;
select 'PRECONDITION_PASS' as result,
  to_regclass('public.user_repertoire_preferences') is not null as compatible_table_already_exists;
rollback;

-- SECTION 2: MIGRATION TRANSACTION. Execute only after Section 1 passes.
begin;
create temporary table repertoire_preferences_release_baseline(row_count bigint) on commit drop;
insert into repertoire_preferences_release_baseline
select case when to_regclass('public.user_repertoire_preferences') is null then 0
  else (select count(*) from public.user_repertoire_preferences) end;

-- ===== BEGIN EXACT SOURCE MIGRATION 202608170001_user_repertoire_preferences.sql =====
-- Manual repertoire presentation choices. Historical evidence remains immutable.

create table if not exists public.user_repertoire_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  repertoire_role text not null check (repertoire_role in ('white', 'black_vs_e4', 'black_vs_d4')),
  canonical_opening_id text not null check (length(btrim(canonical_opening_id)) between 1 and 160),
  preference text not null check (preference in ('main', 'experimenting', 'ignore')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, repertoire_role, canonical_opening_id)
);

create unique index if not exists user_repertoire_preferences_one_main_role_idx
on public.user_repertoire_preferences (user_id, repertoire_role)
where preference = 'main';

alter table public.user_repertoire_preferences enable row level security;

drop policy if exists user_repertoire_preferences_select_own on public.user_repertoire_preferences;
create policy user_repertoire_preferences_select_own
on public.user_repertoire_preferences for select to authenticated
using (auth.uid() = user_id);

revoke insert, update, delete on public.user_repertoire_preferences from anon, authenticated;
grant select on public.user_repertoire_preferences to authenticated;

create or replace function public.set_user_repertoire_preference(
  p_repertoire_role text,
  p_canonical_opening_id text,
  p_preference text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  opening_id text := nullif(btrim(p_canonical_opening_id), '');
  saved public.user_repertoire_preferences;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if p_repertoire_role not in ('white', 'black_vs_e4', 'black_vs_d4') then raise exception 'Invalid repertoire role'; end if;
  if opening_id is null or length(opening_id) > 160 then raise exception 'A canonical opening ID is required'; end if;
  if p_preference not in ('automatic', 'main', 'experimenting', 'ignore') then raise exception 'Invalid repertoire preference'; end if;

  if p_preference = 'automatic' then
    delete from public.user_repertoire_preferences
    where user_id = owner_id and repertoire_role = p_repertoire_role and canonical_opening_id = opening_id;
    return jsonb_build_object(
      'userId', owner_id, 'repertoireRole', p_repertoire_role,
      'canonicalOpeningId', opening_id, 'preference', 'automatic'
    );
  end if;

  if p_preference = 'main' then
    delete from public.user_repertoire_preferences
    where user_id = owner_id and repertoire_role = p_repertoire_role
      and preference = 'main' and canonical_opening_id <> opening_id;
  end if;

  insert into public.user_repertoire_preferences (
    user_id, repertoire_role, canonical_opening_id, preference, updated_at
  ) values (owner_id, p_repertoire_role, opening_id, p_preference, now())
  on conflict (user_id, repertoire_role, canonical_opening_id) do update set
    preference = excluded.preference,
    updated_at = now()
  returning * into saved;

  return jsonb_build_object(
    'userId', saved.user_id, 'repertoireRole', saved.repertoire_role,
    'canonicalOpeningId', saved.canonical_opening_id,
    'preference', saved.preference, 'updatedAt', saved.updated_at
  );
end;
$$;

revoke all on function public.set_user_repertoire_preference(text, text, text) from public, anon;
grant execute on function public.set_user_repertoire_preference(text, text, text) to authenticated;

comment on table public.user_repertoire_preferences is
  'User-controlled presentation status keyed by account, canonical role and canonical opening ID; never raw game evidence.';

-- ===== END EXACT SOURCE MIGRATION 202608170001_user_repertoire_preferences.sql =====

do $postconditions$
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
$postconditions$;
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

select 'FINAL_COMPATIBILITY_COUNTS' as check_name,
  count(*) as preference_rows,
  count(distinct user_id) as owners_with_preferences,
  count(*) filter (where preference='main') as main_rows,
  count(*) filter (where preference='experimenting') as experimenting_rows,
  count(*) filter (where preference='ignore') as ignored_rows
from public.user_repertoire_preferences;

-- Migration-history alignment is intentionally absent. Do not use supabase db push.
