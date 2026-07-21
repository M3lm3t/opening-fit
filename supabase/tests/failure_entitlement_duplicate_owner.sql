alter table public.premium_entitlements
  drop constraint premium_entitlements_pkey;

insert into public.premium_entitlements (user_id, status)
values ('00000000-0000-0000-0000-000000000001', 'active');
