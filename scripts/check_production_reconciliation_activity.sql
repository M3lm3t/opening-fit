-- Read-only concurrency gate. Query text, users, addresses and identifiers are
-- deliberately omitted from output.
select
  state,
  coalesce(wait_event_type, 'none') as wait_event_type,
  coalesce(wait_event, 'none') as wait_event,
  count(*) as session_count,
  max(clock_timestamp() - xact_start) filter (where xact_start is not null)
    as longest_transaction
from pg_stat_activity
where datname = current_database()
  and pid <> pg_backend_pid()
group by state, wait_event_type, wait_event
order by state, wait_event_type, wait_event;

select count(*) as blocked_session_count
from pg_stat_activity
where datname = current_database()
  and cardinality(pg_blocking_pids(pid)) > 0;

select count(*) as transactions_older_than_five_minutes
from pg_stat_activity
where datname = current_database()
  and pid <> pg_backend_pid()
  and xact_start < clock_timestamp() - interval '5 minutes';
