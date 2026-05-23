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

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  display_name text,
  username text,
  platform text,
  chesscom_username text,
  lichess_username text,
  is_premium boolean not null default false,
  last_report jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.profiles add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists platform text;
alter table public.profiles add column if not exists chesscom_username text;
alter table public.profiles add column if not exists lichess_username text;
alter table public.profiles add column if not exists is_premium boolean not null default false;
alter table public.profiles add column if not exists last_report jsonb;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

update public.profiles
set user_id = id
where user_id is null
  and exists (
    select 1
    from auth.users
    where auth.users.id = public.profiles.id
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_user_id_key'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_user_id_key unique (user_id);
  end if;
end;
$$;

create table if not exists public.onboarding_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  items jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null,
  item_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null default 'user-uploads',
  path text not null,
  url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text,
  result jsonb not null default '{}'::jsonb,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  theme text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.activity_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text,
  platform text,
  summary jsonb not null default '{}'::jsonb,
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'onboarding_answers',
    'measurements',
    'outfits',
    'favorites',
    'uploads',
    'ai_generations',
    'settings',
    'activity_history',
    'report_history'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);

    execute format(
      'drop policy if exists %I on public.%I',
      table_name || '_select_own',
      table_name
    );
    execute format(
      'create policy %I on public.%I for select using (auth.uid() = user_id)',
      table_name || '_select_own',
      table_name
    );

    execute format(
      'drop policy if exists %I on public.%I',
      table_name || '_insert_own',
      table_name
    );
    execute format(
      'create policy %I on public.%I for insert with check (auth.uid() = user_id)',
      table_name || '_insert_own',
      table_name
    );

    execute format(
      'drop policy if exists %I on public.%I',
      table_name || '_update_own',
      table_name
    );
    execute format(
      'create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      table_name || '_update_own',
      table_name
    );

    execute format(
      'drop policy if exists %I on public.%I',
      table_name || '_delete_own',
      table_name
    );
    execute format(
      'create policy %I on public.%I for delete using (auth.uid() = user_id)',
      table_name || '_delete_own',
      table_name
    );

    execute format(
      'drop trigger if exists %I on public.%I',
      'set_' || table_name || '_updated_at',
      table_name
    );
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      'set_' || table_name || '_updated_at',
      table_name
    );
  end loop;
end;
$$;

insert into storage.buckets (id, name, public)
values ('user-uploads', 'user-uploads', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Users can read own uploads" on storage.objects;
create policy "Users can read own uploads"
on storage.objects for select
using (
  bucket_id = 'user-uploads'
  and (storage.foldername(name))[1] = 'users'
  and auth.uid()::text = (storage.foldername(name))[2]
);

drop policy if exists "Users can upload own files" on storage.objects;
create policy "Users can upload own files"
on storage.objects for insert
with check (
  bucket_id = 'user-uploads'
  and (storage.foldername(name))[1] = 'users'
  and auth.uid()::text = (storage.foldername(name))[2]
);

drop policy if exists "Users can update own uploads" on storage.objects;
create policy "Users can update own uploads"
on storage.objects for update
using (
  bucket_id = 'user-uploads'
  and (storage.foldername(name))[1] = 'users'
  and auth.uid()::text = (storage.foldername(name))[2]
)
with check (
  bucket_id = 'user-uploads'
  and (storage.foldername(name))[1] = 'users'
  and auth.uid()::text = (storage.foldername(name))[2]
);

drop policy if exists "Users can delete own uploads" on storage.objects;
create policy "Users can delete own uploads"
on storage.objects for delete
using (
  bucket_id = 'user-uploads'
  and (storage.foldername(name))[1] = 'users'
  and auth.uid()::text = (storage.foldername(name))[2]
);
