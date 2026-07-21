-- Local-only behavioral assertions. Raises on any failed expectation.

do $$
declare
  original_report_count bigint;
begin
  select count(*) into original_report_count from public.report_history;
  if original_report_count < 1 then
    raise exception 'Fixture report history was lost';
  end if;
  if (select count(*) from public.recommendation_history) < 1 then
    raise exception 'Fixture recommendation history was lost';
  end if;
  if (select count(*) from public.analysed_games) < 1 then
    raise exception 'Fixture analysed games were lost';
  end if;
  if (select count(*) from public.contact_messages) <> 1
     or (select count(*) from public.feedback) <> 1
     or (select count(*) from public.user_states) <> 1 then
    raise exception 'A production-only fixture table was changed';
  end if;
  if not exists (
    select 1 from public.repertoire
    where repertoire->>'legacyMarker' = 'must-remain'
  ) then
    raise exception 'Legacy repertoire JSON was not preserved';
  end if;
  if not exists (
    select 1 from public.repertoire
    where canonical_name = 'Fixture Opening'
  ) then
    raise exception 'Compatible legacy repertoire workspace JSON was not migrated';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from public.premium_entitlements
    where user_id = '00000000-0000-0000-0000-000000000001'
      and access_type = 'lifetime'
      and is_grandfathered_lifetime is true
      and status = 'active'
      and expires_at is null
  ) then
    raise exception 'Legacy active entitlement was not preserved as lifetime';
  end if;

  if not exists (
    select 1 from public.premium_entitlements
    where user_id = '00000000-0000-0000-0000-000000000002'
      and access_type = 'lifetime'
      and is_grandfathered_lifetime is true
  ) then
    raise exception 'Premium profile was not backfilled as lifetime';
  end if;

  if not exists (
    select 1 from public.premium_entitlements
    where user_id = '00000000-0000-0000-0000-000000000003'
      and access_type = 'monthly_subscription'
      and stripe_subscription_id is not null
  ) then
    raise exception 'Monthly subscription was converted or lost';
  end if;

  if not exists (
    select 1 from public.premium_entitlements
    where user_id = '00000000-0000-0000-0000-000000000004'
      and access_type = 'lifetime'
      and is_grandfathered_lifetime is true
  ) then
    raise exception 'Existing lifetime entitlement was downgraded';
  end if;

  if not exists (
    select 1 from public.premium_entitlements
    where user_id = '00000000-0000-0000-0000-000000000009'
      and access_type = 'lifetime'
      and is_grandfathered_lifetime is false
      and stripe_payment_intent_id = 'pi_fixture_payment'
      and stripe_price_id = 'price_lifetime'
      and checkout_mode = 'payment'
      and stripe_subscription_id is null
      and current_period_end is null
  ) then
    raise exception 'Explicit one-time payment was not preserved as lifetime';
  end if;

  if not exists (
    select 1 from public.premium_entitlements
    where user_id = '00000000-0000-0000-0000-000000000012'
      and access_type = 'lifetime'
      and is_grandfathered_lifetime is false
      and status = 'refunded'
      and source = 'stripe_charge.refunded'
      and stripe_status = 'refunded'
      and expires_at is not null
  ) then
    raise exception 'Legitimate lifetime refund state was not preserved';
  end if;

  insert into public.premium_entitlements (
    user_id, status, source, access_type, stripe_subscription_id,
    checkout_mode, plan_interval
  ) values (
    '00000000-0000-0000-0000-000000000011', 'active',
    'stripe_checkout_success_sync', 'annual_subscription',
    'sub_fixture_pending_interval', 'subscription', null
  );
  if not exists (
    select 1 from public.premium_entitlements
    where user_id = '00000000-0000-0000-0000-000000000011'
      and access_type = 'annual_subscription'
      and stripe_subscription_id = 'sub_fixture_pending_interval'
      and plan_interval is null
  ) then
    raise exception 'Checkout-sync subscription without interval was rejected';
  end if;
end;
$$;

-- Paid-access resolver matrix.
do $$
declare
  fixture record;
  actual boolean;
begin
  perform set_config('request.jwt.claim.role', 'authenticated', false);
  for fixture in
    select * from (values
      ('00000000-0000-0000-0000-000000000001'::uuid, true, 'legacy lifetime'),
      ('00000000-0000-0000-0000-000000000002'::uuid, true, 'profile lifetime'),
      ('00000000-0000-0000-0000-000000000003'::uuid, true, 'active monthly'),
      ('00000000-0000-0000-0000-000000000004'::uuid, true, 'existing lifetime'),
      ('00000000-0000-0000-0000-000000000005'::uuid, true, 'canceled but current annual'),
      ('00000000-0000-0000-0000-000000000006'::uuid, false, 'expired subscription'),
      ('00000000-0000-0000-0000-000000000007'::uuid, false, 'free user'),
      ('00000000-0000-0000-0000-000000000008'::uuid, true, 'active annual')
    ) matrix(user_id, expected, label)
  loop
    perform set_config('request.jwt.claim.sub', fixture.user_id::text, false);
    select public.openingfit_has_paid_access() into actual;
    if actual is distinct from fixture.expected then
      raise exception 'Paid access mismatch for %: expected %, got %', fixture.label, fixture.expected, actual;
    end if;
  end loop;

  perform set_config('request.jwt.claim.role', 'anon', false);
  perform set_config('request.jwt.claim.sub', '', false);
  if public.openingfit_has_paid_access() then
    raise exception 'Anonymous user unexpectedly has paid access';
  end if;
end;
$$;

-- Ordinary self-upgrade is rejected; the same write is accepted for the
-- service-role JWT context used by backend/webhook clients.
do $$
begin
  perform set_config('request.jwt.claim.role', 'authenticated', false);
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000007', false);
  begin
    update public.profiles
    set is_premium = true
    where user_id = '00000000-0000-0000-0000-000000000007';
    raise exception 'Ordinary user self-upgrade unexpectedly succeeded';
  exception
    when others then
      if sqlerrm = 'Ordinary user self-upgrade unexpectedly succeeded' then
        raise;
      end if;
  end;

  perform set_config('request.jwt.claim.role', 'service_role', false);
  perform set_config('request.jwt.claim.sub', '', false);
  update public.profiles
  set is_premium = true
  where user_id = '00000000-0000-0000-0000-000000000007';
  if not exists (
    select 1 from public.profiles
    where user_id = '00000000-0000-0000-0000-000000000007'
      and is_premium is true
  ) then
    raise exception 'Service-role premium write was blocked';
  end if;
  update public.profiles
  set is_premium = false
  where user_id = '00000000-0000-0000-0000-000000000007';
end;
$$;

-- Lifetime downgrade and stale-event attempts are ignored; a newer event wins.
do $$
declare
  prior_event_time timestamptz;
begin
  perform set_config('request.jwt.claim.role', 'service_role', false);

  update public.premium_entitlements
  set access_type = 'monthly_subscription',
      stripe_subscription_id = 'sub_attempted_downgrade'
  where user_id = '00000000-0000-0000-0000-000000000004';
  if not exists (
    select 1 from public.premium_entitlements
    where user_id = '00000000-0000-0000-0000-000000000004'
      and access_type = 'lifetime'
      and stripe_subscription_id is null
  ) then
    raise exception 'Lifetime downgrade guard failed';
  end if;

  select last_stripe_event_created_at into prior_event_time
  from public.premium_entitlements
  where user_id = '00000000-0000-0000-0000-000000000003';

  update public.premium_entitlements
  set status = 'expired',
      last_stripe_event_id = 'evt_fixture_stale',
      last_stripe_event_created_at = prior_event_time - interval '1 hour'
  where user_id = '00000000-0000-0000-0000-000000000003';
  if not exists (
    select 1 from public.premium_entitlements
    where user_id = '00000000-0000-0000-0000-000000000003'
      and status = 'active'
      and last_stripe_event_created_at = prior_event_time
  ) then
    raise exception 'Stale Stripe event overwrote newer state';
  end if;

  update public.premium_entitlements
  set status = 'canceled',
      last_stripe_event_id = 'evt_fixture_newer',
      last_stripe_event_created_at = prior_event_time + interval '1 hour'
  where user_id = '00000000-0000-0000-0000-000000000003';
  if not exists (
    select 1 from public.premium_entitlements
    where user_id = '00000000-0000-0000-0000-000000000003'
      and status = 'canceled'
      and last_stripe_event_created_at = prior_event_time + interval '1 hour'
  ) then
    raise exception 'Newer Stripe event was not accepted';
  end if;
end;
$$;

-- Owner-only report reads remain available to free authenticated users, while
-- cross-owner and anonymous reads remain unavailable.
set role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000007', false);
do $$
declare
  affected_rows bigint;
begin
  if (select count(*) from public.report_history where report_key = 'free-owner-report') <> 1 then
    raise exception 'Free owner could not read own report history';
  end if;
  if exists (
    select 1 from public.report_history
    where user_id = '00000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'Free user could read another owner report history';
  end if;

  begin
    insert into public.report_history (user_id, report_key)
    values ('00000000-0000-0000-0000-000000000007', 'free-mutation-fixture');
    raise exception 'Free report insert unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'Free report insert unexpectedly succeeded' then raise; end if;
  end;

  update public.report_history set report_key = 'free-update-fixture'
  where user_id = '00000000-0000-0000-0000-000000000007';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then raise exception 'Free report update unexpectedly affected rows'; end if;

  delete from public.report_history
  where user_id = '00000000-0000-0000-0000-000000000007';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then raise exception 'Free report delete unexpectedly affected rows'; end if;

  if (select count(*) from public.report_history where report_key = 'free-owner-report') <> 1 then
    raise exception 'Free report mutation checks changed the owner report';
  end if;
end;
$$;
reset role;

set role anon;
select set_config('request.jwt.claim.role', 'anon', false);
select set_config('request.jwt.claim.sub', '', false);
do $$
begin
  begin
    perform count(*) from public.report_history;
    raise exception 'Anonymous report read unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
reset role;

-- Paid owner mutation and service-role access remain compatible.
set role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
insert into public.report_history (user_id, report_key)
values ('00000000-0000-0000-0000-000000000001', 'paid-mutation-fixture');
reset role;

set role service_role;
select set_config('request.jwt.claim.role', 'service_role', false);
select set_config('request.jwt.claim.sub', '', false);
do $$
begin
  if (select count(*) from public.report_history) < 3 then
    raise exception 'Service role could not read report history';
  end if;
end;
$$;
reset role;

-- The manual lifetime RPC is atomic and idempotent.
select set_config('request.jwt.claim.role', 'service_role', false);
do $$
declare
  first_result text;
  second_result text;
begin
  select public.grant_manual_lifetime_entitlement(
    '00000000-0000-0000-0000-000000000010', 'manual_support'
  ) into first_result;
  select public.grant_manual_lifetime_entitlement(
    '00000000-0000-0000-0000-000000000010', 'manual_support'
  ) into second_result;

  if first_result <> 'created_lifetime' or second_result <> 'preserved_lifetime' then
    raise exception 'Manual lifetime grant was not idempotent';
  end if;
  if (select count(*) from public.premium_entitlements
      where user_id = '00000000-0000-0000-0000-000000000010') <> 1 then
    raise exception 'Manual lifetime grant created duplicate owners';
  end if;
  if not exists (
    select 1 from public.premium_entitlements
    where user_id = '00000000-0000-0000-0000-000000000010'
      and access_type = 'lifetime'
      and is_grandfathered_lifetime is true
      and status = 'active'
      and expires_at is null
      and stripe_subscription_id is null
  ) then
    raise exception 'Manual lifetime grant did not create canonical access';
  end if;
  if not exists (
    select 1 from public.profiles
    where user_id = '00000000-0000-0000-0000-000000000010'
      and is_premium is true
  ) then
    raise exception 'Manual lifetime grant did not update the profile';
  end if;
end;
$$;
