-- One canonical and one pristine exact-source row is a mixed state and must
-- fail closed rather than reconciling only the remaining pristine row.
update public.premium_entitlements
set access_type = 'lifetime',
    is_grandfathered_lifetime = true
where user_id = '00000000-0000-0000-0000-000000000001';
