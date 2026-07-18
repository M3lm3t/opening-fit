# OpeningFit subscription QA

Use Stripe test mode and a disposable Supabase project or test users. Never place secret keys, webhook secrets, customer IDs, or access tokens in this file or in committed fixtures.

## Automated checks

Run from the repository root:

```powershell
cd backend
python -m pytest -q tests/test_subscription_qa.py tests/test_premium_entitlements.py tests/test_billing_configuration.py tests/test_feature_entitlements.py

cd ../frontend
node --test --test-name-pattern="subscription|checkout|lifetime|entitlement|refresh|device|webhook" src/lib/*.test.js src/services/*.test.js
```

Run the complete relevant suites before release:

```powershell
cd backend
python -m pytest -q

cd ../frontend
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

The automated coverage uses fakes only. It never calls Stripe or Supabase and needs no secrets.

Coverage mapping: cases 1–2 validate server-selected prices; 3 validates paid-session and subscription activation; 4–5 validate restoration from persisted entitlement rows; 6 validates idempotent event-ledger handling; 7–8 validate invoice lifecycle mapping; 9–11 validate cancellation, expiry, and lifetime precedence; 12 validates user-scoped customer lookup; 13–14 validate authenticated ownership; 15 validates missing metadata; 16–17 validate order-independent access resolution; 18–19 validate that temporary dependency failures do not become false success; and 20 validates the legacy lifetime backfill contract. Stripe-hosted pages, real signatures, delivery timing, and actual database persistence remain manual test-mode checks below.

## Stripe CLI setup

Install and authenticate the Stripe CLI, select the OpeningFit test-mode account, then forward signed webhooks:

```powershell
stripe login
stripe listen --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_failed --forward-to http://localhost:8000/api/stripe/webhook
```

Copy the temporary `whsec_...` value printed by `stripe listen` into the backend process environment as `STRIPE_WEBHOOK_SECRET`. Do not commit it. The backend also needs test-mode values for `STRIPE_SECRET_KEY`, the monthly Price ID, the annual Price ID, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.

Useful test event commands:

```powershell
stripe trigger invoice.paid
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

Generated trigger fixtures usually do not contain an OpeningFit test user's protected metadata. Use a real checkout started from the local pricing page for linked-user activation tests. To verify duplicate delivery against a registered test webhook endpoint:

```powershell
stripe events list --limit 5
stripe events resend evt_REPLACE_ME --webhook-endpoint we_REPLACE_ME
stripe events resend evt_REPLACE_ME --webhook-endpoint we_REPLACE_ME
```

Use placeholders above; do not paste identifiers into source control.

## Manual release checklist

| # | Scenario | Procedure and expected result | Stripe test mode |
|---|---|---|---|
| 1 | Free → monthly | Sign in as a free test user, select monthly, start checkout. Stripe shows the configured monthly recurring Price. | Required |
| 2 | Free → annual | Repeat with annual. Stripe shows the annual recurring Price and only applies the configured founding coupon when enabled. | Required |
| 3 | Successful activation | Complete checkout with Stripe test card `4242 4242 4242 4242`, any future expiry and any CVC. Account gains Plus without a second purchase prompt. | Required |
| 4 | Refresh preserves access | Refresh `/account`, `/report`, and `/train`. Plus access and protected data remain available. | Required |
| 5 | Other-device restore | In a separate browser profile, sign in as the same Supabase user. Access restores from the server; no checkout session query parameter is needed. | Required |
| 6 | Duplicate webhook | Resend the same event ID twice. One ledger row and one entitlement row remain; the replay is marked duplicate/ignored. | Required |
| 7 | Invoice renewal | Send or produce `invoice.paid`. Entitlement stays active and the new period end is stored. | Required |
| 8 | Payment failure | Use `invoice.payment_failed` or a failing test payment method. Status becomes `past_due`; already-paid access is retained only through its stored period end. | Required |
| 9 | Cancel at period end | Open the Stripe portal and cancel. UI shows cancellation while access remains until the displayed period end. | Required |
| 10 | Expiry | Advance a Stripe test clock or update the test fixture beyond period end. Refreshing entitlement removes Plus features but keeps the useful free report. | Required |
| 11 | Lifetime protection | Use a grandfathered lifetime test user, then deliver subscription cancellation/failure events associated with that user. Lifetime access remains active. | Required for webhook interaction; automated guard also exists |
| 12 | Own portal | As a subscription user, open account management. The returned HTTPS Stripe portal belongs to that user's stored customer. | Required |
| 13 | Cross-user portal | While signed in as user A, attempt a request containing user B's ID. Expect HTTP 403 and no portal URL/customer disclosure. | Optional external confirmation; automated auth check exists |
| 14 | Signed-out protection | Call checkout sync, checkout creation, portal creation, and account profile endpoints without a bearer token. Expect 401/controlled auth errors and no writes. | Not required |
| 15 | Missing metadata | Trigger an unlinked checkout/subscription fixture. It is ignored or safely unmatched; no user receives access. Review diagnostics for identifiers only, never secrets. | Required |
| 16 | Webhook before return | Complete Checkout but pause before following the success redirect. Confirm the webhook grants access, then continue to the app; the return remains idempotent. | Required |
| 17 | Return before webhook | Temporarily stop forwarding, complete Checkout and return. The signed-in checkout-sync path restores access; forwarding the later webhook leaves one entitlement. | Required |
| 18 | Supabase interruption | Point only a local QA process at a stopped/disposable Supabase service or temporarily block it. Checkout/webhook reports a retryable failure and never claims a successful write. Restore service and resend the same event. | Required for full recovery test |
| 19 | Stripe interruption | Temporarily stop Stripe CLI forwarding or use a mocked/unavailable Stripe endpoint locally. UI shows a retry-safe error without exposing configuration. Resume and retry once. | Required for real delivery recovery |
| 20 | Legacy premium | Use a database snapshot containing `profiles.is_premium=true` without a canonical row, apply migrations, and confirm one grandfathered lifetime entitlement is created and remains active. | Not required |

For cases 10 and longer renewal timelines, Stripe test clocks are preferred. Create and advance clocks through the Stripe test-mode Dashboard so the customer, subscription and invoices are attached to the same clock.

## Data checks

After lifecycle actions, inspect only the disposable test project:

- `premium_entitlements`: one row per `user_id`, correct access type/status, customer/subscription IDs, period end and last event ID.
- `stripe_webhook_events`: one row per Stripe event ID with `processed`, `ignored`, or retryable `failed` status.
- `profiles`: `is_premium` mirrors current access for subscriptions but never downgrades a protected lifetime member.
- Browser network panel: protected requests carry a Supabase bearer token and never send Stripe secret material.

## Remaining risks

- Unit tests cannot prove Stripe signature delivery, Dashboard portal configuration, Price/Coupon ownership, real event ordering, or Stripe retry timing.
- Local tests cannot prove production Supabase RLS, service-role configuration, migration order, regional outage behaviour, or connection-pool limits.
- Stripe test mode does not reproduce every bank authentication, tax, currency conversion, dispute, chargeback, or live-card failure path.
- Multi-tab races and webhook/checkout-sync concurrency still need observation against the deployed test stack.
- Test clocks and CLI fixtures can differ from organically generated subscription payloads; complete at least one monthly and annual Checkout through the real test-mode UI.
- Monitoring and operator alerting for repeatedly failed webhook ledger rows remain operational checks, not assertions in this suite.
