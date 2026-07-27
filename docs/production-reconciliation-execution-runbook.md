# Production reconciliation execution runbook

This is a forward-only, operator-driven runbook for the three `20260720000*`
reconciliation migrations. It does not authorize execution. **Do not use the
execution section until the SQL review verdict is APPROVED and all identified
SQL defects have been corrected and re-reviewed.** Do not use `db push` or
`migration repair`; production migration history is intentionally handled as a
separate change after schema and data verification.

## Scope, approval, and people

Execution requires two people: an operator with production database and backup
authority, and an independent approver who did not prepare the execution batch.
SQL approval evidence means a dated review record containing the exact release
commit, SHA-256 hashes of every migration and operator SQL file, reviewer name,
review outcome, findings disposition, and an explicit statement that migration
2's predicates and validators were not relaxed. After any change to those
files, a second complete **read-only** review is mandatory and invalidates the
old approval.

Before the window, designate two authenticated **non-customer smoke accounts**.
They must be owned by the company, have no Stripe identifiers or real purchases,
and be named in the private execution record. Never use a customer as a smoke
fixture. The operator needs Supabase SQL/CLI access; the backup authority needs
permission to restore or create a recovery project; and the Stripe reviewer
needs read-only Dashboard access. Use
[`production-reconciliation-execution-record.md`](production-reconciliation-execution-record.md)
as the private record template.

## Before execution

The manual decisions that must be recorded before execution are: the exact
production project; CLI versus SQL Editor execution; backup/PITR recovery point
and restoration owner; quiet-window and observation-period duration; whether
webhook receipt continues or is paused with a retry plan; the two non-customer
smoke accounts; an independent `APPROVE LIFETIME` or `STOP` decision for each
redacted candidate; a `PROCEED` or `STOP` after every stage; and the owner/date
for a separate migration-history alignment review. Silence or uncertainty is a
`STOP`, never implicit approval.

The validator requires an explicit phase. Supabase's Management API does not
interpret `psql` meta-commands, so use this helper to prepend the session setting
to the validator in one SQL batch. The generated file is local and temporary;
the validator creates only session-local `pg_temp` objects and performs no
persistent database writes.

```powershell
function Invoke-OpeningFitReconciliationValidator {
  param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('baseline', 'foundation', 'entitlement', 'final')]
    [string]$Mode
  )

  $validatorSql = Get-Content -Raw scripts/validate_production_subscription_schema.sql
  $batchSql = "set openingfit.validation_mode = '$Mode';`r`n$validatorSql"
  $temporarySql = [IO.Path]::GetTempFileName()
  try {
    [IO.File]::WriteAllText(
      $temporarySql,
      $batchSql,
      [Text.UTF8Encoding]::new($false)
    )
    npx.cmd supabase db query --linked --file $temporarySql --output-format json
    if ($LASTEXITCODE -ne 0) {
      throw "The $Mode validator query failed to execute."
    }
  }
  finally {
    Remove-Item -LiteralPath $temporarySql -ErrorAction SilentlyContinue
  }
}
```

1. Record the release commit and immutable file hashes:

   ```powershell
   git rev-parse HEAD
   Get-FileHash -Algorithm SHA256 supabase/migrations/202607200001_production_schema_reconciliation_foundation.sql
   Get-FileHash -Algorithm SHA256 supabase/migrations/202607200002_production_entitlement_preservation.sql
   Get-FileHash -Algorithm SHA256 supabase/migrations/202607200003_production_coaching_and_entitlement_enforcement.sql
   ```

2. Commit the reviewed migration, validator, preview, test, and runbook files.
   Confirm `git status --short` is empty and the checked-out commit is the
   approved release commit. Do not execute uncommitted SQL.
3. Confirm the production deployment has
   `OPENINGFIT_SUBSCRIPTIONS_ENABLED=false`. Keep checkout creation disabled for
   the entire change window. Do not disable webhook receipt unless a stop
   condition occurs; queued/retried delivery must be planned if it is paused.
4. In the Supabase dashboard, open the production project and complete this
   backup checklist. A green backup badge alone is insufficient:

   - verify the project reference matches the execution record;
   - verify the latest logical backup succeeded, or PITR is enabled and its
     latest recoverable UTC point is immediately before the window;
   - record the earliest retained point and retention duration;
   - confirm retention covers the complete execution **and observation period**;
   - name the person authorised and available to initiate restoration;
   - record the exact dashboard recovery procedure, restoration target (normally
     a separate recovery project), and expected recovery time;
   - preserve dashboard evidence without customer data; and
   - write `NOT RESTORE-TESTED` unless a dated restore and validation record
     actually exists. Never infer restore testing from backup availability.

   STOP if there is no usable recovery point, authority is unavailable, the
   recovery procedure is unknown, or retention does not cover observation.
5. Run the aggregate-only impact preview and identifier-safe candidate review;
   save both complete outputs:

   ```powershell
   npx.cmd supabase db query --linked --file scripts/preview_production_reconciliation_impact.sql
   npx.cmd supabase db query --linked --file scripts/identify_production_reconciliation_candidates.sql
   ```

6. Verify the audited candidates from that output: exactly one conservative
   legacy entitlement candidate; exactly one premium profile without any
   entitlement; zero customer-only, Price-only, source-only, contradictory
   payment/lifetime, unclassified, or otherwise ambiguous rows; and no newly
   observed recurring evidence on either candidate. The candidate script uses
   exactly migration 2's predicates and emits only a stable `ofr-v1-…` digest.
   It does not emit names, email, UUIDs, or Stripe IDs. Each evidence row must
   show `evidence_type_count=0`, `matching_webhook_rows=0`, and
   `REVIEW_STRIPE_DASHBOARD`. Any `STOP` result stops execution.

   A read-only Stripe reviewer must then search the production Stripe Dashboard
   using the authorised internal account-to-Stripe lookup, without copying
   customer identifiers into the execution record. Review Customers,
   Subscriptions, Checkout Sessions, Payment Intents, Invoices, Charges and
   Events for each candidate. Record only the redacted owner ID, categories
   searched, UTC time, reviewer, and yes/no evidence result. **Any recurring,
   webhook, checkout, price, subscription, invoice, charge, or payment evidence
   means STOP, not automatic lifetime conversion.** If the account cannot be
   conclusively matched in Stripe, STOP. If both reviews find no evidence, the
   operator and approver must separately decide `APPROVE LIFETIME` for each row.
7. Run and preserve the explicit baseline validator. Reconciliation-only
   objects must be reported as `EXPECTED_NOT_YET_PRESENT`; all required
   baseline checks and the summary must pass:

   ```powershell
   Invoke-OpeningFitReconciliationValidator -Mode baseline
   ```

   The final row must be `BASELINE_VALIDATION_PASS`. Stop on any `FAIL` row.

8. Capture the current schema and migration list without changing history:

   ```powershell
   npx.cmd supabase --version
   npx.cmd supabase db dump --linked --schema public --file production-schema-before.sql
   npx.cmd supabase migration list --linked | Tee-Object production-migration-history-before.txt
   Get-FileHash -Algorithm SHA256 production-schema-before.sql
   Get-FileHash -Algorithm SHA256 production-migration-history-before.txt
   ```

   Store the dump outside any publishable artifact if its comments or defaults
   contain sensitive configuration. Do not add it to Git.
9. Record exact aggregate counts and concurrency state:

   ```powershell
   npx.cmd supabase db query --linked --file scripts/capture_production_reconciliation_counts.sql --output-format json | Tee-Object production-counts-before.json
   npx.cmd supabase db query --linked --file scripts/check_production_reconciliation_activity.sql --output-format json | Tee-Object production-activity-before.json
   ```

   Choose a quiet window with checkout disabled, no deployments, imports,
   administrative jobs, bulk report creation, or account repair. Coordinate
   support and release operators. `blocked_session_count` and
   `transactions_older_than_five_minutes` must both be `0`; otherwise STOP and
   investigate without terminating sessions from this runbook. Note ordinary
   webhook traffic and leave receipt running unless an incident decision pauses
   it. If paused, record Stripe's retry window and resume owner; never discard
   queued events. Re-run this gate immediately before every migration.
10. Start an execution record containing project ref, operator, UTC timestamps,
    commit, hashes, backup/PITR point, every command/query result, validation
    output, and the final decision. A PowerShell transcript is acceptable:

    ```powershell
    Start-Transcript -Path production-reconciliation-transcript.txt
    ```

11. Obtain the independent second read-only review against the recorded hashes.
    The approver must compare migration 2's conservative predicate
    predicate-by-predicate with the JSON-safe equivalent in
    `scripts/identify_production_reconciliation_candidates.sql`, confirm the
    expected cardinalities are `1` and `1`, confirm every ambiguity metric is
    `0`, and sign both candidate decisions. No cardinality or validator may be
    weakened to manufacture a pass.

### Running parameterised smoke SQL

The smoke scripts need company-controlled account UUIDs but the committed files
contain no identifiers. For the complete final matrix, generate a temporary
batch locally; do not save or transcribe UUIDs outside the private record:

```powershell
$paidSmoke = Read-Host 'Designated non-customer paid-smoke UUID'
$freeSmoke = Read-Host 'Designated non-customer free-smoke UUID'
$smokeSql = Get-Content -Raw scripts/smoke_production_reconciliation.sql
$smokeBatch = "set openingfit.smoke_paid_user = '$paidSmoke';`r`nset openingfit.smoke_free_user = '$freeSmoke';`r`n$smokeSql"
$smokeFile = [IO.Path]::GetTempFileName()
[IO.File]::WriteAllText($smokeFile, $smokeBatch, [Text.UTF8Encoding]::new($false))
npx.cmd supabase db query --linked --file $smokeFile
Remove-Item -LiteralPath $smokeFile
```

The script first rejects accounts carrying Stripe evidence, snapshots original
profile/entitlement rows and aggregate counts into `pg_temp`, then tests the
profile guard, entitlement upsert, resolver states, report RLS, and paid/free
repertoire, weekly-plan, and training-outcome mutations. Its final `rollback`
is the restoration step: **zero persistent rows must change**. STOP if it errors
or if the session disconnects while transaction state is uncertain; confirm no
open transaction and rerun counts before proceeding.

For the phase-specific foundation or entitlement check, use the same pattern
with one setting and the corresponding file:

```powershell
$freeSmoke = Read-Host 'Designated non-customer free-smoke UUID'
$phaseFile = 'scripts/smoke_production_reconciliation_foundation.sql' # after migration 1
# Change only to scripts/smoke_production_reconciliation_entitlement.sql after migration 2.
$phaseSql = Get-Content -Raw $phaseFile
$phaseBatch = "set openingfit.smoke_free_user = '$freeSmoke';`r`n$phaseSql"
$temporaryFile = [IO.Path]::GetTempFileName()
[IO.File]::WriteAllText($temporaryFile, $phaseBatch, [Text.UTF8Encoding]::new($false))
npx.cmd supabase db query --linked --file $temporaryFile
Remove-Item -LiteralPath $temporaryFile
```

## Execution

### Stage order and required result

There is no skip or automatic-continue path. Record a signed `PROCEED` after
each row before starting the next one.

| Order | Stage/query | Only acceptable result | STOP when |
|---:|---|---|---|
| 1 | Backup/recovery check | usable point, authority, procedure, retention coverage recorded | any item unavailable or unverified |
| 2 | Impact preview | conservative candidate `1`; profile-without-entitlement `1`; every ambiguity/contradiction/unclassified metric `0` | any number differs |
| 3 | Identifier-safe candidates | one redacted row of each type; DB evidence counts `0`; Stripe review finds no evidence; both decisions `APPROVE LIFETIME` | missing/extra row, evidence, uncertain match, or approval absent |
| 4 | Baseline validator | every baseline requirement `PASS`; later objects `EXPECTED_NOT_YET_PRESENT`; summary `BASELINE_VALIDATION_PASS` | any `FAIL`, query error, or other summary |
| 5 | Schema/history/count/activity captures | files hashed; blocked and old transactions both `0`; approved baseline counts | capture missing, target mismatch, blocker, or unexplained count |
| 6 | Migration 1 | command succeeds and its transaction commits | error, timeout, uncertain session, or hash mismatch |
| 7 | Foundation validator/counts | foundation rows `PASS`, later rows `EXPECTED_NOT_YET_PRESENT`, summary `FOUNDATION_VALIDATION_PASS`; protected-table counts unchanged | any other result or count loss |
| 8 | Foundation smoke | service-role change succeeds, authenticated self-upgrade rejects, final `ROLLBACK` | any error or persistent delta |
| 9 | Migration 2 | command succeeds and its transaction commits | error, timeout, uncertain session, or hash mismatch |
| 10 | Entitlement preview/validator | candidates now `0`; ambiguities `0`; two qualifying legacy lifetimes; summary `ENTITLEMENT_VALIDATION_PASS` | any other result |
| 11 | Entitlement smoke | synthetic upsert assertion passes and final `ROLLBACK` | any error or persistent delta |
| 12 | Ledger smoke | exactly one `processed` synthetic row, attempt `1`, processed timestamp present | duplicate ID, wrong transition, or delta other than `+1` ledger row |
| 13 | Migration 3 | command succeeds and its transaction commits | error, timeout, uncertain session, or hash mismatch |
| 14 | Final validator/preview | every final row `PASS`, summary `FINAL_VALIDATION_PASS`, every ambiguity/candidate count `0` | any other result |
| 15 | Full rollback smoke | all resolver/RLS/paid-free assertions pass; final `ROLLBACK`; no persistent delta | any exception, access mismatch, or delta |
| 16 | Post dump/history/counts | history byte-equivalent; only approved schema and recorded row deltas | history change, data loss, or unexplained delta |
| 17 | Observation | no new permission/trigger/webhook failures through recorded end time | regression, retry storm, or recovery coverage expires |

The validator's detailed rows are contractual: an object, column, index,
constraint, trigger, policy, grant, row-floor, entitlement metric, profile
backfill metric, or history metric must have status `PASS` for its current
phase. `EXPECTED_NOT_YET_PRESENT` is allowed only for a later phase. The final
phase permits no `EXPECTED_NOT_YET_PRESENT` rows.

Normal `supabase db push` is unsafe because the linked history does not record
older migrations and would attempt to replay them. The reviewed method is to
execute only the exact three committed files, in order, using `supabase db
query`. Each file contains its own `begin`/`commit`; a failed statement rolls
back that file. This method deliberately does not claim that migration history
has already been repaired.

Before each command, compare its SHA-256 hash with the approved record. Do not
continue automatically after any error.

### Migration 1: foundation

```powershell
npx.cmd supabase db query --linked --file supabase/migrations/202607200001_production_schema_reconciliation_foundation.sql
```

Post-migration-1 validation:

- Re-run the preview and save the output.
- Run `Invoke-OpeningFitReconciliationValidator -Mode foundation`. The final
  row must be `FOUNDATION_VALIDATION_PASS`. This mode requires Stripe
  payment/price/mode columns and indexes, profile guard trigger, retention and
  referral objects, profile uniqueness, and report snapshot columns/defaults.
  Entitlement and final coaching objects remain
  `EXPECTED_NOT_YET_PRESENT` rather than failures.
- Confirm `report_history` row count is unchanged and `contact_messages`,
  `feedback`, and `user_states` still exist with unchanged aggregate counts.
- Run `scripts/smoke_production_reconciliation_foundation.sql` with the
  phase-specific command above. Its exact checks are: service-role
  profile change succeeds and the same authenticated self-upgrade is rejected.
  The original row is captured first and the transaction is rolled back.

### Migration 2: entitlement preservation

```powershell
npx.cmd supabase db query --linked --file supabase/migrations/202607200002_production_entitlement_preservation.sql
```

Post-migration-2 validation:

- Re-run the preview and full validator.
- Run `Invoke-OpeningFitReconciliationValidator -Mode entitlement`. The final
  row must be `ENTITLEMENT_VALIDATION_PASS`; final coaching objects may still
  be `EXPECTED_NOT_YET_PRESENT`.
- Confirm the legacy entitlement and profile-derived entitlement are lifetime,
  active, non-expiring, and grandfathered without printing identifiers.
- Confirm zero null/duplicate owners, zero duplicate Stripe subscription IDs,
  zero ambiguous entitlement rows, and zero premium profiles without a current
  qualifying entitlement.
- Confirm every row with recurring evidence is classified monthly or annual,
  and no such row is lifetime.
- Confirm the pre-update ambiguity gates ran before any classification. The
  reviewed order is: ambiguity assertions, subscription classification,
  explicit payment lifetime, conservative legacy lifetime, profile backfill,
  classification-completeness assertion, normalisation, constraints, triggers.
  No Stripe evidence may be cleared before those gates pass.
- Run `scripts/smoke_production_reconciliation_entitlement.sql` with the
  phase-specific command above. It maps a trusted
  synthetic subscription to the designated account, checks the resulting row,
  and rolls it back. Do not run the complete final-feature section before
  migration 3.
- Retain exactly one non-customer webhook audit row. Pick a unique execution ID
  (for example the first 12 release-commit characters), then create a temporary
  batch so the setting and SQL share one session:

  ```powershell
  $executionId = Read-Host 'Approved lowercase execution ID'
  $ledgerSql = Get-Content -Raw scripts/retain_production_reconciliation_webhook_audit.sql
  $ledgerBatch = "set openingfit.execution_id = '$executionId';`r`n$ledgerSql"
  $ledgerFile = [IO.Path]::GetTempFileName()
  [IO.File]::WriteAllText($ledgerFile, $ledgerBatch, [Text.UTF8Encoding]::new($false))
  npx.cmd supabase db query --linked --file $ledgerFile
  Remove-Item -LiteralPath $ledgerFile
  ```

  Expected result: one row with event type
  `openingfit.reconciliation.smoke`, status `processed`, attempt count `1`, and
  `has_processed_at=true`. This is the sole intentional persistent smoke change
  and must increase the ledger aggregate by exactly one. It exercises the same
  processing-to-processed ledger transition as the backend without contacting
  Stripe. Never delete the audit row.

### Migration 3: coaching and entitlement enforcement

```powershell
npx.cmd supabase db query --linked --file supabase/migrations/202607200003_production_coaching_and_entitlement_enforcement.sql
```

Final validation:

```powershell
Invoke-OpeningFitReconciliationValidator -Mode final
npx.cmd supabase db query --linked --file scripts/preview_production_reconciliation_impact.sql
```

The final row must be `FINAL_VALIDATION_PASS`. Every final-phase validator row
must pass and all duplicate/ambiguous counts must be zero.
Record the before/after row counts. Do not run `migration repair` in this window.

Run the full rollback smoke matrix using the parameterised command above.
Expected results are: service-role profile mutation accepted; authenticated
self-upgrade rejected; synthetic entitlement upsert accepted; lifetime, active
subscription, and canceled-current resolver checks true; expired and free
checks false; free owners read only their own reports but cannot mutate them;
anonymous report access rejected; service role access accepted; paid repertoire,
weekly-plan, and training-outcome writes accepted; equivalent free writes all
rejected. Any raised exception is a STOP. A successful command ends in
`ROLLBACK` and changes no persistent rows.

If the CLI query facility is unavailable, the reviewed alternative is the
Supabase SQL Editor: open the correct production project, create one saved query
per committed migration, paste the complete file without edits, verify it begins
with `begin;` and ends with `commit;`, compare the pasted SHA-256 via an exported
copy, and run queries 1, 2, and 3 separately with the same validation gates.
Record the dashboard project ref, query URL/ID, operator, UTC start/end time, and
complete result or screenshot. Never combine the three files into one query.

## After execution

1. Run `Invoke-OpeningFitReconciliationValidator -Mode final` and the preview
   again and archive their complete output.
2. Capture a fresh schema dump and compare it with the approved reconciliation
   scope:

   ```powershell
   npx.cmd supabase db dump --linked --schema public --file production-schema-after.sql
   npx.cmd supabase migration list --linked | Tee-Object production-migration-history-after.txt
   npx.cmd supabase db query --linked --file scripts/capture_production_reconciliation_counts.sql --output-format json | Tee-Object production-counts-after.json
   ```

   The before/after migration-history files must be identical. Direct SQL
   execution does not insert migration-history rows. Any history difference is
   a STOP and investigation; do not repair it in this window. Counts must match
   except for changes explicitly caused by the reviewed migrations: two legacy
   lifetime classifications, one profile-derived entitlement insertion, typed
   repertoire imports described by the preview, and exactly one retained
   synthetic webhook row. Record exact deltas; any unexplained delta is a STOP.

3. Verify, using aggregate checks, that lifetime access remains active and
   non-expiring, subscription resolver states cover active/trialing,
   canceled-but-current, and expired cases correctly, and free users do not
   receive paid resolver access.
4. Verify the backend service-role JWT can claim and finish a webhook ledger
   event and can perform legitimate entitlement/profile writes. Confirm an
   authenticated/anon client cannot write the ledger or self-upgrade premium.
5. Smoke-test saved report history: a free authenticated owner can read their
   own existing rows but cannot read another owner's rows or mutate history; a
   paid owner can mutate; anonymous reads fail; service-role access succeeds.
   Confirm the current free report remains viewable. Paid-only reads are not part
   of this rollout.
6. With designated smoke accounts, verify authenticated paid repertoire RPCs,
   weekly-plan writes, and training-outcome writes; verify equivalent free-user
   mutations are rejected. Confirm direct repertoire mutation behavior matches
   the client implementation.
7. Run focused backend and frontend smoke tests for login/account restore,
   current report, saved reports, checkout-disabled presentation, account
   portal state, repertoire, and weekly plans.
8. Keep `OPENINGFIT_SUBSCRIPTIONS_ENABLED=false`. Review API, PostgREST,
   PostgreSQL, and Stripe webhook logs for permission errors, trigger errors,
   failed events, elevated latency, and unexpected retries through the agreed
   observation period.
9. Prepare migration-history alignment as a separate reviewed change only after
   the observation period succeeds.

## Stop conditions

Stop immediately and do not run the next migration if:

- the lifetime candidate count differs unexpectedly;
- any customer-only, Price-only, source-only, contradictory, or unclassified
  entitlement count is nonzero;
- a premium profile remains without qualifying access after migration 2;
- any entitlement with subscription/recurring evidence becomes lifetime;
- duplicate entitlement owners or subscription IDs appear;
- a service-role write check fails;
- the `report_history` row count decreases;
- any migration assertion or transaction fails;
- the validator reports a missing or incorrect object, trigger, function,
  constraint, grant, or policy;
- `contact_messages`, `feedback`, or `user_states` is missing or its aggregate
  row count changes unexpectedly;
- an SQL file hash, target project ref, backup status, or execution record cannot
  be verified.

## Rollback and forward-fix process

Never delete entitlement rows, revoke lifetime access, delete report history,
drop populated coaching data, delete webhook audit history, or perform a schema
reset.

### Failure during a migration

Each file is one explicit transaction. A statement/assertion failure rolls back
that file. Save the full error, verify the transaction is no longer open, rerun
read-only counts and the validator, keep checkout disabled, and stop. Do not
retry until the cause and any partial-state concern have been reviewed.

### Migration 1 succeeded, application breaks

Leave additive columns/tables/data in place. Keep checkout disabled. Deploy a
forward migration that restores the last reviewed compatible definition of the
profile premium guard, trigger, policy, or grant causing the failure. Referral
entry points can be disabled at the application/router level while retaining
referral and retention data. Do not drop foundation objects.

### Migration 2 succeeded, application breaks

Preserve all entitlements and lifetime classifications. Keep subscription
checkout disabled and, if necessary, pause webhook processing while retaining
provider retries and every ledger row. Correct resolver/lifetime/stale-event
functions, triggers, constraints, or service grants with a reviewed forward
migration. Never reverse the lifetime backfill or clear audit evidence.

For an exceptional reviewed manual lifetime restoration after migration 2, run
the helper in dry-run mode first and archive its redacted result:

```powershell
npm run grant-premium -- 00000000-0000-4000-8000-000000000123
npm run grant-premium -- 00000000-0000-4000-8000-000000000123 --apply
```

The mutation command calls the service-role-only atomic RPC. It must refuse an
existing monthly/annual subscription or ambiguous entitlement; never work
around that refusal with direct profile edits.

### Migration 3 succeeded, application breaks

Disable coaching/repertoire/weekly-plan UI entry points and keep checkout
disabled. Preserve all imported repertoire, plans, outcomes, reports, and
webhook data. A reviewed forward migration may temporarily relax only the
reconciliation-owned `require_paid_mutation` triggers or replace a paid policy
with its prior owner-only policy. Restore the precise prior behavior—never
broad public access—and retain RLS and owner checks. Fix RPC or paid-resolver
definitions forward, then rerun the complete validator and smoke matrix.

### Migration-history handling

Successful direct execution changes schema/data but does not make the divergent
history safe. Record exactly which files ran. Do not use repair as rollback and
do not mark any version applied until a separate history-alignment proposal has
been reviewed against the post-execution schema dump.

## Responsibility boundary and unresolved limits

Codex can safely perform local-only review, compare committed predicates, hash
files, run the disposable Docker/Postgres fixtures, run static tests, and draft
the private record/template. Codex may also help interpret redacted outputs that
the operator supplies. Those actions neither identify the linked production
project nor authorize a release.

A human operator must use the Supabase Dashboard/approved production CLI to
verify the project, backups/PITR, run read-only preflight queries, inspect
activity, and—only after approval—execute migrations and smoke SQL. A human
with read-only Stripe Dashboard access must perform the candidate evidence
search. A person with restoration authority must confirm recovery. Render's
checkout flag and webhook operational decisions are manual. Migration-history
alignment is a new, separately reviewed task.

This runbook deliberately cannot prove that database-local candidates have no
unlinked Stripe object: the ledger stores object IDs, not owner UUIDs, and a
legacy row may contain no correlatable ID. That is why the manual Stripe review
and STOP-on-uncertainty decision are mandatory. It also cannot guarantee a
restore until one is actually tested, estimate production lock duration from a
fixture, or safely automate terminating blockers. Treat each limitation as a
manual gate, not an assumption.
