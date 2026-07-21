param(
  [string]$PostgresImage = "postgres:17"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$container = "openingfit-reconciliation-$PID"
$password = "openingfit-local-reconciliation-only"

function Invoke-ContainerSql {
  param(
    [Parameter(Mandatory = $true)][string]$Database,
    [Parameter(Mandatory = $true)][string]$RelativePath
  )
  $containerPath = "/workspace/" + ($RelativePath -replace "\\", "/")
  & docker exec -e "PGPASSWORD=$password" $container psql -v ON_ERROR_STOP=1 -U postgres -d $Database -f $containerPath
  if ($LASTEXITCODE -ne 0) {
    throw "SQL execution failed: $Database / $RelativePath"
  }
}

function New-FixtureDatabase {
  param([Parameter(Mandatory = $true)][string]$Database)
  & docker exec -e "PGPASSWORD=$password" $container dropdb --if-exists -U postgres $Database
  if ($LASTEXITCODE -ne 0) { throw "Could not drop disposable database $Database" }
  & docker exec -e "PGPASSWORD=$password" $container createdb -U postgres $Database
  if ($LASTEXITCODE -ne 0) { throw "Could not create disposable database $Database" }
  Invoke-ContainerSql $Database "supabase/tests/production_reconciliation_legacy_fixture.sql"
}

function Assert-SqlFailure {
  param(
    [Parameter(Mandatory = $true)][string]$Database,
    [Parameter(Mandatory = $true)][string]$RelativePath,
    [Parameter(Mandatory = $true)][string]$ExpectedText
  )
  $containerPath = "/workspace/" + ($RelativePath -replace "\\", "/")
  $previousErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $output = & docker exec -e "PGPASSWORD=$password" $container psql -v ON_ERROR_STOP=1 -U postgres -d $Database -f $containerPath 2>&1
  $exitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorPreference
  if ($exitCode -eq 0) {
    throw "Expected SQL failure but command succeeded: $Database / $RelativePath"
  }
  $renderedOutput = $output -join [Environment]::NewLine
  if ($renderedOutput -notmatch [regex]::Escape($ExpectedText)) {
    throw "SQL failed for an unexpected reason: $Database / $RelativePath $renderedOutput"
  }
  Write-Host "PASS expected failure: $ExpectedText"
}

function Invoke-Validator {
  param(
    [Parameter(Mandatory = $true)][string]$Database,
    [Parameter(Mandatory = $true)][ValidateSet("baseline", "foundation", "entitlement", "final")][string]$Mode,
    [Parameter(Mandatory = $true)][ValidateSet("PASS", "FAIL")][string]$ExpectedStatus,
    [switch]$RequireExpectedNotYetPresent
  )
  $validatorPath = "/workspace/scripts/validate_production_subscription_schema.sql"
  $summaryName = $Mode.ToUpperInvariant() + "_VALIDATION_" + $ExpectedStatus
  $output = & docker exec -e "PGPASSWORD=$password" $container psql `
    -v ON_ERROR_STOP=1 -A -t -F "|" -U postgres -d $Database `
    -c "set openingfit.validation_mode = '$Mode'; set client_min_messages = warning" -f $validatorPath 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Validator crashed: $Database / $Mode $($output -join [Environment]::NewLine)"
  }
  $renderedOutput = $output -join [Environment]::NewLine
  if ($renderedOutput -notmatch [regex]::Escape("$Mode|$summaryName|$ExpectedStatus|")) {
    throw "Validator returned the wrong summary: $Database / $Mode / expected $summaryName $renderedOutput"
  }
  if ($RequireExpectedNotYetPresent -and $renderedOutput -notmatch "EXPECTED_NOT_YET_PRESENT") {
    throw "Validator did not report expected later objects: $Database / $Mode"
  }
  if ($renderedOutput -match "SQLSTATE 42703|column .* does not exist") {
    throw "Validator referenced an expected-later column statically: $Database / $Mode"
  }
  Write-Host "PASS validator $Mode -> $summaryName"
}

try {
  Write-Host "Starting isolated local Postgres container $container"
  & docker run --name $container -e "POSTGRES_PASSWORD=$password" -e "POSTGRES_DB=postgres" -v "$($repoRoot):/workspace:ro" -d $PostgresImage
  if ($LASTEXITCODE -ne 0) { throw "Could not start local Postgres container" }

  $ready = $false
  for ($attempt = 1; $attempt -le 45; $attempt++) {
    & docker exec -e "PGPASSWORD=$password" $container pg_isready -U postgres -d postgres *> $null
    if ($LASTEXITCODE -eq 0) {
      $ready = $true
      break
    }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw "Local Postgres did not become ready" }

  New-FixtureDatabase "openingfit_clean"
  Invoke-ContainerSql "openingfit_clean" "scripts/preview_production_reconciliation_impact.sql"
  Invoke-ContainerSql "openingfit_clean" "supabase/migrations/202607200001_production_schema_reconciliation_foundation.sql"
  Invoke-ContainerSql "openingfit_clean" "supabase/migrations/202607200002_production_entitlement_preservation.sql"
  Invoke-ContainerSql "openingfit_clean" "supabase/migrations/202607200003_production_coaching_and_entitlement_enforcement.sql"

  # Whole-transaction retries must be safe.
  Invoke-ContainerSql "openingfit_clean" "supabase/migrations/202607200001_production_schema_reconciliation_foundation.sql"
  Invoke-ContainerSql "openingfit_clean" "supabase/migrations/202607200002_production_entitlement_preservation.sql"
  Invoke-ContainerSql "openingfit_clean" "supabase/migrations/202607200003_production_coaching_and_entitlement_enforcement.sql"

  Invoke-ContainerSql "openingfit_clean" "supabase/tests/production_reconciliation_assertions.sql"
  Invoke-Validator "openingfit_clean" "final" "PASS"
  Invoke-ContainerSql "openingfit_clean" "scripts/preview_production_reconciliation_impact.sql"
  Write-Host "PASS clean upgrade, retry, preservation, authorization, and resolver tests"

  # Exercise the exact audited production phase sequence. This fixture removes
  # reconciliation-only columns before baseline validation.
  New-FixtureDatabase "openingfit_validator_sequence"
  Invoke-ContainerSql "openingfit_validator_sequence" "supabase/tests/production_reconciliation_validator_baseline_fixture.sql"
  Invoke-ContainerSql "openingfit_validator_sequence" "scripts/preview_production_reconciliation_impact.sql"
  Invoke-Validator "openingfit_validator_sequence" "baseline" "PASS" -RequireExpectedNotYetPresent
  Invoke-ContainerSql "openingfit_validator_sequence" "supabase/migrations/202607200001_production_schema_reconciliation_foundation.sql"
  Invoke-Validator "openingfit_validator_sequence" "foundation" "PASS" -RequireExpectedNotYetPresent
  Invoke-ContainerSql "openingfit_validator_sequence" "supabase/migrations/202607200002_production_entitlement_preservation.sql"
  Invoke-Validator "openingfit_validator_sequence" "entitlement" "PASS" -RequireExpectedNotYetPresent
  Invoke-ContainerSql "openingfit_validator_sequence" "supabase/migrations/202607200003_production_coaching_and_entitlement_enforcement.sql"
  Invoke-Validator "openingfit_validator_sequence" "final" "PASS"
  Write-Host "PASS phase-aware validator sequence"

  foreach ($missingObjectCase in @(
    @{ Name = "baseline"; Mode = "baseline"; Through = 0; File = "validator_failure_missing_baseline_object.sql" },
    @{ Name = "foundation"; Mode = "foundation"; Through = 1; File = "validator_failure_missing_foundation_object.sql" },
    @{ Name = "entitlement"; Mode = "entitlement"; Through = 2; File = "validator_failure_missing_entitlement_object.sql" },
    @{ Name = "final"; Mode = "final"; Through = 3; File = "validator_failure_missing_final_object.sql" }
  )) {
    $database = "openingfit_validator_missing_" + $missingObjectCase.Name
    New-FixtureDatabase $database
    Invoke-ContainerSql $database "supabase/tests/production_reconciliation_validator_baseline_fixture.sql"
    if ($missingObjectCase.Through -ge 1) {
      Invoke-ContainerSql $database "supabase/migrations/202607200001_production_schema_reconciliation_foundation.sql"
    }
    if ($missingObjectCase.Through -ge 2) {
      Invoke-ContainerSql $database "supabase/migrations/202607200002_production_entitlement_preservation.sql"
    }
    if ($missingObjectCase.Through -ge 3) {
      Invoke-ContainerSql $database "supabase/migrations/202607200003_production_coaching_and_entitlement_enforcement.sql"
    }
    Invoke-ContainerSql $database ("supabase/tests/" + $missingObjectCase.File)
    Invoke-Validator $database $missingObjectCase.Mode "FAIL"
  }

  foreach ($dataViolation in @(
    @{ Name = "duplicate"; File = "validator_failure_duplicate_entitlement.sql" },
    @{ Name = "ambiguous"; File = "validator_failure_ambiguous_entitlement.sql" }
  )) {
    $database = "openingfit_validator_" + $dataViolation.Name
    New-FixtureDatabase $database
    Invoke-ContainerSql $database "supabase/tests/production_reconciliation_validator_baseline_fixture.sql"
    Invoke-ContainerSql $database ("supabase/tests/" + $dataViolation.File)
    Invoke-Validator $database "baseline" "FAIL"
  }
  Write-Host "PASS validator missing-object, duplicate, and ambiguity failures"

  New-FixtureDatabase "openingfit_duplicate_profiles"
  Invoke-ContainerSql "openingfit_duplicate_profiles" "supabase/tests/failure_foundation_duplicate_user_profiles.sql"
  Assert-SqlFailure "openingfit_duplicate_profiles" "supabase/migrations/202607200001_production_schema_reconciliation_foundation.sql" "public.user_profiles contains duplicate user_id values"

  New-FixtureDatabase "openingfit_duplicate_owners"
  Invoke-ContainerSql "openingfit_duplicate_owners" "supabase/migrations/202607200001_production_schema_reconciliation_foundation.sql"
  Invoke-ContainerSql "openingfit_duplicate_owners" "supabase/tests/failure_entitlement_duplicate_owner.sql"
  Assert-SqlFailure "openingfit_duplicate_owners" "supabase/migrations/202607200002_production_entitlement_preservation.sql" "duplicate entitlement owners"

  New-FixtureDatabase "openingfit_duplicate_subscriptions"
  Invoke-ContainerSql "openingfit_duplicate_subscriptions" "supabase/migrations/202607200001_production_schema_reconciliation_foundation.sql"
  Invoke-ContainerSql "openingfit_duplicate_subscriptions" "supabase/tests/failure_entitlement_duplicate_subscription.sql"
  Assert-SqlFailure "openingfit_duplicate_subscriptions" "supabase/migrations/202607200002_production_entitlement_preservation.sql" "duplicate Stripe subscription IDs"

  New-FixtureDatabase "openingfit_missing_entitlement"
  Invoke-ContainerSql "openingfit_missing_entitlement" "supabase/tests/failure_entitlement_missing_qualifying.sql"
  Invoke-ContainerSql "openingfit_missing_entitlement" "supabase/migrations/202607200001_production_schema_reconciliation_foundation.sql"
  Assert-SqlFailure "openingfit_missing_entitlement" "supabase/migrations/202607200002_production_entitlement_preservation.sql" "premium profile lacks qualifying paid access"

  $ambiguityFixtures = @(
    @{ Name = "payment_period"; File = "failure_entitlement_payment_period.sql"; Error = "ambiguous entitlement lifecycle evidence" },
    @{ Name = "payment_interval"; File = "failure_entitlement_payment_interval.sql"; Error = "ambiguous entitlement lifecycle evidence" },
    @{ Name = "payment_status"; File = "failure_entitlement_payment_stripe_status.sql"; Error = "ambiguous entitlement lifecycle evidence" },
    @{ Name = "lifetime_subscription"; File = "failure_entitlement_lifetime_subscription.sql"; Error = "contradictory lifetime and subscription evidence" },
    @{ Name = "lifetime_interval"; File = "failure_entitlement_lifetime_interval.sql"; Error = "contradictory lifetime and subscription evidence" },
    @{ Name = "source_only"; File = "failure_entitlement_source_only.sql"; Error = "ambiguous entitlement lifecycle evidence" },
    @{ Name = "price_only"; File = "failure_entitlement_price_only.sql"; Error = "ambiguous entitlement lifecycle evidence" },
    @{ Name = "customer_only"; File = "failure_entitlement_customer_only.sql"; Error = "ambiguous entitlement lifecycle evidence" },
    @{ Name = "unclassified"; File = "failure_entitlement_unclassified.sql"; Error = "unclassified entitlement rows remain" }
  )
  foreach ($fixture in $ambiguityFixtures) {
    $database = "openingfit_" + $fixture.Name
    New-FixtureDatabase $database
    Invoke-ContainerSql $database "supabase/migrations/202607200001_production_schema_reconciliation_foundation.sql"
    Invoke-ContainerSql $database ("supabase/tests/" + $fixture.File)
    Assert-SqlFailure $database "supabase/migrations/202607200002_production_entitlement_preservation.sql" $fixture.Error
    Invoke-ContainerSql $database "supabase/tests/production_reconciliation_failure_rollback_assertions.sql"
  }

  foreach ($fixture in @(
    @{ Name = "manual_subscription"; File = "failure_manual_grant_active_subscription.sql"; Error = "existing subscription entitlement" },
    @{ Name = "manual_ambiguous"; File = "failure_manual_grant_ambiguous.sql"; Error = "ambiguous existing entitlement" }
  )) {
    $database = "openingfit_" + $fixture.Name
    New-FixtureDatabase $database
    Invoke-ContainerSql $database "supabase/migrations/202607200001_production_schema_reconciliation_foundation.sql"
    Invoke-ContainerSql $database "supabase/migrations/202607200002_production_entitlement_preservation.sql"
    Invoke-ContainerSql $database "supabase/migrations/202607200003_production_coaching_and_entitlement_enforcement.sql"
    Assert-SqlFailure $database ("supabase/tests/" + $fixture.File) $fixture.Error
    if ($fixture.Name -eq "manual_ambiguous") {
      Invoke-ContainerSql $database "supabase/tests/manual_grant_failure_rollback_assertions.sql"
    }
  }

  Write-Host "All local production reconciliation tests passed."
}
finally {
  & docker rm -f $container *> $null
}
