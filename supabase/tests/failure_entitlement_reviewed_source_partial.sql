-- A partially canonical exact-source row must not qualify as pristine or as a
-- complete canonical retry row.
update public.premium_entitlements
set access_type = 'lifetime'
where user_id = '00000000-0000-0000-0000-000000000002';
