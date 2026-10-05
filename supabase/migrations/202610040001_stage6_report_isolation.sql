-- Additive isolation. Apply only after review; default is disabled.
begin;
create table public.openingfit_report_rollout (
  id integer primary key check (id = 1),
  enabled boolean not null default false
);
insert into public.openingfit_report_rollout(id, enabled) values (1, false);
create table public.openingfit_report_store_v2 (
  user_id uuid not null references auth.users(id) on delete cascade,
  collection text not null,
  row_key text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  primary key (user_id, collection, row_key),
  check (payload->>'user_id' is not null and payload->>'user_id' = user_id::text)
);
alter table public.openingfit_report_rollout enable row level security;
alter table public.openingfit_report_store_v2 enable row level security;
revoke all on public.openingfit_report_rollout, public.openingfit_report_store_v2 from public, anon, authenticated;
grant select on public.openingfit_report_rollout to service_role;
grant select, insert, update, delete on public.openingfit_report_store_v2 to service_role;
-- Even accidental grants to authenticated do not expose this namespace.
create policy report_store_service_only on public.openingfit_report_store_v2
  to service_role using (true) with check (true);
create policy report_rollout_service_read on public.openingfit_report_rollout
  for select to service_role using (true);

create function public.openingfit_guard_isolated_report_write() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'UPDATE' and (new.user_id, new.collection, new.row_key) is distinct from
      (old.user_id, old.collection, old.row_key) then
    raise exception 'Report identity is immutable' using errcode = '23514';
  end if;
  if not (select enabled from public.openingfit_report_rollout where id = 1) then
    raise exception 'New report storage is disabled' using errcode = '55000';
  end if;
  if tg_op = 'UPDATE' and old.collection in ('report_history', 'analysis_history')
     and new.payload is distinct from old.payload then
    raise exception 'Saved reports are immutable' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.openingfit_guard_isolated_report_write() from public, anon, authenticated;
create trigger guard_isolated_report_write before insert or update on public.openingfit_report_store_v2
  for each row execute function public.openingfit_guard_isolated_report_write();

create function public.openingfit_contains_stage6(value jsonb) returns boolean
language sql immutable strict set search_path = pg_catalog as $$
  select value::text ~ '(report_decision_v7|repertoire_health_v4|opening_suitability_v2|deterministic_opening_fit_metrics_v2|report_comparison_v1|isolated_report_store_v1|stage6_v1)'
$$;
create function public.openingfit_guard_legacy_report_write() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
begin
  if public.openingfit_contains_stage6(to_jsonb(new)) then
    raise exception 'New-generation data requires isolated report storage' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.openingfit_guard_legacy_report_write() from public, anon, authenticated;
-- Guard every existing JSON/text mirror, including profile/state/retention,
-- share/export metadata and RPC-written auxiliary tables. Existing RLS and
-- grants are untouched. No history values are rewritten or reclassified.
do $$ declare target record; leaked boolean; begin
  for target in
    select distinct c.table_schema, c.table_name from information_schema.columns c
    join information_schema.tables t using (table_schema, table_name)
    where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
      and c.data_type in ('json', 'jsonb', 'text', 'character varying')
      and c.table_name not in ('openingfit_report_store_v2', 'openingfit_report_rollout')
  loop
    execute format('select exists(select 1 from %I.%I r where public.openingfit_contains_stage6(to_jsonb(r)))',
      target.table_schema, target.table_name) into leaked;
    if leaked then
      raise exception 'Existing new-generation data in %.%; review isolation before migration', target.table_schema, target.table_name;
    end if;
    execute format('create trigger guard_stage6_legacy_write before insert or update on %I.%I for each row execute function public.openingfit_guard_legacy_report_write()',
      target.table_schema, target.table_name);
  end loop;
end $$;
comment on table public.openingfit_report_store_v2 is 'Owner-scoped API-only report namespace; never mirror into legacy-readable storage.';
commit;
