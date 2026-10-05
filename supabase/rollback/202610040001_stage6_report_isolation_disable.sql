-- Non-destructive rollback. Retain the API reader, table, RLS and legacy guards.
-- Also set OPENINGFIT_STAGE6_REPORTS_ENABLED=false in the backend configuration.
begin;
update public.openingfit_report_rollout set enabled = false where id = 1;
do $$ begin
  if not exists (select 1 from public.openingfit_report_rollout where id = 1 and enabled = false) then
    raise exception 'Report rollback switch was not disabled';
  end if;
end $$;
commit;
-- Do not drop the isolated store, rewrite saved reports, relabel v4 as v3,
-- copy reports to legacy mirrors, or downgrade compatible readers.
