-- Synthetic validator-only violation using a column available after migration 1.
update public.premium_entitlements
set stripe_customer_id = 'cus_validator_ambiguous'
where source = 'legacy_fixture';
