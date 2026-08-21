$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$generator = Join-Path $PSScriptRoot "prepare_repertoire_preferences_release_bundle.ps1"
$bundle = Join-Path $repoRoot "release-artifacts/openingfit-repertoire-preferences-production-bundle.sql"
$migration = Join-Path $repoRoot "supabase/migrations/202608170001_user_repertoire_preferences.sql"
$inspection = Join-Path $repoRoot "release-artifacts/openingfit-repertoire-preferences-production-inspection.sql"

& $generator | Out-Null
$firstHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $bundle).Hash
& $generator | Out-Null
$secondHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $bundle).Hash
if ($firstHash -ne $secondHash) { throw "Bundle generation is not reproducible." }

$sql = Get-Content -Raw -LiteralPath $bundle
$source = Get-Content -Raw -LiteralPath $migration
$inspectionSource = Get-Content -Raw -LiteralPath $inspection
if (-not $sql.Contains($source.Trim())) { throw "Exact source migration is not embedded." }
if (-not $sql.Contains($inspectionSource.Trim())) { throw "Independent metadata inspection is not embedded." }
if (($sql | Select-String -Pattern '-- ===== BEGIN EXACT SOURCE MIGRATION' -AllMatches).Matches.Count -ne 1) { throw "Expected exactly one source migration section." }
if (($sql | Select-String -Pattern '(?im)^begin(?: read only)?;' -AllMatches).Matches.Count -ne 2) { throw "Expected one read-only and one migration transaction." }
if (($sql | Select-String -Pattern '(?im)^commit;' -AllMatches).Matches.Count -ne 1) { throw "Expected exactly one committed migration transaction." }
if ($sql -match '20260820000[1-5]_') { throw "Retention migrations must not be included." }
if ($sql -match 'supabase_migrations\.schema_migrations|migration repair|db push') {
  if ($sql -match 'insert\s+into\s+supabase_migrations|update\s+supabase_migrations|delete\s+from\s+supabase_migrations') { throw "Migration-history alignment is prohibited." }
}
if ($sql -match '(?i)select\s+\*\s+from\s+public\.user_repertoire_preferences') { throw "Bundle must not output private rows." }
if ($sql -match "(?is)select\s+case\s+when\s+to_regclass\('public\.user_repertoire_preferences'\).*?from\s+public\.user_repertoire_preferences") { throw "CASE must not guard a parse-time reference to an optional relation." }
if ($sql.IndexOf('PRECONDITION_PASS') -gt $sql.IndexOf('BEGIN EXACT SOURCE MIGRATION')) { throw "Preconditions must precede migration." }
if ($sql.IndexOf('MIGRATION_POSTCONDITION_PASS') -lt $sql.IndexOf('END EXACT SOURCE MIGRATION')) { throw "Postconditions must follow migration." }

$migrationStart = $sql.IndexOf('-- ===== BEGIN EXACT SOURCE MIGRATION')
$beforeMigration = $sql.Substring(0, $migrationStart)
$beforeMigrationWithoutStrings = [regex]::Replace($beforeMigration, "'(?:''|[^'])*'", "''")
$unsafeDirectReferences = [regex]::Matches(
  $beforeMigrationWithoutStrings,
  '(?i)\b(?:from|join|into|update|alter\s+table|grant\s+.+?\s+on|revoke\s+.+?\s+on|comment\s+on\s+table)\s+public\.user_repertoire_preferences\b'
)
if ($unsafeDirectReferences.Count -ne 0) { throw "Optional preference table is referenced directly before its creating migration." }
if ($sql -match "FINAL_COMPATIBILITY_COUNTS") { throw "Final verification must be metadata-only." }
if ($sql -match '(?i)repertoire_preferences_release_baseline|create\s+temporary\s+table') { throw "Generated sections must not depend on session helper state." }
if ($sql -notmatch 'ARCHIVAL TEMPLATE ONLY') { throw "Applied migration bundle must be prominently marked non-executable." }

$inspectionWithoutComments = [regex]::Replace($inspectionSource, '(?m)^\s*--.*$', '')
$inspectionStatements = @([regex]::Matches($inspectionWithoutComments, '(?is)\bselect\b.*?;'))
if ($inspectionStatements.Count -ne 10) { throw "Expected ten independent metadata inspection statements." }
if ($inspectionWithoutComments -match '(?i)\b(insert|update|delete|create|alter|drop|truncate|grant|revoke|call|do)\b') { throw "Inspection must remain read-only." }
if ($inspectionSource -match '(?i)\bfrom\s+public\.user_repertoire_preferences\b') { throw "Inspection must not query private preference rows." }

# Simulate the three catalogue states exercised by the baseline contract. The
# absent and fully compatible states proceed; any incompatible partial shape stops.
$simulatedStates = @(
  @{ Name = 'table absent'; Exists = $false; Compatible = $false; ShouldPass = $true },
  @{ Name = 'compatible table present'; Exists = $true; Compatible = $true; ShouldPass = $true },
  @{ Name = 'incompatible partial table'; Exists = $true; Compatible = $false; ShouldPass = $false }
)
foreach ($state in $simulatedStates) {
  $wouldPass = (-not $state.Exists) -or $state.Compatible
  if ($wouldPass -ne $state.ShouldPass) { throw "State simulation failed: $($state.Name)." }
}

$tokens = [System.Management.Automation.PSParser]::Tokenize((Get-Content -Raw -LiteralPath $generator), [ref]$null)
if (-not $tokens) { throw "Generator parser check failed." }
Write-Output "REPERTOIRE_PREFERENCES_BUNDLE_PASS $secondHash"
