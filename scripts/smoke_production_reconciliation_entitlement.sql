-- POST-MIGRATION-2, rollback-only. Set openingfit.smoke_free_user to a
-- designated non-customer profile UUID in the same database session.
begin;
create temporary table openingfit_original_entitlement as
select * from public.premium_entitlements
where user_id=current_setting('openingfit.smoke_free_user')::uuid;
do $block$ begin
  if not exists (select 1 from public.profiles where user_id=current_setting('openingfit.smoke_free_user')::uuid)
    then raise exception 'Designated smoke profile does not exist'; end if;
  if exists (
    select 1 from openingfit_original_entitlement where
      stripe_customer_id is not null or stripe_subscription_id is not null
      or stripe_payment_intent_id is not null or stripe_price_id is not null
      or last_stripe_event_id is not null
  ) then raise exception 'STOP: designated entitlement account has Stripe evidence'; end if;
end $block$;
select set_config('request.jwt.claim.role','service_role',true);
delete from public.premium_entitlements
where user_id=current_setting('openingfit.smoke_free_user')::uuid;
insert into public.premium_entitlements(
  user_id,access_type,status,stripe_status,stripe_subscription_id,plan_interval,
  source,current_period_start,current_period_end,last_stripe_event_id,last_stripe_event_created_at
) values (
  current_setting('openingfit.smoke_free_user')::uuid,'monthly_subscription','active','active',
  'sub_openingfit_noncustomer_smoke','month','reconciliation_smoke',now()-interval '1 day',
  now()+interval '29 days','evt_openingfit_noncustomer_entitlement_smoke',now()
)
on conflict(user_id) do update set
  access_type=excluded.access_type,status=excluded.status,stripe_status=excluded.stripe_status,
  stripe_subscription_id=excluded.stripe_subscription_id,plan_interval=excluded.plan_interval,
  source=excluded.source,current_period_start=excluded.current_period_start,
  current_period_end=excluded.current_period_end,last_stripe_event_id=excluded.last_stripe_event_id,
  last_stripe_event_created_at=excluded.last_stripe_event_created_at;
do $block$ begin
  if not exists (
    select 1 from public.premium_entitlements
    where user_id=current_setting('openingfit.smoke_free_user')::uuid
      and access_type='monthly_subscription' and status='active'
      and stripe_subscription_id='sub_openingfit_noncustomer_smoke'
  ) then raise exception 'Synthetic entitlement upsert failed'; end if;
end $block$;
rollback;
