-- Phase-aware, aggregate-only production reconciliation validator.
--
-- The caller MUST set openingfit.validation_mode in the same SQL batch to one
-- of: baseline, foundation, entitlement, final. Example for psql:
--   SET openingfit.validation_mode = 'baseline';
--   \i scripts/validate_production_subscription_schema.sql
-- Supabase db query does not process psql meta-commands. The runbook documents
-- how to prepend the SET statement to this file before sending the SQL batch.
--
-- This script creates only session-local pg_temp objects. It never changes a
-- persistent schema or row and never returns identifiers, usernames, email
-- addresses, or Stripe values.

drop table if exists pg_temp.openingfit_validation_results;
create temporary table openingfit_validation_results (
  ordinal bigserial,
  validation_mode text not null,
  check_name text not null,
  status text not null check (status in (
    'PASS', 'FAIL', 'WARNING', 'EXPECTED_NOT_YET_PRESENT', 'NOT_APPLICABLE'
  )),
  expected text,
  actual text,
  severity text not null,
  notes text
);

create or replace function pg_temp.record_openingfit_validation(
  p_mode text,
  p_phase integer,
  p_required_phase integer,
  p_check_name text,
  p_passed boolean,
  p_expected text,
  p_actual text,
  p_severity text,
  p_notes text default null
) returns void
language plpgsql
as $$
begin
  insert into pg_temp.openingfit_validation_results (
    validation_mode, check_name, status, expected, actual, severity, notes
  ) values (
    p_mode,
    p_check_name,
    case
      when p_phase < p_required_phase and coalesce(p_passed, false)
        then 'NOT_APPLICABLE'
      when p_phase < p_required_phase
        then 'EXPECTED_NOT_YET_PRESENT'
      when coalesce(p_passed, false)
        then 'PASS'
      else 'FAIL'
    end,
    p_expected,
    p_actual,
    case when p_phase < p_required_phase then 'INFO' else p_severity end,
    p_notes
  );
end;
$$;

do $validator$
declare
  mode_name text := nullif(current_setting('openingfit.validation_mode', true), '');
  phase_number integer;
  item record;
  object_present boolean;
  actual_count bigint;
  expected_count bigint;
  failures bigint;
  actual_text text;
begin
  phase_number := case mode_name
    when 'baseline' then 1
    when 'foundation' then 2
    when 'entitlement' then 3
    when 'final' then 4
    else 0
  end;

  if phase_number = 0 then
    insert into pg_temp.openingfit_validation_results (
      validation_mode, check_name, status, expected, actual, severity, notes
    ) values (
      coalesce(mode_name, 'UNSET'), 'validation_mode', 'FAIL',
      'baseline|foundation|entitlement|final', coalesce(mode_name, 'UNSET'),
      'ERROR', 'Set openingfit.validation_mode explicitly in the same SQL batch.'
    );
    return;
  end if;

  perform pg_temp.record_openingfit_validation(
    mode_name, phase_number, 1, 'validation_mode', true,
    mode_name, mode_name, 'ERROR', 'Explicit phase selected by the caller.'
  );

  -- Object existence is catalog-driven. Objects expected in later phases are
  -- informative in earlier phases and never referenced directly.
  for item in
    select * from (values
      ('table', 'profiles', 1),
      ('table', 'user_profiles', 1),
      ('table', 'premium_entitlements', 1),
      ('table', 'report_history', 1),
      ('table', 'recommendation_history', 1),
      ('table', 'analysed_games', 1),
      ('table', 'repertoire', 1),
      ('table', 'openingfit_user_state', 1),
      ('table', 'contact_messages', 1),
      ('table', 'feedback', 1),
      ('table', 'user_states', 1),
      ('policy', 'premium_entitlements.premium_entitlements_select_own', 1),

      ('column', 'premium_entitlements.stripe_payment_intent_id', 2),
      ('column', 'premium_entitlements.stripe_price_id', 2),
      ('column', 'premium_entitlements.checkout_mode', 2),
      ('column', 'profiles.premium_status', 2),
      ('column', 'profiles.premium_updated_at', 2),
      ('column', 'profiles.stripe_customer_id', 2),
      ('column', 'profiles.stripe_checkout_session_id', 2),
      ('column', 'report_history.report_schema_version', 2),
      ('column', 'report_history.analysis_id', 2),
      ('column', 'report_history.analysis_fingerprint', 2),
      ('column', 'report_history.snapshot', 2),
      ('column', 'report_history.generated_at', 2),
      ('column', 'report_history.source_platform', 2),
      ('column', 'report_history.source_username', 2),
      ('table', 'openingfit_retention_snapshots', 2),
      ('table', 'referral_partners', 2),
      ('table', 'referral_visits', 2),
      ('table', 'referral_attributions', 2),
      ('index', 'premium_entitlements_stripe_payment_intent_idx', 2),
      ('index', 'premium_entitlements_stripe_customer_idx', 2),
      ('index', 'profiles_stripe_customer_id_idx', 2),
      ('index', 'profiles_stripe_checkout_session_id_idx', 2),
      ('index', 'user_profiles_user_id_key', 2),
      ('index', 'openingfit_retention_snapshots_user_snapshot_key', 2),
      ('index', 'referral_partners_code_idx', 2),
      ('index', 'report_history_user_analysis_id', 2),
      ('index', 'report_history_user_analysis_fingerprint', 2),
      ('function', 'prevent_client_profile_premium_update()', 2),
      ('function', 'validate_referral_code(text)', 2),
      ('function', 'attach_referral_to_user(text,text)', 2),
      ('function', 'record_referral_visit(text,text,text)', 2),
      ('trigger', 'profiles.prevent_client_profile_premium_update', 2),
      ('policy', 'openingfit_retention_snapshots.openingfit_retention_snapshots_select_own', 2),
      ('policy', 'openingfit_retention_snapshots.openingfit_retention_snapshots_insert_own', 2),
      ('policy', 'openingfit_retention_snapshots.openingfit_retention_snapshots_update_own', 2),
      ('policy', 'openingfit_retention_snapshots.openingfit_retention_snapshots_delete_own', 2),

      ('column', 'premium_entitlements.access_type', 3),
      ('column', 'premium_entitlements.current_period_start', 3),
      ('column', 'premium_entitlements.current_period_end', 3),
      ('column', 'premium_entitlements.cancel_at_period_end', 3),
      ('column', 'premium_entitlements.is_grandfathered_lifetime', 3),
      ('column', 'premium_entitlements.plan_interval', 3),
      ('column', 'premium_entitlements.stripe_status', 3),
      ('column', 'premium_entitlements.last_stripe_event_id', 3),
      ('column', 'premium_entitlements.last_stripe_event_created_at', 3),
      ('table', 'stripe_webhook_events', 3),
      ('constraint', 'premium_entitlements.premium_entitlements_access_type_check', 3),
      ('constraint', 'premium_entitlements.premium_entitlements_plan_interval_check', 3),
      ('constraint', 'premium_entitlements.premium_entitlements_classification_shape_check', 3),
      ('index', 'premium_entitlements_stripe_subscription_idx', 3),
      ('index', 'stripe_webhook_events_status_updated_idx', 3),
      ('function', 'preserve_lifetime_premium_entitlement()', 3),
      ('function', 'prevent_stale_stripe_entitlement_update()', 3),
      ('function', 'grant_manual_lifetime_entitlement(uuid,text)', 3),
      ('trigger', 'premium_entitlements.preserve_lifetime_premium_entitlement', 3),
      ('trigger', 'premium_entitlements.prevent_stale_stripe_entitlement_update', 3),

      ('column', 'repertoire.slot', 4),
      ('column', 'repertoire.status', 4),
      ('column', 'repertoire.training_outcome', 4),
      ('table', 'weekly_training_plans', 4),
      ('index', 'repertoire_one_active_slot_idx', 4),
      ('index', 'repertoire_one_pending_recommendation_idx', 4),
      ('index', 'weekly_training_plans_one_active_week_idx', 4),
      ('function', 'initialise_repertoire_from_report(jsonb)', 4),
      ('function', 'accept_repertoire_recommendation(uuid)', 4),
      ('function', 'save_weekly_training_plan(jsonb,boolean)', 4),
      ('function', 'set_weekly_training_task_status(uuid,text,boolean)', 4),
      ('function', 'apply_repertoire_training_outcomes(jsonb)', 4),
      ('function', 'openingfit_has_paid_access()', 4),
      ('function', 'require_openingfit_paid_mutation()', 4),
      ('trigger', 'repertoire.require_paid_mutation', 4),
      ('trigger', 'weekly_training_plans.require_paid_mutation', 4),
      ('trigger', 'report_history.require_paid_mutation', 4),
      ('policy', 'repertoire.repertoire_select_own', 4),
      ('policy', 'repertoire.repertoire_insert_own', 4),
      ('policy', 'repertoire.repertoire_update_own', 4),
      ('policy', 'weekly_training_plans.weekly_training_plans_select_own', 4),
      ('policy', 'report_history.report_history_select_own', 4),
      ('policy', 'report_history.report_history_insert_own', 4),
      ('policy', 'report_history.report_history_update_own', 4),
      ('policy', 'report_history.report_history_delete_own', 4)
    ) expected(kind, object_name, required_phase)
  loop
    object_present := false;
    if item.kind = 'table' then
      object_present := to_regclass('public.' || item.object_name) is not null;
    elsif item.kind = 'column' then
      select exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = split_part(item.object_name, '.', 1)
          and column_name = split_part(item.object_name, '.', 2)
      ) into object_present;
    elsif item.kind = 'index' then
      object_present := to_regclass('public.' || item.object_name) is not null;
    elsif item.kind = 'function' then
      object_present := to_regprocedure('public.' || item.object_name) is not null;
    elsif item.kind = 'trigger' then
      select exists (
        select 1 from pg_trigger trigger_row
        join pg_class relation on relation.oid = trigger_row.tgrelid
        join pg_namespace namespace on namespace.oid = relation.relnamespace
        where namespace.nspname = 'public'
          and relation.relname = split_part(item.object_name, '.', 1)
          and trigger_row.tgname = split_part(item.object_name, '.', 2)
          and not trigger_row.tgisinternal and trigger_row.tgenabled <> 'D'
      ) into object_present;
    elsif item.kind = 'policy' then
      select exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = split_part(item.object_name, '.', 1)
          and policyname = split_part(item.object_name, '.', 2)
      ) into object_present;
    elsif item.kind = 'constraint' then
      select exists (
        select 1 from pg_constraint constraint_row
        where constraint_row.conrelid = to_regclass(
          'public.' || split_part(item.object_name, '.', 1)
        ) and constraint_row.conname = split_part(item.object_name, '.', 2)
      ) into object_present;
    end if;

    perform pg_temp.record_openingfit_validation(
      mode_name, phase_number, item.required_phase,
      item.kind || ':' || item.object_name,
      object_present, 'present', case when object_present then 'present' else 'absent' end,
      'ERROR', 'Required from the ' || case item.required_phase
        when 1 then 'baseline' when 2 then 'foundation'
        when 3 then 'entitlement' else 'final' end || ' phase.'
    );
  end loop;

  for item in select * from (values
    ('premium_entitlements', 1),
    ('openingfit_retention_snapshots', 2),
    ('referral_partners', 2),
    ('referral_visits', 2),
    ('referral_attributions', 2),
    ('stripe_webhook_events', 3),
    ('repertoire', 4),
    ('weekly_training_plans', 4),
    ('report_history', 4)
  ) protected_tables(table_name, required_phase)
  loop
    select coalesce(relation.relrowsecurity, false)
    into object_present
    from (select to_regclass('public.' || item.table_name) oid) expected
    left join pg_class relation on relation.oid = expected.oid;
    perform pg_temp.record_openingfit_validation(
      mode_name, phase_number, item.required_phase,
      'rls_enabled:' || item.table_name, object_present,
      'enabled', case when object_present then 'enabled' else 'absent or disabled' end,
      'ERROR', null
    );
  end loop;

  -- Exact historical floors. These are dynamic so a missing core table is a
  -- structured failure rather than a relation-resolution error.
  for item in select * from (values
    ('report_history', 42::bigint),
    ('recommendation_history', 56::bigint),
    ('analysed_games', 142::bigint)
  ) floors(table_name, minimum_rows)
  loop
    if to_regclass('public.' || item.table_name) is null then
      perform pg_temp.record_openingfit_validation(
        mode_name, phase_number, 1, 'row_floor:' || item.table_name, false,
        '>=' || item.minimum_rows, 'table absent', 'ERROR', 'Recorded production floor.'
      );
    else
      execute format('select count(*) from public.%I', item.table_name) into actual_count;
      perform pg_temp.record_openingfit_validation(
        mode_name, phase_number, 1, 'row_floor:' || item.table_name,
        actual_count >= item.minimum_rows, '>=' || item.minimum_rows,
        actual_count::text, 'ERROR', 'Recorded production floor.'
      );
    end if;
  end loop;

  for item in select * from (values
    ('premium_entitlements', 'access_type', 'text', 'NO', null::text, 3),
    ('premium_entitlements', 'current_period_start', 'timestamp with time zone', 'YES', null, 3),
    ('premium_entitlements', 'current_period_end', 'timestamp with time zone', 'YES', null, 3),
    ('premium_entitlements', 'cancel_at_period_end', 'boolean', 'NO', 'false', 3),
    ('premium_entitlements', 'is_grandfathered_lifetime', 'boolean', 'NO', 'false', 3),
    ('premium_entitlements', 'plan_interval', 'text', 'YES', null, 3),
    ('report_history', 'report_schema_version', 'integer', 'NO', '1', 2),
    ('report_history', 'snapshot', 'jsonb', 'NO', '''{}''::jsonb', 2)
  ) definitions(table_name, column_name, data_type, nullable, default_value, required_phase)
  loop
    select column_row.data_type = item.data_type
      and column_row.is_nullable = item.nullable
      and (item.default_value is null or column_row.column_default = item.default_value)
    into object_present
    from (select 1) seed
    left join information_schema.columns column_row
      on column_row.table_schema = 'public'
      and column_row.table_name = item.table_name
      and column_row.column_name = item.column_name;
    perform pg_temp.record_openingfit_validation(
      mode_name, phase_number, item.required_phase,
      'column_definition:' || item.table_name || '.' || item.column_name,
      object_present,
      item.data_type || '; nullable=' || item.nullable ||
        coalesce('; default=' || item.default_value, ''),
      case when object_present then 'matching definition' else 'absent or mismatched' end,
      'ERROR', null
    );
  end loop;

  for item in select * from (values
    ('premium_entitlements_access_type_check', 'access_type.*monthly_subscription.*annual_subscription.*lifetime', 3),
    ('premium_entitlements_plan_interval_check', 'plan_interval.*month.*year', 3),
    ('premium_entitlements_classification_shape_check', 'access_type.*lifetime.*stripe_subscription_id.*monthly_subscription.*annual_subscription', 3)
  ) definitions(constraint_name, definition_pattern, required_phase)
  loop
    select constraint_row.oid is not null
      and pg_get_constraintdef(constraint_row.oid) ~ item.definition_pattern
    into object_present
    from (select 1) seed
    left join pg_constraint constraint_row
      on constraint_row.conrelid = to_regclass('public.premium_entitlements')
      and constraint_row.conname = item.constraint_name;
    perform pg_temp.record_openingfit_validation(
      mode_name, phase_number, item.required_phase,
      'constraint_definition:' || item.constraint_name,
      object_present, 'matching canonical definition',
      case when object_present then 'matching definition' else 'absent or mismatched' end,
      'ERROR', null
    );
  end loop;

  for item in select * from (values
    ('premium_entitlements_stripe_subscription_idx', 'USING btree \(stripe_subscription_id\).*WHERE \(stripe_subscription_id IS NOT NULL\)', 3),
    ('premium_entitlements_stripe_payment_intent_idx', 'USING btree \(stripe_payment_intent_id\)', 2),
    ('user_profiles_user_id_key', 'UNIQUE INDEX.*USING btree \(user_id\)', 2),
    ('report_history_user_analysis_id', 'UNIQUE INDEX.*USING btree \(user_id, analysis_id\).*WHERE \(analysis_id IS NOT NULL\)', 2),
    ('repertoire_one_active_slot_idx', 'UNIQUE INDEX.*USING btree \(user_id, slot\).*WHERE \(status = ''active''::text\)', 4)
  ) definitions(index_name, definition_pattern, required_phase)
  loop
    select index_row.indexdef ~ item.definition_pattern
    into object_present
    from (select 1) seed
    left join pg_indexes index_row on index_row.schemaname = 'public'
      and index_row.indexname = item.index_name;
    perform pg_temp.record_openingfit_validation(
      mode_name, phase_number, item.required_phase,
      'index_definition:' || item.index_name,
      object_present, 'matching canonical definition',
      case when object_present then 'matching definition' else 'absent or mismatched' end,
      'ERROR', null
    );
  end loop;

  for item in select * from (values
    ('profiles', 'prevent_client_profile_premium_update', 'prevent_client_profile_premium_update', 2),
    ('premium_entitlements', 'preserve_lifetime_premium_entitlement', 'preserve_lifetime_premium_entitlement', 3),
    ('premium_entitlements', 'prevent_stale_stripe_entitlement_update', 'prevent_stale_stripe_entitlement_update', 3),
    ('repertoire', 'require_paid_mutation', 'require_openingfit_paid_mutation', 4),
    ('weekly_training_plans', 'require_paid_mutation', 'require_openingfit_paid_mutation', 4),
    ('report_history', 'require_paid_mutation', 'require_openingfit_paid_mutation', 4)
  ) mappings(table_name, trigger_name, function_name, required_phase)
  loop
    select procedure.proname = item.function_name and trigger_row.tgenabled <> 'D'
    into object_present
    from (select 1) seed
    left join pg_class relation on relation.oid = to_regclass('public.' || item.table_name)
    left join pg_trigger trigger_row on trigger_row.tgrelid = relation.oid
      and trigger_row.tgname = item.trigger_name and not trigger_row.tgisinternal
    left join pg_proc procedure on procedure.oid = trigger_row.tgfoid;
    perform pg_temp.record_openingfit_validation(
      mode_name, phase_number, item.required_phase,
      'trigger_mapping:' || item.table_name || '.' || item.trigger_name,
      object_present, item.function_name,
      case when object_present then item.function_name else 'absent or mismatched' end,
      'ERROR', null
    );
  end loop;

  -- Profile and retention-profile ownership invariants.
  if to_regclass('public.profiles') is not null then
    execute 'select count(*) from public.profiles where user_id is null or id is distinct from user_id'
      into actual_count;
    perform pg_temp.record_openingfit_validation(
      mode_name, phase_number, 1, 'profiles:ownership_mismatches', actual_count = 0,
      '0', actual_count::text, 'ERROR', 'Canonical owner must match the profile id.'
    );
  end if;

  if to_regclass('public.user_profiles') is not null then
    execute 'select count(*) from public.user_profiles where user_id is null'
      into actual_count;
    perform pg_temp.record_openingfit_validation(
      mode_name, phase_number, 1, 'user_profiles:null_owners', actual_count = 0,
      '0', actual_count::text, 'ERROR', null
    );
    execute 'select count(*) from (select user_id from public.user_profiles where user_id is not null group by user_id having count(*) > 1) duplicate_groups'
      into actual_count;
    perform pg_temp.record_openingfit_validation(
      mode_name, phase_number, 1, 'user_profiles:duplicate_owner_groups', actual_count = 0,
      '0', actual_count::text, 'ERROR', null
    );
  end if;

  -- Entitlement evidence is read from row JSON, so every phase is safe even
  -- when reconciliation columns have not been added yet.
  if to_regclass('public.premium_entitlements') is not null then
    for item in execute $entitlement_metrics$
      with entitlement_rows as (
        select
          nullif(to_jsonb(e)->>'user_id', '') as user_id,
          lower(coalesce(to_jsonb(e)->>'status', '')) as status,
          nullif(to_jsonb(e)->>'source', '') as source,
          nullif(to_jsonb(e)->>'expires_at', '') as expires_at,
          nullif(to_jsonb(e)->>'stripe_customer_id', '') as stripe_customer_id,
          nullif(to_jsonb(e)->>'stripe_subscription_id', '') as stripe_subscription_id,
          nullif(to_jsonb(e)->>'stripe_payment_intent_id', '') as stripe_payment_intent_id,
          nullif(to_jsonb(e)->>'stripe_price_id', '') as stripe_price_id,
          nullif(to_jsonb(e)->>'checkout_mode', '') as checkout_mode,
          nullif(to_jsonb(e)->>'access_type', '') as access_type,
          nullif(to_jsonb(e)->>'current_period_start', '') as current_period_start,
          nullif(to_jsonb(e)->>'current_period_end', '') as current_period_end,
          nullif(to_jsonb(e)->>'plan_interval', '') as plan_interval,
          nullif(to_jsonb(e)->>'stripe_status', '') as stripe_status,
          nullif(to_jsonb(e)->>'last_stripe_event_id', '') as last_stripe_event_id,
          nullif(to_jsonb(e)->>'last_stripe_event_created_at', '') as last_stripe_event_created_at,
          coalesce((to_jsonb(e)->>'is_grandfathered_lifetime')::boolean, false) as grandfathered
        from public.premium_entitlements e
      ), classified as (
        select *,
          access_type is null
            and status in ('active', 'premium', 'paid', 'lifetime')
            and expires_at is null
            and stripe_customer_id is null and stripe_subscription_id is null
            and stripe_payment_intent_id is null and stripe_price_id is null
            and checkout_mode is null and plan_interval is null and stripe_status is null
            and current_period_start is null and current_period_end is null
            and last_stripe_event_id is null and last_stripe_event_created_at is null
            and (source is null or source in (
              'legacy', 'legacy_fixture', 'legacy_lifetime_backfill', 'manual_support'
            )) as conservative_candidate,
          access_type is null and coalesce(checkout_mode, '') <> 'payment' and (
            stripe_subscription_id is not null or checkout_mode = 'subscription'
            or plan_interval in ('month', 'year')
            or (lower(coalesce(stripe_status, '')) in (
              'active', 'trialing', 'past_due', 'canceled', 'unpaid',
              'incomplete', 'incomplete_expired', 'paused'
            ) and (current_period_start is not null or current_period_end is not null))
          ) as subscription_classifiable,
          access_type is null and checkout_mode = 'payment'
            and stripe_subscription_id is null and plan_interval is null
            and current_period_start is null and current_period_end is null
            and stripe_status is null
            and coalesce(source, '') not in (
              'stripe_customer.subscription.created', 'stripe_customer.subscription.updated',
              'stripe_customer.subscription.deleted', 'stripe_invoice.paid',
              'stripe_invoice.payment_failed'
            ) and last_stripe_event_id is null and last_stripe_event_created_at is null
            as payment_lifetime_evidence
        from entitlement_rows
      ), projected as (
        select *, case
          when access_type is not null then access_type
          when payment_lifetime_evidence then 'lifetime'
          when subscription_classifiable then case when plan_interval = 'year'
            then 'annual_subscription' else 'monthly_subscription' end
          when conservative_candidate then 'lifetime'
          else null
        end as projected_access_type
        from classified
      ), metrics as (
        select 'null_owner_count' metric, count(*) filter (where user_id is null)::bigint value from classified
        union all select 'duplicate_owner_groups', count(*) from (
          select user_id from classified where user_id is not null group by user_id having count(*) > 1
        ) groups
        union all select 'duplicate_subscription_groups', count(*) from (
          select stripe_subscription_id from classified where stripe_subscription_id is not null
          group by stripe_subscription_id having count(*) > 1
        ) groups
        union all select 'conservative_lifetime_candidates', count(*) filter (where conservative_candidate) from classified
        union all select 'customer_only_ambiguous', count(*) filter (
          where access_type is null and stripe_customer_id is not null
            and stripe_subscription_id is null and stripe_payment_intent_id is null
            and stripe_price_id is null and checkout_mode is null and plan_interval is null
            and stripe_status is null and current_period_start is null and current_period_end is null
            and source is null and last_stripe_event_id is null and last_stripe_event_created_at is null
        ) from classified
        union all select 'price_only_ambiguous', count(*) filter (
          where access_type is null and stripe_price_id is not null
            and stripe_customer_id is null and stripe_subscription_id is null
            and stripe_payment_intent_id is null and checkout_mode is null and plan_interval is null
            and stripe_status is null and current_period_start is null and current_period_end is null
            and source is null and last_stripe_event_id is null and last_stripe_event_created_at is null
        ) from classified
        union all select 'source_only_subscription_evidence', count(*) filter (
          where access_type is null and source in (
            'stripe_customer.subscription.created', 'stripe_customer.subscription.updated',
            'stripe_customer.subscription.deleted', 'stripe_invoice.paid', 'stripe_invoice.payment_failed'
          ) and stripe_customer_id is null and stripe_subscription_id is null
            and stripe_payment_intent_id is null and stripe_price_id is null
            and checkout_mode is null and plan_interval is null and stripe_status is null
            and current_period_start is null and current_period_end is null
            and last_stripe_event_id is null and last_stripe_event_created_at is null
        ) from classified
        union all select 'payment_mode_with_recurring_evidence', count(*) filter (
          where checkout_mode = 'payment' and (
              stripe_subscription_id is not null
              or plan_interval is not null
              or lower(coalesce(stripe_status, '')) in (
                'active', 'trialing', 'past_due', 'canceled', 'unpaid',
                'incomplete', 'incomplete_expired', 'paused'
              )
              or current_period_start is not null or current_period_end is not null
              or source in (
                'stripe_customer.subscription.created', 'stripe_customer.subscription.updated',
                'stripe_customer.subscription.deleted', 'stripe_invoice.paid',
                'stripe_invoice.payment_failed'
              )
              or ((last_stripe_event_id is not null or last_stripe_event_created_at is not null)
                and coalesce(source, '') not in (
                  'stripe_charge.refunded', 'stripe_refund.updated',
                  'stripe_checkout', 'stripe_checkout_success_sync'
                ))
            )
            and not (
              access_type = 'lifetime' and not grandfathered and status = 'refunded'
              and source in ('stripe_charge.refunded', 'stripe_refund.updated')
              and stripe_status = 'refunded' and expires_at is not null
            )
        ) from classified
        union all select 'lifetime_with_subscription_evidence', count(*) filter (
          where access_type = 'lifetime' and (
            stripe_subscription_id is not null or checkout_mode = 'subscription'
            or plan_interval is not null or lower(coalesce(stripe_status, '')) in (
              'active', 'trialing', 'past_due', 'canceled', 'unpaid',
              'incomplete', 'incomplete_expired', 'paused'
            ) or current_period_start is not null or current_period_end is not null
          )
        ) from classified
        union all select 'rows_remaining_unclassified', count(*)
          from projected where projected_access_type is null
        union all select 'ambiguous_active_nonexpiring', count(*) filter (
          where access_type is null and status in ('active', 'premium', 'paid', 'lifetime')
            and expires_at is null and not conservative_candidate
            and not subscription_classifiable and not payment_lifetime_evidence
        ) from classified
        union all select 'grandfathered_lifetime_count', count(*) filter (
          where access_type = 'lifetime' and grandfathered and expires_at is null
            and current_period_end is null
        ) from classified
      )
      select metric, value from metrics
    $entitlement_metrics$
    loop
      if item.metric = 'conservative_lifetime_candidates' then
        expected_count := case when phase_number < 3 then 1 else 0 end;
        object_present := item.value = expected_count;
        actual_text := expected_count::text;
      elsif item.metric = 'grandfathered_lifetime_count' then
        expected_count := case when phase_number < 3 then 0 else 2 end;
        object_present := case when phase_number < 3
          then item.value = 0 else item.value >= 2 end;
        actual_text := case when phase_number < 3 then '0' else '>=2' end;
      else
        expected_count := 0;
        object_present := item.value = 0;
        actual_text := '0';
      end if;
      perform pg_temp.record_openingfit_validation(
        mode_name, phase_number,
        case when item.metric = 'grandfathered_lifetime_count' then 3 else 1 end,
        'entitlements:' || item.metric,
        object_present, actual_text, item.value::text,
        'ERROR', 'Aggregate-only entitlement safety gate.'
      );
    end loop;
  end if;

  if to_regclass('public.profiles') is not null
     and to_regclass('public.premium_entitlements') is not null then
    execute $backfill$
      select count(*)
      from public.profiles profile
      where profile.is_premium is true and profile.user_id is not null
        and not exists (
          select 1 from public.premium_entitlements entitlement
          where nullif(to_jsonb(entitlement)->>'user_id', '') = profile.user_id::text
        )
    $backfill$ into actual_count;
    expected_count := case when phase_number < 3 then 1 else 0 end;
    perform pg_temp.record_openingfit_validation(
      mode_name, phase_number, 1, 'profiles:entitlement_backfill_candidates',
      actual_count = expected_count, expected_count::text, actual_count::text,
      'ERROR', 'Audited premium profiles lacking any entitlement.'
    );

    if phase_number >= 3 then
      execute $qualifying$
        select count(*)
        from public.profiles profile
        where profile.is_premium is true and profile.user_id is not null
          and not exists (
            select 1 from public.premium_entitlements entitlement
            where nullif(to_jsonb(entitlement)->>'user_id', '') = profile.user_id::text
              and (
                (to_jsonb(entitlement)->>'access_type' = 'lifetime' and (
                  coalesce((to_jsonb(entitlement)->>'is_grandfathered_lifetime')::boolean, false)
                  or lower(coalesce(to_jsonb(entitlement)->>'status', '')) in ('active', 'trialing')
                )) or (
                  to_jsonb(entitlement)->>'access_type' in ('monthly_subscription', 'annual_subscription')
                  and (
                    lower(coalesce(to_jsonb(entitlement)->>'status', '')) in ('active', 'trialing')
                    or (lower(coalesce(to_jsonb(entitlement)->>'status', '')) in ('canceled', 'past_due')
                      and nullif(to_jsonb(entitlement)->>'current_period_end', '')::timestamptz > now())
                  )
                )
              )
          )
      $qualifying$ into actual_count;
      perform pg_temp.record_openingfit_validation(
        mode_name, phase_number, 3, 'profiles:without_qualifying_entitlement',
        actual_count = 0, '0', actual_count::text, 'ERROR', null
      );
    end if;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'repertoire'
      and column_name = 'repertoire' and data_type = 'jsonb'
  ) into object_present;
  perform pg_temp.record_openingfit_validation(
    mode_name, phase_number, 1, 'repertoire:legacy_json_preserved', object_present,
    'present jsonb column', case when object_present then 'present jsonb column' else 'absent' end,
    'ERROR', 'The typed model must retain the legacy recovery column.'
  );

  -- Direct-execution reconciliation intentionally leaves migration history at
  -- the audited pre-change baseline. Validate the known baseline without
  -- inserting or repairing any migration-history row.
  if to_regclass('supabase_migrations.schema_migrations') is null then
    perform pg_temp.record_openingfit_validation(
      mode_name, phase_number, 1, 'migration_history:audited_baseline', false,
      '10 audited versions through 202606010002; no 20260720000*',
      'schema_migrations absent', 'ERROR', null
    );
  else
    execute $history$
      select count(*) filter (where version in (
        '202605230001','202605240001','202605250001','202605250002',
        '202605270001','202605310001','202605310002','202605310003',
        '202606010001','202606010002'
      )), count(*) filter (where version in (
        '202607200001','202607200002','202607200003'
      ))
      from supabase_migrations.schema_migrations
    $history$ into actual_count, failures;
    actual_text := actual_count || ' audited; ' || failures || ' reconciliation';
    perform pg_temp.record_openingfit_validation(
      mode_name, phase_number, 1, 'migration_history:audited_baseline',
      actual_count = 10 and failures = 0,
      '10 audited; 0 reconciliation', actual_text, 'ERROR',
      'History remains unchanged during direct controlled execution.'
    );
  end if;

  -- Definition checks for security-sensitive functions and final policies.
  for item in select * from (values
    ('prevent_client_profile_premium_update()', 2),
    ('preserve_lifetime_premium_entitlement()', 3),
    ('prevent_stale_stripe_entitlement_update()', 3),
    ('grant_manual_lifetime_entitlement(uuid,text)', 3),
    ('openingfit_has_paid_access()', 4),
    ('require_openingfit_paid_mutation()', 4)
  ) functions(signature, required_phase)
  loop
    select coalesce(procedure.prosecdef, false)
      and coalesce(procedure.proconfig, array[]::text[]) @> array['search_path=public']::text[]
    into object_present
    from (select to_regprocedure('public.' || item.signature) oid) expected
    left join pg_proc procedure on procedure.oid = expected.oid;
    perform pg_temp.record_openingfit_validation(
      mode_name, phase_number, item.required_phase,
      'function_security:' || item.signature, object_present,
      'SECURITY DEFINER; search_path=public',
      case when object_present then 'secure definition' else 'absent or insecure' end,
      'ERROR', null
    );
  end loop;

  if phase_number >= 4 then
    for item in select * from (values
      ('report_history_select_own', 'SELECT', false),
      ('report_history_insert_own', 'INSERT', true),
      ('report_history_update_own', 'UPDATE', true),
      ('report_history_delete_own', 'DELETE', true)
    ) policies(policy_name, command_name, requires_paid)
    loop
      select policy.cmd = item.command_name
        and policy.roles = array['authenticated']::name[]
        and coalesce(policy.qual, policy.with_check, '') like '%auth.uid()%user_id%'
        and case when item.requires_paid
          then (coalesce(policy.qual, '') || coalesce(policy.with_check, '')) like '%openingfit_has_paid_access%'
          else (coalesce(policy.qual, '') || coalesce(policy.with_check, '')) not like '%openingfit_has_paid_access%'
        end
      into object_present
      from (select 1) seed
      left join pg_policies policy on policy.schemaname = 'public'
        and policy.tablename = 'report_history'
        and policy.policyname = item.policy_name;
      perform pg_temp.record_openingfit_validation(
        mode_name, phase_number, 4, 'policy_definition:report_history.' || item.policy_name,
        object_present, 'owner-scoped authenticated policy',
        case when object_present then 'matching definition' else 'missing or mismatched' end,
        'ERROR', 'Owner reads remain free; mutations require paid access.'
      );
    end loop;
  end if;

  -- Representative ACL checks for every phase that introduces grants.
  for item in select * from (values
    ('table', 'referral_partners', 'service_role', 'INSERT', 2),
    ('function', 'validate_referral_code(text)', 'authenticated', 'EXECUTE', 2),
    ('table', 'stripe_webhook_events', 'service_role', 'INSERT', 3),
    ('function', 'grant_manual_lifetime_entitlement(uuid,text)', 'service_role', 'EXECUTE', 3),
    ('table', 'repertoire', 'authenticated', 'SELECT', 4),
    ('table', 'weekly_training_plans', 'authenticated', 'SELECT', 4),
    ('function', 'openingfit_has_paid_access()', 'authenticated', 'EXECUTE', 4)
  ) grants(kind, object_name, role_name, privilege_name, required_phase)
  loop
    if item.kind = 'table' then
      select exists (
        select 1 from information_schema.role_table_grants
        where table_schema = 'public' and table_name = item.object_name
          and grantee = item.role_name and privilege_type = item.privilege_name
      ) into object_present;
    else
      select exists (
        select 1 from information_schema.routine_privileges privilege
        join pg_proc procedure on procedure.proname = privilege.routine_name
        join pg_namespace namespace on namespace.oid = procedure.pronamespace
        where namespace.nspname = 'public'
          and procedure.oid = to_regprocedure('public.' || item.object_name)
          and privilege.grantee = item.role_name
          and privilege.privilege_type = item.privilege_name
      ) into object_present;
    end if;
    perform pg_temp.record_openingfit_validation(
      mode_name, phase_number, item.required_phase,
      'grant:' || item.role_name || ':' || item.privilege_name || ':' || item.object_name,
      object_present, 'granted', case when object_present then 'granted' else 'absent' end,
      'ERROR', null
    );
  end loop;
end;
$validator$;

insert into pg_temp.openingfit_validation_results (
  validation_mode, check_name, status, expected, actual, severity, notes
)
select
  coalesce(nullif(current_setting('openingfit.validation_mode', true), ''), 'UNSET'),
  case lower(coalesce(nullif(current_setting('openingfit.validation_mode', true), ''), 'UNSET'))
    when 'baseline' then 'BASELINE_VALIDATION_' || case when count(*) filter (where status = 'FAIL') = 0 then 'PASS' else 'FAIL' end
    when 'foundation' then 'FOUNDATION_VALIDATION_' || case when count(*) filter (where status = 'FAIL') = 0 then 'PASS' else 'FAIL' end
    when 'entitlement' then 'ENTITLEMENT_VALIDATION_' || case when count(*) filter (where status = 'FAIL') = 0 then 'PASS' else 'FAIL' end
    when 'final' then 'FINAL_VALIDATION_' || case when count(*) filter (where status = 'FAIL') = 0 then 'PASS' else 'FAIL' end
    else 'VALIDATION_CONFIGURATION_FAIL'
  end,
  case when count(*) filter (where status = 'FAIL') = 0 then 'PASS' else 'FAIL' end,
  'zero required-check failures',
  (count(*) filter (where status = 'FAIL'))::text || ' required-check failures',
  case when count(*) filter (where status = 'FAIL') = 0 then 'INFO' else 'ERROR' end,
  'Phase summary. EXPECTED_NOT_YET_PRESENT and NOT_APPLICABLE are non-failing.'
from pg_temp.openingfit_validation_results;

select validation_mode, check_name, status, expected, actual, severity, notes
from pg_temp.openingfit_validation_results
order by
  case when check_name like '%VALIDATION_%' then 1 else 0 end,
  ordinal;
