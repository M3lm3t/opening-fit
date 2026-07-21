# Production reconciliation execution runbook

This is a forward-only, operator-driven runbook for the three `20260720000*`
reconciliation migrations. It does not authorize execution. **Do not use the
execution section until the SQL review verdict is APPROVED and all identified
SQL defects have been corrected and re-reviewed.** Do not use `db push` or
`migration repair`; production migration history is intentionally handled as a
separate change after schema and data verification.

## Before execution

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
4. In the Supabase dashboard, confirm a recoverable backup or PITR timestamp
   immediately before the window. Record the project ref, timestamp, retention,
   and the operator who verified recovery is available.
5. Run the aggregate-only impact preview and save its complete output:

   ```powershell
   npx.cmd supabase db query --linked --file scripts/preview_production_reconciliation_impact.sql
   ```

6. Verify the audited candidates from that output: exactly one conservative
   legacy entitlement candidate; exactly one premium profile without any
   entitlement; zero customer-only, Price-only, source-only, contradictory
   payment/lifetime, unclassified, or otherwise ambiguous rows; and no newly
   observed recurring evidence on either candidate. Stop on any difference.
7. Run and preserve the explicit baseline validator. Reconciliation-only
   objects must be reported as `EXPECTED_NOT_YET_PRESENT`; all required
   baseline checks and the summary must pass:

   ```powershell
   Invoke-OpeningFitReconciliationValidator -Mode baseline
   ```

   The final row must be `BASELINE_VALIDATION_PASS`. Stop on any `FAIL` row.

8. Capture the current schema and migration list without changing history:

   ```powershell
   npx.cmd supabase db dump --linked --schema public --file production-schema-before.sql
   npx.cmd supabase migration list --linked
   ```

   Store the dump outside any publishable artifact if its comments or defaults
   contain sensitive configuration. Do not add it to Git.
9. Record aggregate row counts for `profiles`, `premium_entitlements`,
   `report_history`, `repertoire`, and all production-only tables. Choose a quiet
   deployment window with no administrative data jobs and minimal authenticated
   writes.
10. Start an execution record containing project ref, operator, UTC timestamps,
    commit, hashes, backup/PITR point, every command/query result, validation
    output, and the final decision. A PowerShell transcript is acceptable:

    ```powershell
    Start-Transcript -Path production-reconciliation-transcript.txt
    ```

## Execution

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
- Confirm a service-role profile premium update succeeds in a designated smoke
  account and an authenticated client self-upgrade is rejected. Restore the
  smoke account to its prior value using the service role and record both
  operations.

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
- Exercise a service-role-only test webhook event claim/update and entitlement
  upsert with a synthetic event ID, then verify aggregate success and preserve
  the audit row. Do not use a real customer or alter a real entitlement.

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
   ```

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
