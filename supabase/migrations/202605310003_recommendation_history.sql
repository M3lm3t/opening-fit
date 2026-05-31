create extension if not exists "pgcrypto";

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

alter table public.recommendation_history add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.recommendation_history add column if not exists analysis_date timestamptz not null default now();
alter table public.recommendation_history add column if not exists games_analysed integer not null default 0;
alter table public.recommendation_history add column if not exists detected_openings jsonb not null default '[]'::jsonb;
alter table public.recommendation_history add column if not exists recommended_openings jsonb not null default '[]'::jsonb;
alter table public.recommendation_history add column if not exists confidence_score numeric;
alter table public.recommendation_history add column if not exists style_profile jsonb;
alter table public.recommendation_history add column if not exists time_control_filter text not null default 'custom';
alter table public.recommendation_history add column if not exists analysis_version text not null default 'retention-history-v1';
alter table public.recommendation_history add column if not exists snapshot jsonb not null default '{}'::jsonb;
alter table public.recommendation_history add column if not exists created_at timestamptz not null default now();
alter table public.recommendation_history add column if not exists updated_at timestamptz not null default now();

alter table public.recommendation_history enable row level security;

drop policy if exists recommendation_history_select_own on public.recommendation_history;
create policy recommendation_history_select_own
on public.recommendation_history for select
using (auth.uid() = user_id);

drop policy if exists recommendation_history_insert_own on public.recommendation_history;
create policy recommendation_history_insert_own
on public.recommendation_history for insert
with check (auth.uid() = user_id);

drop policy if exists recommendation_history_update_own on public.recommendation_history;
create policy recommendation_history_update_own
on public.recommendation_history for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists recommendation_history_delete_own on public.recommendation_history;
create policy recommendation_history_delete_own
on public.recommendation_history for delete
using (auth.uid() = user_id);

create index if not exists recommendation_history_user_date_idx
on public.recommendation_history(user_id, analysis_date desc);

drop trigger if exists set_recommendation_history_updated_at on public.recommendation_history;
create trigger set_recommendation_history_updated_at
before update on public.recommendation_history
for each row execute function public.set_updated_at();
