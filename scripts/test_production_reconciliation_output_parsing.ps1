$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "production_reconciliation_test_helpers.ps1")

function Assert-ThrowsWithText {
  param(
    [Parameter(Mandatory = $true)][scriptblock]$Action,
    [Parameter(Mandatory = $true)][string]$ExpectedText
  )
  try {
    & $Action
  }
  catch {
    if ($_.Exception.Message -notmatch [regex]::Escape($ExpectedText)) {
      throw "Expected '$ExpectedText', got '$($_.Exception.Message)'"
    }
    return
  }
  throw "Expected parser failure containing '$ExpectedText'."
}

$mixedPsqlOutput = @(
  "BEGIN",
  "SELECT 2",
  "conservative_legacy_entitlement|ofr-v1-1111111111111111",
  "premium_profile_without_entitlement|ofr-v1-2222222222222222",
  "conservative_legacy_entitlement|ofr-v1-1111111111111111|0|{}|0|REVIEW_STRIPE_DASHBOARD",
  "premium_profile_without_entitlement|ofr-v1-2222222222222222|0|{}|0|REVIEW_STRIPE_DASHBOARD",
  "OPENINGFIT_CANDIDATE_COUNTS|1|1",
  "ROLLBACK"
)
$counts = Get-OpeningFitCandidateCounts -Output $mixedPsqlOutput
if ($counts.Legacy -ne 1 -or $counts.Profile -ne 1) {
  throw "Mixed psql output parsed to the wrong candidate counts."
}

Assert-ThrowsWithText { Get-OpeningFitCandidateCounts -Output @("BEGIN", "ROLLBACK") } "missing"
Assert-ThrowsWithText {
  Get-OpeningFitCandidateCounts -Output @(
    "OPENINGFIT_CANDIDATE_COUNTS|1|1",
    "OPENINGFIT_CANDIDATE_COUNTS|1|1"
  )
} "duplicated"
Assert-ThrowsWithText {
  Get-OpeningFitCandidateCounts -Output @("OPENINGFIT_CANDIDATE_COUNTS|1|one")
} "malformed"

Write-Host "PASS candidate-count output parsing"
