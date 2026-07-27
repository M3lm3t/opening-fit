-- Any recurring evidence removes an otherwise reviewed row from the
-- conservative lifetime cohort.
update public.premium_entitlements
set stripe_subscription_id = 'sub_reviewed_source_recurring_fixture'
where user_id = '00000000-0000-0000-0000-000000000002';
