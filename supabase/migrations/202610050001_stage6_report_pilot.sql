-- Additive web report pilot. Apply after 202610040001; no accounts are enrolled.
begin;
create table public.openingfit_report_pilot_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false
);
alter table public.openingfit_report_pilot_accounts enable row level security;
revoke all on public.openingfit_report_pilot_accounts from public, anon, authenticated;
grant select on public.openingfit_report_pilot_accounts to service_role;
create policy report_pilot_service_read on public.openingfit_report_pilot_accounts
  for select to service_role using (true);

create or replace function public.openingfit_guard_isolated_report_write() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'UPDATE' and (new.user_id, new.collection, new.row_key) is distinct from
      (old.user_id, old.collection, old.row_key) then
    raise exception 'Report identity is immutable' using errcode = '23514';
  end if;
  if not coalesce((select enabled from public.openingfit_report_rollout where id = 1), false) then
    raise exception 'New report storage is disabled' using errcode = '55000';
  end if;
  if not coalesce((select enabled from public.openingfit_report_pilot_accounts where user_id = new.user_id), false) then
    raise exception 'Account is not enabled for the report pilot' using errcode = '42501';
  end if;
  if new.collection in ('repertoire', 'saved_openings', 'weekly_training_plans',
      'coaching_weekly_reviews', 'coaching_response_plans', 'repertoire_entries', 'repertoires') then
    raise exception 'Report-only pilot: training and repertoire writes are unavailable' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.collection in ('report_history', 'analysis_history')
     and new.payload is distinct from old.payload then
    raise exception 'Saved reports are immutable' using errcode = '23514';
  end if;
  return new;
end $$;

-- RPCs using an isolated report ID must not write legacy tables, even if their
-- arguments omit generation markers. Same-account legacy reports remain valid.
create or replace function public.openingfit_guard_legacy_report_write() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare report_id text;
begin
  if public.openingfit_contains_stage6(to_jsonb(new)) then
    raise exception 'New-generation data requires isolated report storage' using errcode = '23514';
  end if;
  for report_id in
    select distinct ids.value from public.openingfit_report_store_v2 s
    cross join lateral (values (s.row_key), (s.payload->>'id'), (s.payload->>'analysis_id'),
      (s.payload->'report'->>'analysisId')) ids(value)
    where s.collection in ('report_history', 'analysis_history') and length(ids.value) >= 16
  loop
    if position(report_id in to_jsonb(new)::text) > 0 then
      raise exception 'Isolated report references cannot be written to legacy storage' using errcode = '23514';
    end if;
  end loop;
  return new;
end $$;
revoke all on function public.openingfit_guard_legacy_report_write() from public, anon, authenticated;
comment on table public.openingfit_report_pilot_accounts is 'Explicit test-account admission; empty and disabled by default. Retain membership during creation rollback for saved-report reads.';
commit;
