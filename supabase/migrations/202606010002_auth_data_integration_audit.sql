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

alter table if exists public.profiles
add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table if exists public.profiles
add column if not exists email text;

alter table if exists public.profiles
add column if not exists display_name text;

alter table if exists public.profiles
add column if not exists created_at timestamptz not null default now();

alter table if exists public.profiles
add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if to_regclass('public.profiles') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'profiles'
         and column_name = 'id'
         and udt_name = 'uuid'
     )
     and not exists (
       select 1
       from pg_constraint constraint_record
       join pg_attribute local_attribute
         on local_attribute.attrelid = constraint_record.conrelid
        and local_attribute.attnum = any(constraint_record.conkey)
       join pg_class foreign_table
         on foreign_table.oid = constraint_record.confrelid
       join pg_namespace foreign_schema
         on foreign_schema.oid = foreign_table.relnamespace
       where constraint_record.conrelid = 'public.profiles'::regclass
         and constraint_record.contype = 'f'
         and local_attribute.attname = 'id'
         and foreign_schema.nspname = 'auth'
         and foreign_table.relname = 'users'
     ) then
    alter table public.profiles alter column id set default gen_random_uuid();
  end if;
end;
$$;

update public.profiles
set user_id = id
where user_id is null
  and exists (
    select 1
    from auth.users
    where auth.users.id = public.profiles.id
  );

insert into public.profiles (id, user_id, email, display_name, created_at, updated_at)
select
  users.id,
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

do $$
begin
  if to_regclass('public.profiles') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'profiles_user_id_key'
         and conrelid = 'public.profiles'::regclass
     ) then
    alter table public.profiles add constraint profiles_user_id_key unique (user_id);
  end if;
end;
$$;

create or replace function public.create_profile_for_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    user_id,
    email,
    display_name,
    created_at,
    updated_at
  )
  values (
    new.id,
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

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, user_id, email, display_name)
  values (
    new.id,
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'display_name', new.email, '')
  )
  on conflict (user_id) do update
  set
    email = excluded.email,
    display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name),
    updated_at = now();

  insert into public.settings (user_id, preferences)
  values (new.id, '{}'::jsonb)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_profile_after_auth_user_insert on auth.users;
drop trigger if exists on_auth_user_created_openingfit_profile on auth.users;
create trigger on_auth_user_created_openingfit_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user_profile();

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.analysis_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text,
  platform text,
  summary jsonb not null default '{}'::jsonb,
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.analysed_games (
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

create table if not exists public.saved_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recommendation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opening_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.repertoire (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  repertoire jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.saved_openings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opening_name text not null,
  side text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chess_account_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  username text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, username)
);

alter table if exists public.user_profiles add column if not exists user_id uuid references auth.users(id) on delete cascade;
update public.user_profiles set user_id = id where user_id is null and id in (select id from auth.users);

do $$
declare
  user_table text;
begin
  foreach user_table in array array[
    'profiles',
    'user_profiles',
    'settings',
    'user_settings',
    'notification_preferences',
    'activity_history',
    'user_activity_log',
    'report_history',
    'analysis_history',
    'analysed_games',
    'openingfit_user_state',
    'recommendation_history',
    'saved_recommendations',
    'opening_preferences',
    'repertoire',
    'saved_openings',
    'chess_account_links',
    'user_streaks',
    'user_goals',
    'user_achievements',
    'weekly_reports'
  ]
  loop
    if to_regclass(format('public.%I', user_table)) is not null
       and exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = user_table
           and column_name = 'user_id'
       ) then
      execute format('alter table public.%I enable row level security', user_table);

      execute format('drop policy if exists %I on public.%I', user_table || '_select_own', user_table);
      execute format(
        'create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)',
        user_table || '_select_own',
        user_table
      );

      execute format('drop policy if exists %I on public.%I', user_table || '_insert_own', user_table);
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)',
        user_table || '_insert_own',
        user_table
      );

      execute format('drop policy if exists %I on public.%I', user_table || '_update_own', user_table);
      execute format(
        'create policy %I on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
        user_table || '_update_own',
        user_table
      );

      execute format('drop policy if exists %I on public.%I', user_table || '_delete_own', user_table);
      execute format(
        'create policy %I on public.%I for delete to authenticated using (auth.uid() = user_id)',
        user_table || '_delete_own',
        user_table
      );

      execute format(
        'create index if not exists %I on public.%I(user_id)',
        user_table || '_user_id_idx',
        user_table
      );

      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = user_table
          and column_name = 'updated_at'
      ) then
        execute format('drop trigger if exists %I on public.%I', 'set_' || user_table || '_updated_at', user_table);
        execute format(
          'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
          'set_' || user_table || '_updated_at',
          user_table
        );
      end if;
    end if;
  end loop;
end;
$$;

create index if not exists report_history_user_updated_idx
on public.report_history(user_id, updated_at desc);

create index if not exists recommendation_history_user_updated_idx
on public.recommendation_history(user_id, updated_at desc);

create index if not exists openingfit_user_state_user_updated_idx
on public.openingfit_user_state(user_id, updated_at desc);

alter table if exists public.premium_entitlements enable row level security;
drop policy if exists premium_entitlements_select_own on public.premium_entitlements;
create policy premium_entitlements_select_own
on public.premium_entitlements for select
to authenticated
using (auth.uid() = user_id);
