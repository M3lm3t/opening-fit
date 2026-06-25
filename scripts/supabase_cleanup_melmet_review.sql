-- OpeningFit melmet cleanup review script.
--
-- Do not run this until the target UUID has been reviewed.
-- Usage:
--   psql "$DATABASE_URL" -v target_user_id='00000000-0000-0000-0000-000000000000' -f scripts/supabase_cleanup_melmet_review.sql
--
-- Safety model:
-- - Requires an explicit target_user_id UUID.
-- - Verifies exactly one public data identity resolves to username melmet.
-- - Verifies that identity is the supplied UUID.
-- - Preserves the earliest report_history row for melmet by created_at.
-- - Deletes only rows owned by the supplied UUID.
-- - Does not delete profiles or premium_entitlements.
-- - Does not alter schemas, RLS, policies, triggers, or Stripe/payment fields.

\set ON_ERROR_STOP on

begin;

create temp table _melmet_cleanup_params as
select
  :'target_user_id'::uuid as target_user_id,
  'melmet'::text as target_username;

create temp table _melmet_cleanup_tables (
  table_name text primary key,
  mode text not null,
  note text not null
);

insert into _melmet_cleanup_tables (table_name, mode, note)
values
  ('profiles', 'count_only', 'Kept: profile/auth metadata and premium flags are not cleanup targets.'),
  ('premium_entitlements', 'count_only', 'Kept: Stripe/payment entitlement record must not be deleted.'),
  ('report_history', 'preserve_earliest_report', 'Keeps the earliest melmet report_history row by created_at, deletes later target-user reports.'),
  ('openingfit_user_state', 'delete_all', 'Deletes target-user cached report/progress workspace rows.'),
  ('settings', 'delete_all', 'Deletes target-user app settings backup rows.'),
  ('activity_history', 'delete_all_except_retained_report_link', 'Deletes target-user activity rows, preserving rows linked to the retained report when related_report_id exists.'),
  ('openingfit_retention_snapshots', 'delete_all', 'Deletes target-user retention snapshots.'),
  ('analysed_games', 'delete_all', 'Deletes target-user imported game rows.'),
  ('recommendation_history', 'delete_all', 'Deletes target-user recommendation snapshots.'),
  ('notification_preferences', 'delete_all', 'Deletes target-user notification preferences.'),
  ('analysis_history', 'delete_all', 'Deletes target-user legacy analysis snapshots.'),
  ('saved_recommendations', 'delete_all', 'Deletes target-user saved recommendation rows.'),
  ('opening_preferences', 'delete_all', 'Deletes target-user opening preferences.'),
  ('repertoire', 'delete_all', 'Deletes target-user repertoire rows.'),
  ('saved_openings', 'delete_all', 'Deletes target-user saved openings.'),
  ('chess_account_links', 'delete_all', 'Deletes target-user username/platform account links.'),
  ('user_settings', 'delete_all', 'Deletes target-user legacy user_settings rows.'),
  ('user_profiles', 'delete_all', 'Deletes target-user deprecated retention profile rows only.'),
  ('user_activity_log', 'delete_all_except_retained_report_link', 'Deletes target-user legacy activity rows, preserving rows linked to the retained report when related_report_id exists.'),
  ('user_streaks', 'delete_all', 'Deletes target-user legacy streak rows.'),
  ('user_goals', 'delete_all', 'Deletes target-user legacy goal rows.'),
  ('user_achievements', 'delete_all', 'Deletes target-user legacy achievement rows.'),
  ('weekly_reports', 'delete_all', 'Deletes target-user legacy weekly report rows.'),
  ('onboarding_answers', 'delete_all', 'Deletes target-user deprecated onboarding rows.'),
  ('measurements', 'delete_all', 'Deletes target-user deprecated measurement rows.'),
  ('outfits', 'delete_all', 'Deletes target-user deprecated outfit rows.'),
  ('favorites', 'delete_all', 'Deletes target-user deprecated favorite rows.'),
  ('uploads', 'delete_all', 'Deletes target-user deprecated upload metadata rows only; storage objects are not touched.'),
  ('ai_generations', 'delete_all', 'Deletes target-user deprecated AI generation rows.');

create temp table _melmet_identity_sources (
  user_id uuid not null,
  source text not null,
  platform text,
  matched_username text
);

do $$
declare
  target_user uuid := (select target_user_id from _melmet_cleanup_params);
  target_name text := (select target_username from _melmet_cleanup_params);
begin
  if target_user is null then
    raise exception 'target_user_id is required';
  end if;

  if not exists (select 1 from auth.users where id = target_user) then
    raise exception 'target_user_id % was not found in auth.users', target_user;
  end if;

  if to_regclass('public.profiles') is not null then
    insert into _melmet_identity_sources (user_id, source, platform, matched_username)
    select user_id, 'profiles.username', platform, username
    from public.profiles
    where user_id is not null and lower(username) = target_name;

    insert into _melmet_identity_sources (user_id, source, platform, matched_username)
    select user_id, 'profiles.chesscom_username', 'chesscom', chesscom_username
    from public.profiles
    where user_id is not null and lower(chesscom_username) = target_name;

    insert into _melmet_identity_sources (user_id, source, platform, matched_username)
    select user_id, 'profiles.lichess_username', 'lichess', lichess_username
    from public.profiles
    where user_id is not null and lower(lichess_username) = target_name;

    insert into _melmet_identity_sources (user_id, source, platform, matched_username)
    select
      user_id,
      'profiles.last_report',
      coalesce(last_report->>'platform', last_report->>'importPlatform', last_report->>'source'),
      coalesce(last_report->>'username', last_report->>'playerName', last_report->'profile'->>'username', last_report->'account'->>'username')
    from public.profiles
    where user_id is not null
      and lower(coalesce(last_report->>'username', last_report->>'playerName', last_report->'profile'->>'username', last_report->'account'->>'username')) = target_name;
  end if;

  if to_regclass('public.chess_account_links') is not null then
    insert into _melmet_identity_sources (user_id, source, platform, matched_username)
    select user_id, 'chess_account_links.username', platform, username
    from public.chess_account_links
    where user_id is not null and lower(username) = target_name;
  end if;

  if to_regclass('public.openingfit_user_state') is not null then
    insert into _melmet_identity_sources (user_id, source, platform, matched_username)
    select user_id, 'openingfit_user_state.username', platform, username
    from public.openingfit_user_state
    where user_id is not null and lower(username) = target_name;
  end if;

  if to_regclass('public.report_history') is not null then
    insert into _melmet_identity_sources (user_id, source, platform, matched_username)
    select
      user_id,
      'report_history.username',
      platform,
      username
    from public.report_history
    where user_id is not null and lower(username) = target_name;

    insert into _melmet_identity_sources (user_id, source, platform, matched_username)
    select
      user_id,
      'report_history.summary_or_report',
      coalesce(platform, summary->>'platform', report->>'platform', report->>'importPlatform', report->>'source'),
      coalesce(summary->>'username', report->>'username', report->>'playerName', report->'profile'->>'username', report->'account'->>'username')
    from public.report_history
    where user_id is not null
      and lower(coalesce(summary->>'username', report->>'username', report->>'playerName', report->'profile'->>'username', report->'account'->>'username')) = target_name;
  end if;

  if to_regclass('public.analysis_history') is not null then
    insert into _melmet_identity_sources (user_id, source, platform, matched_username)
    select user_id, 'analysis_history.username', platform, username
    from public.analysis_history
    where user_id is not null and lower(username) = target_name;
  end if;

  if to_regclass('public.analysed_games') is not null then
    insert into _melmet_identity_sources (user_id, source, platform, matched_username)
    select user_id, 'analysed_games.username', platform, username
    from public.analysed_games
    where user_id is not null and lower(username) = target_name;
  end if;
end $$;

create temp table _melmet_identity_summary as
select
  user_id,
  array_agg(distinct source order by source) as sources,
  array_agg(distinct coalesce(platform, 'unknown') order by coalesce(platform, 'unknown')) as platforms
from _melmet_identity_sources
group by user_id;

do $$
declare
  candidate_count integer;
  target_user uuid := (select target_user_id from _melmet_cleanup_params);
begin
  select count(*) into candidate_count from _melmet_identity_summary;

  if candidate_count = 0 then
    raise exception 'No public OpeningFit data identity resolves to username melmet. Refusing cleanup.';
  end if;

  if candidate_count > 1 then
    raise exception 'Username melmet resolves to % user_ids. Refusing ambiguous cleanup. Inspect _melmet_identity_summary.', candidate_count;
  end if;

  if not exists (select 1 from _melmet_identity_summary where user_id = target_user) then
    raise exception 'Supplied target_user_id % does not match the melmet identity found in public data.', target_user;
  end if;
end $$;

do $$
begin
  if to_regclass('public.report_history') is null then
    raise exception 'public.report_history is missing. Refusing cleanup.';
  end if;
end $$;

create temp table _melmet_retained_report as
select
  id,
  user_id,
  created_at,
  updated_at,
  report_key,
  username,
  platform,
  coalesce(summary->>'username', report->>'username', report->>'playerName', report->'profile'->>'username', report->'account'->>'username', username) as matched_username
from public.report_history
where user_id = (select target_user_id from _melmet_cleanup_params)
  and lower(coalesce(summary->>'username', report->>'username', report->>'playerName', report->'profile'->>'username', report->'account'->>'username', username)) = (select target_username from _melmet_cleanup_params)
order by created_at asc nulls last, id asc
limit 1;

do $$
begin
  if not exists (select 1 from _melmet_retained_report) then
    raise exception 'No melmet report_history row exists for target_user_id. Refusing cleanup because there is no earliest report to preserve.';
  end if;

  if exists (
    select 1
    from pg_constraint
    where contype = 'f'
      and confrelid = 'public.report_history'::regclass
      and conrelid <> 'public.report_history'::regclass
  ) then
    raise exception 'Unexpected foreign keys reference public.report_history. Inspect pg_constraint before cleanup.';
  end if;
end $$;

create temp table _melmet_cleanup_counts (
  table_name text primary key,
  mode text not null,
  before_count bigint,
  after_count bigint,
  deleted_count bigint,
  note text not null
);

do $$
declare
  row_def record;
  owner_column text;
  before_total bigint;
  target_user uuid := (select target_user_id from _melmet_cleanup_params);
begin
  for row_def in select * from _melmet_cleanup_tables order by table_name loop
    if to_regclass(format('public.%I', row_def.table_name)) is null then
      insert into _melmet_cleanup_counts (table_name, mode, before_count, after_count, deleted_count, note)
      values (row_def.table_name, row_def.mode, null, null, null, row_def.note || ' Table is not present in this database.');
      continue;
    end if;

    select column_name into owner_column
    from information_schema.columns
    where table_schema = 'public'
      and table_name = row_def.table_name
      and column_name = 'user_id'
    limit 1;

    if owner_column is null and row_def.table_name = 'user_profiles' then
      select column_name into owner_column
      from information_schema.columns
      where table_schema = 'public'
        and table_name = row_def.table_name
        and column_name = 'id'
      limit 1;
    end if;

    if owner_column is null then
      raise exception 'Expected owner column user_id on public.%, but none was found. Refusing cleanup.', row_def.table_name;
    end if;

    execute format('select count(*) from public.%I where %I = $1', row_def.table_name, owner_column)
      into before_total
      using target_user;

    insert into _melmet_cleanup_counts (table_name, mode, before_count, after_count, deleted_count, note)
    values (row_def.table_name, row_def.mode, before_total, null, null, row_def.note);
  end loop;
end $$;

do $$
declare
  row_def record;
  owner_column text;
  retained_report uuid := (select id from _melmet_retained_report);
  target_user uuid := (select target_user_id from _melmet_cleanup_params);
begin
  for row_def in select * from _melmet_cleanup_tables where mode <> 'count_only' order by table_name loop
    if to_regclass(format('public.%I', row_def.table_name)) is null then
      continue;
    end if;

    select column_name into owner_column
    from information_schema.columns
    where table_schema = 'public'
      and table_name = row_def.table_name
      and column_name = 'user_id'
    limit 1;

    if owner_column is null and row_def.table_name = 'user_profiles' then
      select column_name into owner_column
      from information_schema.columns
      where table_schema = 'public'
        and table_name = row_def.table_name
        and column_name = 'id'
      limit 1;
    end if;

    if row_def.table_name = 'report_history' then
      execute 'delete from public.report_history where user_id = $1 and id <> $2'
        using target_user, retained_report;
    elsif row_def.mode = 'delete_all_except_retained_report_link'
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = row_def.table_name
          and column_name = 'related_report_id'
      )
    then
      execute format(
        'delete from public.%I where %I = $1 and (related_report_id is null or related_report_id <> $2)',
        row_def.table_name,
        owner_column
      )
      using target_user, retained_report;
    else
      execute format('delete from public.%I where %I = $1', row_def.table_name, owner_column)
        using target_user;
    end if;
  end loop;
end $$;

do $$
declare
  row_def record;
  owner_column text;
  after_total bigint;
  target_user uuid := (select target_user_id from _melmet_cleanup_params);
begin
  for row_def in select * from _melmet_cleanup_tables order by table_name loop
    if to_regclass(format('public.%I', row_def.table_name)) is null then
      update _melmet_cleanup_counts
      set after_count = null, deleted_count = null
      where table_name = row_def.table_name;
      continue;
    end if;

    select column_name into owner_column
    from information_schema.columns
    where table_schema = 'public'
      and table_name = row_def.table_name
      and column_name = 'user_id'
    limit 1;

    if owner_column is null and row_def.table_name = 'user_profiles' then
      select column_name into owner_column
      from information_schema.columns
      where table_schema = 'public'
        and table_name = row_def.table_name
        and column_name = 'id'
      limit 1;
    end if;

    execute format('select count(*) from public.%I where %I = $1', row_def.table_name, owner_column)
      into after_total
      using target_user;

    update _melmet_cleanup_counts
    set after_count = after_total,
        deleted_count = before_count - after_total
    where table_name = row_def.table_name;
  end loop;
end $$;

select * from _melmet_identity_summary;

select
  id as retained_report_id,
  user_id,
  created_at,
  updated_at,
  report_key,
  username,
  platform,
  matched_username
from _melmet_retained_report;

select
  table_name,
  mode,
  before_count,
  after_count,
  deleted_count,
  note
from _melmet_cleanup_counts
order by table_name;

commit;
