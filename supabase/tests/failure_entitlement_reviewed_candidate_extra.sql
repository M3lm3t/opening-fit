-- A third clean row with the exact approved source must stop the complete
-- exact-source cohort assertion instead of being silently classified.
insert into public.premium_entitlements (
  user_id, status, source, premium_since, expires_at
) values (
  '00000000-0000-0000-0000-000000000007',
  'active', 'legacy_lifetime_repair', now(), null
);
