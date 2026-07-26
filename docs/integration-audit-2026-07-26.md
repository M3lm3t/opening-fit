# OpeningFit integration audit — 2026-07-26

## Outcome

Chess.com and Lichess imports, the shared analysis-job API, Vercel routing, and
the public Supabase client configuration are operational. Production Stripe
configuration is present, but new checkout must remain unavailable until the
linked Supabase schema is reconciled. The application now detects that state
and fails checkout closed instead of accepting a payment it cannot persist
safely.

## Live evidence

- `/api/health` returned 200 from the Render-backed API rewrite.
- Chess.com diagnostics fetched and parsed 490 public games; a real analysis
  completed with 297 analysed games, recommendations, and a coverage score.
- Lichess diagnostics fetched and parsed 49 public games; a real analysis
  completed with all 49 games, recommendations, and a coverage score.
- Deliberately unknown usernames returned distinct, actionable 404 failures for
  Chess.com and Lichess.
- Duplicate analysis requests returned the completed job rather than starting
  competing work.
- `/`, `/login`, `/report`, and `/account` loaded without browser console or
  page errors at a 390×844 viewport. Supabase was configured in the deployed
  browser client and Google sign-in was present on the login/account surfaces.
- Allowed CORS preflight succeeded for `https://www.openingfit.com`; an unknown
  origin was rejected.
- Account profile and portal endpoints rejected unsigned requests. Invalid
  Stripe webhook signatures were rejected.
- Vercel production/preview environments contain encrypted
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` values. Production uses the
  intentional same-origin `/api` rewrite to Render.

## Supabase findings

The linked database is reachable and RLS is enabled on profiles, entitlements,
report history, user state, and repertoire. `premium_entitlements` exposes only
an owner SELECT policy to authenticated clients. A deployed trigger prevents
clients from changing `profiles.is_premium`.

Migration history currently stops at `202606010002`. The production database
does not yet contain:

- `stripe_webhook_events`
- canonical entitlement columns used by current checkout/webhook code
- `initialise_repertoire_from_report(jsonb)`
- `openingfit_has_paid_access()`
- typed weekly-plan and training-outcome tables

The aggregate reconciliation preview found two entitlement rows that remain
unclassified by the current migration predicates and 44 historical reports
that need the later snapshot/schema defaults. No duplicate entitlement owners,
duplicate Stripe subscriptions, or null owners were found.

Do not run `supabase db push`: repository migration history intentionally
differs from production. Follow `docs/production-reconciliation-execution-runbook.md`,
resolve the two ambiguous entitlement rows without exposing their identifiers,
take a recoverable backup, and execute the reviewed reconciliation sequence.

## Stripe findings

The live public configuration reports monthly £4.99 and annual £39.99 pricing,
recurring subscriptions enabled, portal configuration present, and lifetime
member protection. Server code validates authenticated ownership, server-side
Price selection, recurring intervals, checkout-session ownership, webhook
signatures, event idempotency, cancellation/current-period access, and lifetime
precedence.

Before this audit, unsigned checkout and checkout-sync calls accidentally
returned 500 because the error wrapper received `status_code` twice. That is
fixed and tested. Checkout/readiness now also verify the required production
billing schema and return a controlled unavailable state while it is missing.
Existing member portal access remains independent of new-checkout availability.

## Manual gates still required

These cannot be proved without designated test credentials and Stripe account
access:

1. Confirm the live Stripe Price objects charge exactly £4.99 monthly and
   £39.99 annually and belong to the intended product/account.
2. Confirm the live webhook endpoint is registered for every event in
   `docs/subscription-qa.md`.
3. After Supabase reconciliation, complete monthly and annual test-mode
   purchases with disposable users; verify webhook-before-return,
   return-before-webhook, portal cancellation, period-end access, expiry, and
   lifetime-member protection.
4. Exercise Google, password, and email-link authentication with designated QA
   accounts, including refresh and a second browser profile.

The live checkout blocker remains the Supabase reconciliation, not a missing
Stripe price or disabled subscription flag. On 26 July 2026 the safe public
diagnostics reported Stripe, webhook, monthly price and annual price configured,
subscriptions enabled, and `billing_schema=not_ready`. Follow
`docs/production-reconciliation-execution-runbook.md`; do not use a direct
`supabase db push` against the drifted production migration history.

## Automated verification

- Backend: 161 tests passed.
- Frontend: 305 tests passed.
- ESLint passed.
- Production build passed.
- Colour contrast passed across two themes, two viewports, and 13 routes.
- Focused responsive layout checks passed at 320×568, 390×844, 768×1024,
  1366×768, and 1440×900.

The existing production-build advisory for the main JavaScript chunk remains a
performance warning, not an integration failure.
