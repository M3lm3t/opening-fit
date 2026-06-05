alter table public.premium_entitlements
add column if not exists stripe_payment_intent_id text,
add column if not exists stripe_price_id text,
add column if not exists checkout_mode text;

create index if not exists premium_entitlements_stripe_payment_intent_idx
on public.premium_entitlements(stripe_payment_intent_id)
where stripe_payment_intent_id is not null;

create index if not exists premium_entitlements_stripe_customer_idx
on public.premium_entitlements(stripe_customer_id)
where stripe_customer_id is not null;
