# Mission stage 001C psql execution runbook

Target project: `frtjfvhiimgruenqcuon`. Do not use Supabase SQL Editor or a transaction-pooler endpoint. This procedure requires separate 001C approval and preserves the artifact's own `BEGIN`, assertions and `COMMIT`.

## Connection selection and credentials

Use the Direct connection from Dashboard -> Connect when IPv6 is available. Otherwise use the Shared Pooler **Session mode** connection on port 5432. Never use port 6543. Copy the session host and server CA certificate path from the Dashboard; do not copy a URI or password into the shell.

```powershell
$psql = 'D:\opening-fit\.release-build\postgresql17\runtime\bin\psql.exe'
$artifact = (Resolve-Path 'D:\opening-fit\release-artifacts\openingfit-missions-production-001c-execute.sql').Path
$verification = (Resolve-Path 'D:\opening-fit\release-artifacts\openingfit-missions-production-001c-verification.sql').Path
$checkpoint = (Resolve-Path 'D:\opening-fit\release-artifacts\openingfit-missions-production-001-checkpoint-inspection.sql').Path
$env:PGDATABASE = 'postgres'
$env:PGPORT = '5432'
$env:PGSSLMODE = 'verify-full'
$env:PGSSLROOTCERT = '<ABSOLUTE PATH TO DASHBOARD SERVER CA CERTIFICATE>'
```

For Direct mode only:

```powershell
$env:PGHOST = 'db.frtjfvhiimgruenqcuon.supabase.co'
$env:PGUSER = 'postgres'
if ($env:PGHOST -cne 'db.frtjfvhiimgruenqcuon.supabase.co' -or $env:PGPORT -ne '5432') { throw 'Wrong direct target' }
```

For Shared Pooler Session mode only, copy the non-secret host from Dashboard -> Connect -> Session pooler:

```powershell
$env:PGHOST = '<SESSION POOLER HOST FROM DASHBOARD>'
$env:PGUSER = 'postgres.frtjfvhiimgruenqcuon'
if ($env:PGUSER -cne 'postgres.frtjfvhiimgruenqcuon' -or $env:PGPORT -ne '5432' -or $env:PGHOST -notlike '*.pooler.supabase.com') { throw 'Wrong session-pooler target' }
```

Do not set `PGPASSWORD`. Each command uses `-W` so psql prompts privately. Never paste the password into a command, URI, file, transcript or chat.

## Read-only preflight

```powershell
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $artifact).Hash -cne '05D545F448656E027CC182EF9CB5CA4D3AF73AE9507ECF89AA3FF6FB6839A45B') { throw '001C artifact hash mismatch' }
& $psql -X -W -v ON_ERROR_STOP=1 -c "select current_database(),current_user,session_user,inet_server_addr(),inet_server_port(),version(),pg_is_in_recovery();"
if ($LASTEXITCODE -ne 0) { throw 'Read-only identity check failed' }
& $psql -X -W -v ON_ERROR_STOP=1 -c "select to_regprocedure('public.transition_openingfit_mission(uuid,uuid,text,text,text,text,jsonb)') transition_function,to_regprocedure('public.dismiss_openingfit_mission(uuid,text,text)') dismiss_function;"
if ($LASTEXITCODE -ne 0) { throw 'Read-only 001C absence check failed' }
& $psql -X -W -v ON_ERROR_STOP=1 -f $checkpoint
if ($LASTEXITCODE -ne 0) { throw 'Read-only post-001B checkpoint inspection failed' }
```

Manually confirm database `postgres`, the expected `postgres` or `postgres.frtjfvhiimgruenqcuon` identity, a primary server (`pg_is_in_recovery = false`), the approved Dashboard host, both functions NULL, and final checkpoint classification `post_001b_complete`. Stop on any mismatch. Do not rerun 001A, containment or 001B.

## Approved execution

```powershell
$runLog = Join-Path ([IO.Path]::GetTempPath()) ('openingfit-001c-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
& $psql -X -W -v ON_ERROR_STOP=1 -f $artifact 2>&1 | Tee-Object -LiteralPath $runLog
if ($LASTEXITCODE -ne 0) { throw "001C failed or is uncertain; do not rerun. Inspect with the read-only procedure. Output: $runLog" }
```

The temporary log contains SQL status/error output only. Confirm it contains `BEGIN`, both `CREATE FUNCTION` results, privilege/comment results, the final assertion result, and `COMMIT`; then run the verification file one SELECT at a time. Delete the temporary log through the normal approved local cleanup process after review.

## Failure or uncertain result

Never rerun after any nonzero exit, disconnect, timeout or missing `COMMIT`. Re-run only the read-only identity and `to_regprocedure` checks above, then run the read-only 001C verification from disk with `& $psql -X -W -v ON_ERROR_STOP=1 -f $verification`. If both functions are NULL, rollback is consistent. If both exist, complete verification must prove definitions, grants and comments before treating 001C as committed. If only one exists or any check disagrees, classify the state as partial/uncertain and stop for diagnosis. Do not edit migration history or drop objects.

When finished, remove only the process-scoped non-secret connection variables:

```powershell
Remove-Item Env:PGHOST,Env:PGPORT,Env:PGDATABASE,Env:PGUSER,Env:PGSSLMODE,Env:PGSSLROOTCERT -ErrorAction SilentlyContinue
```
