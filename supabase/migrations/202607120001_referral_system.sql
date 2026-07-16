-- Production-safe referral attribution. Client roles interact only through the
-- narrowly scoped RPCs defined below; Stripe webhook writes continue through
-- the service role and the existing entitlement flow remains unchanged.

create table public.referral_partners (
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

create index referral_partners_code_idx
  on public.referral_partners(code);

create table public.referral_visits (
  id uuid primary key default gen_random_uuid(),
  referral_partner_id uuid not null
    references public.referral_partners(id) on delete cascade,
  referral_code text not null,
  visitor_id text not null,
  landing_path text,
  created_at timestamptz not null default now()
);

create index referral_visits_partner_idx
  on public.referral_visits(referral_partner_id);
create index referral_visits_visitor_idx
  on public.referral_visits(visitor_id);
create index referral_visits_created_at_idx
  on public.referral_visits(created_at);
create index referral_visits_partner_visitor_created_idx
  on public.referral_visits(referral_partner_id, visitor_id, created_at desc);

create table public.referral_attributions (
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

create index referral_attributions_partner_idx
  on public.referral_attributions(referral_partner_id);
create index referral_attributions_referred_user_idx
  on public.referral_attributions(referred_user_id);
create index referral_attributions_status_idx
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
