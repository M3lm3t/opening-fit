-- PRODUCTION WARNING: target frtjfvhiimgruenqcuon only; migration 002.
-- Required: prior baseline and preceding verification passed; Missions disabled; rollout 0%; notifications disabled.
-- On failure before COMMIT the transaction should roll back. After uncertain connection failure, do not rerun; run read-only inspection first.
BEGIN;
DO $precondition$ begin if (select count(*) from pg_class where oid=any(array[to_regclass('public.openingfit_missions'),to_regclass('public.openingfit_mission_training_attempts'),to_regclass('public.openingfit_mission_encounters'),to_regclass('public.openingfit_mission_status_events')]) and relrowsecurity)<>4 or (select count(*) from pg_policies where schemaname='public' and tablename=any(array['openingfit_missions','openingfit_mission_training_attempts','openingfit_mission_encounters','openingfit_mission_status_events']))<>4 or to_regprocedure('public.transition_openingfit_mission(uuid,uuid,text,text,text,text,jsonb)') is null or to_regprocedure('public.dismiss_openingfit_mission(uuid,text,text)') is null or not exists(select 1 from pg_trigger where tgrelid=to_regclass('public.openingfit_missions') and tgname='openingfit_protect_mission_identity' and not tgisinternal) then raise exception 'completed migration 001 is required'; end if; end $precondition$;
-- Phase 3 protected readiness probe. Phase 2 foundation must be applied first.
create or replace function public.openingfit_missions_schema_readiness()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'ready',
    to_regclass('public.openingfit_missions') is not null
    and to_regclass('public.openingfit_mission_training_attempts') is not null
    and to_regclass('public.openingfit_mission_encounters') is not null
    and to_regclass('public.openingfit_mission_status_events') is not null
    and to_regprocedure('public.transition_openingfit_mission(uuid,uuid,text,text,text,text,jsonb)') is not null
    and to_regprocedure('public.dismiss_openingfit_mission(uuid,text,text)') is not null,
    'schemaVersion', 1
  )
$$;
revoke all on function public.openingfit_missions_schema_readiness() from public, anon, authenticated;
grant execute on function public.openingfit_missions_schema_readiness() to service_role;

comment on function public.openingfit_missions_schema_readiness() is 'Backend-only, secret-free readiness probe for the additive Missions schema and protected RPCs.';

DO $assert$ begin if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='openingfit_missions_schema_readiness')<>1 or not exists(select 1 from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=to_regprocedure('public.openingfit_missions_schema_readiness()') and p.prorettype='jsonb'::regtype and l.lanname='sql' and p.provolatile='s' and p.prosecdef and p.proconfig @> array['search_path=public']) or has_function_privilege(0,to_regprocedure('public.openingfit_missions_schema_readiness()'),'execute') or has_function_privilege('anon',to_regprocedure('public.openingfit_missions_schema_readiness()'),'execute') or has_function_privilege('authenticated',to_regprocedure('public.openingfit_missions_schema_readiness()'),'execute') or not has_function_privilege('service_role',to_regprocedure('public.openingfit_missions_schema_readiness()'),'execute') or public.openingfit_missions_schema_readiness() is distinct from jsonb_build_object('ready',true,'schemaVersion',1) then raise exception '002 postcondition failed'; end if; end $assert$;
COMMIT;
