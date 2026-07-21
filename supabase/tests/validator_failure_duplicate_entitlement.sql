-- Synthetic validator-only violation: duplicate owner and duplicate Stripe id.
alter table public.premium_entitlements drop constraint if exists premium_entitlements_pkey;
insert into public.premium_entitlements (
  user_id, status, source, stripe_subscription_id
) values (
  '00000000-0000-0000-0000-000000000001',
  'active', 'stripe_subscription.updated', 'sub_validator_duplicate'
);
update public.premium_entitlements
set stripe_subscription_id = 'sub_validator_duplicate'
where source = 'legacy_fixture';
