-- Account-based daily training streak. UTC is the canonical v1 day boundary.
-- No historical activity is backfilled: only calls made after deployment count.

create table if not exists public.training_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= current_streak),
  last_qualified_date date,
  last_qualified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.qualified_streak_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  activity_type text not null check (activity_type in (
    'analysis_completed',
    'today_training_completed',
    'training_task_completed',
    'repair_review_completed'
  )),
  source_id text not null check (length(source_id) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (user_id, activity_type, source_id)
);

create index if not exists qualified_streak_activities_user_date_idx
on public.qualified_streak_activities (user_id, activity_date desc, created_at desc);

alter table public.training_streaks enable row level security;
alter table public.qualified_streak_activities enable row level security;

drop policy if exists training_streaks_select_own on public.training_streaks;
create policy training_streaks_select_own on public.training_streaks
for select to authenticated using (auth.uid() = user_id);

drop policy if exists qualified_streak_activities_select_own on public.qualified_streak_activities;
create policy qualified_streak_activities_select_own on public.qualified_streak_activities
for select to authenticated using (auth.uid() = user_id);

revoke insert, update, delete on public.training_streaks from authenticated;
revoke insert, update, delete on public.qualified_streak_activities from authenticated;
grant select on public.training_streaks to authenticated;
grant select on public.qualified_streak_activities to authenticated;

create or replace function public.training_streak_payload(p_owner_id uuid, p_today date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'currentStreak', case
      when s.last_qualified_date is null or s.last_qualified_date < p_today - 1 then 0
      else s.current_streak
    end,
    'longestStreak', coalesce(s.longest_streak, 0),
    'completedToday', coalesce(s.last_qualified_date = p_today, false),
    'lastQualifiedDate', s.last_qualified_date,
    'lastQualifiedAt', s.last_qualified_at,
    'timezone', 'UTC'
  )
  from (select p_owner_id as user_id) owner
  left join public.training_streaks s on s.user_id = owner.user_id;
$$;

create or replace function public.get_training_streak()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  canonical_today date := (now() at time zone 'UTC')::date;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  return public.training_streak_payload(owner_id, canonical_today);
end;
$$;

create or replace function public.record_qualified_streak_activity(
  p_activity_type text,
  p_source_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  canonical_now timestamptz := now();
  canonical_today date := (canonical_now at time zone 'UTC')::date;
  inserted_id uuid;
  streak public.training_streaks;
  next_current integer;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if p_activity_type not in ('analysis_completed', 'today_training_completed', 'training_task_completed', 'repair_review_completed') then
    raise exception 'Unsupported qualifying streak activity';
  end if;
  p_source_id := nullif(btrim(p_source_id), '');
  if p_source_id is null or length(p_source_id) > 200 then raise exception 'A valid source id is required'; end if;

  insert into public.qualified_streak_activities (user_id, activity_date, activity_type, source_id, created_at)
  values (owner_id, canonical_today, p_activity_type, p_source_id, canonical_now)
  on conflict (user_id, activity_type, source_id) do nothing
  returning id into inserted_id;

  insert into public.training_streaks (user_id)
  values (owner_id)
  on conflict (user_id) do nothing;

  select * into streak from public.training_streaks
  where user_id = owner_id for update;

  if inserted_id is null or streak.last_qualified_date = canonical_today then
    return public.training_streak_payload(owner_id, canonical_today);
  end if;

  next_current := case
    when streak.last_qualified_date = canonical_today - 1 then streak.current_streak + 1
    else 1
  end;

  update public.training_streaks set
    current_streak = next_current,
    longest_streak = greatest(longest_streak, next_current),
    last_qualified_date = canonical_today,
    last_qualified_at = canonical_now,
    updated_at = canonical_now
  where user_id = owner_id;

  return public.training_streak_payload(owner_id, canonical_today);
end;
$$;

revoke all on function public.training_streak_payload(uuid, date) from public, anon, authenticated;
revoke all on function public.get_training_streak() from public, anon;
revoke all on function public.record_qualified_streak_activity(text, text) from public, anon;
grant execute on function public.get_training_streak() to authenticated;
grant execute on function public.record_qualified_streak_activity(text, text) to authenticated;

comment on table public.training_streaks is 'Current and longest meaningful-activity streak per account; UTC day boundary.';
comment on table public.qualified_streak_activities is 'Idempotent post-activation ledger of meaningful activities that may secure a streak day.';
