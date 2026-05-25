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

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  goal_text text,
  current_level text default 'Beginner',
  xp integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.user_activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  activity_type text not null,
  points integer default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.user_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak integer default 0,
  best_streak integer default 0,
  last_active_date date,
  streak_freezes integer default 1,
  updated_at timestamptz default now()
);

create table if not exists public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  goal_type text not null,
  target_value integer not null,
  current_value integer default 0,
  period text default 'weekly',
  starts_on date default current_date,
  ends_on date,
  completed boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  achievement_key text not null,
  title text not null,
  description text,
  unlocked_at timestamptz default now(),
  unique (user_id, achievement_key)
);

create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  summary text,
  stats jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique (user_id, week_start)
);

alter table public.user_profiles enable row level security;
alter table public.user_activity_log enable row level security;
alter table public.user_streaks enable row level security;
alter table public.user_goals enable row level security;
alter table public.user_achievements enable row level security;
alter table public.weekly_reports enable row level security;

drop policy if exists user_profiles_select_own on public.user_profiles;
create policy user_profiles_select_own
on public.user_profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists user_profiles_insert_own on public.user_profiles;
create policy user_profiles_insert_own
on public.user_profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists user_profiles_update_own on public.user_profiles;
create policy user_profiles_update_own
on public.user_profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists user_profiles_delete_own on public.user_profiles;
create policy user_profiles_delete_own
on public.user_profiles for delete
to authenticated
using (id = auth.uid());

drop policy if exists user_activity_log_select_own on public.user_activity_log;
create policy user_activity_log_select_own
on public.user_activity_log for select
to authenticated
using (user_id = auth.uid());

drop policy if exists user_activity_log_insert_own on public.user_activity_log;
create policy user_activity_log_insert_own
on public.user_activity_log for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists user_activity_log_update_own on public.user_activity_log;
create policy user_activity_log_update_own
on public.user_activity_log for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists user_activity_log_delete_own on public.user_activity_log;
create policy user_activity_log_delete_own
on public.user_activity_log for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists user_streaks_select_own on public.user_streaks;
create policy user_streaks_select_own
on public.user_streaks for select
to authenticated
using (user_id = auth.uid());

drop policy if exists user_streaks_insert_own on public.user_streaks;
create policy user_streaks_insert_own
on public.user_streaks for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists user_streaks_update_own on public.user_streaks;
create policy user_streaks_update_own
on public.user_streaks for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists user_streaks_delete_own on public.user_streaks;
create policy user_streaks_delete_own
on public.user_streaks for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists user_goals_select_own on public.user_goals;
create policy user_goals_select_own
on public.user_goals for select
to authenticated
using (user_id = auth.uid());

drop policy if exists user_goals_insert_own on public.user_goals;
create policy user_goals_insert_own
on public.user_goals for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists user_goals_update_own on public.user_goals;
create policy user_goals_update_own
on public.user_goals for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists user_goals_delete_own on public.user_goals;
create policy user_goals_delete_own
on public.user_goals for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists user_achievements_select_own on public.user_achievements;
create policy user_achievements_select_own
on public.user_achievements for select
to authenticated
using (user_id = auth.uid());

drop policy if exists user_achievements_insert_own on public.user_achievements;
create policy user_achievements_insert_own
on public.user_achievements for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists user_achievements_update_own on public.user_achievements;
create policy user_achievements_update_own
on public.user_achievements for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists user_achievements_delete_own on public.user_achievements;
create policy user_achievements_delete_own
on public.user_achievements for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists weekly_reports_select_own on public.weekly_reports;
create policy weekly_reports_select_own
on public.weekly_reports for select
to authenticated
using (user_id = auth.uid());

drop policy if exists weekly_reports_insert_own on public.weekly_reports;
create policy weekly_reports_insert_own
on public.weekly_reports for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists weekly_reports_update_own on public.weekly_reports;
create policy weekly_reports_update_own
on public.weekly_reports for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists weekly_reports_delete_own on public.weekly_reports;
create policy weekly_reports_delete_own
on public.weekly_reports for delete
to authenticated
using (user_id = auth.uid());

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_user_streaks_updated_at on public.user_streaks;
create trigger set_user_streaks_updated_at
before update on public.user_streaks
for each row execute function public.set_updated_at();
