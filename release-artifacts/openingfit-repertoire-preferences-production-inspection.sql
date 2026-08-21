-- OpeningFit repertoire preferences: production metadata inspection only
-- Target project: frtjfvhiimgruenqcuon
-- Run each numbered SELECT independently in a fresh Supabase SQL Editor run.
-- Read-only catalogue metadata only: no helper objects, user rows, or migration writes.

-- 1. Expected: exactly six rows with the migration's types/nullability/defaults.
select
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'user_repertoire_preferences'
order by ordinal_position;

-- 2. Expected: canonical three-column primary key and user_id -> auth.users(id)
-- foreign key with ON DELETE CASCADE.
select
  c.conname,
  c.contype,
  pg_get_constraintdef(c.oid, true) as definition,
  rn.nspname as referenced_schema,
  rc.relname as referenced_table
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
left join pg_class rc on rc.oid = c.confrelid
left join pg_namespace rn on rn.oid = rc.relnamespace
where n.nspname = 'public'
  and t.relname = 'user_repertoire_preferences'
order by c.contype, c.conname;

-- 3. Expected: alongside the primary-key index, a unique index named
-- user_repertoire_preferences_one_main_role_idx on (user_id, repertoire_role),
-- with exact predicate (preference = 'main'::text).
select
  i.relname as index_name,
  ix.indisunique as is_unique,
  pg_get_indexdef(ix.indexrelid) as index_definition,
  pg_get_expr(ix.indpred, ix.indrelid) as predicate
from pg_index ix
join pg_class t on t.oid = ix.indrelid
join pg_namespace n on n.oid = t.relnamespace
join pg_class i on i.oid = ix.indexrelid
where n.nspname = 'public'
  and t.relname = 'user_repertoire_preferences'
order by i.relname;

-- 4. Expected: rls_enabled=true, rls_forced=false.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'user_repertoire_preferences'
  and c.relkind in ('r', 'p');

-- 5. Expected: exactly one PERMISSIVE SELECT policy, for {authenticated}, with
-- auth.uid() = user_id and no WITH CHECK expression.
select
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'user_repertoire_preferences'
order by policyname;

-- 6. Expected: one text,text,text overload returning jsonb, language plpgsql,
-- security_definer=true, and search_path=public.
select
  p.oid::regprocedure::text as function_signature,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_function_result(p.oid) as return_type,
  l.lanname as language,
  p.prosecdef as security_definer,
  p.proconfig as function_settings
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname = 'public'
  and p.proname = 'set_user_repertoire_preference'
order by p.oid::regprocedure::text;

-- 7. Expected for the canonical text,text,text overload: one EXECUTE row for
-- authenticated; no anon or PUBLIC row.
select
  p.oid::regprocedure::text as function_signature,
  case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end as grantee,
  acl.privilege_type,
  acl.is_grantable
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
where n.nspname = 'public'
  and p.proname = 'set_user_repertoire_preference'
  and pg_get_function_identity_arguments(p.oid) =
    'p_repertoire_role text, p_canonical_opening_id text, p_preference text'
order by grantee, acl.privilege_type;

-- 8. Expected client ACL: authenticated has SELECT only; anon and PUBLIC have
-- no rows. Owner/admin ACL rows may also appear and are not client grants. Query
-- 5 must independently prove that authenticated SELECT is owner-filtered by RLS.
select
  case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end as grantee,
  acl.privilege_type,
  acl.is_grantable
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
where n.nspname = 'public'
  and c.relname = 'user_repertoire_preferences'
order by grantee, acl.privilege_type;

-- 9. Expected: zero rows. Internal constraint triggers are deliberately excluded.
select
  tg.tgname as trigger_name,
  tg.tgenabled as enabled_state,
  pg_get_triggerdef(tg.oid, true) as definition
from pg_trigger tg
join pg_class t on t.oid = tg.tgrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname = 'user_repertoire_preferences'
  and not tg.tgisinternal
order by tg.tgname;

-- 10. Expected: table_exists=true, ordinary_table=true, table_owner is the
-- production administrative owner, table_comment is canonical, and row data is
-- not queried or returned.
select
  to_regclass('public.user_repertoire_preferences') is not null as table_exists,
  c.relkind = 'r' as ordinary_table,
  pg_get_userbyid(c.relowner) as table_owner,
  obj_description(c.oid, 'pg_class') as table_comment
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'user_repertoire_preferences';
