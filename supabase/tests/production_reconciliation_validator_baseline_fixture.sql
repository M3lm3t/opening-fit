-- Convert the broad mixed-drift fixture into the exact audited production
-- baseline shape used to exercise phase-aware validation. Synthetic data only.

delete from public.premium_entitlements;
update public.profiles set is_premium = false;
update public.profiles
set is_premium = true
where user_id in (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
);
delete from public.profiles
where user_id = '00000000-0000-0000-0000-000000000012';
delete from public.user_profiles
where user_id = '00000000-0000-0000-0000-000000000012';

insert into public.premium_entitlements (
  user_id, status, source, premium_since, expires_at
) values (
  '00000000-0000-0000-0000-000000000001',
  'active', 'legacy_fixture', now() - interval '1 year', null
);

delete from public.report_history;
insert into public.report_history (user_id, report_key, report)
select
  '00000000-0000-0000-0000-000000000001',
  'baseline-report-' || sequence_number,
  '{}'::jsonb
from generate_series(1, 42) sequence_number;

delete from public.recommendation_history;
insert into public.recommendation_history (user_id, snapshot_key, snapshot)
select
  '00000000-0000-0000-0000-000000000001',
  'baseline-recommendation-' || sequence_number,
  '{}'::jsonb
from generate_series(1, 56) sequence_number;

delete from public.analysed_games;
insert into public.analysed_games (user_id, platform, username, game_id)
select
  '00000000-0000-0000-0000-000000000001',
  'fixture', 'fixture-user', 'baseline-game-' || sequence_number
from generate_series(1, 142) sequence_number;

delete from public.repertoire;
delete from public.openingfit_user_state;

alter table public.premium_entitlements
  drop column if exists stripe_payment_intent_id,
  drop column if exists stripe_price_id,
  drop column if exists checkout_mode,
  drop column if exists access_type,
  drop column if exists current_period_end,
  drop column if exists cancel_at_period_end,
  drop column if exists is_grandfathered_lifetime,
  drop column if exists plan_interval,
  drop column if exists stripe_status,
  drop column if exists current_period_start,
  drop column if exists last_stripe_event_id,
  drop column if exists last_stripe_event_created_at;

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key
);
insert into supabase_migrations.schema_migrations (version) values
  ('202605230001'), ('202605240001'), ('202605250001'),
  ('202605250002'), ('202605270001'), ('202605310001'),
  ('202605310002'), ('202605310003'), ('202606010001'),
  ('202606010002')
on conflict do nothing;
