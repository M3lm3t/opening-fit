alter table public.premium_entitlements
  add column if not exists plan_interval text,
  add column if not exists stripe_status text,
  add column if not exists current_period_start timestamptz,
  add column if not exists last_stripe_event_id text,
  add column if not exists last_stripe_event_created_at timestamptz;

alter table public.premium_entitlements
  drop constraint if exists premium_entitlements_plan_interval_check;

alter table public.premium_entitlements
  add constraint premium_entitlements_plan_interval_check
  check (plan_interval is null or plan_interval in ('month', 'year'));

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

-- Existing lifetime records are never repurposed as subscription rows. New
-- lifetime purchases can still be revoked by an explicit Stripe refund; legacy
-- grandfathered lifetime access remains permanent.
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

-- Stripe can deliver valid events out of order. Keep the newest known lifecycle
-- state while the event ledger still records older events as deliberately handled.
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

drop trigger if exists prevent_stale_stripe_entitlement_update on public.premium_entitlements;
create trigger prevent_stale_stripe_entitlement_update
before update on public.premium_entitlements
for each row execute function public.prevent_stale_stripe_entitlement_update();

comment on table public.stripe_webhook_events is
  'Server-only idempotency ledger for verified Stripe webhook events.';
