alter table public.premium_entitlements
add column if not exists stripe_subscription_id text;

create index if not exists premium_entitlements_stripe_subscription_idx
on public.premium_entitlements(stripe_subscription_id)
where stripe_subscription_id is not null;
