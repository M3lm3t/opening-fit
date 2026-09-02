-- PRODUCTION WARNING: target frtjfvhiimgruenqcuon only; migration 002.
-- Required: prior baseline and preceding verification passed; Missions disabled; rollout 0%; notifications disabled.
-- On failure before COMMIT the transaction should roll back. After uncertain connection failure, do not rerun; run read-only inspection first.
BEGIN;
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

DO $assert$ begin if not exists(select 1 from pg_proc where oid=to_regprocedure('public.openingfit_missions_schema_readiness()') and prosecdef and proconfig @> array['search_path=public']) then raise exception '002 postcondition failed'; end if; end $assert$;
COMMIT;
