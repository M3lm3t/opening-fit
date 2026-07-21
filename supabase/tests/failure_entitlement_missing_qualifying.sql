update public.profiles
set is_premium = true
where user_id = '00000000-0000-0000-0000-000000000007';

insert into public.premium_entitlements (
  user_id, status, stripe_customer_id, stripe_subscription_id,
  access_type, plan_interval, checkout_mode, current_period_end
)
values (
  '00000000-0000-0000-0000-000000000007',
  'expired',
  'cus_fixture_expired_profile',
  'sub_fixture_expired_profile',
  'monthly_subscription',
  'month',
  'subscription',
  now() - interval '1 day'
);
