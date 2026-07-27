-- READ-ONLY PRODUCTION PREFLIGHT (persistent data): this script creates only
-- pg_temp working tables. It never returns PII, a full UUID, or a Stripe ID.
-- Run before migration 1 and archive the complete output.

begin;

create temporary table openingfit_reconciliation_candidates on commit drop as
with entitlement_rows as (
  select
    e.user_id,
    to_jsonb(e) as row_data
  from public.premium_entitlements e
),
profile_rows as (
  select
    p.user_id,
    to_jsonb(p) as row_data
  from public.profiles p
)
select
  'conservative_legacy_entitlement'::text as candidate_type,
  e.user_id,
  e.row_data,
  p.row_data as profile_data
from entitlement_rows e
left join profile_rows p on p.user_id = e.user_id
where nullif(e.row_data ->> 'access_type', '') is null
  and lower(coalesce(e.row_data ->> 'status', '')) in ('active', 'premium', 'paid', 'lifetime')
  and nullif(e.row_data ->> 'expires_at', '') is null
  and nullif(e.row_data ->> 'stripe_customer_id', '') is null
  and nullif(e.row_data ->> 'stripe_subscription_id', '') is null
  and nullif(e.row_data ->> 'stripe_payment_intent_id', '') is null
  and nullif(e.row_data ->> 'stripe_price_id', '') is null
  and nullif(e.row_data ->> 'checkout_mode', '') is null
  and nullif(e.row_data ->> 'plan_interval', '') is null
  and nullif(e.row_data ->> 'stripe_status', '') is null
  and nullif(e.row_data ->> 'current_period_start', '') is null
  and nullif(e.row_data ->> 'current_period_end', '') is null
  and nullif(e.row_data ->> 'last_stripe_event_id', '') is null
  and nullif(e.row_data ->> 'last_stripe_event_created_at', '') is null
  and (
    nullif(e.row_data ->> 'source', '') is null
    or e.row_data ->> 'source' in (
      'legacy', 'legacy_fixture', 'legacy_lifetime_backfill', 'manual_support'
    )
  )
union all
select
  'premium_profile_without_entitlement'::text,
  p.user_id,
  null::jsonb,
  p.row_data
from profile_rows p
where p.user_id is not null
  and coalesce((p.row_data ->> 'is_premium')::boolean, false) is true
  and not exists (
    select 1 from public.premium_entitlements e where e.user_id = p.user_id
  );

-- The domain-separated digest is stable across all queries in this runbook but
-- cannot be used as an application identifier.
select
  candidate_type,
  'ofr-v1-' || substr(md5('openingfit-production-reconciliation-v1:' || user_id::text), 1, 16)
    as redacted_owner_id
from openingfit_reconciliation_candidates
order by candidate_type, redacted_owner_id;

-- Evidence in the entitlement or profile. The migration intentionally uses
-- only the entitlement predicates above; profile evidence is an extra STOP
-- gate and is not used to weaken or silently broaden migration classification.
create temporary table openingfit_candidate_evidence on commit drop as
select
  c.candidate_type,
  c.user_id,
  array_remove(array[
    case when nullif(c.row_data ->> 'stripe_customer_id', '') is not null then 'entitlement_customer' end,
    case when nullif(c.row_data ->> 'stripe_subscription_id', '') is not null then 'entitlement_subscription' end,
    case when nullif(c.row_data ->> 'stripe_payment_intent_id', '') is not null then 'entitlement_payment' end,
    case when nullif(c.row_data ->> 'stripe_price_id', '') is not null then 'entitlement_price' end,
    case when nullif(c.row_data ->> 'checkout_mode', '') is not null then 'entitlement_checkout_mode' end,
    case when nullif(c.row_data ->> 'plan_interval', '') is not null then 'entitlement_interval' end,
    case when nullif(c.row_data ->> 'stripe_status', '') is not null then 'entitlement_stripe_status' end,
    case when nullif(c.row_data ->> 'current_period_start', '') is not null then 'entitlement_period' end,
    case when nullif(c.row_data ->> 'current_period_end', '') is not null then 'entitlement_period' end,
    case when coalesce((c.row_data ->> 'cancel_at_period_end')::boolean, false) is true then 'entitlement_cancel_at_period_end' end,
    case when nullif(c.row_data ->> 'last_stripe_event_id', '') is not null then 'entitlement_webhook' end,
    case when nullif(c.profile_data ->> 'stripe_customer_id', '') is not null then 'profile_customer' end,
    case when nullif(c.profile_data ->> 'stripe_checkout_session_id', '') is not null then 'profile_checkout' end
  ], null) as evidence_types,
  array_remove(array[
    nullif(c.row_data ->> 'stripe_customer_id', ''),
    nullif(c.row_data ->> 'stripe_subscription_id', ''),
    nullif(c.row_data ->> 'stripe_payment_intent_id', ''),
    nullif(c.row_data ->> 'stripe_price_id', ''),
    nullif(c.row_data ->> 'last_stripe_event_id', ''),
    nullif(c.profile_data ->> 'stripe_customer_id', ''),
    nullif(c.profile_data ->> 'stripe_checkout_session_id', '')
  ], null) as evidence_object_ids
from openingfit_reconciliation_candidates c;

-- Add referral checkout/payment evidence when the foundation table exists.
do $block$
begin
  if to_regclass('public.referral_attributions') is not null then
    execute $sql$
      update openingfit_candidate_evidence e
      set evidence_types = e.evidence_types || x.types,
          evidence_object_ids = e.evidence_object_ids || x.ids
      from (
        select c.user_id,
          array_remove(array[
            case when count(*) filter (where nullif(to_jsonb(r)->>'stripe_checkout_session_id','') is not null) > 0 then 'referral_checkout' end,
            case when count(*) filter (where nullif(to_jsonb(r)->>'stripe_payment_intent_id','') is not null) > 0 then 'referral_payment' end
          ], null) types,
          array_remove(array_agg(distinct coalesce(
            nullif(to_jsonb(r)->>'stripe_checkout_session_id',''),
            nullif(to_jsonb(r)->>'stripe_payment_intent_id','')
          )), null) ids
        from openingfit_reconciliation_candidates c
        join public.referral_attributions r on r.referred_user_id = c.user_id
        group by c.user_id
      ) x
      where x.user_id = e.user_id
    $sql$;
  end if;
end
$block$;

-- Correlate ledger rows by object ID without printing either identifier.
create temporary table openingfit_candidate_ledger_counts (
  user_id uuid primary key,
  matching_webhook_rows bigint not null
) on commit drop;

do $block$
begin
  if to_regclass('public.stripe_webhook_events') is null then
    insert into openingfit_candidate_ledger_counts
    select user_id, 0 from openingfit_candidate_evidence;
  else
    execute $sql$
      insert into openingfit_candidate_ledger_counts
      select e.user_id, count(distinct w.event_id)
      from openingfit_candidate_evidence e
      left join public.stripe_webhook_events w
        on w.object_id = any(e.evidence_object_ids)
      group by e.user_id
    $sql$;
  end if;
end
$block$;

select
  e.candidate_type,
  'ofr-v1-' || substr(md5('openingfit-production-reconciliation-v1:' || e.user_id::text), 1, 16)
    as redacted_owner_id,
  cardinality(e.evidence_types) as evidence_type_count,
  coalesce(e.evidence_types, array[]::text[]) as evidence_types,
  l.matching_webhook_rows,
  case
    when cardinality(e.evidence_types) > 0 or l.matching_webhook_rows > 0 then 'STOP'
    else 'REVIEW_STRIPE_DASHBOARD'
  end as decision
from openingfit_candidate_evidence e
join openingfit_candidate_ledger_counts l using (user_id)
order by e.candidate_type, redacted_owner_id;

select
  'OPENINGFIT_CANDIDATE_COUNTS' as result_type,
  count(*) filter (where candidate_type = 'conservative_legacy_entitlement')
    as conservative_legacy_candidate_count,
  count(*) filter (where candidate_type = 'premium_profile_without_entitlement')
    as premium_profile_without_entitlement_count
from openingfit_reconciliation_candidates;

rollback;
