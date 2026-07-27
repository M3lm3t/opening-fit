-- The count fixture intentionally removes one entitlement before migration 2.
-- A failed migration must not recreate it through profile-only backfill.
do $$
begin
  if not exists (
    select 1 from public.premium_entitlements
    where user_id = '00000000-0000-0000-0000-000000000001'
      and access_type is null
  ) then
    raise exception 'Reviewed candidate-count failure changed the retained row';
  end if;
  if exists (
    select 1 from public.premium_entitlements
    where user_id = '00000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'Reviewed candidate-count failure ran profile-only backfill';
  end if;
  if to_regclass('public.stripe_webhook_events') is not null then
    raise exception 'Reviewed candidate-count failure left a webhook table';
  end if;
end;
$$;
