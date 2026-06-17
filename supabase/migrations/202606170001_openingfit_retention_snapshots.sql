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
