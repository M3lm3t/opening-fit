select set_config('request.jwt.claim.role', 'service_role', false);
select public.grant_manual_lifetime_entitlement(
  '00000000-0000-0000-0000-000000000003',
  'manual_support'
);
