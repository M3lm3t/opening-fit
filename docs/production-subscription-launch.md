# OpeningFit production subscription launch

This is the single sequential operator checklist for subscription launch. Do not paste secrets, customer data, or full Stripe identifiers into this file or a deployment ticket. Repository validation does not prove an external dashboard step is complete.

Current repository assessment: **ready for the final manual gates; checkout must remain disabled until every blocking checkbox below is complete.**

## Before migrations

- [ ] Freeze the release commit and record its hash.
- [ ] Record the current frontend and backend deployment IDs.
- [ ] Set `OPENINGFIT_SUBSCRIPTIONS_ENABLED=false` in production.
- [ ] Confirm Supabase backup or point-in-time recovery and record the recovery timestamp privately.
- [ ] Name the launch operator, monitoring owner, support owner, and rollback owner.
- [ ] Confirm the rollback owner can redeploy the last known-good frontend and backend.
- [ ] Run frontend tests, backend tests, ESLint, the production build, and responsive layout checks from the frozen commit.

## Supabase

- [ ] Link the Supabase CLI to the production project without storing the service-role key in the repository.
- [ ] Run `supabase migration list` and apply migrations in filename order.
- [ ] Confirm the latest applied migration is `202607180004_feature_entitlement_enforcement.sql`.
- [ ] Run the audit SQL below read-only.
- [ ] Investigate and resolve every unexpected row before continuing.
- [ ] Verify RLS is enabled for `premium_entitlements`, `repertoire`, `weekly_training_plans`, `report_history`, and `stripe_webhook_events`.
- [ ] Verify authenticated users can access only their own rows.
- [ ] Verify `anon` and `authenticated` have no access to `stripe_webhook_events`.
- [ ] Verify subscription entitlement writes require the trusted backend service role.
- [ ] Verify all grandfathered lifetime users have `access_type='lifetime'`, active status, no expiry, and no cancellation date.
- [ ] Verify there is no more than one canonical entitlement per user.
- [ ] Record the audit result without exporting customer data.

```sql
select user_id, count(*)
from public.premium_entitlements
group by user_id
having count(*) > 1;

select p.user_id
from public.profiles p
left join public.premium_entitlements e on e.user_id = p.user_id
where p.is_premium is true and e.user_id is null;

select user_id, status, expires_at, current_period_end, cancel_at_period_end
from public.premium_entitlements
where access_type = 'lifetime'
  and (status <> 'active' or expires_at is not null or current_period_end is not null or cancel_at_period_end is true);

select event_id, event_type, status, attempt_count, updated_at, last_error
from public.stripe_webhook_events
where status = 'failed'
   or (status = 'processing' and updated_at < now() - interval '5 minutes')
order by updated_at;
```

## Stripe test mode

- [ ] Configure test monthly and annual recurring GBP Prices.
- [ ] Configure the Customer Portal with payment-method updates, invoice history, and cancellation at period end.
- [ ] Configure test receipt and failed-payment emails.
- [ ] Register the test webhook endpoint with all events listed under Stripe live mode below.
- [ ] Complete a monthly purchase with an owned test user and verify one entitlement.
- [ ] Complete an annual purchase with another owned test user and verify one entitlement.
- [ ] If the founding offer is enabled, verify a once-duration Coupon produces £29.99 first year and £39.99 renewal.
- [ ] Replay the same webhook event and verify one ledger row and one entitlement.
- [ ] Deliver an older lifecycle event after a newer event and verify the newer entitlement state remains.
- [ ] Use a Stripe test clock to deliver `invoice.paid` renewal and verify the new period end.
- [ ] Deliver `invoice.payment_failed` and verify paid access remains only through the stored paid period.
- [ ] Cancel in Portal and verify access continues to the paid period end.
- [ ] Advance the test clock beyond period end and verify Plus access ends without deleting saved data.
- [ ] Issue the approved test refund and verify refund webhooks and entitlement handling.
- [ ] Verify a lifetime account is not downgraded by subscription cancellation, failure, expiry, or refund events.
- [ ] Verify Portal opens only for the authenticated user's Stripe customer.
- [ ] Verify the successful-payment receipt arrives with correct product, interval, amount, and business details.
- [ ] Test webhook-before-Checkout-return and Checkout-return-before-webhook ordering.

## Stripe live mode

- [ ] Verify the live Product is named **OpeningFit Plus** and describes only implemented outcomes.
- [ ] Verify the live monthly Price is exactly **£4.99 GBP**, recurring monthly, and active.
- [ ] Verify the live annual Price is exactly **£39.99 GBP**, recurring annually, and active.
- [ ] Copy the live Price identifiers into the backend secret store, never the frontend.
- [ ] If enabled, verify the live founding Coupon is once-duration and reduces the first annual invoice to £29.99.
- [ ] If the founding offer is disabled, leave its flag false and do not show the offer.
- [ ] Configure Portal business details, Terms, Privacy, support link, payment-method updates, invoices, and cancellation at period end.
- [ ] Configure supported recurring GBP payment methods; cards are the minimum path.
- [ ] Configure successful-payment receipts and failed-payment emails according to the approved support policy.
- [ ] Register the production webhook endpoint at `/api/stripe/webhook` on the verified production backend.
- [ ] Select exactly the consumed events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`, and `refund.updated`.
- [ ] Store the live endpoint signing secret securely as `STRIPE_WEBHOOK_SECRET`; do not reuse a Stripe CLI secret.
- [ ] Confirm Stripe webhook retry notifications have an owner.

## Deployment

- [ ] Populate backend-only variables from `.env.example`: `APP_ENV`, `FRONTEND_URL`, `FRONTEND_URL_WWW`, `STRIPE_CUSTOMER_PORTAL_RETURN_URL`, `CORS_ALLOWED_ORIGINS`, `OPENINGFIT_SUBSCRIPTIONS_ENABLED`, Supabase service credentials, Stripe secret/webhook credentials, live monthly/annual Prices, and optional founding Coupon configuration.
- [ ] Set `APP_ENV=production` and keep `OPENINGFIT_SUBSCRIPTIONS_ENABLED=false` for the first deployment.
- [ ] Populate only frontend-safe variables: `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_SUPPORT_EMAIL`.
- [ ] Confirm the frontend environment contains no Stripe secret, webhook secret, or Supabase service-role key.
- [ ] Deploy the backend from the frozen commit.
- [ ] Verify `/health` returns liveness even when readiness is unavailable.
- [ ] Verify `/api/readiness` reports safe configured statuses and no keys, Price IDs, URLs containing secrets, or customer data.
- [ ] Verify production CORS accepts only configured exact origins and successful OPTIONS preflight for auth, imports, Stripe, and account routes.
- [ ] Deploy the frontend from the same frozen commit.
- [ ] Verify the support links use the configured support mailbox.
- [ ] Smoke-test homepage, Chess.com import, Lichess import, free report, sign-up, account restoration, pricing, account deletion, Terms, Privacy, and support links on phone, tablet, and desktop.
- [ ] Verify disabled checkout shows a truthful unavailable state while existing paid and lifetime access, Portal, and webhooks remain operational.

## Webhook audit command

- [ ] Run the configuration-only dry run:

```powershell
python backend/scripts/audit_subscription_state.py --dry-run
```

- [ ] Run the read-only Supabase and Stripe audit from a secured operator machine:

```powershell
python backend/scripts/audit_subscription_state.py
```

- [ ] If Stripe comparison is intentionally unavailable, run `python backend/scripts/audit_subscription_state.py --without-stripe` and record that limitation.
- [ ] Investigate unprocessed, failed, or stuck webhook events; duplicate IDs; unmatched Stripe subscriptions; subscription entitlements missing subscription IDs; multiple active entitlements; downgraded lifetime records; and inconsistent canceled access dates.
- [ ] Do not use `--repair`: repair is deliberately not implemented and the command refuses it. Apply any correction through the existing guarded service-role process with an incident record.

## Controlled production purchase

- [ ] Confirm legal, support, monitoring, backup, migration, Stripe, Supabase, deployment, and audit gates above are complete.
- [ ] Confirm the controlled purchase/refund is operationally and legally approved.
- [ ] Temporarily set `OPENINGFIT_SUBSCRIPTIONS_ENABLED=true` for the owned launch account path.
- [ ] Use an owned production account with no lifetime entitlement.
- [ ] Complete one real monthly payment.
- [ ] Verify the Stripe receipt arrives with the correct amount and recurring terms.
- [ ] Verify exactly one `premium_entitlements` row exists for the user.
- [ ] Verify the signed webhook has a processed ledger entry.
- [ ] Verify Plus access survives page refresh.
- [ ] Verify Plus access restores in a second browser/device without Checkout query parameters.
- [ ] Open Customer Portal and cancel at period end.
- [ ] Verify the account shows cancellation while retaining access through the paid period.
- [ ] If approved, issue a refund and verify webhook, entitlement, referral, and support handling.
- [ ] Re-run the read-only webhook audit and investigate any finding.

## Enabling checkout

- [ ] Confirm the monitoring owner is actively watching backend 5xx, checkout failures, webhook failures, Stripe delivery failures, entitlement delays, Supabase failures, and stuck ledger rows.
- [ ] Confirm Terms, Privacy, recurring billing, cancellation, refund wording, and statutory-rights review are approved.
- [ ] Confirm the configured support mailbox is monitored for payment, access, refund, and deletion requests.
- [ ] Set `OPENINGFIT_SUBSCRIPTIONS_ENABLED=true` in production.
- [ ] Verify `/api/billing/config` marks configured monthly and annual checkout available without returning Price IDs.
- [ ] Verify signed-out checkout is blocked, free authenticated checkout opens Stripe, and paid/lifetime users are not prompted to repurchase.
- [ ] Verify every public checkout entry point and pricing interval.
- [ ] Monitor initial transactions and webhook deliveries continuously for the agreed launch window.

## Rollback

- [ ] Set `OPENINGFIT_SUBSCRIPTIONS_ENABLED=false` to stop only new Checkout sessions.
- [ ] Keep webhook processing active so Stripe retries and existing lifecycle updates are not lost.
- [ ] Keep Customer Portal available to existing Stripe subscribers.
- [ ] Retain all existing subscription entitlements and paid-period access.
- [ ] Preserve all grandfathered lifetime access.
- [ ] Disable the founding offer independently if the incident is promotion-specific.
- [ ] Redeploy the last known-good frontend or backend when required.
- [ ] Reconcile Stripe subscriptions, invoices, `premium_entitlements`, and `stripe_webhook_events` using safe references.
- [ ] Replay failed Stripe events only after the handler is safe; idempotency protects already completed events.
- [ ] Use a reviewed forward migration or verified PITR plan for database recovery; never drop entitlement or ledger data during an incident.
- [ ] Restore access through the guarded service-role process only with an incident record.
- [ ] Refund and communicate with affected customers where required by the approved policy.
- [ ] Complete an incident review before re-enabling checkout.
