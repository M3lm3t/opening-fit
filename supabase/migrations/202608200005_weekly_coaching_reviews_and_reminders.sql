create table if not exists public.coaching_weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  review_key text not null,
  report_id uuid null,
  status text not null default 'ready' check (status in ('ready', 'read', 'dismissed')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start),
  unique (user_id, review_key)
);

alter table public.coaching_weekly_reviews enable row level security;
drop policy if exists coaching_weekly_reviews_owner_all on public.coaching_weekly_reviews;
create policy coaching_weekly_reviews_owner_all on public.coaching_weekly_reviews
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.notification_preferences add column if not exists reminders_enabled boolean not null default false;
alter table public.notification_preferences add column if not exists game_check_reminders boolean not null default true;
alter table public.notification_preferences add column if not exists weekly_plan_reminders boolean not null default true;
alter table public.notification_preferences add column if not exists consistency_reminders boolean not null default true;
alter table public.notification_preferences add column if not exists timezone text not null default 'UTC';
alter table public.notification_preferences add column if not exists quiet_hours_start smallint not null default 21 check (quiet_hours_start between 0 and 23);
alter table public.notification_preferences add column if not exists quiet_hours_end smallint not null default 8 check (quiet_hours_end between 0 and 23);
alter table public.notification_preferences add column if not exists permission_requested_at timestamptz;
alter table public.notification_preferences add column if not exists last_reminder_date date;
alter table public.notification_preferences add column if not exists last_reminder_type text;

create index if not exists coaching_weekly_reviews_user_week_idx on public.coaching_weekly_reviews(user_id, week_start desc);

comment on table public.coaching_weekly_reviews is 'Immutable-per-week deterministic coaching review snapshots owned by one authenticated user.';
comment on column public.notification_preferences.reminders_enabled is 'Explicit opt-in; legacy preference rows remain disabled until the user activates reminders.';
