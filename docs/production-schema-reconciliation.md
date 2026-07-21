# Production schema reconciliation review

The reconciliation set is intentionally forward-only:

1. `202607200001_production_schema_reconciliation_foundation.sql`
2. `202607200002_production_entitlement_preservation.sql`
3. `202607200003_production_coaching_and_entitlement_enforcement.sql`

The order is mandatory. Foundation objects and prerequisite Stripe columns are
installed first. Canonical entitlements and lifetime preservation are completed
and asserted second. Coaching objects and paid database enforcement are installed
last.

Migration 2 uses a fixed reconciliation order: validate ambiguity before any
data update; classify conclusive subscriptions; classify explicit payment-mode
one-time purchases; classify evidence-free legacy lifetime grants; backfill
premium profiles without entitlements; require every row to have a supported
`access_type`; normalise fields only after classification; add constraints; then
install lifetime/stale-event triggers. Stripe references are never cleared before
the ambiguity checks have succeeded. Customer-only, Price-only, source-only, and
otherwise sparse lifecycle rows stop the transaction for manual review.

Migration 3 intentionally retains authenticated owner-only SELECT access to
`report_history`, including for free owners with existing history. INSERT,
UPDATE, and DELETE remain paid-only through both RLS and the paid-mutation
trigger. Paid-only reads are deferred until a limited-free-history UX and a
documented retention policy exist.

These files must be reviewed and tested before production execution. Applying
them and aligning migration history are separate operational changes.

Do not run `supabase db push` against the current linked repository state. It
would attempt to replay the 15 older unrecorded migration files before reaching
the reconciliation set. A human-reviewed execution and history-alignment
runbook is required first.

## Local verification

Run the disposable PostgreSQL 17 suite from the repository root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test_production_reconciliation.ps1
```

The harness mounts the repository read-only, creates separate databases for the
successful and expected-failure cases, and removes its uniquely named container
on exit. It never reads the linked Supabase project configuration.

## Future migration-history alignment

Do not run migration repair until all three reconciliation migrations have been
applied successfully and the read-only validation script returns the expected
results.

The production audit found that these versions already match production and may
be marked applied after reconciliation verification:

- `202606050001`
- `202606050002`
- `202606070001`

Do not mark these versions applied merely because some objects exist:

- `202606050003`
- `202606110001`
- `202606110002`

The reconciliation set supplies their missing columns, indexes, uniqueness,
comments, and corrected premium guard. Until that has been verified, marking
them applied would hide incomplete schema and function drift.

The reconciliation set also supersedes the missing intended effects of:

- `202606170001`
- `202607120001`
- `202607170001`
- `202607170002`
- `202607170003`
- `202607180001`
- `202607180002`
- `202607180003`
- `202607180004`

After reconciliation and validation, a human operator should prepare an
explicit, reviewed migration-history repair plan that records the reconciliation
versions and prevents the superseded historical files from being replayed.
That plan must document that the versions were reconciled rather than executed
verbatim. This repository change does not perform or authorize that repair.

## Manual review gates

- Confirm the two audited legacy lifetime candidates still satisfy the migration
  predicates immediately before execution.
- Confirm every existing Stripe subscription has a non-null subscription ID or
  an unambiguous `checkout_mode = 'subscription'` marker.
- Review the conservative monthly fallback for subscriptions whose interval was
  not historically stored.
- Confirm backend/webhook requests continue to supply a service-role JWT claim.
- Confirm saved report history remains a paid feature. The reviewed
  rollout gates saved-history mutations but temporarily retains owner reads.
- Review the exact referral RPC grants and the intentional absence of direct
  anon/authenticated referral-table policies.
- Take a recoverable database backup before execution and run
  `scripts/validate_production_subscription_schema.sql` afterward.

## Guarded manual lifetime restoration

The helper accepts an explicit Supabase Auth user UUID and is read-only by
default. It uses only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, prints a
redacted identifier, and calls the service-role-only atomic database function
when `--apply` is supplied:

```powershell
npm run grant-premium -- 00000000-0000-4000-8000-000000000123
npm run grant-premium -- 00000000-0000-4000-8000-000000000123 --apply
```

The first command is the required dry run. The second creates or preserves one
canonical grandfathered lifetime entitlement and updates the legacy profile
flag in the same database transaction. It refuses subscription entitlements,
ambiguous rows, unsupported reasons, missing profiles, and non-service callers.

No production-only table is referenced by any reconciliation mutation.
`contact_messages`, `feedback`, and `user_states` are checked only by the
read-only validator.
