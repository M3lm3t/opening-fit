-- Read-only, aggregate-only preview for the three production reconciliation migrations.
-- Optional future columns are read through to_jsonb(row), allowing this one result set
-- to run before and after reconciliation without returning identifiers or PII.

with entitlement_rows as (
  select
    nullif(to_jsonb(e)->>'user_id', '') as user_id,
    lower(coalesce(to_jsonb(e)->>'status', '')) as status,
    nullif(to_jsonb(e)->>'access_type', '') as access_type,
    coalesce((to_jsonb(e)->>'is_grandfathered_lifetime')::boolean, false) as is_grandfathered_lifetime,
    nullif(to_jsonb(e)->>'stripe_customer_id', '') as stripe_customer_id,
    nullif(to_jsonb(e)->>'stripe_subscription_id', '') as stripe_subscription_id,
    nullif(to_jsonb(e)->>'stripe_payment_intent_id', '') as stripe_payment_intent_id,
    nullif(to_jsonb(e)->>'stripe_price_id', '') as stripe_price_id,
    nullif(to_jsonb(e)->>'checkout_mode', '') as checkout_mode,
    nullif(to_jsonb(e)->>'plan_interval', '') as plan_interval,
    nullif(to_jsonb(e)->>'stripe_status', '') as stripe_status,
    nullif(to_jsonb(e)->>'current_period_start', '') as current_period_start,
    nullif(to_jsonb(e)->>'current_period_end', '') as current_period_end,
    nullif(to_jsonb(e)->>'expires_at', '') as expires_at,
    nullif(to_jsonb(e)->>'source', '') as source,
    nullif(to_jsonb(e)->>'last_stripe_event_id', '') as last_stripe_event_id,
    nullif(to_jsonb(e)->>'last_stripe_event_created_at', '') as last_stripe_event_created_at
  from public.premium_entitlements e
), classified as (
  select *,
    access_type is null
      and status in ('active', 'premium', 'paid', 'lifetime')
      and expires_at is null
      and stripe_customer_id is null and stripe_subscription_id is null
      and stripe_payment_intent_id is null and stripe_price_id is null
      and checkout_mode is null
      and plan_interval is null and stripe_status is null
      and current_period_start is null and current_period_end is null
      and last_stripe_event_id is null and last_stripe_event_created_at is null
      and (source is null or source in ('legacy', 'legacy_fixture', 'legacy_lifetime_backfill', 'manual_support'))
      as conservative_lifetime_candidate,
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
        'stripe_customer.subscription.deleted', 'stripe_invoice.paid', 'stripe_invoice.payment_failed'
      )
      and last_stripe_event_id is null and last_stripe_event_created_at is null
      as payment_lifetime_evidence
  from entitlement_rows
), premium_profiles as (
  select p.user_id::text as user_id from public.profiles p
  where p.user_id is not null and p.is_premium is true
), report_rows as (
  select h.user_id::text as user_id, to_jsonb(h) as row_data from public.report_history h
), workspace_items as (
  select item,
    case item->>'section'
      when 'white' then case when item->>'role' in ('Backup', 'Alternative') then 'white_secondary' else 'white_primary' end
      when 'blackE4' then 'black_vs_e4'
      when 'blackD4' then 'black_vs_d4'
      when 'other' then 'black_other'
      else null
    end as mapped_slot
  from public.openingfit_user_state s
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(s.coach_progress->'repertoireWorkspace'->'items') = 'array'
      then s.coach_progress->'repertoireWorkspace'->'items' else '[]'::jsonb end
  ) item
), projected as (
  select user_id, status, current_period_end,
    (is_grandfathered_lifetime or conservative_lifetime_candidate) as projected_grandfathered,
    case
      when access_type is not null then access_type
      when payment_lifetime_evidence then 'lifetime'
      when coalesce(subscription_classifiable, false)
        then case when plan_interval = 'year' then 'annual_subscription' else 'monthly_subscription' end
      when conservative_lifetime_candidate then 'lifetime'
      else null
    end as projected_access_type
  from classified
), projected_paid_users as (
  select user_id from projected
  where (projected_access_type = 'lifetime'
         and (projected_grandfathered or status in ('active', 'trialing')))
     or (projected_access_type in ('monthly_subscription', 'annual_subscription') and (
       status in ('active', 'trialing')
       or (status = 'canceled' and current_period_end is not null and current_period_end::timestamptz > now())
     ))
  union select user_id from premium_profiles
), metrics as (
  select 'entitlements.total'::text metric, count(*)::bigint affected_rows from classified
  union all select 'entitlements.legacy_lifetime_candidates_conservative', count(*) filter (where conservative_lifetime_candidate) from classified
  union all select 'entitlements.explicit_one_time_payment_lifetime_classifications', count(*) filter (where payment_lifetime_evidence) from classified
  union all select 'entitlements.explicit_subscription_classifications', count(*) filter (where subscription_classifiable) from classified
  union all select 'entitlements.customer_only_ambiguous', count(*) filter (
    where access_type is null and stripe_customer_id is not null
      and stripe_subscription_id is null and stripe_payment_intent_id is null and stripe_price_id is null
      and checkout_mode is null and plan_interval is null and stripe_status is null
      and current_period_start is null and current_period_end is null and source is null
      and last_stripe_event_id is null and last_stripe_event_created_at is null
  ) from classified
  union all select 'entitlements.price_only_ambiguous', count(*) filter (
    where access_type is null and stripe_price_id is not null
      and stripe_customer_id is null and stripe_subscription_id is null and stripe_payment_intent_id is null
      and checkout_mode is null and plan_interval is null and stripe_status is null
      and current_period_start is null and current_period_end is null and source is null
      and last_stripe_event_id is null and last_stripe_event_created_at is null
  ) from classified
  union all select 'entitlements.source_only_subscription_evidence', count(*) filter (
    where access_type is null and source in (
      'stripe_customer.subscription.created', 'stripe_customer.subscription.updated',
      'stripe_customer.subscription.deleted', 'stripe_invoice.paid', 'stripe_invoice.payment_failed'
    ) and stripe_customer_id is null and stripe_subscription_id is null
      and stripe_payment_intent_id is null and stripe_price_id is null and checkout_mode is null
      and plan_interval is null and stripe_status is null and current_period_start is null
      and current_period_end is null and last_stripe_event_id is null and last_stripe_event_created_at is null
  ) from classified
  union all select 'entitlements.payment_mode_with_contradictory_recurring_evidence', count(*) filter (
    where checkout_mode = 'payment' and not payment_lifetime_evidence
      and not (
        access_type = 'lifetime'
        and is_grandfathered_lifetime is false
        and status = 'refunded'
        and source in ('stripe_charge.refunded', 'stripe_refund.updated')
        and stripe_status = 'refunded'
        and expires_at is not null
      )
  ) from classified
  union all select 'entitlements.lifetime_with_contradictory_subscription_evidence', count(*) filter (
    where access_type = 'lifetime' and (
      stripe_subscription_id is not null or checkout_mode = 'subscription' or plan_interval is not null
      or lower(coalesce(stripe_status, '')) in (
        'active', 'trialing', 'past_due', 'canceled', 'unpaid',
        'incomplete', 'incomplete_expired', 'paused'
      ) or current_period_start is not null or current_period_end is not null
    )
  ) from classified
  union all select 'entitlements.rows_remaining_unclassified', count(*) from projected where projected_access_type is null
  union all select 'entitlements.ambiguous_active_nonexpiring', count(*) filter (
    where access_type is null and status in ('active', 'premium', 'paid', 'lifetime')
      and expires_at is null and not conservative_lifetime_candidate
      and not coalesce(subscription_classifiable, false)
      and not coalesce(payment_lifetime_evidence, false)
  ) from classified
  union all select 'entitlements.active_subscription_classification', count(*) filter (
    where (access_type in ('monthly_subscription', 'annual_subscription') or subscription_classifiable)
      and status in ('active', 'trialing')
  ) from classified
  union all select 'entitlements.canceled_current_subscription_classification', count(*) filter (
    where (access_type in ('monthly_subscription', 'annual_subscription') or subscription_classifiable)
      and status = 'canceled' and current_period_end is not null and current_period_end::timestamptz > now()
  ) from classified
  union all select 'entitlements.expired_subscription_classification', count(*) filter (
    where (access_type in ('monthly_subscription', 'annual_subscription') or subscription_classifiable)
      and (status in ('expired', 'inactive') or (current_period_end is not null and current_period_end::timestamptz <= now()))
  ) from classified
  union all select 'profiles.premium_without_any_entitlement', count(*) from premium_profiles p
    where not exists (select 1 from entitlement_rows e where e.user_id = p.user_id)
  union all select 'profiles.rows_affected_by_canonical_entitlement_backfill', count(*) from premium_profiles p
    where not exists (select 1 from entitlement_rows e where e.user_id = p.user_id)
  union all select 'profiles.premium_without_current_qualifying_entitlement', count(*) from premium_profiles p
    where not exists (
      select 1 from projected e where e.user_id = p.user_id and (
        e.projected_access_type = 'lifetime'
        or (e.projected_access_type in ('monthly_subscription', 'annual_subscription') and (
          e.status in ('active', 'trialing')
          or (e.status = 'canceled' and e.current_period_end is not null and e.current_period_end::timestamptz > now())
        ))
      )
    )
  union all select 'constraints.user_profiles_null_owner', count(*) from public.user_profiles where user_id is null
  union all select 'constraints.user_profiles_duplicate_owner_groups', count(*) from (
    select user_id from public.user_profiles where user_id is not null group by user_id having count(*) > 1
  ) d
  union all select 'constraints.entitlement_null_owner', count(*) from public.premium_entitlements where user_id is null
  union all select 'constraints.entitlement_duplicate_owner_groups', count(*) from (
    select user_id from public.premium_entitlements where user_id is not null group by user_id having count(*) > 1
  ) d
  union all select 'constraints.entitlement_duplicate_subscription_groups', count(*) from (
    select stripe_subscription_id from entitlement_rows where stripe_subscription_id is not null
    group by stripe_subscription_id having count(*) > 1
  ) d
  union all select 'report_history.total_rows', count(*) from report_rows
  union all select 'report_history.rows_receiving_schema_version_default', count(*) filter (
    where not (row_data ? 'report_schema_version') or row_data->>'report_schema_version' is null
  ) from report_rows
  union all select 'report_history.rows_receiving_snapshot_default', count(*) filter (
    where not (row_data ? 'snapshot') or row_data->'snapshot' is null
  ) from report_rows
  union all select 'repertoire.existing_legacy_table_rows_to_archive', count(*) from public.repertoire r
    where not (to_jsonb(r) ? 'slot') or nullif(to_jsonb(r)->>'slot', '') is null
  union all select 'repertoire.workspace_items_eligible_for_typed_import', count(*) from workspace_items
    where mapped_slot is not null and nullif(trim(item->>'name'), '') is not null
  union all select 'repertoire.workspace_items_with_invalid_locked_boolean', count(*) from workspace_items
    where item ? 'locked' and item->>'locked' is not null
      and item->>'locked' !~* '^(true|false|t|f|yes|no|y|n|on|off|1|0)$'
  union all select 'report_history.distinct_free_users_retaining_owner_read_access', count(distinct r.user_id) from report_rows r
    where not exists (select 1 from projected_paid_users p where p.user_id = r.user_id)
)
select metric, affected_rows from metrics order by metric;
