-- The failed migration must leave both reviewed candidates pristine and must
-- also roll back its tentative subscription classification of the third row.
do $$
begin
  if (
    select count(*)
    from public.premium_entitlements
    where user_id in (
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002'
    )
      and source = 'legacy_lifetime_repair'
      and access_type is null
      and not is_grandfathered_lifetime
  ) <> 2 then
    raise exception 'Third-row failure changed a reviewed entitlement';
  end if;

  if not exists (
    select 1
    from public.premium_entitlements
    where user_id = '00000000-0000-0000-0000-000000000007'
      and source = 'legacy_lifetime_repair'
      and stripe_subscription_id = 'sub_reviewed_source_third_recurring_fixture'
      and access_type is null
      and not is_grandfathered_lifetime
  ) then
    raise exception 'Third-row failure did not roll back tentative classification';
  end if;

  if to_regclass('public.stripe_webhook_events') is not null then
    raise exception 'Third-row failure left a partial webhook table';
  end if;
end;
$$;
