-- READ ONLY. Migration 003 verification. Run each numbered SELECT independently.
-- 1. Relations and exact columns.
select name,to_regclass('public.'||name) object from unnest(array['openingfit_mission_training_sessions','openingfit_mission_training_attempts']) name;
select table_name,column_name,data_type,udt_name,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name=any(array['openingfit_mission_training_sessions','openingfit_mission_training_attempts']) order by 1,ordinal_position;
-- 2. Constraints, foreign keys and idempotency.
select c.conrelid::regclass table_name,c.conname,c.contype,pg_get_constraintdef(c.oid) definition from pg_constraint c where c.conrelid=any(array['openingfit_mission_training_sessions','openingfit_mission_training_attempts']::regclass[]) order by 1,2;
-- 3. Indexes, including partial uniqueness.
select tablename,indexname,indexdef from pg_indexes where schemaname='public' and tablename=any(array['openingfit_mission_training_sessions','openingfit_mission_training_attempts']) order by 1,2;
-- 4. RLS, policies and direct grants.
select c.relname,c.relrowsecurity from pg_class c join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' and c.relname=any(array['openingfit_mission_training_sessions','openingfit_mission_training_attempts']) order by 1;
select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' and tablename=any(array['openingfit_mission_training_sessions','openingfit_mission_training_attempts']) order by 1,2;
select table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and table_name=any(array['openingfit_mission_training_sessions','openingfit_mission_training_attempts']) order by 1,2,3;
-- 5. Procedure security, safe search path, exact definitions and grants.
select p.proname,pg_get_function_identity_arguments(p.oid) arguments,p.prosecdef,p.proconfig,has_function_privilege('public',p.oid,'execute') public_execute,has_function_privilege('anon',p.oid,'execute') anon_execute,has_function_privilege('authenticated',p.oid,'execute') authenticated_execute,has_function_privilege('service_role',p.oid,'execute') service_execute,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='public' and p.proname=any(array['openingfit_protect_training_session','start_openingfit_mission_training_session','record_openingfit_mission_training_attempt','complete_openingfit_mission_training_session','openingfit_missions_schema_readiness']) order by 1,2;
-- 6. Triggers and safe aggregate estimates.
select event_object_table,trigger_name,action_timing,event_manipulation,action_statement from information_schema.triggers where event_object_schema='public' and event_object_table=any(array['openingfit_mission_training_sessions','openingfit_mission_training_attempts']) order by 1,2;
select c.relname,c.reltuples::bigint estimated_rows from pg_class c join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' and c.relname=any(array['openingfit_mission_training_sessions','openingfit_mission_training_attempts']) order by 1;
-- Expected results: session ownership FK; one active session; immutable manifest trigger; service-only mutation; readiness schemaVersion 3 in definition
