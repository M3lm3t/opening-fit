insert into public.premium_entitlements (
  user_id, status, stripe_subscription_id, access_type,
  current_period_end, plan_interval, stripe_status
)
values (
  '00000000-0000-0000-0000-000000000007',
  'active',
  'sub_fixture_monthly',
  'monthly_subscription',
  now() + interval '30 days',
  'month',
  'active'
);
