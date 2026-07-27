-- READ-ONLY, IDENTIFIER-SAFE diagnostic for the two privately reviewed
-- conservative lifetime candidates approved for migration 2.
-- This is one SELECT in a READ ONLY transaction: no temporary or persistent
-- database object is created and no identifier or Stripe value is returned.

begin read only;

with entitlement_rows as materialized (
  select e.user_id, to_jsonb(e) as row_data
  from public.premium_entitlements e
), classified as materialized (
  select *,
    nullif(row_data ->> 'access_type', '') is null
      and lower(coalesce(row_data ->> 'status', '')) in ('active', 'premium', 'paid', 'lifetime')
      and nullif(row_data ->> 'expires_at', '') is null
      and nullif(row_data ->> 'stripe_customer_id', '') is null
      and nullif(row_data ->> 'stripe_subscription_id', '') is null
      and nullif(row_data ->> 'stripe_payment_intent_id', '') is null
      and nullif(row_data ->> 'stripe_price_id', '') is null
      and nullif(row_data ->> 'checkout_mode', '') is null
      and nullif(row_data ->> 'plan_interval', '') is null
      and nullif(row_data ->> 'stripe_status', '') is null
      and nullif(row_data ->> 'current_period_start', '') is null
      and nullif(row_data ->> 'current_period_end', '') is null
      and not coalesce((row_data ->> 'cancel_at_period_end')::boolean, false)
      and nullif(row_data ->> 'last_stripe_event_id', '') is null
      and nullif(row_data ->> 'last_stripe_event_created_at', '') is null
      and (
        nullif(row_data ->> 'source', '') is null
        or row_data ->> 'source' in (
          'legacy', 'legacy_fixture', 'legacy_lifetime_backfill',
          'manual_support', 'legacy_lifetime_repair'
        )
      ) as conservative_candidate,
    row_data ->> 'source' = 'legacy_lifetime_repair'
      and nullif(row_data ->> 'access_type', '') is null
      and not coalesce((row_data ->> 'is_grandfathered_lifetime')::boolean, false)
      and lower(coalesce(row_data ->> 'status', '')) in ('active', 'premium', 'paid', 'lifetime')
      and nullif(row_data ->> 'expires_at', '') is null
      and nullif(row_data ->> 'stripe_customer_id', '') is null
      and nullif(row_data ->> 'stripe_checkout_session_id', '') is null
      and nullif(row_data ->> 'stripe_subscription_id', '') is null
      and nullif(row_data ->> 'stripe_payment_intent_id', '') is null
      and nullif(row_data ->> 'stripe_price_id', '') is null
      and nullif(row_data ->> 'checkout_mode', '') is null
      and nullif(row_data ->> 'plan_interval', '') is null
      and nullif(row_data ->> 'stripe_status', '') is null
      and nullif(row_data ->> 'current_period_start', '') is null
      and nullif(row_data ->> 'current_period_end', '') is null
      and not coalesce((row_data ->> 'cancel_at_period_end')::boolean, false)
      and nullif(row_data ->> 'last_stripe_event_id', '') is null
      and nullif(row_data ->> 'last_stripe_event_created_at', '') is null
      as pristine_reviewed_candidate,
    row_data ->> 'source' = 'legacy_lifetime_repair'
      and row_data ->> 'access_type' = 'lifetime'
      and row_data ->> 'status' = 'active'
      and coalesce((row_data ->> 'is_grandfathered_lifetime')::boolean, false)
      and nullif(row_data ->> 'expires_at', '') is null
      and nullif(row_data ->> 'stripe_customer_id', '') is null
      and nullif(row_data ->> 'stripe_checkout_session_id', '') is null
      and nullif(row_data ->> 'stripe_subscription_id', '') is null
      and nullif(row_data ->> 'stripe_payment_intent_id', '') is null
      and nullif(row_data ->> 'stripe_price_id', '') is null
      and nullif(row_data ->> 'checkout_mode', '') is null
      and nullif(row_data ->> 'plan_interval', '') is null
      and nullif(row_data ->> 'stripe_status', '') is null
      and nullif(row_data ->> 'current_period_start', '') is null
      and nullif(row_data ->> 'current_period_end', '') is null
      and nullif(row_data ->> 'last_stripe_event_id', '') is null
      and nullif(row_data ->> 'last_stripe_event_created_at', '') is null
      as canonical_reviewed_lifetime,
    nullif(row_data ->> 'access_type', '') is null
      and coalesce(nullif(row_data ->> 'checkout_mode', ''), '') <> 'payment'
      and (
        nullif(row_data ->> 'stripe_subscription_id', '') is not null
        or row_data ->> 'checkout_mode' = 'subscription'
        or row_data ->> 'plan_interval' in ('month', 'year')
        or (
          lower(coalesce(row_data ->> 'stripe_status', '')) in (
            'active', 'trialing', 'past_due', 'canceled', 'unpaid',
            'incomplete', 'incomplete_expired', 'paused'
          )
          and (
            nullif(row_data ->> 'current_period_start', '') is not null
            or nullif(row_data ->> 'current_period_end', '') is not null
          )
        )
      ) as subscription_classifiable,
    nullif(row_data ->> 'access_type', '') is null
      and row_data ->> 'checkout_mode' = 'payment'
      and nullif(row_data ->> 'stripe_subscription_id', '') is null
      and nullif(row_data ->> 'plan_interval', '') is null
      and nullif(row_data ->> 'current_period_start', '') is null
      and nullif(row_data ->> 'current_period_end', '') is null
      and nullif(row_data ->> 'stripe_status', '') is null
      and coalesce(row_data ->> 'source', '') not in (
        'stripe_customer.subscription.created',
        'stripe_customer.subscription.updated',
        'stripe_customer.subscription.deleted',
        'stripe_invoice.paid',
        'stripe_invoice.payment_failed'
      )
      and nullif(row_data ->> 'last_stripe_event_id', '') is null
      and nullif(row_data ->> 'last_stripe_event_created_at', '') is null
      as payment_lifetime_classifiable
  from entitlement_rows
), reviewed as materialized (
  select *
  from classified
  where row_data ->> 'source' = 'legacy_lifetime_repair'
), diagnostic_gate as materialized (
  select
    count(*)::bigint as total_exact_source_cohort,
    count(*) filter (where pristine_reviewed_candidate)::bigint as pristine_reviewed_candidates,
    count(*) filter (where canonical_reviewed_lifetime)::bigint as canonical_reviewed_rows,
    count(*) filter (
      where not pristine_reviewed_candidate and not canonical_reviewed_lifetime
    )::bigint as exact_source_rows_with_conflicting_evidence,
    1 / case
    when count(*) = 2
      and count(distinct user_id) = 2
      and count(*) filter (where pristine_reviewed_candidate) = 2
      and count(*) filter (where canonical_reviewed_lifetime) = 0
      and count(*) filter (
        where not pristine_reviewed_candidate and not canonical_reviewed_lifetime
      ) = 0
      and to_regclass('public.stripe_webhook_events') is null
    then 1
    else (count(*) - count(*))::integer
  end as passed
  from reviewed
)
select
  'ofr-v1-' || substr(
    md5('openingfit-production-reconciliation-v1:' || a.user_id::text), 1, 16
  ) as redacted_owner_id,

  -- Exact conservative migration-2 predicate components.
  nullif(a.row_data ->> 'access_type', '') is null as predicate_access_type_null,
  lower(coalesce(a.row_data ->> 'status', '')) in ('active', 'premium', 'paid', 'lifetime')
    as predicate_status_allowed,
  nullif(a.row_data ->> 'expires_at', '') is null as predicate_expiry_null,
  nullif(a.row_data ->> 'stripe_customer_id', '') is null as predicate_customer_null,
  nullif(a.row_data ->> 'stripe_subscription_id', '') is null as predicate_subscription_null,
  nullif(a.row_data ->> 'stripe_payment_intent_id', '') is null as predicate_payment_intent_null,
  nullif(a.row_data ->> 'stripe_price_id', '') is null as predicate_price_null,
  nullif(a.row_data ->> 'checkout_mode', '') is null as predicate_checkout_mode_null,
  nullif(a.row_data ->> 'plan_interval', '') is null as predicate_plan_interval_null,
  nullif(a.row_data ->> 'stripe_status', '') is null as predicate_stripe_status_null,
  nullif(a.row_data ->> 'current_period_start', '') is null as predicate_period_start_null,
  nullif(a.row_data ->> 'current_period_end', '') is null as predicate_period_end_null,
  nullif(a.row_data ->> 'last_stripe_event_id', '') is null as predicate_last_event_id_null,
  nullif(a.row_data ->> 'last_stripe_event_created_at', '') is null
    as predicate_last_event_created_null,
  (
    nullif(a.row_data ->> 'source', '') is null
    or a.row_data ->> 'source' in (
      'legacy', 'legacy_fixture', 'legacy_lifetime_backfill',
      'manual_support', 'legacy_lifetime_repair'
    )
  ) as predicate_source_allowed,
  a.conservative_candidate,
  a.subscription_classifiable,
  a.payment_lifetime_classifiable,
  g.total_exact_source_cohort,
  g.pristine_reviewed_candidates,
  g.canonical_reviewed_rows,
  g.exact_source_rows_with_conflicting_evidence,

  -- Presence only. No Stripe object or user identifier is returned.
  nullif(a.row_data ->> 'access_type', '') is not null as access_type_present,
  nullif(a.row_data ->> 'status', '') is not null as status_present,
  nullif(a.row_data ->> 'expires_at', '') is not null as expiry_present,
  nullif(a.row_data ->> 'stripe_customer_id', '') is not null as stripe_customer_present,
  nullif(a.row_data ->> 'stripe_subscription_id', '') is not null as stripe_subscription_present,
  nullif(a.row_data ->> 'stripe_payment_intent_id', '') is not null as stripe_payment_intent_present,
  nullif(a.row_data ->> 'stripe_price_id', '') is not null as stripe_price_present,
  nullif(a.row_data ->> 'stripe_checkout_session_id', '') is not null as stripe_checkout_session_present,
  nullif(a.row_data ->> 'checkout_mode', '') is not null as checkout_mode_present,
  nullif(a.row_data ->> 'plan_interval', '') is not null as plan_interval_present,
  nullif(a.row_data ->> 'stripe_status', '') is not null as stripe_status_present,
  (
    nullif(a.row_data ->> 'current_period_start', '') is not null
    or nullif(a.row_data ->> 'current_period_end', '') is not null
  ) as current_period_present,
  (
    nullif(a.row_data ->> 'last_stripe_event_id', '') is not null
    or nullif(a.row_data ->> 'last_stripe_event_created_at', '') is not null
  ) as last_stripe_event_present,
  nullif(a.row_data ->> 'source', '') is not null as entitlement_source_present,
  nullif(to_jsonb(p) ->> 'premium_source', '') is not null as profile_premium_source_present,
  nullif(a.row_data ->> 'premium_since', '') is not null as premium_since_present,
  (a.row_data ? 'is_grandfathered_lifetime') as grandfathered_column_present,
  coalesce((a.row_data ->> 'is_grandfathered_lifetime')::boolean, false)
    as grandfathered_value,

  case
    when nullif(a.row_data ->> 'status', '') is null then 'absent'
    when lower(a.row_data ->> 'status') in ('active', 'premium', 'paid', 'lifetime')
      then 'active_like'
    when lower(a.row_data ->> 'status') in (
      'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete',
      'incomplete_expired', 'paused'
    ) then 'subscription_lifecycle'
    else 'other_nonempty'
  end as status_category,
  case
    when nullif(a.row_data ->> 'source', '') is null then 'absent'
    when a.row_data ->> 'source' = 'legacy_lifetime_repair'
      then 'approved_exact_source'
    else 'other_nonempty'
  end as entitlement_source_category,
  case
    when nullif(to_jsonb(p) ->> 'premium_source', '') is null then 'absent'
    when to_jsonb(p) ->> 'premium_source' = 'legacy_lifetime_repair'
      then 'approved_exact_source'
    else 'other_nonempty'
  end as profile_premium_source_category,
  nullif(a.row_data ->> 'source', '') is not distinct from
    nullif(to_jsonb(p) ->> 'premium_source', '') as entitlement_profile_sources_match,
  case
    when nullif(a.row_data ->> 'created_at', '') is null then 'unknown'
    when (a.row_data ->> 'created_at')::timestamptz < timestamptz '2026-07-18 00:00:00+00'
      then 'predates_recurring_launch_commit'
    else 'on_or_after_recurring_launch_commit'
  end as entitlement_age_category,
  case
    when nullif(a.row_data ->> 'premium_since', '') is null then 'unknown'
    when (a.row_data ->> 'premium_since')::timestamptz < timestamptz '2026-07-18 00:00:00+00'
      then 'predates_recurring_launch_commit'
    else 'on_or_after_recurring_launch_commit'
  end as premium_since_category,
  coalesce((to_jsonb(p) ->> 'is_premium')::boolean, false) as profile_is_premium,
  false as webhook_ledger_available,
  false as matching_database_webhook_evidence,
  g.passed = 1 as diagnostic_gate_passed
from reviewed a
cross join diagnostic_gate g
left join public.profiles p on p.user_id = a.user_id
order by redacted_owner_id;

rollback;
