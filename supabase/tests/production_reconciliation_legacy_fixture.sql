-- Disposable local-only fixture approximating the audited production schema.
-- All UUIDs and Stripe-looking identifiers below are synthetic test values.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$$;

create schema if not exists auth;

create schema if not exists supabase_migrations;
create table supabase_migrations.schema_migrations (
  version text primary key
);
insert into supabase_migrations.schema_migrations (version) values
  ('202605230001'), ('202605240001'), ('202605250001'),
  ('202605250002'), ('202605270001'), ('202605310001'),
  ('202605310002'), ('202605310003'), ('202606010001'),
  ('202606010002');

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.role', true), '');
$$;

create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade unique,
  email text,
  display_name text,
  username text,
  platform text,
  chesscom_username text,
  lichess_username text,
  is_premium boolean not null default false,
  premium_source text,
  last_report jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.premium_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'inactive',
  source text,
  stripe_customer_id text,
  stripe_checkout_session_id text unique,
  premium_since timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  stripe_subscription_id text,
  stripe_payment_intent_id text,
  stripe_price_id text,
  checkout_mode text,
  -- Mixed-drift fields permit explicit existing lifetime/subscription fixtures.
  access_type text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  is_grandfathered_lifetime boolean not null default false,
  plan_interval text,
  stripe_status text,
  current_period_start timestamptz,
  last_stripe_event_id text,
  last_stripe_event_created_at timestamptz
);

create index premium_entitlements_stripe_subscription_idx
  on public.premium_entitlements(stripe_subscription_id)
  where stripe_subscription_id is not null;

alter table public.premium_entitlements enable row level security;
create policy premium_entitlements_select_own
  on public.premium_entitlements for select to authenticated
  using (auth.uid() = user_id);

create table public.report_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text,
  platform text,
  summary jsonb not null default '{}'::jsonb,
  report jsonb not null default '{}'::jsonb,
  report_key text,
  analysis_time_format text not null default 'custom',
  effective_time_format text not null default 'custom',
  detected_time_format jsonb,
  style_profile jsonb,
  style_based_recommendations jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.report_history enable row level security;
grant select, insert, update, delete on public.report_history to authenticated;
grant all on public.report_history to service_role;

create table public.recommendation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_key text,
  snapshot jsonb not null default '{}'::jsonb,
  analysis_date timestamptz not null default now(),
  games_analysed integer not null default 0,
  detected_openings jsonb not null default '[]'::jsonb,
  recommended_openings jsonb not null default '[]'::jsonb,
  time_control_filter text not null default 'custom',
  analysis_version text not null default 'retention-history-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.analysed_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text,
  username text,
  game_id text,
  game jsonb not null default '{}'::jsonb,
  analysis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.openingfit_user_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'unknown',
  username text not null default 'guest',
  last_report jsonb,
  coach_progress jsonb not null default '{}'::jsonb,
  progress_history jsonb not null default '[]'::jsonb,
  import_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, username)
);

create table public.repertoire (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  repertoire jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  message text not null
);
create table public.feedback (
  id bigint generated by default as identity primary key,
  message text not null
);
create table public.user_states (
  id bigint generated by default as identity primary key,
  username text not null,
  platform text not null default 'chesscom',
  state jsonb not null default '{}'::jsonb,
  unique (platform, username)
);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000004'),
  ('00000000-0000-0000-0000-000000000005'),
  ('00000000-0000-0000-0000-000000000006'),
  ('00000000-0000-0000-0000-000000000007'),
  ('00000000-0000-0000-0000-000000000008'),
  ('00000000-0000-0000-0000-000000000009'),
  ('00000000-0000-0000-0000-000000000010'),
  ('00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-000000000012');

insert into public.profiles (id, user_id, is_premium) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', false),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', true),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', true),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', true),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000005', true),
  ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000006', false),
  ('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000007', false),
  ('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000008', true),
  ('00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000009', true),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000010', false),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000011', false),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000012', false);

insert into public.user_profiles (id, user_id)
select id, id from auth.users;

insert into public.premium_entitlements (
  user_id, status, source, stripe_customer_id, stripe_subscription_id,
  premium_since, expires_at, access_type, current_period_start,
  current_period_end, cancel_at_period_end, is_grandfathered_lifetime,
  plan_interval, stripe_status, last_stripe_event_id,
  last_stripe_event_created_at, stripe_payment_intent_id, stripe_price_id,
  checkout_mode
) values
  -- Audited legacy active/non-expiring row.
  ('00000000-0000-0000-0000-000000000001', 'active', null, null, null,
   now() - interval '1 year', null, null, null, null, false, false, null, null, null, null,
   null, null, null),
  -- Active monthly subscription.
  ('00000000-0000-0000-0000-000000000003', 'active', 'stripe_subscription.updated',
   'cus_fixture_monthly', 'sub_fixture_monthly', now() - interval '1 month', null,
   'monthly_subscription', now() - interval '1 day', now() + interval '29 days', false,
   false, 'month', 'active', 'evt_fixture_new', now(), null, 'price_monthly', 'subscription'),
  -- Existing grandfathered lifetime.
  ('00000000-0000-0000-0000-000000000004', 'active', 'legacy_fixture', null, null,
   now() - interval '2 years', null, 'lifetime', null, null, false, true, null, null, null, null,
   null, null, null),
  -- Canceled annual subscription that retains access until period end.
  ('00000000-0000-0000-0000-000000000005', 'canceled', 'stripe_subscription.updated',
   'cus_fixture_annual', 'sub_fixture_annual', now() - interval '1 year', now() + interval '10 days',
   'annual_subscription', now() - interval '355 days', now() + interval '10 days', true,
   false, 'year', 'canceled', 'evt_fixture_canceled', now(), null, 'price_annual', 'subscription'),
  -- Expired monthly subscription.
  ('00000000-0000-0000-0000-000000000006', 'expired', 'stripe_subscription.deleted',
   'cus_fixture_expired', 'sub_fixture_expired', now() - interval '2 months', now() - interval '1 month',
   'monthly_subscription', now() - interval '2 months', now() - interval '1 month', false,
   false, 'month', 'canceled', 'evt_fixture_expired', now() - interval '1 month', null, 'price_monthly', 'subscription'),
  -- Active annual subscription.
  ('00000000-0000-0000-0000-000000000008', 'active', 'stripe_subscription.updated',
   'cus_fixture_active_annual', 'sub_fixture_active_annual', now() - interval '1 month', null,
   'annual_subscription', now() - interval '1 month', now() + interval '11 months', false,
   false, 'year', 'active', 'evt_fixture_active_annual', now(), null, 'price_annual', 'subscription'),
  -- Explicit one-time payment with retained PaymentIntent and Price references.
  ('00000000-0000-0000-0000-000000000009', 'active', 'stripe_checkout',
   'cus_fixture_payment', null, now() - interval '1 day', null,
   null, null, null, false, false, null, null, null, null,
   'pi_fixture_payment', 'price_lifetime', 'payment'),
  -- Legitimate non-grandfathered lifetime refund state from the backend.
  ('00000000-0000-0000-0000-000000000012', 'refunded', 'stripe_charge.refunded',
   'cus_fixture_refund', null, now() - interval '2 days', now(),
   'lifetime', null, null, false, false, null, 'refunded', 'evt_fixture_refund', now(),
   'pi_fixture_refund', 'price_lifetime', 'payment');

insert into public.report_history (user_id, report_key, report)
values
  ('00000000-0000-0000-0000-000000000001', 'fixture-report', '{"preserve":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000007', 'free-owner-report', '{"preserve":true}'::jsonb);

insert into public.recommendation_history (user_id, snapshot_key, snapshot)
values ('00000000-0000-0000-0000-000000000001', 'fixture-recommendation', '{"preserve":true}'::jsonb);

insert into public.analysed_games (user_id, platform, username, game_id)
values ('00000000-0000-0000-0000-000000000001', 'fixture', 'redacted', 'fixture-game');

-- Meet the recorded production history floors so every validator phase can
-- assert preservation, while retaining the focused rows above.
insert into public.report_history (user_id, report_key, report)
select
  '00000000-0000-0000-0000-000000000001',
  'floor-report-' || sequence_number,
  '{}'::jsonb
from generate_series(1, 40) sequence_number;

insert into public.recommendation_history (user_id, snapshot_key, snapshot)
select
  '00000000-0000-0000-0000-000000000001',
  'floor-recommendation-' || sequence_number,
  '{}'::jsonb
from generate_series(1, 55) sequence_number;

insert into public.analysed_games (user_id, platform, username, game_id)
select
  '00000000-0000-0000-0000-000000000001',
  'fixture', 'redacted', 'floor-game-' || sequence_number
from generate_series(1, 141) sequence_number;

insert into public.repertoire (user_id, repertoire)
values (
  '00000000-0000-0000-0000-000000000001',
  '{"legacyMarker":"must-remain"}'::jsonb
);

insert into public.openingfit_user_state (user_id, platform, username, coach_progress)
values (
  '00000000-0000-0000-0000-000000000001',
  'fixture',
  'redacted',
  '{"repertoireWorkspace":{"items":[{"section":"white","name":"Fixture Opening","source":"manual","status":"Current","games":"8","fit":"62.5"}]}}'::jsonb
);

insert into public.contact_messages (message) values ('fixture');
insert into public.feedback (message) values ('fixture');
insert into public.user_states (username, state) values ('redacted', '{"fixture":true}'::jsonb);
