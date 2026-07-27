-- A third row with the exact approved source must be counted before recurring
-- evidence filtering. Migration 2 may tentatively classify it as a subscription,
-- but the exact-source cohort gate must reject and roll back the whole file.
insert into public.premium_entitlements (
  user_id, status, source, stripe_subscription_id, premium_since, expires_at
) values (
  '00000000-0000-0000-0000-000000000007',
  'active', 'legacy_lifetime_repair',
  'sub_reviewed_source_third_recurring_fixture', now(), null
);
