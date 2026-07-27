-- REVERSIBLE POST-MIGRATION SMOKE MATRIX.
-- Required session settings (UUIDs of designated, non-customer accounts):
--   openingfit.smoke_paid_user
--   openingfit.smoke_free_user
-- The entire test is rolled back. Never substitute a customer account.
begin;

create temporary table openingfit_smoke_identity as
select
  current_setting('openingfit.smoke_paid_user')::uuid paid_user,
  current_setting('openingfit.smoke_free_user')::uuid free_user;
-- This rollback-scoped fixture contains only the two designated smoke UUIDs.
-- Each role exercised below needs to read it after SET LOCAL ROLE.
grant select on openingfit_smoke_identity to authenticated, anon, service_role;

create function pg_temp.openingfit_expect_exact_failure(
  p_sql text,
  p_expected_state text,
  p_expected_message text
)
returns void
language plpgsql
as $function$
declare
  caught_state text;
  caught_message text;
begin
  begin
    execute p_sql;
    raise exception 'Protected smoke operation unexpectedly succeeded';
  exception when others then
    get stacked diagnostics
      caught_state = returned_sqlstate,
      caught_message = message_text;
    if caught_state <> p_expected_state or caught_message <> p_expected_message then
      raise;
    end if;
  end;
end
$function$;

do $block$
declare p uuid; f uuid;
begin
  select paid_user, free_user into p, f from openingfit_smoke_identity;
  if p = f then raise exception 'Smoke accounts must be distinct'; end if;
  if not exists (select 1 from public.profiles where user_id = p)
     or not exists (select 1 from public.profiles where user_id = f) then
    raise exception 'Both designated smoke profiles must already exist';
  end if;
  if exists (
    select 1 from public.premium_entitlements e
    where e.user_id in (p, f) and (
      e.stripe_customer_id is not null or e.stripe_subscription_id is not null
      or e.stripe_payment_intent_id is not null or e.stripe_price_id is not null
      or e.last_stripe_event_id is not null
    )
  ) then raise exception 'STOP: a smoke account contains Stripe evidence'; end if;
end
$block$;

-- Capture originals before changing anything. Rollback is the restoration step.
create temporary table openingfit_smoke_original_profiles as
select * from public.profiles
where user_id in (select paid_user from openingfit_smoke_identity union all select free_user from openingfit_smoke_identity);
create temporary table openingfit_smoke_original_entitlements as
select * from public.premium_entitlements
where user_id in (select paid_user from openingfit_smoke_identity union all select free_user from openingfit_smoke_identity);
create temporary table openingfit_smoke_original_counts as
select
  (select count(*) from public.report_history) report_history,
  (select count(*) from public.repertoire) repertoire,
  (select count(*) from public.weekly_training_plans) weekly_training_plans;

-- Foundation guard: service-role context may change the derived profile flag.
select set_config('request.jwt.claim.role', 'service_role', true);
update public.profiles set is_premium = not coalesce(is_premium, false)
where user_id = (select paid_user from openingfit_smoke_identity);

-- Authenticated self-upgrade must be rejected.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', (select free_user::text from openingfit_smoke_identity), true);
do $block$
declare
  caught_state text;
  caught_message text;
begin
  begin
    update public.profiles set is_premium = true
    where user_id = (select free_user from openingfit_smoke_identity);
    raise exception 'Authenticated self-upgrade unexpectedly succeeded';
  exception when others then
    get stacked diagnostics
      caught_state = returned_sqlstate,
      caught_message = message_text;
    if caught_state <> 'P0001'
       or caught_message <> 'profiles.is_premium can only be updated by trusted server code' then
      raise;
    end if;
  end;
end
$block$;

-- Trusted synthetic entitlement upsert; all values and rows roll back.
select set_config('request.jwt.claim.role', 'service_role', true);
delete from public.premium_entitlements
where user_id in (select paid_user from openingfit_smoke_identity union all select free_user from openingfit_smoke_identity);
insert into public.premium_entitlements (
  user_id, access_type, status, stripe_status, stripe_subscription_id,
  plan_interval, source, current_period_start, current_period_end,
  last_stripe_event_id, last_stripe_event_created_at
)
select paid_user, 'monthly_subscription', 'active', 'active',
  'sub_openingfit_noncustomer_smoke', 'month', 'reconciliation_smoke',
  now() - interval '1 day', now() + interval '29 days',
  'evt_openingfit_noncustomer_entitlement_smoke', now()
from openingfit_smoke_identity
on conflict (user_id) do update set
  access_type = excluded.access_type, status = excluded.status,
  stripe_status = excluded.stripe_status,
  stripe_subscription_id = excluded.stripe_subscription_id,
  plan_interval = excluded.plan_interval, source = excluded.source,
  current_period_start = excluded.current_period_start,
  current_period_end = excluded.current_period_end,
  last_stripe_event_id = excluded.last_stripe_event_id,
  last_stripe_event_created_at = excluded.last_stripe_event_created_at;

-- Resolver: subscription, canceled-current, expired/free, and lifetime.
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', (select paid_user::text from openingfit_smoke_identity), true);
do $block$ begin
  if not public.openingfit_has_paid_access() then raise exception 'Active subscription resolver failed'; end if;
end $block$;
select set_config('request.jwt.claim.role', 'service_role', true);
update public.premium_entitlements set status='canceled', stripe_status='canceled', current_period_end=now()+interval '1 day'
where user_id=(select paid_user from openingfit_smoke_identity);
select set_config('request.jwt.claim.role', 'authenticated', true);
do $block$ begin
  if not public.openingfit_has_paid_access() then raise exception 'Canceled-current resolver failed'; end if;
end $block$;
select set_config('request.jwt.claim.role', 'service_role', true);
update public.premium_entitlements set current_period_end=now()-interval '1 day', expires_at=now()-interval '1 day'
where user_id=(select paid_user from openingfit_smoke_identity);
select set_config('request.jwt.claim.role', 'authenticated', true);
do $block$ begin
  if public.openingfit_has_paid_access() then raise exception 'Expired resolver granted access'; end if;
end $block$;
select set_config('request.jwt.claim.role', 'service_role', true);
delete from public.premium_entitlements where user_id=(select paid_user from openingfit_smoke_identity);
insert into public.premium_entitlements(user_id,access_type,status,is_grandfathered_lifetime,source)
select paid_user,'lifetime','active',true,'reconciliation_smoke' from openingfit_smoke_identity;
select set_config('request.jwt.claim.role', 'authenticated', true);
do $block$ begin
  if not public.openingfit_has_paid_access() then raise exception 'Lifetime resolver failed'; end if;
end $block$;
select set_config('request.jwt.claim.sub', (select free_user::text from openingfit_smoke_identity), true);
do $block$ begin
  if public.openingfit_has_paid_access() then raise exception 'Free resolver granted access'; end if;
end $block$;

-- Create rollback-only report/repertoire fixtures in trusted context.
select set_config('request.jwt.claim.role', 'service_role', true);
insert into public.report_history(user_id,report_key,source_platform,source_username,snapshot)
select paid_user,'reconciliation-smoke-paid','chesscom','noncustomer-smoke',
  '{"source_platform":"chesscom","source_username":"noncustomer-smoke","total_games_analysed":1}'::jsonb
from openingfit_smoke_identity;
insert into public.report_history(user_id,report_key,source_platform,source_username,snapshot)
select free_user,'reconciliation-smoke-free','lichess','noncustomer-smoke',
  '{"source_platform":"lichess","source_username":"noncustomer-smoke","total_games_analysed":1}'::jsonb
from openingfit_smoke_identity;
insert into public.repertoire(user_id,slot,display_name,canonical_name,source,status)
select free_user,'white_primary','Non-customer smoke','Non-customer smoke','user_selected','active'
from openingfit_smoke_identity;

-- Report RLS matrix: free owner read, cross-owner hidden, owner mutation
-- rejected by the paid-mutation trigger, and cross-owner mutation filtered to
-- zero rows by RLS before any row trigger can run.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', (select free_user::text from openingfit_smoke_identity), true);
do $block$
declare
  affected bigint;
  rejected int := 0;
  caught_state text;
  caught_message text;
begin
  if (select count(*) from public.report_history where report_key='reconciliation-smoke-free') <> 1
    then raise exception 'Free owner report read failed'; end if;
  if exists (select 1 from public.report_history where report_key='reconciliation-smoke-paid')
    then raise exception 'Cross-owner report was visible'; end if;

  begin
    insert into public.report_history(user_id,report_key)
    select free_user,'must-not-insert' from openingfit_smoke_identity;
    raise exception 'Free report insert unexpectedly succeeded';
  exception when others then
    get stacked diagnostics
      caught_state = returned_sqlstate,
      caught_message = message_text;
    if caught_state <> '42501'
       or caught_message <> 'Paid OpeningFit access is required for this feature' then
      raise;
    end if;
    rejected := rejected + 1;
  end;

  begin
    update public.report_history set report_key='must-not-change'
    where report_key='reconciliation-smoke-free';
    raise exception 'Free report update unexpectedly succeeded';
  exception when others then
    get stacked diagnostics
      caught_state = returned_sqlstate,
      caught_message = message_text;
    if caught_state <> '42501'
       or caught_message <> 'Paid OpeningFit access is required for this feature' then
      raise;
    end if;
    rejected := rejected + 1;
  end;

  begin
    delete from public.report_history
    where report_key='reconciliation-smoke-free';
    raise exception 'Free report delete unexpectedly succeeded';
  exception when others then
    get stacked diagnostics
      caught_state = returned_sqlstate,
      caught_message = message_text;
    if caught_state <> '42501'
       or caught_message <> 'Paid OpeningFit access is required for this feature' then
      raise;
    end if;
    rejected := rejected + 1;
  end;

  if rejected <> 3 then raise exception 'One or more free report writes were not rejected'; end if;

  update public.report_history set report_key='must-not-cross-update'
  where report_key='reconciliation-smoke-paid';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-owner report update affected rows'; end if;

  delete from public.report_history where report_key='reconciliation-smoke-paid';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-owner report delete affected rows'; end if;
end
$block$;
reset role;

-- Paid repertoire/weekly-plan/training writes succeed.
set local role authenticated;
select set_config('request.jwt.claim.sub', (select paid_user::text from openingfit_smoke_identity), true);
select public.replace_repertoire_entry('white_primary','{"display_name":"Non-customer smoke","canonical_name":"Non-customer smoke"}'::jsonb);
select public.save_weekly_training_plan(jsonb_build_object(
  'schemaVersion',1,'weekStart',current_date-(extract(isodow from current_date)::int-1),
  'weekEnd',current_date-(extract(isodow from current_date)::int-1)+6,
  'reportId',(select id from public.report_history where report_key='reconciliation-smoke-paid'),
  'primaryGoal','Non-customer smoke','reason','Reconciliation verification','estimatedMinutes',10,
  'targetMetric','{}'::jsonb,'tasks',jsonb_build_array(
    jsonb_build_object('id','smoke-1','type','position_drill','title','Smoke','explanation','Smoke','successCriteria','Smoke','status','pending'),
    jsonb_build_object('id','smoke-2','type','line_replay','title','Smoke','explanation','Smoke','successCriteria','Smoke','status','pending'),
    jsonb_build_object('id','smoke-3','type','game_review','title','Smoke','explanation','Smoke','successCriteria','Smoke','status','pending')
  )
), true);
select * from public.apply_repertoire_training_outcomes(
  '[{"canonical_name":"Non-customer smoke","training_outcome":{"result":"smoke"}}]'::jsonb
);
reset role;

-- Equivalent free mutations must fail (the fixtures remove unrelated causes).
set local role authenticated;
select set_config('request.jwt.claim.sub', (select free_user::text from openingfit_smoke_identity), true);
do $block$
declare
  rejected int := 0;
  caught_state text;
  caught_message text;
begin
  begin
    perform public.replace_repertoire_entry(
      'white_secondary', '{"display_name":"Must fail"}'::jsonb
    );
    raise exception 'Free repertoire mutation unexpectedly succeeded';
  exception when others then
    get stacked diagnostics
      caught_state = returned_sqlstate,
      caught_message = message_text;
    if caught_state <> '42501'
       or caught_message <> 'Paid OpeningFit access is required for this feature' then
      raise;
    end if;
    rejected := rejected + 1;
  end;

  begin
    perform public.save_weekly_training_plan(jsonb_build_object(
      'schemaVersion',1,'weekStart',current_date-(extract(isodow from current_date)::int-1),
      'weekEnd',current_date-(extract(isodow from current_date)::int-1)+6,
      'reportId',(select id from public.report_history where report_key='reconciliation-smoke-free'),
      'primaryGoal','Must fail','reason','Must fail','estimatedMinutes',10,'targetMetric','{}'::jsonb,
      'tasks',jsonb_build_array(
        jsonb_build_object('id','f1','type','position_drill','title','x','explanation','x','successCriteria','x','status','pending'),
        jsonb_build_object('id','f2','type','line_replay','title','x','explanation','x','successCriteria','x','status','pending'),
        jsonb_build_object('id','f3','type','game_review','title','x','explanation','x','successCriteria','x','status','pending'))
    ),true);
    raise exception 'Free weekly-plan mutation unexpectedly succeeded';
  exception when others then
    get stacked diagnostics
      caught_state = returned_sqlstate,
      caught_message = message_text;
    if caught_state <> '42501'
       or caught_message <> 'Paid OpeningFit access is required for this feature' then
      raise;
    end if;
    rejected := rejected + 1;
  end;

  begin
    perform public.apply_repertoire_training_outcomes(
      '[{"canonical_name":"Non-customer smoke","training_outcome":{"result":"must-fail"}}]'::jsonb
    );
    raise exception 'Free training-outcome mutation unexpectedly succeeded';
  exception when others then
    get stacked diagnostics
      caught_state = returned_sqlstate,
      caught_message = message_text;
    if caught_state <> '42501'
       or caught_message <> 'Paid OpeningFit access is required for this feature' then
      raise;
    end if;
    rejected := rejected + 1;
  end;
  if rejected <> 3 then raise exception 'One or more free paid-feature writes were not rejected'; end if;
end
$block$;
reset role;

-- Anonymous table privileges exist in production, but RLS exposes no rows.
-- Inserts reach the paid trigger; updates/deletes see zero target rows. The
-- supported mutation functions are not executable by anon.
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);
do $block$
declare
  visible bigint;
  affected bigint;
begin
  select count(*) into visible from public.report_history;
  if visible <> 0 then raise exception 'Anonymous report visibility was not zero'; end if;
  select count(*) into visible from public.repertoire;
  if visible <> 0 then raise exception 'Anonymous repertoire visibility was not zero'; end if;
  select count(*) into visible from public.weekly_training_plans;
  if visible <> 0 then raise exception 'Anonymous weekly-plan visibility was not zero'; end if;

  perform pg_temp.openingfit_expect_exact_failure(
    format(
      'insert into public.report_history(user_id,report_key) values (%L::uuid,%L)',
      (select free_user::text from openingfit_smoke_identity), 'anonymous-must-not-insert'
    ), '42501', 'Paid OpeningFit access is required for this feature'
  );
  update public.report_history set report_key='anonymous-must-not-update';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Anonymous report update affected rows'; end if;
  delete from public.report_history;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Anonymous report delete affected rows'; end if;

  perform pg_temp.openingfit_expect_exact_failure(
    format(
      'insert into public.repertoire(user_id,slot,display_name,canonical_name,source,status) values (%L::uuid,%L,%L,%L,%L,%L)',
      (select free_user::text from openingfit_smoke_identity), 'white_secondary',
      'anonymous', 'anonymous', 'user_selected', 'active'
    ), '42501', 'Paid OpeningFit access is required for this feature'
  );
  update public.repertoire set display_name='anonymous-must-not-update';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Anonymous repertoire update affected rows'; end if;
  delete from public.repertoire;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Anonymous repertoire delete affected rows'; end if;

  perform pg_temp.openingfit_expect_exact_failure(
    format(
      'insert into public.weekly_training_plans(user_id,week_start,week_end,primary_goal,reason,estimated_minutes,tasks) values (%L::uuid,current_date,current_date+6,%L,%L,10,%L::jsonb)',
      (select free_user::text from openingfit_smoke_identity), 'anonymous', 'anonymous',
      '[{"id":"a1"},{"id":"a2"},{"id":"a3"}]'
    ), '42501', 'Paid OpeningFit access is required for this feature'
  );
  update public.weekly_training_plans set primary_goal='anonymous-must-not-update';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Anonymous weekly-plan update affected rows'; end if;
  delete from public.weekly_training_plans;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Anonymous weekly-plan delete affected rows'; end if;

  perform pg_temp.openingfit_expect_exact_failure(
    'select public.replace_repertoire_entry(''white_secondary'',''{"display_name":"anonymous"}''::jsonb)',
    '42501', 'permission denied for function replace_repertoire_entry'
  );
  perform pg_temp.openingfit_expect_exact_failure(
    'select public.save_weekly_training_plan(''{}''::jsonb,true)',
    '42501', 'permission denied for function save_weekly_training_plan'
  );
  perform pg_temp.openingfit_expect_exact_failure(
    'select public.apply_repertoire_training_outcomes(''[]''::jsonb)',
    '42501', 'permission denied for function apply_repertoire_training_outcomes'
  );
end
$block$;
reset role;

-- Service role bypasses RLS, has direct table privileges, and may execute the
-- trusted functions when a designated non-customer subject is supplied.
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claim.sub', (select paid_user::text from openingfit_smoke_identity), true);
do $block$
declare
  service_report uuid;
  service_repertoire uuid;
  service_plan uuid;
  grant_result text;
begin
  if (select count(*) from public.report_history) < 2 then raise exception 'Service report read failed'; end if;

  insert into public.report_history(user_id,report_key,source_platform,source_username,snapshot)
  select paid_user,'reconciliation-smoke-service-report','chesscom','noncustomer-smoke',
    '{"source_platform":"chesscom","source_username":"noncustomer-smoke","total_games_analysed":1}'::jsonb
  from openingfit_smoke_identity returning id into service_report;
  update public.report_history set report_key='reconciliation-smoke-service-report-updated'
  where id=service_report;
  if not exists (select 1 from public.report_history where id=service_report and report_key='reconciliation-smoke-service-report-updated')
    then raise exception 'Service report update failed'; end if;
  delete from public.report_history where id=service_report;
  if exists (select 1 from public.report_history where id=service_report)
    then raise exception 'Service report delete failed'; end if;

  insert into public.repertoire(user_id,slot,display_name,canonical_name,source,status)
  select paid_user,'black_other','Service role smoke','Service role smoke','user_selected','archived'
  from openingfit_smoke_identity returning id into service_repertoire;
  update public.repertoire set display_name='Service role smoke updated' where id=service_repertoire;
  if not exists (select 1 from public.repertoire where id=service_repertoire and display_name='Service role smoke updated')
    then raise exception 'Service repertoire update failed'; end if;
  delete from public.repertoire where id=service_repertoire;
  if exists (select 1 from public.repertoire where id=service_repertoire)
    then raise exception 'Service repertoire delete failed'; end if;

  insert into public.weekly_training_plans(
    user_id,week_start,week_end,status,primary_goal,reason,estimated_minutes,tasks
  ) select paid_user,current_date+14,current_date+20,'expired','Service role smoke','Service role smoke',10,
    '[{"id":"s1"},{"id":"s2"},{"id":"s3"}]'::jsonb
  from openingfit_smoke_identity returning id into service_plan;
  update public.weekly_training_plans set primary_goal='Service role smoke updated' where id=service_plan;
  if not exists (select 1 from public.weekly_training_plans where id=service_plan and primary_goal='Service role smoke updated')
    then raise exception 'Service weekly-plan update failed'; end if;
  delete from public.weekly_training_plans where id=service_plan;
  if exists (select 1 from public.weekly_training_plans where id=service_plan)
    then raise exception 'Service weekly-plan delete failed'; end if;

  perform public.apply_repertoire_training_outcomes(
    '[{"canonical_name":"Non-customer smoke","training_outcome":{"result":"service-smoke"}}]'::jsonb
  );
  if not exists (
    select 1 from public.repertoire
    where user_id=(select paid_user from openingfit_smoke_identity)
      and canonical_name='Non-customer smoke'
      and training_outcome->>'result'='service-smoke'
  ) then raise exception 'Service training-outcome mutation failed'; end if;

  grant_result := public.grant_manual_lifetime_entitlement(
    (select free_user from openingfit_smoke_identity), 'manual_support'
  );
  if grant_result <> 'created_lifetime'
     or not exists (
       select 1 from public.premium_entitlements
       where user_id=(select free_user from openingfit_smoke_identity)
         and access_type='lifetime' and status='active'
         and is_grandfathered_lifetime and expires_at is null
     )
     or not exists (
       select 1 from public.profiles
       where user_id=(select free_user from openingfit_smoke_identity)
         and is_premium and premium_source='manual_support'
     ) then raise exception 'Service entitlement mutation failed'; end if;
end
$block$;
reset role;

rollback;
