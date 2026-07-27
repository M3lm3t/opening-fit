-- Removing one reviewed entitlement must make migration 2 fail closed before
-- profile-only backfill can manufacture a replacement.
delete from public.premium_entitlements
where user_id = '00000000-0000-0000-0000-000000000002';
