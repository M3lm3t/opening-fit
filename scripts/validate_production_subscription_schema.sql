-- Read-only post-reconciliation validation. This script returns only object
-- names, booleans, and aggregate counts; it never returns user or Stripe data.

with required_tables(table_name) as (
  values
    ('premium_entitlements'), ('stripe_webhook_events'),
    ('openingfit_retention_snapshots'), ('referral_partners'),
    ('referral_visits'), ('referral_attributions'), ('report_history'),
    ('repertoire'), ('weekly_training_plans'), ('contact_messages'),
    ('feedback'), ('user_states')
)
select
  'required_table' as check_type,
  required.table_name as object_name,
  (tables.table_name is not null) as passed
from required_tables required
left join information_schema.tables tables
  on tables.table_schema = 'public'
 and tables.table_name = required.table_name
order by required.table_name;

with required_columns(table_name, column_name) as (
  values
    ('premium_entitlements', 'stripe_payment_intent_id'),
    ('premium_entitlements', 'stripe_price_id'),
    ('premium_entitlements', 'checkout_mode'),
    ('premium_entitlements', 'access_type'),
    ('premium_entitlements', 'current_period_start'),
    ('premium_entitlements', 'current_period_end'),
    ('premium_entitlements', 'cancel_at_period_end'),
    ('premium_entitlements', 'is_grandfathered_lifetime'),
    ('premium_entitlements', 'plan_interval'),
    ('premium_entitlements', 'stripe_status'),
    ('premium_entitlements', 'last_stripe_event_id'),
    ('premium_entitlements', 'last_stripe_event_created_at'),
    ('profiles', 'premium_status'),
    ('profiles', 'premium_updated_at'),
    ('profiles', 'stripe_customer_id'),
    ('profiles', 'stripe_checkout_session_id'),
    ('report_history', 'report_schema_version'),
    ('report_history', 'analysis_id'),
    ('report_history', 'analysis_fingerprint'),
    ('report_history', 'snapshot'),
    ('report_history', 'generated_at'),
    ('report_history', 'source_platform'),
    ('report_history', 'source_username'),
    ('repertoire', 'repertoire'),
    ('repertoire', 'slot'),
    ('repertoire', 'status'),
    ('repertoire', 'training_outcome')
)
select
  'required_column' as check_type,
  required.table_name || '.' || required.column_name as object_name,
  (columns.column_name is not null) as passed
from required_columns required
left join information_schema.columns columns
  on columns.table_schema = 'public'
 and columns.table_name = required.table_name
 and columns.column_name = required.column_name
order by required.table_name, required.column_name;

with expected(table_name, column_name, data_type, is_nullable, default_pattern) as (
  values
    ('premium_entitlements', 'access_type', 'text', 'NO', null::text),
    ('premium_entitlements', 'current_period_start', 'timestamp with time zone', 'YES', null),
    ('premium_entitlements', 'current_period_end', 'timestamp with time zone', 'YES', null),
    ('premium_entitlements', 'cancel_at_period_end', 'boolean', 'NO', 'false'),
    ('premium_entitlements', 'is_grandfathered_lifetime', 'boolean', 'NO', 'false'),
    ('premium_entitlements', 'plan_interval', 'text', 'YES', null),
    ('report_history', 'report_schema_version', 'integer', 'NO', '1'),
    ('report_history', 'snapshot', 'jsonb', 'NO', '''{}''::jsonb')
)
select 'column_definition' as check_type,
       expected.table_name || '.' || expected.column_name as object_name,
       columns.data_type = expected.data_type
       and columns.is_nullable = expected.is_nullable
       and (expected.default_pattern is null or columns.column_default = expected.default_pattern) as passed
from expected
left join information_schema.columns columns
  on columns.table_schema = 'public'
 and columns.table_name = expected.table_name
 and columns.column_name = expected.column_name
order by expected.table_name, expected.column_name;

with expected(constraint_name, definition_pattern) as (
  values
    ('premium_entitlements_access_type_check', 'access_type.*monthly_subscription.*annual_subscription.*lifetime'),
    ('premium_entitlements_plan_interval_check', 'plan_interval.*month.*year'),
    ('premium_entitlements_classification_shape_check', 'access_type.*lifetime.*stripe_subscription_id.*monthly_subscription.*annual_subscription')
)
select 'constraint_definition' as check_type, expected.constraint_name as object_name,
       constraint_row.oid is not null
       and pg_get_constraintdef(constraint_row.oid) ~ expected.definition_pattern as passed
from expected
left join pg_constraint constraint_row
  on constraint_row.conrelid = 'public.premium_entitlements'::regclass
 and constraint_row.conname = expected.constraint_name
order by expected.constraint_name;

with required_indexes(index_name) as (
  values
    ('premium_entitlements_stripe_subscription_idx'),
    ('premium_entitlements_stripe_payment_intent_idx'),
    ('premium_entitlements_stripe_customer_idx'),
    ('profiles_stripe_customer_id_idx'),
    ('profiles_stripe_checkout_session_id_idx'),
    ('user_profiles_user_id_key'),
    ('openingfit_retention_snapshots_user_snapshot_key'),
    ('referral_partners_code_idx'),
    ('report_history_user_analysis_id'),
    ('report_history_user_analysis_fingerprint'),
    ('repertoire_one_active_slot_idx'),
    ('repertoire_one_pending_recommendation_idx'),
    ('weekly_training_plans_one_active_week_idx'),
    ('stripe_webhook_events_status_updated_idx')
)
select
  'required_index' as check_type,
  required.index_name as object_name,
  (indexes.indexname is not null) as passed
from required_indexes required
left join pg_indexes indexes
  on indexes.schemaname = 'public'
 and indexes.indexname = required.index_name
order by required.index_name;

with expected(index_name, definition_pattern) as (
  values
    ('premium_entitlements_stripe_subscription_idx', 'USING btree \(stripe_subscription_id\).*WHERE \(stripe_subscription_id IS NOT NULL\)'),
    ('premium_entitlements_stripe_payment_intent_idx', 'USING btree \(stripe_payment_intent_id\)'),
    ('user_profiles_user_id_key', 'UNIQUE INDEX.*USING btree \(user_id\)'),
    ('report_history_user_analysis_id', 'UNIQUE INDEX.*USING btree \(user_id, analysis_id\).*WHERE \(analysis_id IS NOT NULL\)'),
    ('repertoire_one_active_slot_idx', 'UNIQUE INDEX.*USING btree \(user_id, slot\).*WHERE \(status = ''active''::text\)')
)
select 'index_definition' as check_type, expected.index_name as object_name,
       indexes.indexdef ~ expected.definition_pattern as passed
from expected
left join pg_indexes indexes
  on indexes.schemaname = 'public' and indexes.indexname = expected.index_name
order by expected.index_name;

with required_functions(signature) as (
  values
    ('prevent_client_profile_premium_update()'),
    ('preserve_lifetime_premium_entitlement()'),
    ('prevent_stale_stripe_entitlement_update()'),
    ('grant_manual_lifetime_entitlement(uuid,text)'),
    ('openingfit_has_paid_access()'),
    ('require_openingfit_paid_mutation()'),
    ('validate_referral_code(text)'),
    ('attach_referral_to_user(text,text)'),
    ('record_referral_visit(text,text,text)'),
    ('initialise_repertoire_from_report(jsonb)'),
    ('accept_repertoire_recommendation(uuid)'),
    ('save_weekly_training_plan(jsonb,boolean)'),
    ('set_weekly_training_task_status(uuid,text,boolean)'),
    ('apply_repertoire_training_outcomes(jsonb)')
)
select
  'required_function' as check_type,
  required.signature as object_name,
  (to_regprocedure('public.' || required.signature) is not null) as passed
from required_functions required
order by required.signature;

with expected(signature) as (
  values
    ('prevent_client_profile_premium_update()'),
    ('preserve_lifetime_premium_entitlement()'),
    ('prevent_stale_stripe_entitlement_update()'),
    ('grant_manual_lifetime_entitlement(uuid,text)'),
    ('openingfit_has_paid_access()'),
    ('require_openingfit_paid_mutation()')
)
select 'function_security' as check_type, expected.signature as object_name,
       procedure.prosecdef is true
       and coalesce(procedure.proconfig, array[]::text[]) @> array['search_path=public']::text[] as passed
from expected
left join pg_proc procedure
  on procedure.oid = to_regprocedure('public.' || expected.signature)
order by expected.signature;

with required_triggers(table_name, trigger_name) as (
  values
    ('profiles', 'prevent_client_profile_premium_update'),
    ('premium_entitlements', 'preserve_lifetime_premium_entitlement'),
    ('premium_entitlements', 'prevent_stale_stripe_entitlement_update'),
    ('openingfit_retention_snapshots', 'set_openingfit_retention_snapshots_updated_at'),
    ('referral_partners', 'normalize_referral_partner_code'),
    ('referral_partners', 'set_referral_partners_updated_at'),
    ('referral_attributions', 'set_referral_attributions_updated_at'),
    ('repertoire', 'set_repertoire_updated_at'),
    ('repertoire', 'require_paid_mutation'),
    ('weekly_training_plans', 'set_weekly_training_plans_updated_at'),
    ('weekly_training_plans', 'require_paid_mutation'),
    ('report_history', 'require_paid_mutation')
)
select
  'required_trigger' as check_type,
  required.table_name || '.' || required.trigger_name as object_name,
  (trigger.oid is not null and trigger.tgenabled <> 'D') as passed
from required_triggers required
left join pg_class relation
  on relation.oid = to_regclass('public.' || required.table_name)
left join pg_trigger trigger
  on trigger.tgrelid = relation.oid
 and trigger.tgname = required.trigger_name
 and not trigger.tgisinternal
order by required.table_name, required.trigger_name;

with expected(table_name, trigger_name, function_name) as (
  values
    ('profiles', 'prevent_client_profile_premium_update', 'prevent_client_profile_premium_update'),
    ('premium_entitlements', 'preserve_lifetime_premium_entitlement', 'preserve_lifetime_premium_entitlement'),
    ('premium_entitlements', 'prevent_stale_stripe_entitlement_update', 'prevent_stale_stripe_entitlement_update'),
    ('repertoire', 'require_paid_mutation', 'require_openingfit_paid_mutation'),
    ('weekly_training_plans', 'require_paid_mutation', 'require_openingfit_paid_mutation'),
    ('report_history', 'require_paid_mutation', 'require_openingfit_paid_mutation')
)
select 'trigger_function_mapping' as check_type,
       expected.table_name || '.' || expected.trigger_name as object_name,
       procedure.proname = expected.function_name and trigger.tgenabled <> 'D' as passed
from expected
left join pg_class relation on relation.oid = to_regclass('public.' || expected.table_name)
left join pg_trigger trigger on trigger.tgrelid = relation.oid
  and trigger.tgname = expected.trigger_name and not trigger.tgisinternal
left join pg_proc procedure on procedure.oid = trigger.tgfoid
order by expected.table_name, expected.trigger_name;

with protected_tables(table_name) as (
  values
    ('premium_entitlements'), ('stripe_webhook_events'),
    ('openingfit_retention_snapshots'), ('referral_partners'),
    ('referral_visits'), ('referral_attributions'), ('report_history'),
    ('repertoire'), ('weekly_training_plans')
)
select
  'rls_enabled' as check_type,
  protected.table_name as object_name,
  coalesce(relation.relrowsecurity, false) as passed
from protected_tables protected
left join pg_class relation
  on relation.oid = to_regclass('public.' || protected.table_name)
order by protected.table_name;

with required_policies(table_name, policy_name) as (
  values
    ('premium_entitlements', 'premium_entitlements_select_own'),
    ('openingfit_retention_snapshots', 'openingfit_retention_snapshots_select_own'),
    ('openingfit_retention_snapshots', 'openingfit_retention_snapshots_insert_own'),
    ('openingfit_retention_snapshots', 'openingfit_retention_snapshots_update_own'),
    ('openingfit_retention_snapshots', 'openingfit_retention_snapshots_delete_own'),
    ('repertoire', 'repertoire_select_own'),
    ('weekly_training_plans', 'weekly_training_plans_select_own'),
    ('report_history', 'report_history_select_own'),
    ('report_history', 'report_history_insert_own'),
    ('report_history', 'report_history_update_own'),
    ('report_history', 'report_history_delete_own')
)
select
  'required_policy' as check_type,
  required.table_name || '.' || required.policy_name as object_name,
  (policies.policyname is not null) as passed
from required_policies required
left join pg_policies policies
  on policies.schemaname = 'public'
 and policies.tablename = required.table_name
 and policies.policyname = required.policy_name
order by required.table_name, required.policy_name;

with expected(policy_name, command_name, requires_paid) as (
  values
    ('report_history_select_own', 'SELECT', false),
    ('report_history_insert_own', 'INSERT', true),
    ('report_history_update_own', 'UPDATE', true),
    ('report_history_delete_own', 'DELETE', true)
)
select 'report_history_policy_definition' as check_type,
       expected.policy_name as object_name,
       policy.cmd = expected.command_name
       and policy.roles = array['authenticated']::name[]
       and coalesce(policy.qual, policy.with_check, '') like '%auth.uid()%user_id%'
       and (
         (expected.requires_paid and (coalesce(policy.qual, '') || coalesce(policy.with_check, '')) like '%openingfit_has_paid_access%')
         or
         (not expected.requires_paid and (coalesce(policy.qual, '') || coalesce(policy.with_check, '')) not like '%openingfit_has_paid_access%')
       ) as passed
from expected
left join pg_policies policy
  on policy.schemaname = 'public'
 and policy.tablename = 'report_history'
 and policy.policyname = expected.policy_name
order by expected.policy_name;

select 'duplicate_entitlement_owner_groups' as metric, count(*)::bigint as finding_count
from (
  select user_id from public.premium_entitlements
  group by user_id having count(*) > 1
) duplicates
union all
select 'duplicate_stripe_subscription_id_groups', count(*)::bigint
from (
  select stripe_subscription_id from public.premium_entitlements
  where stripe_subscription_id is not null
  group by stripe_subscription_id having count(*) > 1
) duplicates
union all
select 'missing_entitlement_owners', count(*)::bigint
from public.premium_entitlements where user_id is null
union all
select 'premium_profiles_without_qualifying_entitlement', count(*)::bigint
from public.profiles profile
where profile.is_premium is true
  and profile.user_id is not null
  and not exists (
    select 1 from public.premium_entitlements entitlement
    where entitlement.user_id = profile.user_id
      and (
        (entitlement.access_type = 'lifetime' and
          (entitlement.is_grandfathered_lifetime is true or entitlement.status in ('active', 'trialing')))
        or
        (entitlement.access_type in ('monthly_subscription', 'annual_subscription') and
          (entitlement.status in ('active', 'trialing') or
           (entitlement.status in ('canceled', 'past_due') and entitlement.current_period_end > now())))
      )
  )
union all
select 'grandfathered_lifetime_with_expiry', count(*)::bigint
from public.premium_entitlements
where is_grandfathered_lifetime is true
  and (access_type <> 'lifetime' or expires_at is not null or current_period_end is not null)
union all
select 'lifetime_with_subscription_lifecycle', count(*)::bigint
from public.premium_entitlements
where access_type = 'lifetime'
  and (stripe_subscription_id is not null or checkout_mode = 'subscription'
       or plan_interval is not null
       or (stripe_status is not null and not (
         is_grandfathered_lifetime is false
         and status = 'refunded'
         and source in ('stripe_charge.refunded', 'stripe_refund.updated')
         and stripe_status = 'refunded'
         and expires_at is not null
       ))
       or current_period_start is not null or current_period_end is not null)
union all
select 'invalid_refunded_lifetime_shape', count(*)::bigint
from public.premium_entitlements
where access_type = 'lifetime' and status = 'refunded'
  and not (
    is_grandfathered_lifetime is false
    and source in ('stripe_charge.refunded', 'stripe_refund.updated')
    and stripe_status = 'refunded'
    and expires_at is not null
    and stripe_subscription_id is null
    and checkout_mode is distinct from 'subscription'
    and plan_interval is null
    and current_period_start is null
    and current_period_end is null
  )
union all
select 'stuck_webhook_events_over_5_minutes', count(*)::bigint
from public.stripe_webhook_events
where status = 'processing' and updated_at <= now() - interval '5 minutes'
union all
select 'report_history_rows', count(*)::bigint from public.report_history
union all
select 'recommendation_history_rows', count(*)::bigint from public.recommendation_history
union all
select 'analysed_games_rows', count(*)::bigint from public.analysed_games
union all
select 'legacy_repertoire_json_column_count', count(*)::bigint
from information_schema.columns
where table_schema = 'public' and table_name = 'repertoire'
  and column_name = 'repertoire' and data_type = 'jsonb'
union all
select 'production_only_table_count', count(*)::bigint
from information_schema.tables
where table_schema = 'public'
  and table_name in ('contact_messages', 'feedback', 'user_states')
order by metric;
