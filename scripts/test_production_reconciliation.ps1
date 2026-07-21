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
  Invoke-ContainerSql "openingfit_clean" "scripts/validate_production_subscription_schema.sql"
  Invoke-ContainerSql "openingfit_clean" "scripts/preview_production_reconciliation_impact.sql"
  Write-Host "PASS clean upgrade, retry, preservation, authorization, and resolver tests"

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
