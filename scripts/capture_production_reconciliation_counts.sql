-- Persistent-data read only. The pg_temp table lets one script tolerate tables
-- that are intentionally introduced in later phases.
begin;
create temporary table openingfit_reconciliation_counts (
  table_name text primary key,
  row_count bigint not null
) on commit drop;

do $block$
declare
  name text;
begin
  foreach name in array array[
    'profiles', 'premium_entitlements', 'report_history', 'repertoire',
    'contact_messages', 'feedback', 'user_states', 'openingfit_user_state',
    'analysed_games', 'analyzed_games', 'recommendation_history',
    'openingfit_retention_snapshots', 'referral_partners', 'referral_visits',
    'referral_attributions', 'stripe_webhook_events', 'weekly_training_plans'
  ] loop
    if to_regclass(format('public.%I', name)) is not null then
      execute format(
        'insert into openingfit_reconciliation_counts values (%L, (select count(*) from public.%I))',
        name, name
      );
    end if;
  end loop;
end
$block$;

select table_name, row_count
from openingfit_reconciliation_counts
order by table_name;

rollback;
