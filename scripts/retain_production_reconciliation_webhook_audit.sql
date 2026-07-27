-- This is the ONE intentionally retained synthetic audit row. Set a unique,
-- approved execution ID containing only [a-z0-9_-], then archive the result.
-- It does not call Stripe or process a payment.
begin;
do $block$
declare execution_id text := current_setting('openingfit.execution_id');
declare synthetic_event text;
begin
  if execution_id !~ '^[a-z0-9_-]{8,64}$' then
    raise exception 'openingfit.execution_id is missing or unsafe';
  end if;
  synthetic_event := 'evt_openingfit_reconciliation_' || execution_id;
  if exists (select 1 from public.stripe_webhook_events where event_id=synthetic_event) then
    raise exception 'Synthetic audit event already exists';
  end if;
  insert into public.stripe_webhook_events(event_id,event_type,status,attempt_count)
  values (synthetic_event,'openingfit.reconciliation.smoke','processing',1);
  update public.stripe_webhook_events
  set status='processed',processed_at=now(),updated_at=now()
  where event_id=synthetic_event and status='processing';
  if not exists (
    select 1 from public.stripe_webhook_events
    where event_id=synthetic_event and status='processed' and attempt_count=1
  ) then raise exception 'Synthetic webhook ledger transition failed'; end if;
end
$block$;
commit;

select event_type,status,attempt_count,(processed_at is not null) as has_processed_at
from public.stripe_webhook_events
where event_id='evt_openingfit_reconciliation_' || current_setting('openingfit.execution_id');
