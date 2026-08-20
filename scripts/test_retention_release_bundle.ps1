$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$bundle = Join-Path $repoRoot "release-artifacts/openingfit-retention-production-bundle.sql"
& (Join-Path $PSScriptRoot "prepare_retention_release_bundle.ps1") | Out-Null
$sql = Get-Content -Raw -LiteralPath $bundle

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}

$names = @(
  "202608200001_canonical_coaching_activity.sql",
  "202608200002_save_coaching_response_plan.sql",
  "202608200003_complete_game_check.sql",
  "202608200004_meaningful_consistency.sql",
  "202608200005_weekly_coaching_reviews_and_reminders.sql"
)
Assert-True ([regex]::Matches($sql, '(?m)^-- ===== BEGIN').Count -eq 5) "Expected five migration sections"
Assert-True ([regex]::Matches($sql, '(?m)^commit;$').Count -eq 5) "Expected five migration commits"
Assert-True ([regex]::Matches($sql, '(?m)^do \$verify_00[1-5]\$').Count -eq 5) "Expected five in-transaction postconditions"

$baseline = $sql.Substring(0, $sql.IndexOf("-- ===== BEGIN"))
Assert-True (-not $baseline.Contains("qualified_streak_activities")) "Optional legacy ledger must not be a baseline prerequisite"
Assert-True ($sql.Contains("if to_regclass('public.qualified_streak_activities') is not null")) "Migration 004 must conditionally preserve legacy evidence"
Assert-True (-not $sql.Contains("supabase_migrations.schema_migrations")) "Migration-history alignment must remain excluded"

foreach ($name in $names) {
  $source = Get-Content -Raw -LiteralPath (Join-Path $repoRoot "supabase/migrations/$name")
  Assert-True ($sql.Contains($source.TrimEnd())) "Bundle does not contain exact source migration $name"
}

$tokens = [System.Management.Automation.PSParser]::Tokenize((Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot "prepare_retention_release_bundle.ps1")), [ref]$null)
Assert-True ($tokens.Count -gt 0) "PowerShell generator did not parse"
Write-Output "RETENTION_RELEASE_BUNDLE_STATIC_CHECK_PASS"
