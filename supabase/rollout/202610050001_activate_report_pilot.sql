-- EXPLICIT LAUNCH APPROVAL REQUIRED. psql -v pilot_user_id='<approved UUID>'.
-- Backend OPENINGFIT_STAGE6_REPORTS_ENABLED must remain false until verified.
\set ON_ERROR_STOP on
begin;
do $$ begin
  if not exists(select 1 from public.openingfit_report_rollout where id=1 and enabled=false) then
    raise exception 'Expected creation disabled before activation'; end if;
  if exists(select 1 from public.openingfit_report_pilot_accounts where enabled) then
    raise exception 'Expected no active pilot accounts; review existing admission'; end if;
end $$;
-- UUID cast and auth.users FK fail closed for a missing or invalid account.
insert into public.openingfit_report_pilot_accounts(user_id,enabled)
  values (:'pilot_user_id'::uuid,true)
  on conflict (user_id) do update set enabled=true;
update public.openingfit_report_rollout set enabled=true where id=1;
commit;
select user_id,enabled from public.openingfit_report_pilot_accounts where enabled;
