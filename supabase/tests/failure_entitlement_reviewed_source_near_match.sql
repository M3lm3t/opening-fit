-- A visually similar source is intentionally outside the exact allowlist.
insert into public.premium_entitlements (
  user_id, status, source, premium_since, expires_at
) values (
  '00000000-0000-0000-0000-000000000007',
  'active', 'legacy_lifetime_repair_near_match', now(), null
);
