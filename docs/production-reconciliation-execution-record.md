# Production reconciliation execution record

## Repertoire preferences release — awaiting manual execution

Status (2026-08-21): **AWAITING MANUAL EXECUTION — DO NOT PUSH MAIN**.
Target project: `frtjfvhiimgruenqcuon`.

Pending source migration: `202608170001_user_repertoire_preferences.sql` from
integration commit `aac3c2d635a32571893dee1b06db4ba450290470`.
Pending reviewed bundle: 11,621 bytes; SHA-256
`E941AA34D27FC1CF154326C39C4F2D370FF1D66DBBACE667A212E54387138458`.
Execution must use the migration-specific reviewed SQL Editor bundle documented
in `docs/repertoire-preferences-manual-execution.md`. It must not rerun retention
migrations `202608200001–005`, align migration history, or use `supabase db push`.
Record the final generated bundle size/hash and owner-confirmed precondition,
transaction, metadata, RLS, owner-isolation, and compatibility results here only
after manual execution.

Current release status (2026-08-20): **RETENTION MIGRATIONS MANUALLY APPLIED AND VERIFIED**.
Owner-confirmed production target: `frtjfvhiimgruenqcuon`.

The owner confirmed that corrected bundle SHA-256
`116E5E63A84406C6C557099B90C45FF4F9AC489868C93460E88EE02F15999EB5`
was executed manually. Migrations `202608200001` through `202608200005` ran in
filename order, and every in-transaction postcondition passed. The final
metadata checks independently confirmed the required tables, enabled RLS,
owner-only policies, notification columns and defaults, existing reminder rows
remaining disabled, and all eight expected functions.

Migration history remains intentionally unaligned. Normal `supabase db push`
remains prohibited under `docs/production-schema-reconciliation.md`. No
credentials, user content, or private query output are recorded here.

Retention bundle attempt: initial precondition failed before any migration
section ran because the superseded bundle incorrectly required optional legacy
table `public.qualified_streak_activities`. Exact production execution timestamp
was not supplied. Superseded bundle SHA-256:
`83B47793E27A53607AB404176CCA8F87BDE5310D9CFB66EBF2BD6FFC59B79F6C`.
The failed bundle was not used again. The corrected bundle recorded below is
the successfully executed artifact.
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
