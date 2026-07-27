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
  "conservative_legacy_entitlement|ofr-v1-2222222222222222",
  "conservative_legacy_entitlement|ofr-v1-1111111111111111|0|{}|0|REVIEW_STRIPE_DASHBOARD",
  "conservative_legacy_entitlement|ofr-v1-2222222222222222|0|{}|0|REVIEW_STRIPE_DASHBOARD",
  "OPENINGFIT_CANDIDATE_COUNTS|2|0",
  "OPENINGFIT_REVIEWED_SOURCE_COUNTS|2|2|0|0",
  "ROLLBACK"
)
$counts = Get-OpeningFitCandidateCounts -Output $mixedPsqlOutput
if ($counts.Legacy -ne 2 -or $counts.Profile -ne 0) {
  throw "Mixed psql output parsed to the wrong candidate counts."
}

$reviewedCounts = Get-OpeningFitReviewedSourceCounts -Output $mixedPsqlOutput
if ($reviewedCounts.Total -ne 2 -or $reviewedCounts.Pristine -ne 2 `
    -or $reviewedCounts.Canonical -ne 0 -or $reviewedCounts.Conflicting -ne 0) {
  throw "Mixed psql output parsed to the wrong reviewed-source counts."
}

Assert-ThrowsWithText { Get-OpeningFitCandidateCounts -Output @("BEGIN", "ROLLBACK") } "missing"
Assert-ThrowsWithText {
  Get-OpeningFitCandidateCounts -Output @(
    "OPENINGFIT_CANDIDATE_COUNTS|2|0",
    "OPENINGFIT_CANDIDATE_COUNTS|2|0"
  )
} "duplicated"
Assert-ThrowsWithText {
  Get-OpeningFitCandidateCounts -Output @("OPENINGFIT_CANDIDATE_COUNTS|1|one")
} "malformed"
Assert-ThrowsWithText {
  Get-OpeningFitReviewedSourceCounts -Output @("BEGIN", "ROLLBACK")
} "missing"
Assert-ThrowsWithText {
  Get-OpeningFitReviewedSourceCounts -Output @(
    "OPENINGFIT_REVIEWED_SOURCE_COUNTS|2|2|0|0",
    "OPENINGFIT_REVIEWED_SOURCE_COUNTS|2|2|0|0"
  )
} "duplicated"
Assert-ThrowsWithText {
  Get-OpeningFitReviewedSourceCounts -Output @(
    "OPENINGFIT_REVIEWED_SOURCE_COUNTS|2|two|0|0"
  )
} "malformed"

Write-Host "PASS candidate-count output parsing"
