# Production reconciliation execution record

Current release status (2026-08-20): **AWAITING MANUAL EXECUTION — DO NOT PUSH MAIN**.
Owner-confirmed target: `frtjfvhiimgruenqcuon`. Automated Supabase CLI access
was unavailable; use the secret-free procedure in
`docs/retention-release-manual-execution.md`. Do not record credentials or
private query results in this repository template.

Retention bundle attempt: initial precondition failed before any migration
section ran because the superseded bundle incorrectly required optional legacy
table `public.qualified_streak_activities`. Exact production execution timestamp
was not supplied. Superseded bundle SHA-256:
`83B47793E27A53607AB404176CCA8F87BDE5310D9CFB66EBF2BD6FFC59B79F6C`.
Use only the regenerated bundle recorded in the manual execution guide.
Corrected bundle: 35,884 bytes; SHA-256
`116E5E63A84406C6C557099B90C45FF4F9AC489868C93460E88EE02F15999EB5`.

Copy this file to a private operations location. Do not commit the completed
record, schema dumps, dashboard exports, customer identifiers, or secrets.

## Approval and identity

- Production project reference (verify in dashboard and CLI):
- Operator:
- Independent approver / second read-only reviewer:
- SQL review verdict and evidence link: `APPROVED` / `REJECTED`
- Approval UTC timestamp:
- Release branch and commit:
- Supabase CLI version (`npx.cmd supabase --version`):
- Migration 1 SHA-256:
- Migration 2 SHA-256:
- Migration 3 SHA-256:
- Preview SHA-256:
- Validator SHA-256:
- Candidate-query SHA-256:
- Counts-query SHA-256:

## Recovery evidence

- Backup/PITR dashboard page and screenshot/evidence location:
- Last restorable UTC point immediately before execution:
- Retention duration and earliest retained UTC point:
- Named person authorised and able to initiate restoration:
- Written recovery procedure/location:
- Restoration target and estimated recovery time:
- Restore test evidence/date, or explicitly `NOT RESTORE-TESTED`:
- Observation period end UTC (must remain covered by retention):

## Window and concurrency

- Checkout-disabled evidence:
- Quiet-window start/end UTC:
- Administrative jobs paused/confirmed absent by:
- Blocking-activity query result:
- Open/long transaction query result:
- Stripe webhook traffic at start:
- Webhook handling decision (continue / pause with provider retry plan):

## Baseline

- Schema dump path/hash:
- Migration-history output path/hash:
- Impact preview path/hash:
- Baseline validator output path/hash:
- Aggregate-count output path/hash:
- Aggregate counts (paste table):

## Candidate decisions

| Candidate type | Redacted owner ID | Human-approved role | Database evidence | Stripe dashboard review evidence | Decision and approver |
|---|---|---|---|---|---|
| Conservative legacy entitlement | `ofr-v1-9bccdb630af841fe` | Paying customer with intentionally granted lifetime access | No stored recurring/checkout/payment evidence | | |
| Conservative legacy entitlement | `ofr-v1-3e8058d82714f9ee` | Owner-operated test account retaining lifetime premium | No stored recurring/checkout/payment evidence | | |

Expected pre-migration counts are an exact-source cohort of two, two pristine
reviewed candidates, zero canonical reviewed rows, zero exact-source conflicts,
two conservative candidates, zero premium profiles without an entitlement,
zero profile-only backfills, zero ambiguous active non-expiring rows, and zero
unclassified rows. Both rows require an
explicit `APPROVE LIFETIME` decision. New recurring or contradictory evidence
requires `STOP`; unexpected payment evidence requires private human review and
must never cause automatic classification.

## Stage results

| UTC start/end | Stage | File hash rechecked | Expected result | Actual result/evidence | PROCEED/STOP | Approver |
|---|---|---|---|---|---|---|
| | Baseline | | `BASELINE_VALIDATION_PASS` | | | |
| | Migration 1 | | transaction committed | | | |
| | Foundation validation | | `FOUNDATION_VALIDATION_PASS` | | | |
| | Premium guard smoke | | service allowed; self-upgrade rejected | | | |
| | Migration 2 | | transaction committed | | | |
| | Entitlement validation | | `ENTITLEMENT_VALIDATION_PASS` | | | |
| | Ledger/upsert smoke | | assertions pass; one audit row retained | | | |
| | Migration 3 | | transaction committed | | | |
| | Final validation | | `FINAL_VALIDATION_PASS` | | | |
| | Resolver/RLS/paid-feature smoke | | all matrix assertions pass | | | |

## Final reconciliation

- Post-schema dump path/hash:
- Post-migration-history capture path/hash (must remain unchanged):
- Post-count output path/hash:
- Intentionally changed counts by table and reason:
- Confirm two existing entitlements classified as grandfathered lifetime:
- Confirm profile-only entitlement inserts equal zero:
- Retained synthetic webhook event ID (non-customer):
- Confirm exactly one synthetic audit row intentionally retained:
- Unexpected changes (must be none, otherwise STOP):
- Observation results and UTC end:
- History-alignment follow-up ticket/review (separate task; never silently repair):
- Final go/no-go decision, operator, approver, UTC:
