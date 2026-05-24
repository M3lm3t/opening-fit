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

alter table public.openingfit_user_state add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.openingfit_user_state add column if not exists platform text not null default 'unknown';
alter table public.openingfit_user_state add column if not exists username text not null default 'guest';
alter table public.openingfit_user_state add column if not exists last_report jsonb;
alter table public.openingfit_user_state add column if not exists coach_progress jsonb not null default '{}'::jsonb;
alter table public.openingfit_user_state add column if not exists progress_history jsonb not null default '[]'::jsonb;
alter table public.openingfit_user_state add column if not exists import_history jsonb not null default '[]'::jsonb;
alter table public.openingfit_user_state add column if not exists created_at timestamptz not null default now();
alter table public.openingfit_user_state add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'openingfit_user_state_user_id_platform_username_key'
      and conrelid = 'public.openingfit_user_state'::regclass
  ) then
    alter table public.openingfit_user_state
      add constraint openingfit_user_state_user_id_platform_username_key
      unique (user_id, platform, username);
  end if;
end;
$$;

do $$
declare
  user_table text;
begin
  foreach user_table in array array[
    'activity_history',
    'ai_generations',
    'favorites',
    'measurements',
    'onboarding_answers',
    'openingfit_user_state',
    'outfits',
    'profiles',
    'report_history',
    'settings'
  ]
  loop
    if to_regclass(format('public.%I', user_table)) is not null
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = user_table
          and column_name = 'user_id'
      )
    then
      execute format('alter table public.%I enable row level security', user_table);

      execute format('drop policy if exists %I on public.%I', user_table || '_select_own', user_table);
      execute format(
        'create policy %I on public.%I for select using (auth.uid() = user_id)',
        user_table || '_select_own',
        user_table
      );

      execute format('drop policy if exists %I on public.%I', user_table || '_insert_own', user_table);
      execute format(
        'create policy %I on public.%I for insert with check (auth.uid() = user_id)',
        user_table || '_insert_own',
        user_table
      );

      execute format('drop policy if exists %I on public.%I', user_table || '_update_own', user_table);
      execute format(
        'create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)',
        user_table || '_update_own',
        user_table
      );

      execute format('drop policy if exists %I on public.%I', user_table || '_delete_own', user_table);
      execute format(
        'create policy %I on public.%I for delete using (auth.uid() = user_id)',
        user_table || '_delete_own',
        user_table
      );
    end if;
  end loop;
end;
$$;

drop trigger if exists set_openingfit_user_state_updated_at on public.openingfit_user_state;
create trigger set_openingfit_user_state_updated_at
before update on public.openingfit_user_state
for each row execute function public.set_updated_at();
