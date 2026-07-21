do $$
begin
  if exists (
    select 1 from public.premium_entitlements
    where user_id = '00000000-0000-0000-0000-000000000001'
      and access_type is not null
  ) then
    raise exception 'Expected-failure migration left a partial lifetime classification';
  end if;
  if to_regclass('public.stripe_webhook_events') is not null then
    raise exception 'Expected-failure migration left a partial webhook table';
  end if;
end;
$$;
