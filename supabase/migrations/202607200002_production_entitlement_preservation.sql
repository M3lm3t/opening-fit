-- Forward-only canonical entitlement reconciliation. Existing paid access is
-- preserved conservatively before any paid-feature enforcement is installed.

begin;

do $$
begin
  if to_regclass('public.premium_entitlements') is null
     or to_regclass('public.profiles') is null then
    raise exception 'Entitlement reconciliation precondition failed: required tables are missing';
  end if;

  if exists (
    select 1 from public.premium_entitlements
    where user_id is null
  ) then
    raise exception 'Entitlement reconciliation precondition failed: entitlement owner is missing';
  end if;

  if exists (
    select 1 from public.premium_entitlements
    group by user_id having count(*) > 1
  ) then
    raise exception 'Entitlement reconciliation precondition failed: duplicate entitlement owners';
  end if;

  if exists (
    select 1 from public.premium_entitlements
    where stripe_subscription_id is not null
    group by stripe_subscription_id having count(*) > 1
  ) then
    raise exception 'Entitlement reconciliation precondition failed: duplicate Stripe subscription IDs';
  end if;
end;
$$;

alter table public.premium_entitlements
  add column if not exists access_type text,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists is_grandfathered_lifetime boolean not null default false,
  add column if not exists plan_interval text,
  add column if not exists stripe_status text,
  add column if not exists current_period_start timestamptz,
  add column if not exists last_stripe_event_id text,
  add column if not exists last_stripe_event_created_at timestamptz;

alter table public.premium_entitlements
  drop constraint if exists premium_entitlements_access_type_check,
  drop constraint if exists premium_entitlements_plan_interval_check,
  drop constraint if exists premium_entitlements_classification_shape_check;

-- Validate all lifecycle evidence before any data-changing statement can clear,
-- classify, or normalise it. These checks deliberately return only fixed error
-- text: Stripe references and user identifiers never appear in exceptions.
do $$
begin
  if exists (
    select 1 from public.premium_entitlements
    where checkout_mode = 'payment'
      and (
        stripe_subscription_id is not null
        or plan_interval is not null
        or lower(coalesce(stripe_status, '')) in (
          'active', 'trialing', 'past_due', 'canceled', 'unpaid',
          'incomplete', 'incomplete_expired', 'paused'
        )
        or current_period_start is not null
        or current_period_end is not null
        or source in (
          'stripe_customer.subscription.created',
          'stripe_customer.subscription.updated',
          'stripe_customer.subscription.deleted',
          'stripe_invoice.paid',
          'stripe_invoice.payment_failed'
        )
        or (
          (last_stripe_event_id is not null or last_stripe_event_created_at is not null)
          and coalesce(source, '') not in (
            'stripe_charge.refunded', 'stripe_refund.updated',
            'stripe_checkout', 'stripe_checkout_success_sync'
          )
        )
      )
  ) then
    raise exception 'Entitlement reconciliation failed: ambiguous entitlement lifecycle evidence';
  end if;

  if exists (
    select 1 from public.premium_entitlements
    where access_type = 'lifetime'
      and (
        stripe_subscription_id is not null
        or checkout_mode = 'subscription'
        or plan_interval is not null
        or lower(coalesce(stripe_status, '')) in (
          'active', 'trialing', 'past_due', 'canceled', 'unpaid',
          'incomplete', 'incomplete_expired', 'paused'
        )
        or current_period_start is not null
        or current_period_end is not null
        or source in (
          'stripe_customer.subscription.created',
          'stripe_customer.subscription.updated',
          'stripe_customer.subscription.deleted',
          'stripe_invoice.paid',
          'stripe_invoice.payment_failed'
        )
      )
  ) then
    raise exception 'Entitlement reconciliation failed: contradictory lifetime and subscription evidence';
  end if;

  if exists (
    select 1 from public.premium_entitlements
    where access_type is null
      and coalesce(checkout_mode, '') <> 'payment'
      and (
        stripe_customer_id is not null
        or stripe_payment_intent_id is not null
        or stripe_price_id is not null
        or stripe_subscription_id is not null
        or checkout_mode = 'subscription'
        or plan_interval is not null
        or stripe_status is not null
        or current_period_start is not null
        or current_period_end is not null
        or source in (
          'stripe_customer.subscription.created',
          'stripe_customer.subscription.updated',
          'stripe_customer.subscription.deleted',
          'stripe_invoice.paid',
          'stripe_invoice.payment_failed'
        )
        or last_stripe_event_id is not null
        or last_stripe_event_created_at is not null
      )
      and not coalesce((
        stripe_subscription_id is not null
        or checkout_mode = 'subscription'
        or plan_interval in ('month', 'year')
        or (
          lower(coalesce(stripe_status, '')) in (
            'active', 'trialing', 'past_due', 'canceled', 'unpaid',
            'incomplete', 'incomplete_expired', 'paused'
          )
          and (current_period_start is not null or current_period_end is not null)
        )
      ), false)
  ) then
    raise exception 'Entitlement reconciliation failed: ambiguous entitlement lifecycle evidence';
  end if;
end;
$$;

-- 1. Classify records with conclusive recurring evidence. Backend subscription
-- sources are supporting evidence but, by design, are not sufficient alone.
update public.premium_entitlements
set access_type = case
      when plan_interval = 'year' then 'annual_subscription'
      else 'monthly_subscription'
    end
where access_type is null
  and coalesce(checkout_mode, '') <> 'payment'
  and (
    stripe_subscription_id is not null
    or checkout_mode = 'subscription'
    or plan_interval in ('month', 'year')
    or (
      lower(coalesce(stripe_status, '')) in (
        'active', 'trialing', 'past_due', 'canceled', 'unpaid',
        'incomplete', 'incomplete_expired', 'paused'
      )
      and (current_period_start is not null or current_period_end is not null)
    )
  );

-- 2. Explicit one-time checkout purchases may retain customer, Price, and
-- PaymentIntent references, but may contain no recurring lifecycle evidence.
update public.premium_entitlements
set access_type = 'lifetime'
where access_type is null
  and checkout_mode = 'payment'
  and stripe_subscription_id is null
  and plan_interval is null
  and current_period_start is null
  and current_period_end is null
  and stripe_status is null
  and coalesce(source, '') not in (
    'stripe_customer.subscription.created',
    'stripe_customer.subscription.updated',
    'stripe_customer.subscription.deleted',
    'stripe_invoice.paid',
    'stripe_invoice.payment_failed'
  )
  and last_stripe_event_id is null
  and last_stripe_event_created_at is null;

-- 3. Conservative legacy lifetime inference requires an active, non-expiring
-- grant and no Stripe object, checkout, lifecycle, or event evidence. Only
-- known legacy/manual sources are accepted; an unknown source remains visible
-- for human classification instead of being guessed.
update public.premium_entitlements
set access_type = 'lifetime',
    is_grandfathered_lifetime = true
where access_type is null
  and lower(coalesce(status, '')) in ('active', 'premium', 'paid', 'lifetime')
  and expires_at is null
  and stripe_customer_id is null
  and stripe_subscription_id is null
  and stripe_payment_intent_id is null
  and stripe_price_id is null
  and checkout_mode is null
  and plan_interval is null
  and stripe_status is null
  and current_period_start is null
  and current_period_end is null
  and last_stripe_event_id is null
  and last_stripe_event_created_at is null
  and (
    source is null
    or source in ('legacy', 'legacy_fixture', 'legacy_lifetime_backfill', 'manual_support')
  );

-- Profiles were historically the only lifetime-access source. Insert only when
-- no entitlement exists, and never overwrite a subscription or lifetime row.
insert into public.premium_entitlements (
  user_id,
  status,
  source,
  access_type,
  is_grandfathered_lifetime,
  premium_since,
  expires_at,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  created_at,
  updated_at
)
select
  profile.user_id,
  'active',
  'legacy_lifetime_backfill',
  'lifetime',
  true,
  coalesce(profile.premium_updated_at, profile.updated_at, profile.created_at, now()),
  null,
  null,
  null,
  false,
  now(),
  now()
from public.profiles profile
where profile.user_id is not null
  and profile.is_premium is true
  and not exists (
    select 1 from public.premium_entitlements entitlement
    where entitlement.user_id = profile.user_id
  )
on conflict (user_id) do nothing;

-- Every row must now be classified before any evidence is normalised.
do $$
begin
  if exists (
    select 1 from public.premium_entitlements
    where access_type is null
  ) then
    raise exception 'Entitlement reconciliation failed: unclassified entitlement rows remain';
  end if;

  if exists (
    select 1 from public.premium_entitlements
    where access_type not in ('monthly_subscription', 'annual_subscription', 'lifetime')
  ) then
    raise exception 'Entitlement reconciliation failed: unsupported entitlement access type';
  end if;

  if exists (
    select 1 from public.premium_entitlements
    where access_type in ('monthly_subscription', 'annual_subscription')
      and stripe_subscription_id is null
      and coalesce(checkout_mode, '') <> 'subscription'
      and coalesce(plan_interval, '') not in ('month', 'year')
      and not (
        lower(coalesce(stripe_status, '')) in (
          'active', 'trialing', 'past_due', 'canceled', 'unpaid',
          'incomplete', 'incomplete_expired', 'paused'
        )
        and (current_period_start is not null or current_period_end is not null)
      )
  ) then
    raise exception 'Entitlement reconciliation failed: subscription lacks meaningful lifecycle evidence';
  end if;
end;
$$;

-- Classification is complete. Only now remove fields incompatible with the
-- chosen canonical type and supply the canonical subscription interval.
update public.premium_entitlements
set is_grandfathered_lifetime = true
where access_type = 'lifetime'
  and checkout_mode is distinct from 'payment'
  and stripe_payment_intent_id is null
  and stripe_price_id is null
  and coalesce(source, '') not in (
    'stripe_checkout', 'stripe_checkout_success_sync',
    'stripe_charge.refunded', 'stripe_refund.updated'
  );

update public.premium_entitlements
set current_period_start = null,
    current_period_end = null,
    cancel_at_period_end = false,
    plan_interval = null
where access_type = 'lifetime';

update public.premium_entitlements
set status = 'active',
    expires_at = null,
    stripe_status = null
where access_type = 'lifetime'
  and not (
    is_grandfathered_lifetime is false
    and status = 'refunded'
    and source in ('stripe_charge.refunded', 'stripe_refund.updated')
    and stripe_status = 'refunded'
    and expires_at is not null
  );

update public.premium_entitlements
set plan_interval = case
      when access_type = 'annual_subscription' then 'year'
      else 'month'
    end
where access_type in ('monthly_subscription', 'annual_subscription');

-- Final invariants run before constraints and feature enforcement.
do $$
begin
  if exists (
    select 1 from public.premium_entitlements where user_id is null
  ) then
    raise exception 'Entitlement reconciliation failed: entitlement owner is missing';
  end if;

  if exists (
    select 1 from public.premium_entitlements
    group by user_id having count(*) > 1
  ) then
    raise exception 'Entitlement reconciliation failed: duplicate entitlement owners';
  end if;

  if exists (
    select 1 from public.premium_entitlements
    where stripe_subscription_id is not null
    group by stripe_subscription_id having count(*) > 1
  ) then
    raise exception 'Entitlement reconciliation failed: duplicate Stripe subscription IDs';
  end if;

  if exists (
    select 1
    from public.premium_entitlements
    where access_type = 'lifetime'
      and (
        current_period_start is not null
        or current_period_end is not null
        or cancel_at_period_end is true
      )
  ) then
    raise exception 'Entitlement reconciliation failed: lifetime access has a subscription period';
  end if;

  if exists (
    select 1
    from public.premium_entitlements
    where access_type = 'lifetime'
      and (
        stripe_subscription_id is not null
        or checkout_mode = 'subscription'
        or plan_interval is not null
        or source in (
          'stripe_customer.subscription.created',
          'stripe_customer.subscription.updated',
          'stripe_customer.subscription.deleted',
          'stripe_invoice.paid',
          'stripe_invoice.payment_failed'
        )
        or (
          stripe_status is not null
          and not (
            is_grandfathered_lifetime is false
            and status = 'refunded'
            and source in ('stripe_charge.refunded', 'stripe_refund.updated')
            and stripe_status = 'refunded'
            and expires_at is not null
          )
        )
      )
  ) then
    raise exception 'Entitlement reconciliation failed: a subscription is classified as lifetime';
  end if;

  if exists (
    select 1 from public.premium_entitlements
    where access_type is null
       or access_type not in ('monthly_subscription', 'annual_subscription', 'lifetime')
  ) then
    raise exception 'Entitlement reconciliation failed: unclassified entitlement rows remain';
  end if;

  if exists (
    select 1 from public.premium_entitlements
    where access_type in ('monthly_subscription', 'annual_subscription')
      and stripe_subscription_id is null
      and coalesce(checkout_mode, '') <> 'subscription'
      and coalesce(plan_interval, '') not in ('month', 'year')
      and not (
        lower(coalesce(stripe_status, '')) in (
          'active', 'trialing', 'past_due', 'canceled', 'unpaid',
          'incomplete', 'incomplete_expired', 'paused'
        )
        and (current_period_start is not null or current_period_end is not null)
      )
  ) then
    raise exception 'Entitlement reconciliation failed: subscription lacks meaningful lifecycle evidence';
  end if;

  if exists (
    select 1
    from public.profiles profile
    where profile.is_premium is true
      and profile.user_id is not null
      and not exists (
        select 1
        from public.premium_entitlements entitlement
        where entitlement.user_id = profile.user_id
          and (
            (
              entitlement.access_type = 'lifetime'
              and (entitlement.is_grandfathered_lifetime is true
                   or entitlement.status in ('active', 'trialing'))
            )
            or (
              entitlement.access_type in ('monthly_subscription', 'annual_subscription')
              and (
                entitlement.status in ('active', 'trialing')
                or (entitlement.status in ('canceled', 'past_due')
                    and entitlement.current_period_end > now())
              )
            )
          )
      )
  ) then
    raise exception 'Entitlement reconciliation failed: premium profile lacks qualifying paid access';
  end if;
end;
$$;

alter table public.premium_entitlements
  alter column access_type set not null,
  add constraint premium_entitlements_access_type_check
  check (access_type in ('monthly_subscription', 'annual_subscription', 'lifetime'));

alter table public.premium_entitlements
  add constraint premium_entitlements_plan_interval_check
  check (plan_interval is null or plan_interval in ('month', 'year'));

alter table public.premium_entitlements
  add constraint premium_entitlements_classification_shape_check
  check (
    (
      access_type = 'lifetime'
      and stripe_subscription_id is null
      and checkout_mode is distinct from 'subscription'
      and coalesce(source, '') not in (
        'stripe_customer.subscription.created',
        'stripe_customer.subscription.updated',
        'stripe_customer.subscription.deleted',
        'stripe_invoice.paid',
        'stripe_invoice.payment_failed'
      )
      and plan_interval is null
      and current_period_start is null
      and current_period_end is null
      and cancel_at_period_end is false
      and (
        (stripe_status is null and expires_at is null)
        or (
          is_grandfathered_lifetime is false
          and status = 'refunded'
          and source in ('stripe_charge.refunded', 'stripe_refund.updated')
          and stripe_status = 'refunded'
          and expires_at is not null
        )
      )
    )
    or (
      access_type = 'monthly_subscription'
      and (plan_interval is null or plan_interval = 'month')
      and (
        stripe_subscription_id is not null
        or checkout_mode = 'subscription'
        or plan_interval = 'month'
        or (stripe_status is not null and (current_period_start is not null or current_period_end is not null))
      )
    )
    or (
      access_type = 'annual_subscription'
      and (plan_interval is null or plan_interval = 'year')
      and (
        stripe_subscription_id is not null
        or checkout_mode = 'subscription'
        or plan_interval = 'year'
        or (stripe_status is not null and (current_period_start is not null or current_period_end is not null))
      )
    )
  );

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  object_id text,
  status text not null default 'processing',
  attempt_count integer not null default 1,
  last_error text,
  first_received_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint stripe_webhook_events_status_check
    check (status in ('processing', 'processed', 'ignored', 'failed'))
);

create index if not exists stripe_webhook_events_status_updated_idx
  on public.stripe_webhook_events(status, updated_at desc);

alter table public.stripe_webhook_events enable row level security;
revoke all on public.stripe_webhook_events from anon, authenticated;
grant all on public.stripe_webhook_events to service_role;

create or replace function public.preserve_lifetime_premium_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.access_type = 'lifetime' and (
    old.is_grandfathered_lifetime is true
    or coalesce(new.source, '') not in ('stripe_charge.refunded', 'stripe_refund.updated')
  ) then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.prevent_stale_stripe_entitlement_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.last_stripe_event_created_at is not null
     and new.last_stripe_event_created_at is not null
     and new.last_stripe_event_created_at < old.last_stripe_event_created_at then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists preserve_lifetime_premium_entitlement
  on public.premium_entitlements;
create trigger preserve_lifetime_premium_entitlement
before update on public.premium_entitlements
for each row execute function public.preserve_lifetime_premium_entitlement();

drop trigger if exists prevent_stale_stripe_entitlement_update
  on public.premium_entitlements;
create trigger prevent_stale_stripe_entitlement_update
before update on public.premium_entitlements
for each row execute function public.prevent_stale_stripe_entitlement_update();

-- Atomic service-role workflow for exceptional manual lifetime restoration.
-- It never replaces a subscription or an ambiguous row, and it updates the
-- legacy profile flag only after the canonical entitlement is safe.
create or replace function public.grant_manual_lifetime_entitlement(
  p_user_id uuid,
  p_reason text default 'manual_support'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.premium_entitlements%rowtype;
  grant_result text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), auth.role(), '') <> 'service_role' then
    raise exception 'Manual lifetime grant requires service role';
  end if;
  if p_user_id is null then
    raise exception 'Manual lifetime grant requires a target user';
  end if;
  if p_reason <> 'manual_support' then
    raise exception 'Manual lifetime grant reason is unsupported';
  end if;
  if not exists (select 1 from public.profiles where user_id = p_user_id) then
    raise exception 'Manual lifetime grant target profile is missing';
  end if;

  select * into existing
  from public.premium_entitlements
  where user_id = p_user_id
  for update;

  if found then
    if existing.access_type in ('monthly_subscription', 'annual_subscription') then
      raise exception 'Manual lifetime grant refused: existing subscription entitlement';
    end if;
    if existing.access_type <> 'lifetime'
       or existing.stripe_subscription_id is not null
       or existing.checkout_mode = 'subscription'
       or existing.plan_interval is not null
       or existing.stripe_status is not null
       or existing.current_period_start is not null
       or existing.current_period_end is not null
       or existing.expires_at is not null then
      raise exception 'Manual lifetime grant refused: ambiguous existing entitlement';
    end if;
    grant_result := 'preserved_lifetime';
  else
    insert into public.premium_entitlements (
      user_id, status, source, access_type, is_grandfathered_lifetime,
      premium_since, expires_at, current_period_start, current_period_end,
      cancel_at_period_end, plan_interval, stripe_status, stripe_subscription_id,
      created_at, updated_at
    ) values (
      p_user_id, 'active', p_reason, 'lifetime', true,
      now(), null, null, null, false, null, null, null, now(), now()
    );
    grant_result := 'created_lifetime';
  end if;

  update public.profiles
  set is_premium = true,
      premium_status = 'active',
      premium_source = p_reason,
      premium_updated_at = now(),
      updated_at = now()
  where user_id = p_user_id;

  return grant_result;
end;
$$;

revoke all on function public.grant_manual_lifetime_entitlement(uuid, text)
  from public, anon, authenticated;
grant execute on function public.grant_manual_lifetime_entitlement(uuid, text)
  to service_role;

comment on column public.premium_entitlements.access_type is
  'Canonical paid access type. Free access is represented by no qualifying entitlement.';
comment on table public.stripe_webhook_events is
  'Server-only idempotency ledger for verified Stripe webhook events.';

commit;
