\set ON_ERROR_STOP on
begin;
-- Default-off applies to trusted writers too.
do $$ begin
  begin
    insert into public.openingfit_report_store_v2 values
      ('11111111-1111-4111-8111-111111111111','report_history','new-one',
       '{"user_id":"11111111-1111-4111-8111-111111111111","report":{"repertoireHealth":{"version":"repertoire_health_v4","score":83}}}');
    raise exception 'Default-off bypassed';
  exception when sqlstate '55000' then null; end;
end $$;
update public.openingfit_report_rollout set enabled=true where id=1;
set local role service_role;
insert into public.openingfit_report_store_v2(user_id,collection,row_key,payload) values
 ('11111111-1111-4111-8111-111111111111','report_history','new-one',
  '{"user_id":"11111111-1111-4111-8111-111111111111","report":{"repertoireHealth":{"version":"repertoire_health_v4","score":83}}}');
do $$ begin
  if (select count(*) from public.openingfit_report_store_v2 where user_id='11111111-1111-4111-8111-111111111111') <> 1 then raise exception 'Owner read failed'; end if;
  if (select count(*) from public.openingfit_report_store_v2 where user_id='22222222-2222-4222-8222-222222222222') <> 0 then raise exception 'Owner filter failed'; end if;
  begin
    update public.openingfit_report_store_v2 set payload=jsonb_set(payload,'{report,repertoireHealth,score}','12');
    raise exception 'Immutable history changed';
  exception when check_violation then null; end;
  begin
    insert into public.openingfit_report_store_v2(user_id,collection,row_key,payload) values
    ('11111111-1111-4111-8111-111111111111','profiles','bad-owner','{"user_id":"22222222-2222-4222-8222-222222222222"}');
    raise exception 'Payload owner mismatch accepted';
  exception when check_violation then null; end;
  begin
    insert into public.openingfit_report_store_v2(user_id,collection,row_key,payload) values
    ('11111111-1111-4111-8111-111111111111','profiles','null-owner','{"user_id":null}');
    raise exception 'Null payload owner accepted';
  exception when check_violation then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$ begin
  if (select count(*) from public.report_history) <> 1 then raise exception 'Legacy RLS owner read changed'; end if;
  if (select report #>> '{repertoireHealth,score}' from public.report_history limit 1) <> '61' then raise exception 'Stored legacy score changed'; end if;
  begin
    perform * from public.openingfit_report_store_v2;
    raise exception 'Old direct reader can see isolated reports';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.report_history(user_id,report) values
    ('22222222-2222-4222-8222-222222222222','{}');
    raise exception 'Cross-account legacy write accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.report_history(user_id,report) values
    ('11111111-1111-4111-8111-111111111111','{"snapshot":{"report":{"version":"repertoire_health_v4"}}}');
    raise exception 'History leak accepted';
  exception when check_violation then null; end;
  begin
    update public.profiles set last_report='{"version":"report_decision_v7"}';
    raise exception 'Profile leak accepted';
  exception when check_violation then null; end;
  begin
    insert into public.openingfit_user_state(user_id,last_report,coach_progress) values
    ('11111111-1111-4111-8111-111111111111','{}','{"nested":{"version":"opening_suitability_v2"}}');
    raise exception 'State mirror leak accepted';
  exception when check_violation then null; end;
  begin
    insert into public.openingfit_retention_snapshots(user_id,snapshot_key,snapshot) values
    ('11111111-1111-4111-8111-111111111111','new','{"version":"repertoire_health_v4"}');
    raise exception 'Retention leak accepted';
  exception when check_violation then null; end;
  begin
    insert into public.recommendation_history(user_id,snapshot) values
    ('11111111-1111-4111-8111-111111111111','{"version":"deterministic_opening_fit_metrics_v2"}');
    raise exception 'Recommendation leak accepted';
  exception when check_violation then null; end;
end $$;
-- Genuine legacy clients continue writing/importing without any capability header.
insert into public.report_history(user_id,report) values
 ('11111111-1111-4111-8111-111111111111','{"repertoireHealth":{"version":"repertoire_health_v3","score":62}}');
update public.profiles set last_report='{"repertoireHealth":{"version":"repertoire_health_v3","score":62}}';
reset role;
set local role anon;
do $$ begin
  begin perform * from public.openingfit_report_store_v2;
    raise exception 'Anonymous reader exposed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.openingfit_report_rollout set enabled=false where id=1;
set local role service_role;
do $$ begin
  if (select count(*) from public.openingfit_report_store_v2) <> 1 then raise exception 'Rollback lost new report'; end if;
  begin
    insert into public.openingfit_report_store_v2(user_id,collection,row_key,payload) values
    ('11111111-1111-4111-8111-111111111111','profiles','after-rollback','{"user_id":"11111111-1111-4111-8111-111111111111"}');
    raise exception 'Rollback permits new writes';
  exception when sqlstate '55000' then null; end;
  begin update public.profiles set last_report='{"version":"repertoire_health_v4"}';
    raise exception 'Service role bypassed legacy guard';
  exception when check_violation then null; end;
end $$;
reset role;
rollback;
\echo Stage6 SQL ownership, legacy reads/writes, all report mirrors, immutable history and rollback checks passed.
