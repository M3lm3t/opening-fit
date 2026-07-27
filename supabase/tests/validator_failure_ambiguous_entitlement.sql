-- Synthetic validator-only violation using a column available after migration 1.
update public.premium_entitlements
set stripe_customer_id = 'cus_validator_ambiguous'
where user_id = '00000000-0000-0000-0000-000000000001';
