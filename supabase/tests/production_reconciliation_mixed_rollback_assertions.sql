do $$
begin
  if not exists (
    select 1 from public.premium_entitlements
    where user_id = '00000000-0000-0000-0000-000000000001'
      and access_type = 'lifetime' and is_grandfathered_lifetime
  ) or not exists (
    select 1 from public.premium_entitlements
    where user_id = '00000000-0000-0000-0000-000000000002'
      and access_type is null and not is_grandfathered_lifetime
  ) then
    raise exception 'Mixed-state failure did not preserve the fixture state';
  end if;
  if to_regclass('public.stripe_webhook_events') is not null then
    raise exception 'Mixed-state failure left a partial webhook table';
  end if;
end;
$$;
