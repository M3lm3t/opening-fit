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
