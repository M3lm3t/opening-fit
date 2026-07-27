-- A cancellation-at-period-end flag is recurring lifecycle evidence even when
-- no other Stripe field is populated, so the exact reviewed row must fail.
update public.premium_entitlements
set cancel_at_period_end = true
where user_id = '00000000-0000-0000-0000-000000000002';
