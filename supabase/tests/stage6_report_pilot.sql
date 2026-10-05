\set ON_ERROR_STOP on
begin;
do $$ begin
  if exists(select 1 from public.openingfit_report_pilot_accounts) then raise exception 'Pilot migration must start empty'; end if;
  if (select enabled from public.openingfit_report_rollout where id=1) then raise exception 'Creation must remain disabled'; end if;
end $$;
insert into public.openingfit_report_pilot_accounts(user_id) values ('11111111-1111-4111-8111-111111111111');
update public.openingfit_report_rollout set enabled=true where id=1;
do $$ begin
  begin
    insert into public.openingfit_report_store_v2(user_id,collection,row_key,payload) values
      ('11111111-1111-4111-8111-111111111111','report_history','pilot-default-test','{"user_id":"11111111-1111-4111-8111-111111111111"}');
    raise exception 'Default-disabled account admitted';
  exception when insufficient_privilege then null; end;
end $$;
update public.openingfit_report_pilot_accounts set enabled=true;
set local role service_role;
insert into public.openingfit_report_store_v2(user_id,collection,row_key,payload) values
 ('11111111-1111-4111-8111-111111111111','report_history','analysis:33333333-3333-4333-8333-333333333333',
 '{"user_id":"11111111-1111-4111-8111-111111111111","analysis_id":"33333333-3333-4333-8333-333333333333","report":{"reportGeneration":"stage6_v1"}}');
do $$ begin
  begin
    insert into public.openingfit_report_store_v2(user_id,collection,row_key,payload) values
      ('22222222-2222-4222-8222-222222222222','report_history','not-allowed','{"user_id":"22222222-2222-4222-8222-222222222222"}');
    raise exception 'Trusted writer bypassed allowlist';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.openingfit_report_store_v2(user_id,collection,row_key,payload) values
      ('11111111-1111-4111-8111-111111111111','weekly_training_plans','plan','{"user_id":"11111111-1111-4111-8111-111111111111","completed":true}');
    raise exception 'Report-only mutation accepted';
  exception when insufficient_privilege then null; end;
  begin
    update public.openingfit_report_pilot_accounts set enabled=true;
    raise exception 'API service can enrol accounts';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Simulate an existing SECURITY DEFINER RPC storing a bare report ID.
create function public.pilot_test_rpc(report_id text) returns void
language sql security definer set search_path=pg_catalog,public as $$
  insert into public.openingfit_retention_snapshots(user_id,snapshot_key,snapshot)
    values ('11111111-1111-4111-8111-111111111111','pilot-rpc-test',jsonb_build_object('report_id',report_id,'score',83));
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$ begin
  begin
    perform public.pilot_test_rpc('33333333-3333-4333-8333-333333333333');
    raise exception 'Bare new-report ID leaked via RPC';
  exception when check_violation then null; end;
  begin
    perform * from public.openingfit_report_pilot_accounts;
    raise exception 'Membership exposed to clients';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.openingfit_report_store_v2;
    raise exception 'Old direct reader can see pilot reports';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set last_report='{"report_id":"33333333-3333-4333-8333-333333333333"}';
    raise exception 'Bare ID leaked to profile';
  exception when check_violation then null; end;
  if (select count(*) from public.report_history) <> 1 then raise exception 'Legacy RLS changed'; end if;
end $$;
-- Same allowlisted user still uses genuine legacy reports and RPCs on Android.
select public.pilot_test_rpc('44444444-4444-4444-8444-444444444444');
update public.profiles set last_report='{"repertoireHealth":{"version":"repertoire_health_v3","score":61}}';
reset role;
update public.openingfit_report_rollout set enabled=false where id=1;
set local role service_role;
do $$ begin
  if not exists(select 1 from public.openingfit_report_store_v2 where row_key='analysis:33333333-3333-4333-8333-333333333333') then
    raise exception 'Rollback lost report'; end if;
  begin
    insert into public.openingfit_report_store_v2(user_id,collection,row_key,payload) values
      ('11111111-1111-4111-8111-111111111111','profiles','profile','{"user_id":"11111111-1111-4111-8111-111111111111"}');
    raise exception 'Creation rollback bypassed';
  exception when sqlstate '55000' then null; end;
end $$;
reset role;
rollback;
