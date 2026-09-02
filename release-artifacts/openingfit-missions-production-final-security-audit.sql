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
