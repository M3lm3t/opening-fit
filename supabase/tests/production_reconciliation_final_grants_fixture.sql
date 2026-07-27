-- Local-only final-schema fixture matching the reviewed production grants.
-- Production grants anon table privileges; RLS, paid-mutation triggers, and
-- explicit function revokes provide the effective boundary.
grant all on public.report_history to anon;
grant all on public.repertoire to anon;
grant all on public.weekly_training_plans to anon;
grant all on public.premium_entitlements to anon;

-- These grants pre-exist in the reviewed production schema. The reconciliation
-- migration preserves them; the disposable legacy fixture must reproduce them
-- so the trusted-boundary branch exercises the same effective contract.
grant all on public.report_history to service_role;
grant all on public.profiles to service_role;
grant all on public.repertoire to service_role;
grant all on public.weekly_training_plans to service_role;
grant all on public.premium_entitlements to service_role;
grant execute on function public.apply_repertoire_training_outcomes(jsonb) to service_role;
grant execute on function public.grant_manual_lifetime_entitlement(uuid, text) to service_role;
