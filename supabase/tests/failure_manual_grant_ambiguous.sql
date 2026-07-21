begin;
alter table public.premium_entitlements
  drop constraint premium_entitlements_classification_shape_check;
insert into public.premium_entitlements (
  user_id, status, access_type, current_period_end
) values (
  '00000000-0000-0000-0000-000000000007',
  'active',
  'lifetime',
  now() + interval '1 month'
);
select set_config('request.jwt.claim.role', 'service_role', false);
select public.grant_manual_lifetime_entitlement(
  '00000000-0000-0000-0000-000000000007',
  'manual_support'
);
commit;
