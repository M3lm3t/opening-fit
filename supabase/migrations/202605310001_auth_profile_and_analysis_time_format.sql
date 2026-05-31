create extension if not exists "pgcrypto";

alter table public.report_history
add column if not exists analysis_time_format text not null default 'custom',
add column if not exists effective_time_format text not null default 'custom',
add column if not exists detected_time_format jsonb;

create or replace function public.create_profile_for_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    user_id,
    email,
    display_name,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'display_name',
      new.email,
      ''
    ),
    now(),
    now()
  )
  on conflict (user_id) do update
  set
    email = coalesce(excluded.email, public.profiles.email),
    display_name = coalesce(nullif(excluded.display_name, ''), public.profiles.display_name),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists create_profile_after_auth_user_insert on auth.users;
create trigger create_profile_after_auth_user_insert
after insert on auth.users
for each row execute function public.create_profile_for_new_auth_user();

insert into public.profiles (user_id, email, display_name, created_at, updated_at)
select
  users.id,
  users.email,
  coalesce(
    users.raw_user_meta_data ->> 'full_name',
    users.raw_user_meta_data ->> 'display_name',
    users.email,
    ''
  ),
  now(),
  now()
from auth.users as users
where not exists (
  select 1
  from public.profiles
  where profiles.user_id = users.id
);
