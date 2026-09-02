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
