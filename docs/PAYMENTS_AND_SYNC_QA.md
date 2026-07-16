# OpeningFit Payments And Sync QA

Use this checklist before shipping changes to auth, Supabase persistence, Stripe checkout, webhooks, or premium gating.

## Required Environment Variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID` or the relevant Stripe price IDs for each plan
- `FRONTEND_URL` / `SITE_URL`
- `BACKEND_URL` if the checkout or webhook flow uses a backend service

## Manual QA Checklist

### 1. New User Signs Up

1. Open OpeningFit in a clean browser profile or incognito window.
2. Create a new account with an email/password or supported OAuth provider.
3. Confirm the app shows the user as logged in and does not remain in a loading state.
4. In Supabase, confirm a row exists for the new user in `auth.users`.
5. Confirm `public.profiles.user_id` matches the new `auth.users.id`.
6. Confirm initial settings or account rows, if created, also use `user_id = auth.users.id`.

### 2. User Imports/Analyzes Games

1. While logged in, enter a Chess.com or Lichess username.
2. Run an import/analysis using a normal free-user range.
3. Confirm the report renders successfully.
4. Confirm the analyzed account username and platform are shown as report metadata, not used as the authenticated user identity.

### 3. User Saves Analysis

1. Save the analysis or trigger the normal auto-save flow.
2. Confirm Supabase writes succeed without RLS errors.
3. Confirm `openingfit_user_state.user_id`, `report_history.user_id`, and `analysed_games.user_id` equal the logged-in `auth.users.id`.
4. Confirm `report_history.report_key` dedupes repeated saves for the same user/report instead of creating conflicting duplicates.
5. Confirm `analysed_games` dedupes by `user_id`, `platform`, `username`, and `game_id`.

### 4. User Logs Out And Logs Back In

1. Sign out from the account menu.
2. Confirm local account-specific state is cleared or no longer shown for the signed-out session.
3. Sign back in with the same account.
4. Confirm the app does not show another user account's profile, reports, games, settings, or premium state.

### 5. Saved Data Appears Again

1. After login completes, confirm the previous username and platform restore.
2. Confirm the latest saved report appears again.
3. Confirm saved analyses/history appears in account or report history views.
4. Confirm saved games or training history appears where the app exposes it.
5. Confirm settings such as theme, notification preferences, and persisted workspace preferences restore.
6. Confirm the sync status shows success, or a clear warning if any non-critical cloud load failed.

### 6. User Clicks Upgrade/Pay

1. Use a logged-in free account.
2. Open the Premium/Founder Pass upgrade flow.
3. Click the upgrade or checkout button.
4. Confirm the app prevents checkout if the user is logged out, or routes them to login first.
5. Confirm the checkout request includes the authenticated user identifier expected by the backend or Stripe metadata.

### 7. Stripe Checkout Opens

1. Confirm Stripe Checkout opens in test mode.
2. Confirm the checkout page shows the correct product, price, currency, and billing mode.
3. Confirm success and cancel URLs point back to the configured `FRONTEND_URL` / `SITE_URL`.
4. Confirm no service role key or Stripe secret key appears in browser-visible code, network responses, or logs.

### 8. Test Card Payment Succeeds

1. Complete checkout with Stripe test card `4242 4242 4242 4242`.
2. Use any valid future expiry date, CVC, and postal code.
3. Confirm Stripe marks the payment/subscription successful.
4. Confirm the app returns to the success URL and shows a payment success or restore notice.

### 9. Stripe Webhook Updates Supabase

1. Confirm the webhook endpoint receives the Stripe event.
2. Confirm webhook signature verification uses `STRIPE_WEBHOOK_SECRET`.
3. Confirm trusted server code uses `SUPABASE_SERVICE_ROLE_KEY`, not the anon key, for entitlement writes.
4. Confirm `public.premium_entitlements.user_id` is set to the matching `auth.users.id`.
5. Confirm Stripe identifiers such as customer, checkout session, payment intent, subscription, and price IDs are stored when available.
6. Confirm webhook retries are idempotent and do not create duplicate conflicting entitlement records.

### 10. Premium Status Appears In App

1. Refresh or use restore access after successful payment.
2. Confirm `premium_entitlements.status = active`.
3. Confirm the app shows Founder/Premium access for the logged-in account.
4. Confirm premium-gated controls unlock only for that account.
5. Log out and log in again, then confirm premium status still restores from Supabase.

### 11. Subscription Cancellation/Downgrade Updates App

1. Cancel or downgrade the subscription in Stripe test mode.
2. Confirm the webhook receives the cancellation, deletion, or subscription update event.
3. Confirm Supabase updates the entitlement status or expiration fields.
4. Refresh the app or restore cloud data.
5. Confirm the app removes premium access when the entitlement is inactive or expired.
6. Confirm historical reports remain visible according to product rules, but premium-only actions are gated again.

### 12. Failed Payment Does Not Mark User Premium

1. Start checkout with a logged-in free account.
2. Use a Stripe test card that fails, such as `4000 0000 0000 0002`.
3. Confirm Stripe records the failed payment.
4. Confirm the webhook does not create an active premium entitlement.
5. Confirm `profiles.is_premium` is not set by client-side code.
6. Confirm the app remains on Free access and shows a clear payment failure or retry path.

### 13. Supabase Temporarily Unavailable

1. Simulate Supabase REST/auth unavailability, a network failure, or an RLS error in a test environment.
2. Load the app while signed in or with a saved local report.
3. Confirm the app exits cloud restore loading and remains usable with local/default data.
4. Confirm a visible sync warning appears with retry/restore affordance.
5. Confirm the app does not enter an infinite loading screen.
6. Restore Supabase availability.
7. Retry cloud restore and confirm profile, reports, games/history, settings, and premium status load again.

### 14. Referral Checkout and Refunds

Referral payments reuse the existing backend configuration; no referral-specific secret is required:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`, `STRIPE_PREMIUM_PRICE_ID`, or `STRIPE_FOUNDER_PASS_PRICE_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FRONTEND_URL`, `SITE_URL`, or `CLIENT_URL` for checkout return URLs

Apply `supabase/migrations/202607120001_referral_system.sql` before testing. Configure the existing Stripe webhook endpoint to deliver `checkout.session.completed` and the already handled `charge.refunded` / `refund.updated` events. Then verify:

1. A registered referral adds only server-resolved attribution metadata to Checkout.
2. Premium activates before the attribution changes to `converted`.
3. Replaying the checkout webhook leaves the original commission unchanged.
4. Fixed and percentage commission values are calculated from the database partner row and capped at the gross payment.
5. A successful refund changes the attribution to `refunded` while preserving gross and commission audit values.
6. Referral lookup/update failures are logged but do not roll back premium activation.
7. More than 500 anonymous visit writes for one partner in ten minutes are rejected, while existing visitors remain deduplicated for 24 hours.
8. Referral visit rows contain no user-agent string or IP address.

### 15. Referral Admin Access

The private `/admin/referrals` route is not linked from application navigation. Its backend endpoints fail closed unless at least one server-only allow-list is configured:

- `OPENINGFIT_ADMIN_USER_IDS`: comma-separated Supabase Auth user UUIDs.
- `OPENINGFIT_ADMIN_EMAILS`: comma-separated authenticated email addresses.

Prefer immutable user IDs where possible. These variables belong on the backend only and must not use a `VITE_` prefix. Every referral-admin request still requires a valid Supabase bearer session, and the server verifies the session against the allow-list before using the existing `SUPABASE_SERVICE_ROLE_KEY` client.

CSV exports use the same date, partner, and status filters currently applied to the dashboard.
