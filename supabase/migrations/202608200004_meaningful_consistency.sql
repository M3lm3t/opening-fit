alter table public.activity_history add column if not exists activity_local_date date;

create or replace function public.coaching_timezone(p_user_id uuid)
returns text language plpgsql stable security definer set search_path = public
as $$
declare zone text := 'UTC';
begin
  select coalesce(nullif(s.preferences->>'timezone', ''), 'UTC') into zone from public.settings s where s.user_id = p_user_id;
  if zone is null or not exists(select 1 from pg_timezone_names where name = zone) then zone := 'UTC'; end if;
  return zone;
end;
$$;

update public.activity_history a
set activity_local_date = (coalesce(a.occurred_at, a.created_at) at time zone public.coaching_timezone(a.user_id))::date
where a.coaching_activity_type is not null and a.activity_local_date is null;

insert into public.activity_history(user_id, type, action_type, coaching_activity_type, dedupe_key, payload, occurred_at, activity_local_date, updated_at)
select q.user_id,
       case when q.activity_type = 'repair_review_completed' then 'position_review_completed' else 'training_session_completed' end,
       case when q.activity_type = 'repair_review_completed' then 'position_review_completed' else 'training_session_completed' end,
       case when q.activity_type = 'repair_review_completed' then 'position_review_completed' else 'training_session_completed' end,
       'migrated-qualified:' || q.id::text,
       jsonb_build_object('migratedFrom', 'qualified_streak_activities', 'legacySourceId', q.source_id),
       q.created_at,
       q.activity_date,
       now()
from public.qualified_streak_activities q
where q.activity_type in ('today_training_completed', 'training_task_completed', 'repair_review_completed')
on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

create or replace function public.record_meaningful_coaching_activity(
  p_activity_type text,
  p_idempotency_key text,
  p_payload jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default null
) returns public.activity_history
language plpgsql security definer set search_path = public
as $$
declare owner_id uuid := auth.uid(); saved public.activity_history; canonical_at timestamptz; local_day date;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if p_activity_type not in ('training_session_completed', 'source_game_review_completed', 'response_plan_saved', 'response_plan_recalled', 'game_check_completed', 'position_review_completed') then raise exception 'Unsupported meaningful coaching activity'; end if;
  p_idempotency_key := nullif(btrim(p_idempotency_key), '');
  if p_idempotency_key is null or length(p_idempotency_key) > 200 then raise exception 'A valid idempotency key is required'; end if;
  canonical_at := case when auth.role() = 'service_role' then coalesce(p_occurred_at, now()) else now() end;
  local_day := (canonical_at at time zone public.coaching_timezone(owner_id))::date;
  insert into public.activity_history(user_id, type, action_type, coaching_activity_type, dedupe_key, payload, evidence_refs, related_report_id, task_id, occurred_at, activity_local_date, updated_at)
  values (owner_id, p_activity_type, p_activity_type, p_activity_type, p_idempotency_key, coalesce(p_payload, '{}'::jsonb), coalesce(p_payload->'evidenceRefs', '{}'::jsonb), nullif(p_payload->>'reportId', '')::uuid, nullif(p_payload->>'taskId', ''), canonical_at, local_day, now())
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing returning * into saved;
  if saved.id is null then select * into saved from public.activity_history where user_id = owner_id and dedupe_key = p_idempotency_key; end if;
  return saved;
end;
$$;

create or replace function public.get_meaningful_consistency()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare owner_id uuid := auth.uid(); zone text; today date; dates date[]; day date; prior date; chain integer := 0; longest integer := 0; latest date; missed integer; status text; weekly integer;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  zone := public.coaching_timezone(owner_id); today := (now() at time zone zone)::date;
  select array_agg(distinct activity_local_date order by activity_local_date) into dates from public.activity_history where user_id = owner_id and coaching_activity_type is not null and activity_local_date is not null;
  if dates is not null then
    foreach day in array dates loop
      if prior is null or day - prior <= 3 then chain := chain + 1; else chain := 1; end if;
      longest := greatest(longest, chain); prior := day;
    end loop;
    latest := dates[array_length(dates, 1)]; missed := today - latest;
    if missed >= 3 then chain := 0; end if;
  else missed := null; chain := 0; end if;
  status := case when latest is null or missed >= 3 then 'reset' when missed = 0 then 'active' when missed = 1 then 'resting' when missed = 2 then 'at_risk' else 'reset' end;
  select count(*) into weekly from public.activity_history where user_id = owner_id and coaching_activity_type is not null and activity_local_date >= date_trunc('week', today::timestamp)::date and activity_local_date < date_trunc('week', today::timestamp)::date + 7;
  return jsonb_build_object('status', status, 'currentStreak', chain, 'longestStreak', longest, 'completedToday', coalesce(latest = today, false), 'lastQualifiedDate', latest, 'timezone', zone, 'weeklyCompleted', weekly, 'weeklyTarget', 3, 'milestones', array[3,7,14,30,50,100], 'latestMilestone', case when longest >= 100 then 100 when longest >= 50 then 50 when longest >= 30 then 30 when longest >= 14 then 14 when longest >= 7 then 7 when longest >= 3 then 3 else null end, 'recoveryAvailable', false, 'recoveryUsed', false);
end;
$$;

create or replace function public.get_training_streak() returns jsonb language sql stable security definer set search_path = public as $$ select public.get_meaningful_consistency() $$;
create or replace function public.get_weekly_coaching_goal() returns jsonb language sql stable security definer set search_path = public as $$ select jsonb_build_object('target', consistency->'weeklyTarget', 'completed', consistency->'weeklyCompleted', 'timezone', consistency->'timezone') from (select public.get_meaningful_consistency() as consistency) state $$;

revoke all on function public.coaching_timezone(uuid) from public, anon, authenticated;
revoke all on function public.get_meaningful_consistency() from public, anon;
grant execute on function public.get_meaningful_consistency() to authenticated, service_role;
comment on column public.activity_history.activity_local_date is 'Immutable local calendar day captured at completion so later timezone changes cannot duplicate or shift consistency days.';
