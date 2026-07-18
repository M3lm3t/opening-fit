alter table public.premium_entitlements
  add column if not exists access_type text,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists is_grandfathered_lifetime boolean not null default false;

alter table public.premium_entitlements
  drop constraint if exists premium_entitlements_access_type_check;

alter table public.premium_entitlements
  add constraint premium_entitlements_access_type_check
  check (access_type in ('monthly_subscription', 'annual_subscription', 'lifetime'));

-- Existing one-off payments are lifetime purchases. Existing subscriptions did
-- not store their interval, so retain them as monthly until Stripe next sends a
-- subscription event with the authoritative price interval.
update public.premium_entitlements
set access_type = case
  when checkout_mode = 'payment' then 'lifetime'
  when checkout_mode = 'subscription' then 'monthly_subscription'
  else access_type
end
where access_type is null;

-- Very old lifetime grants can pre-date checkout_mode. A protected premium
-- profile with no subscription marker is treated as the legacy lifetime source.
update public.premium_entitlements entitlement
set access_type = 'lifetime',
    status = 'active',
    expires_at = null,
    is_grandfathered_lifetime = true
from public.profiles profile
where entitlement.user_id = profile.user_id
  and profile.is_premium is true
  and entitlement.access_type is null
  and coalesce(entitlement.checkout_mode, '') <> 'subscription';

update public.premium_entitlements
set is_grandfathered_lifetime = true
where access_type = 'lifetime';

-- Preserve legacy members who pre-date premium_entitlements. A profile premium
-- flag is used only for this one-way migration; it is no longer an access source.
insert into public.premium_entitlements (
  user_id,
  status,
  source,
  access_type,
  is_grandfathered_lifetime,
  premium_since,
  expires_at,
  created_at,
  updated_at
)
select
  profiles.user_id,
  'active',
  'legacy_lifetime_backfill',
  'lifetime',
  true,
  coalesce(profiles.premium_updated_at, profiles.updated_at, profiles.created_at, now()),
  null,
  now(),
  now()
from public.profiles
where profiles.user_id is not null
  and profiles.is_premium is true
  and not exists (
    select 1
    from public.premium_entitlements entitlement
    where entitlement.user_id = profiles.user_id
  )
on conflict (user_id) do nothing;

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
    new.access_type := 'lifetime';
    new.is_grandfathered_lifetime := old.is_grandfathered_lifetime;
    new.status := 'active';
    new.expires_at := null;
    new.current_period_end := null;
    new.cancel_at_period_end := false;
  end if;
  return new;
end;
$$;

drop trigger if exists preserve_lifetime_premium_entitlement on public.premium_entitlements;
create trigger preserve_lifetime_premium_entitlement
before update on public.premium_entitlements
for each row execute function public.preserve_lifetime_premium_entitlement();

comment on column public.premium_entitlements.access_type is
  'Canonical paid access type. Free access is represented by no qualifying entitlement.';
