-- Forward-only reconciliation of safe June drift and absent infrastructure.
-- No historical migration is replayed and no existing business data is removed.

begin;

create extension if not exists "pgcrypto";

do $$
begin
  if to_regclass('public.premium_entitlements') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.user_profiles') is null
     or to_regclass('public.report_history') is null
     or to_regclass('public.openingfit_user_state') is null
     or to_regclass('public.analysed_games') is null then
    raise exception 'Reconciliation precondition failed: audited production foundation tables are missing';
  end if;

  if exists (select 1 from public.user_profiles where user_id is null) then
    raise exception 'Reconciliation precondition failed: public.user_profiles contains null user_id values';
  end if;

  if exists (
    select 1 from public.user_profiles group by user_id having count(*) > 1
  ) then
    raise exception 'Reconciliation precondition failed: public.user_profiles contains duplicate user_id values';
  end if;
end;
$$;

alter table public.premium_entitlements
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_price_id text,
  add column if not exists checkout_mode text;

create index if not exists premium_entitlements_stripe_payment_intent_idx
  on public.premium_entitlements(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create index if not exists premium_entitlements_stripe_customer_idx
  on public.premium_entitlements(stripe_customer_id)
  where stripe_customer_id is not null;

alter table public.profiles
  add column if not exists premium_status text,
  add column if not exists premium_source text,
  add column if not exists premium_updated_at timestamptz,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_checkout_session_id text;

create index if not exists profiles_stripe_customer_id_idx
  on public.profiles(stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists profiles_stripe_checkout_session_id_idx
  on public.profiles(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists user_profiles_user_id_key
  on public.user_profiles(user_id);

comment on column public.profiles.user_id is
  'Canonical OpeningFit owner id. Matches auth.users.id/auth.uid(); email and chess usernames are metadata.';
comment on column public.user_profiles.user_id is
  'Canonical OpeningFit owner id for retention profile rows. Matches auth.users.id/auth.uid().';
comment on table public.premium_entitlements is
  'Premium access rows keyed by user_id = auth.users.id. Client code may read its own row; trusted server code writes Stripe lifecycle fields.';
comment on column public.openingfit_user_state.user_id is
  'Canonical OpeningFit owner id. Platform and username dedupe workspaces but do not identify the authenticated account.';
comment on column public.report_history.user_id is
  'Canonical OpeningFit owner id for saved analyses. report_key dedupes saves within a user only.';
comment on column public.analysed_games.user_id is
  'Canonical OpeningFit owner id for imported game history. game_id dedupes within user/platform/username.';

create or replace function public.prevent_client_profile_premium_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  request_role text := coalesce(
    current_setting('request.jwt.claim.role', true),
    auth.role()
  );
begin
  if request_role = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' and coalesce(new.is_premium, false) then
    raise exception 'profiles.is_premium can only be set by trusted server code';
  end if;

  if tg_op = 'UPDATE' and new.is_premium is distinct from old.is_premium then
    raise exception 'profiles.is_premium can only be updated by trusted server code';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_client_profile_premium_update on public.profiles;
create trigger prevent_client_profile_premium_update
before insert or update on public.profiles
for each row execute function public.prevent_client_profile_premium_update();


-- Retention snapshot schema. Existing definitions are replaced only where the
-- historical migration already used CREATE OR REPLACE / DROP POLICY semantics.
create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.openingfit_retention_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid,
  snapshot_key text not null,
  opening_fit_score numeric,
  repertoire_health_score numeric,
  top_opening_mastery jsonb not null default '[]'::jsonb,
  weakest_line jsonb,
  one_thing_to_fix jsonb,
  opening_identity jsonb,
  source_summary jsonb not null default '{}'::jsonb,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists openingfit_retention_snapshots_user_snapshot_key
on public.openingfit_retention_snapshots(user_id, snapshot_key);

create index if not exists openingfit_retention_snapshots_user_created_idx
on public.openingfit_retention_snapshots(user_id, created_at desc);

alter table public.openingfit_retention_snapshots enable row level security;

drop policy if exists openingfit_retention_snapshots_select_own on public.openingfit_retention_snapshots;
create policy openingfit_retention_snapshots_select_own
on public.openingfit_retention_snapshots for select
to authenticated
using (user_id = auth.uid());

drop policy if exists openingfit_retention_snapshots_insert_own on public.openingfit_retention_snapshots;
create policy openingfit_retention_snapshots_insert_own
on public.openingfit_retention_snapshots for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists openingfit_retention_snapshots_update_own on public.openingfit_retention_snapshots;
create policy openingfit_retention_snapshots_update_own
on public.openingfit_retention_snapshots for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists openingfit_retention_snapshots_delete_own on public.openingfit_retention_snapshots;
create policy openingfit_retention_snapshots_delete_own
on public.openingfit_retention_snapshots for delete
to authenticated
using (user_id = auth.uid());

drop trigger if exists set_openingfit_retention_snapshots_updated_at on public.openingfit_retention_snapshots;
create trigger set_openingfit_retention_snapshots_updated_at
before update on public.openingfit_retention_snapshots
for each row execute function public.set_updated_at();


-- Referral schema. CREATE statements are guarded for the audited absent state
-- and for safe whole-transaction retries.
-- Production-safe referral attribution. Client roles interact only through the
-- narrowly scoped RPCs defined below; Stripe webhook writes continue through
-- the service role and the existing entitlement flow remains unchanged.

create table if not exists public.referral_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  email text,
  commission_type text not null default 'fixed',
  commission_value numeric(10,2) not null default 2.00,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referral_partners_code_format_check
    check (code = lower(code) and code ~ '^[a-z0-9_-]+$'),
  constraint referral_partners_commission_type_check
    check (commission_type in ('fixed', 'percentage')),
  constraint referral_partners_commission_value_check
    check (
      commission_value >= 0
      and (commission_type <> 'percentage' or commission_value <= 100)
    )
);

create index if not exists referral_partners_code_idx
  on public.referral_partners(code);

create table if not exists public.referral_visits (
  id uuid primary key default gen_random_uuid(),
  referral_partner_id uuid not null
    references public.referral_partners(id) on delete cascade,
  referral_code text not null,
  visitor_id text not null,
  landing_path text,
  created_at timestamptz not null default now()
);

create index if not exists referral_visits_partner_idx
  on public.referral_visits(referral_partner_id);
create index if not exists referral_visits_visitor_idx
  on public.referral_visits(visitor_id);
create index if not exists referral_visits_created_at_idx
  on public.referral_visits(created_at);
create index if not exists referral_visits_partner_visitor_created_idx
  on public.referral_visits(referral_partner_id, visitor_id, created_at desc);

create table if not exists public.referral_attributions (
  id uuid primary key default gen_random_uuid(),
  referral_partner_id uuid not null
    references public.referral_partners(id) on delete restrict,
  referral_code text not null,
  referred_user_id uuid not null
    references auth.users(id) on delete cascade,
  visitor_id text,
  status text not null default 'registered',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  gross_amount numeric(10,2),
  commission_amount numeric(10,2),
  currency text default 'gbp',
  registered_at timestamptz not null default now(),
  converted_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referral_attributions_referred_user_key unique (referred_user_id),
  constraint referral_attributions_status_check
    check (status in ('registered', 'converted', 'refunded', 'cancelled')),
  constraint referral_attributions_gross_amount_check
    check (gross_amount is null or gross_amount >= 0),
  constraint referral_attributions_commission_amount_check
    check (commission_amount is null or commission_amount >= 0)
);

create index if not exists referral_attributions_partner_idx
  on public.referral_attributions(referral_partner_id);
create index if not exists referral_attributions_referred_user_idx
  on public.referral_attributions(referred_user_id);
create index if not exists referral_attributions_status_idx
  on public.referral_attributions(status);

alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by_partner_id uuid
    references public.referral_partners(id) on delete set null;

create or replace function public.normalize_referral_partner_code()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  new.code := lower(btrim(new.code));
  return new;
end;
$function$;

drop trigger if exists normalize_referral_partner_code
  on public.referral_partners;
create trigger normalize_referral_partner_code
before insert or update of code on public.referral_partners
for each row execute function public.normalize_referral_partner_code();

drop trigger if exists set_referral_partners_updated_at
  on public.referral_partners;
create trigger set_referral_partners_updated_at
before update on public.referral_partners
for each row execute function public.set_updated_at();

drop trigger if exists set_referral_attributions_updated_at
  on public.referral_attributions;
create trigger set_referral_attributions_updated_at
before update on public.referral_attributions
for each row execute function public.set_updated_at();

alter table public.referral_partners enable row level security;
alter table public.referral_visits enable row level security;
alter table public.referral_attributions enable row level security;

-- There are intentionally no anon/authenticated table policies. PostgreSQL's
-- service role bypasses RLS for webhook processing; clients use only the RPCs.
revoke all on table public.referral_partners from anon, authenticated;
revoke all on table public.referral_visits from anon, authenticated;
revoke all on table public.referral_attributions from anon, authenticated;
grant all on table public.referral_partners to service_role;
grant all on table public.referral_visits to service_role;
grant all on table public.referral_attributions to service_role;

create or replace function public.validate_referral_code(input_code text)
returns table (
  valid boolean,
  normalized_code text,
  partner_display_name text
)
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  with supplied as (
    select lower(btrim(coalesce(input_code, ''))) as normalized_code
  ), matched as (
    select rp.code, rp.name
    from public.referral_partners as rp
    join supplied as s on rp.code = s.normalized_code
    where rp.is_active
    limit 1
  )
  select
    (matched.code is not null) as valid,
    supplied.normalized_code,
    matched.name as partner_display_name
  from supplied
  left join matched on true;
$function$;

create or replace function public.attach_referral_to_user(
  input_code text,
  input_visitor_id text default null
)
returns table (
  success boolean,
  code text,
  status text
)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_input text := lower(btrim(coalesce(input_code, '')));
  safe_visitor_id text := nullif(left(btrim(coalesce(input_visitor_id, '')), 200), '');
  partner_record record;
  attribution_record record;
begin
  if current_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select ra.referral_partner_id, ra.referral_code, ra.status
    into attribution_record
  from public.referral_attributions as ra
  where ra.referred_user_id = current_user_id
  limit 1;

  if found then
    return query
      select true, attribution_record.referral_code, attribution_record.status;
    return;
  end if;

  select rp.id, rp.code, rp.user_id
    into partner_record
  from public.referral_partners as rp
  where rp.code = normalized_input
    and rp.is_active
  limit 1;

  if not found then
    raise exception 'Referral code is invalid or inactive.' using errcode = '22023';
  end if;

  if partner_record.user_id = current_user_id then
    raise exception 'A referral partner cannot refer their own account.' using errcode = '22023';
  end if;

  insert into public.referral_attributions as inserted (
    referral_partner_id,
    referral_code,
    referred_user_id,
    visitor_id,
    status
  ) values (
    partner_record.id,
    partner_record.code,
    current_user_id,
    safe_visitor_id,
    'registered'
  )
  on conflict (referred_user_id) do nothing
  returning inserted.referral_partner_id, inserted.referral_code, inserted.status
    into attribution_record;

  if not found then
    select ra.referral_partner_id, ra.referral_code, ra.status
      into attribution_record
    from public.referral_attributions as ra
    where ra.referred_user_id = current_user_id
    limit 1;
  end if;

  insert into public.profiles (
    id,
    user_id,
    referral_code,
    referred_by_partner_id,
    updated_at
  ) values (
    current_user_id,
    current_user_id,
    attribution_record.referral_code,
    attribution_record.referral_partner_id,
    now()
  )
  on conflict (user_id) do update
  set referral_code = excluded.referral_code,
      referred_by_partner_id = excluded.referred_by_partner_id,
      updated_at = now();

  return query
    select true, attribution_record.referral_code, attribution_record.status;
end;
$function$;

create or replace function public.record_referral_visit(
  input_code text,
  input_visitor_id text,
  input_landing_path text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  normalized_input text := lower(btrim(coalesce(input_code, '')));
  safe_visitor_id text := nullif(left(btrim(coalesce(input_visitor_id, '')), 200), '');
  safe_landing_path text := nullif(left(btrim(coalesce(input_landing_path, '')), 2048), '');
  partner_record record;
begin
  if safe_visitor_id is null then
    return false;
  end if;

  select rp.id, rp.code
    into partner_record
  from public.referral_partners as rp
  where rp.code = normalized_input
    and rp.is_active
  limit 1;

  if not found then
    return false;
  end if;

  -- Bound anonymous write volume even when a caller rotates visitor IDs.
  -- Normal campaign traffic is well below this per-partner safety ceiling.
  if (
    select count(*)
    from public.referral_visits as recent
    where recent.referral_partner_id = partner_record.id
      and recent.created_at >= now() - interval '10 minutes'
  ) >= 500 then
    return false;
  end if;

  -- Serialize this partner/visitor pair so concurrent requests cannot both
  -- pass the rolling-window check before either visit becomes visible.
  perform pg_advisory_xact_lock(
    hashtextextended(partner_record.id::text || ':' || safe_visitor_id, 0)
  );

  if exists (
    select 1
    from public.referral_visits as rv
    where rv.referral_partner_id = partner_record.id
      and rv.visitor_id = safe_visitor_id
      and rv.created_at >= now() - interval '24 hours'
  ) then
    return true;
  end if;

  insert into public.referral_visits (
    referral_partner_id,
    referral_code,
    visitor_id,
    landing_path
  ) values (
    partner_record.id,
    partner_record.code,
    safe_visitor_id,
    safe_landing_path
  );

  return true;
end;
$function$;

revoke all on function public.validate_referral_code(text) from public;
revoke all on function public.attach_referral_to_user(text, text) from public;
revoke all on function public.record_referral_visit(text, text, text) from public;

grant execute on function public.validate_referral_code(text) to anon, authenticated;
grant execute on function public.attach_referral_to_user(text, text) to authenticated;
grant execute on function public.record_referral_visit(text, text, text) to anon, authenticated;

grant execute on function public.validate_referral_code(text) to service_role;
grant execute on function public.attach_referral_to_user(text, text) to service_role;
grant execute on function public.record_referral_visit(text, text, text) to service_role;

comment on function public.validate_referral_code(text) is
  'Returns only public validation fields for one active normalized referral code.';
comment on function public.attach_referral_to_user(text, text) is
  'Creates at most one authenticated-user referral attribution without exposing partner internals.';
comment on function public.record_referral_visit(text, text, text) is
  'Records at most one visit per active partner and visitor in a rolling 24-hour window.';


-- Additive versioned report snapshots; legacy report and summary JSON remain unchanged.
alter table public.report_history
  add column if not exists report_schema_version integer not null default 1,
  add column if not exists analysis_id text,
  add column if not exists analysis_fingerprint text,
  add column if not exists snapshot jsonb not null default '{}'::jsonb,
  add column if not exists generated_at timestamptz,
  add column if not exists source_platform text,
  add column if not exists source_username text;

create unique index if not exists report_history_user_analysis_id
on public.report_history(user_id, analysis_id)
where analysis_id is not null;

create unique index if not exists report_history_user_analysis_fingerprint
on public.report_history(user_id, analysis_fingerprint)
where analysis_fingerprint is not null;

create index if not exists report_history_user_generated_idx
on public.report_history(user_id, generated_at desc);

comment on column public.report_history.snapshot is
  'Normalized, versioned comparison snapshot. The original report and summary remain unchanged for backward compatibility.';


commit;

