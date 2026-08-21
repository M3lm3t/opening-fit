$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$generator = Join-Path $PSScriptRoot "prepare_repertoire_preferences_release_bundle.ps1"
$bundle = Join-Path $repoRoot "release-artifacts/openingfit-repertoire-preferences-production-bundle.sql"
$migration = Join-Path $repoRoot "supabase/migrations/202608170001_user_repertoire_preferences.sql"

& $generator | Out-Null
$firstHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $bundle).Hash
& $generator | Out-Null
$secondHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $bundle).Hash
if ($firstHash -ne $secondHash) { throw "Bundle generation is not reproducible." }

$sql = Get-Content -Raw -LiteralPath $bundle
$source = Get-Content -Raw -LiteralPath $migration
if (-not $sql.Contains($source.Trim())) { throw "Exact source migration is not embedded." }
if (($sql | Select-String -Pattern '-- ===== BEGIN EXACT SOURCE MIGRATION' -AllMatches).Matches.Count -ne 1) { throw "Expected exactly one source migration section." }
if (($sql | Select-String -Pattern '(?im)^begin(?: read only)?;' -AllMatches).Matches.Count -ne 2) { throw "Expected one read-only and one migration transaction." }
if (($sql | Select-String -Pattern '(?im)^commit;' -AllMatches).Matches.Count -ne 1) { throw "Expected exactly one committed migration transaction." }
if ($sql -match '20260820000[1-5]_') { throw "Retention migrations must not be included." }
if ($sql -match 'supabase_migrations\.schema_migrations|migration repair|db push') {
  if ($sql -match 'insert\s+into\s+supabase_migrations|update\s+supabase_migrations|delete\s+from\s+supabase_migrations') { throw "Migration-history alignment is prohibited." }
}
if ($sql -match '(?i)select\s+\*\s+from\s+public\.user_repertoire_preferences') { throw "Bundle must not output private rows." }
if ($sql.IndexOf('PRECONDITION_PASS') -gt $sql.IndexOf('BEGIN EXACT SOURCE MIGRATION')) { throw "Preconditions must precede migration." }
if ($sql.IndexOf('MIGRATION_POSTCONDITION_PASS') -lt $sql.IndexOf('END EXACT SOURCE MIGRATION')) { throw "Postconditions must follow migration." }

$tokens = [System.Management.Automation.PSParser]::Tokenize((Get-Content -Raw -LiteralPath $generator), [ref]$null)
if (-not $tokens) { throw "Generator parser check failed." }
Write-Output "REPERTOIRE_PREFERENCES_BUNDLE_PASS $secondHash"
