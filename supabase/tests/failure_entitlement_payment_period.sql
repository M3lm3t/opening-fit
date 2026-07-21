insert into public.premium_entitlements (user_id, status, checkout_mode, current_period_end)
values ('00000000-0000-0000-0000-000000000007', 'active', 'payment', now() + interval '1 month');
