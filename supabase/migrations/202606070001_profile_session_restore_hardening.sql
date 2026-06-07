-- Keep profile restore keyed to the authenticated Supabase user.
-- Older profile rows may have used profiles.id = auth.users.id before user_id existed.

alter table public.profiles
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

update public.profiles as profiles
set user_id = profiles.id
where profiles.user_id is null
  and exists (
    select 1
    from auth.users as users
    where users.id = profiles.id
  );

create index if not exists profiles_user_id_idx
  on public.profiles(user_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_user_id_key'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_user_id_key unique (user_id);
  end if;
end $$;

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own
  on public.profiles
  for delete
  to authenticated
  using (auth.uid() = user_id);
