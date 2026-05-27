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

create table if not exists public.premium_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'inactive',
  source text,
  stripe_customer_id text,
  stripe_checkout_session_id text unique,
  premium_since timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.premium_entitlements enable row level security;

drop policy if exists premium_entitlements_select_own on public.premium_entitlements;
create policy premium_entitlements_select_own
on public.premium_entitlements for select
to authenticated
using (user_id = auth.uid());

drop trigger if exists set_premium_entitlements_updated_at on public.premium_entitlements;
create trigger set_premium_entitlements_updated_at
before update on public.premium_entitlements
for each row execute function public.set_updated_at();

create or replace function public.prevent_client_profile_premium_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
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

revoke update (is_premium) on public.profiles from anon, authenticated;

drop trigger if exists prevent_client_profile_premium_update on public.profiles;
create trigger prevent_client_profile_premium_update
before insert or update on public.profiles
for each row execute function public.prevent_client_profile_premium_update();

alter table public.activity_history
add column if not exists points integer not null default 0,
add column if not exists action_type text,
add column if not exists related_report_id uuid,
add column if not exists dedupe_key text;

create unique index if not exists activity_history_user_dedupe_key
on public.activity_history(user_id, dedupe_key)
where dedupe_key is not null;

alter table public.user_activity_log
add column if not exists dedupe_key text,
add column if not exists related_report_id uuid;

create unique index if not exists user_activity_log_user_dedupe_key
on public.user_activity_log(user_id, dedupe_key)
where dedupe_key is not null;

alter table public.report_history
add column if not exists report_key text;

create unique index if not exists report_history_user_report_key
on public.report_history(user_id, report_key)
where report_key is not null;
