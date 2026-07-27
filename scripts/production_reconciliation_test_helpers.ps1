function Get-OpeningFitCandidateCounts {
  param(
    [Parameter(Mandatory = $true)]
    [AllowEmptyCollection()]
    [object[]]$Output
  )

  $prefix = "OPENINGFIT_CANDIDATE_COUNTS|"
  $lines = @(
    $Output |
      ForEach-Object { ([string]$_).Trim() } |
      Where-Object { $_.StartsWith($prefix, [StringComparison]::Ordinal) }
  )

  if ($lines.Count -eq 0) {
    throw "Candidate count result is missing."
  }
  if ($lines.Count -ne 1) {
    throw "Candidate count result is duplicated ($($lines.Count) rows)."
  }

  $match = [regex]::Match(
    $lines[0],
    '^OPENINGFIT_CANDIDATE_COUNTS\|(?<legacy>[0-9]+)\|(?<profile>[0-9]+)$',
    [Text.RegularExpressions.RegexOptions]::CultureInvariant
  )
  if (-not $match.Success) {
    throw "Candidate count result is malformed: $($lines[0])"
  }

  [pscustomobject]@{
    Legacy = [int64]$match.Groups['legacy'].Value
    Profile = [int64]$match.Groups['profile'].Value
  }
}

function Get-OpeningFitReviewedSourceCounts {
  param(
    [Parameter(Mandatory = $true)]
    [AllowEmptyCollection()]
    [object[]]$Output
  )

  $prefix = "OPENINGFIT_REVIEWED_SOURCE_COUNTS|"
  $lines = @(
    $Output |
      ForEach-Object { ([string]$_).Trim() } |
      Where-Object { $_.StartsWith($prefix, [StringComparison]::Ordinal) }
  )

  if ($lines.Count -eq 0) { throw "Reviewed-source count result is missing." }
  if ($lines.Count -ne 1) {
    throw "Reviewed-source count result is duplicated ($($lines.Count) rows)."
  }

  $match = [regex]::Match(
    $lines[0],
    '^OPENINGFIT_REVIEWED_SOURCE_COUNTS\|(?<total>[0-9]+)\|(?<pristine>[0-9]+)\|(?<canonical>[0-9]+)\|(?<conflicting>[0-9]+)$',
    [Text.RegularExpressions.RegexOptions]::CultureInvariant
  )
  if (-not $match.Success) {
    throw "Reviewed-source count result is malformed: $($lines[0])"
  }

  [pscustomobject]@{
    Total = [int64]$match.Groups['total'].Value
    Pristine = [int64]$match.Groups['pristine'].Value
    Canonical = [int64]$match.Groups['canonical'].Value
    Conflicting = [int64]$match.Groups['conflicting'].Value
  }
}
