-- Confirms the operator smoke scripts left no persistent fixture changes.
do $block$
begin
  if exists (
    select 1 from public.premium_entitlements
    where stripe_subscription_id = 'sub_openingfit_noncustomer_smoke'
       or last_stripe_event_id = 'evt_openingfit_noncustomer_entitlement_smoke'
  ) then raise exception 'Synthetic smoke entitlement survived rollback'; end if;
  if exists (
    select 1 from public.report_history
    where report_key in ('reconciliation-smoke-paid','reconciliation-smoke-free','must-not-change')
  ) then raise exception 'Synthetic smoke report survived rollback'; end if;
  if exists (
    select 1 from public.repertoire
    where canonical_name = 'Non-customer smoke' or display_name = 'Must fail'
  ) then raise exception 'Synthetic smoke repertoire survived rollback'; end if;
  if exists (
    select 1 from public.weekly_training_plans
    where primary_goal in ('Non-customer smoke','Must fail')
  ) then raise exception 'Synthetic smoke weekly plan survived rollback'; end if;
  if exists (
    select 1 from public.premium_entitlements
    where user_id = '00000000-0000-0000-0000-000000000007'
  ) then raise exception 'Free smoke entitlement survived rollback'; end if;
  if not exists (
    select 1 from public.profiles
    where user_id = '00000000-0000-0000-0000-000000000007'
      and coalesce(is_premium, false) is false
  ) then raise exception 'Free smoke profile was not restored'; end if;
end
$block$;
