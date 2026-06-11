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
