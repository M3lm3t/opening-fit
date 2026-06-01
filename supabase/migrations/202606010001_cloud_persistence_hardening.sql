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

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  theme text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.report_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text,
  platform text,
  summary jsonb not null default '{}'::jsonb,
  report jsonb not null default '{}'::jsonb,
  report_key text,
  analysis_time_format text,
  effective_time_format text,
  detected_time_format jsonb,
  style_profile jsonb,
  style_based_recommendations jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.openingfit_user_state (
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

create table if not exists public.recommendation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_date timestamptz not null default now(),
  games_analysed integer not null default 0,
  detected_openings jsonb not null default '[]'::jsonb,
  recommended_openings jsonb not null default '[]'::jsonb,
  confidence_score numeric,
  style_profile jsonb,
  time_control_filter text not null default 'custom',
  analysis_version text not null default 'retention-history-v1',
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.report_history add column if not exists report_key text;
alter table public.report_history add column if not exists analysis_time_format text;
alter table public.report_history add column if not exists effective_time_format text;
alter table public.report_history add column if not exists detected_time_format jsonb;
alter table public.report_history add column if not exists style_profile jsonb;
alter table public.report_history add column if not exists style_based_recommendations jsonb;

create unique index if not exists report_history_user_report_key
on public.report_history(user_id, report_key)
where report_key is not null;

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, display_name)
  values (
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

drop trigger if exists on_auth_user_created_openingfit_profile on auth.users;
create trigger on_auth_user_created_openingfit_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user_profile();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'settings',
    'activity_history',
    'report_history',
    'openingfit_user_state',
    'recommendation_history'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);

      execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
      execute format(
        'create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)',
        table_name || '_select_own',
        table_name
      );

      execute format('drop policy if exists %I on public.%I', table_name || '_insert_own', table_name);
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)',
        table_name || '_insert_own',
        table_name
      );

      execute format('drop policy if exists %I on public.%I', table_name || '_update_own', table_name);
      execute format(
        'create policy %I on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
        table_name || '_update_own',
        table_name
      );

      execute format('drop policy if exists %I on public.%I', table_name || '_delete_own', table_name);
      execute format(
        'create policy %I on public.%I for delete to authenticated using (auth.uid() = user_id)',
        table_name || '_delete_own',
        table_name
      );

      execute format('drop trigger if exists %I on public.%I', 'set_' || table_name || '_updated_at', table_name);
      execute format(
        'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
        'set_' || table_name || '_updated_at',
        table_name
      );
    end if;
  end loop;
end;
$$;

alter table if exists public.premium_entitlements enable row level security;
drop policy if exists premium_entitlements_select_own on public.premium_entitlements;
create policy premium_entitlements_select_own
on public.premium_entitlements for select
to authenticated
using (auth.uid() = user_id);
