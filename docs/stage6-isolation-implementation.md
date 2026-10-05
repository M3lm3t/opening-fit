# Stage 6 report isolation — local implementation

The report-only pilot scope is now accepted. See [the web pilot release candidate and launch runbook](stage6-web-pilot-release.md) for the additional account admission migration, explicit web entry, current validation and launch order. The original evidence below remains valid where the pilot delta does not change it; its pending-scope decision is superseded.

Implemented on the existing Stage 6A–6D branch. Android 1.0.19 (22) manual internal testing is user-confirmed; its files and signed artifacts are unchanged. No UI polish, production migration, push, deployment or Google upload is included.

## Contract and boundaries

Legacy `/api/analysis/jobs`, all four synchronous import aliases and `/api/demo` use genuine pre-Stage-6 calculations, extracted from release baseline `054626e762c419c6c4b1477c4a7adef5210177bb`. `scripts/freeze_legacy_reports.py` reproduces the dependency snapshot and manifest. It includes 204 pipeline functions and 18 calculation modules; the large generated diff preserves the actual old generator rather than relabelling new results. Each call binds a separate namespace to existing I/O configuration. No shared module/function swapping occurs. Both primary and fallback calculation imports are frozen.

`POST /api/v2/analysis/jobs` requires authentication and the exact explicit capability set: decision v7, health v4, suitability v2, metrics v2, comparison v1, and `isolated_report_store_v1`. Capabilities never supply identity, premium access or entitlement. Existing auth and history limits remain in force. Incomplete/unknown capabilities receive 409 before a job starts. Anonymous clients keep legacy routes; capable imports require sign-in.

Generation is fixed in each job and in its deduplication namespace. The legacy deduplication key is unchanged. V2 polling requires the same capability header and owner; neither poll route exposes the other generation. The client checks the returned generation and never falls back to legacy on a v2 error. Worker retries keep the chosen route/generation; disabling creation fails a queued v2 job without rerouting it. Existing in-memory job TTL/restart behavior is unchanged: an expired/lost job is retried through its original versioned route, not resumed from a durable queue.

Creation requires **both** `OPENINGFIT_STAGE6_REPORTS_ENABLED=true` and database row `openingfit_report_rollout(id=1).enabled=true`. Both default off. Admission, worker start and persistence check these controls; the database write trigger closes a concurrent disable/write race. Read/poll paths remain available during rollback.

## Storage and client wiring

`openingfit_report_store_v2` is an API-only, owner-scoped namespace. Anon/authenticated roles have no direct grants or matching RLS policy. The existing verified auth user determines every service-role query's owner; supplied owners/owner filters cannot override it. The JSON payload must agree with the row owner. Profile premium flags remain sourced from canonical legacy profile data, never a client-supplied isolated value.

`POST /api/v2/report-store/query` reads existing owner-scoped legacy rows plus isolated rows, and writes only isolated rows. History is immutable, including collisions with existing legacy IDs/keys. Profile/state snapshots may advance within the isolated namespace. Original stored generation/version fields are retained. No migration rewrites old reports. The new worker saves its report here and never updates the public username-keyed filesystem profile or mission persistence.

The client opts in with `VITE_STAGE6_REPORTS_ENABLED=true` (default false). Its Supabase adapter routes report/history, profile, user-state, retention, recommendation, analysed-game, activity, settings/local-cache mirrors and supported report-derived collections to the capability service. Account profile API helpers use the same service. This includes unmarked derived scores, which a version-string guard alone cannot identify. New local caches use a separate prefix, can initially read old caches, and never replace the old client's report keys. Auth/sign-out clearing remains in place.

Legacy-table INSERT/UPDATE guards reject nested or serialized new-generation markers, including service-role/RPC writes. The migration installs these on every existing public table with JSON/text data, not just `report_history`; it aborts atomically if new-generation data already exists in a legacy table. It leaves existing RLS and grants unchanged. Future migrations adding a mirror must add the same guard and coverage before shipping. Clients cannot safely strip versions and write derived v4 data to an old mirror: capable-client writes are routed by collection, not marker detection. No new shared-report/export storage or public report URL is introduced; current share/export output remains on the client, and any future server mirror must use the isolated service.

The initial v2 surface is intentionally report-focused: old report-derived RPC mutations (repertoire/weekly-plan/coaching persistence), unknown collection writes and historical deletes fail closed, with no fallback. Server-side v4 mission generation is also disabled. Existing legacy clients keep these features. Do not claim full new-client cloud-training/repertoire mutation parity; supporting those RPCs needs a separate isolated contract, or explicitly accept the report-only pilot scope. Report reading and local practice remain available.

## Local validation and preservation

The existing loopback PostgreSQL 17 instance was reused at `127.0.0.1:55436`, with data directory `.release-build/stage6-isolation/postgres`. Only isolated databases in this cluster received migrations. `stage6_final` uses the repository's report/profile/retention migrations plus test-only Supabase auth/storage primitives; it is not a production clone.

- 50 distinct affected backend tests passed: 28 existing job regressions, 21 new contract tests, and one API-to-real-database test. Valid passing subsets were reused after fixing the test temporary directory and psql adapter parsing. Logs retain initial failures rather than claiming those initial runs passed.
- 68 affected frontend tests passed, including negotiation, no downgrade fallback, polling generation checks, every supported collection, unmarked retention/settings mirrors, cached reports, and existing persistence/training helpers.
- SQL checks passed for default-off trusted writes; genuine legacy reads/writes and unchanged stored scores; direct old/anonymous reader denial; RLS cross-account denial; history/profile/state/retention/recommendation leakage prevention; immutable isolated history; and rollback retaining readable reports while refusing writes.
- The authenticated API was exercised against the local database with a service-role SQL adapter: a completed new job persisted privately; another account could not read it; profile/state/retention/history/settings mirrors stayed out of legacy tables; existing history was byte-equivalent as JSON before/after; rollback reads succeeded. Authentication token verification itself is unchanged and was stubbed in these bounded API tests.
- Changed-file ESLint and both default-off and capability-enabled Vite builds passed (existing non-failing large-file/chunk warnings). No Capacitor sync or Android rebuild was performed.
- All six pre-existing modified tracked files, including Android version metadata, matched saved baseline hashes. Both 1.0.19 (22) artifact hashes still match their release manifest. Existing unrelated untracked work is retained.

Evidence: `.release-build/stage6-isolation/` (`sql-final.log`, `rollback-final.log`, `backend-contract.log`, `backend-final.log`, `backend-provenance.log`, `api-database-final.log`, `frontend-tests.log`, `frontend-final-targeted.log`, `lint-final.log`, and both `build-*-final.log` files). Existing Stage 6A–6D calculation/UI evidence is reused; no broad suite/audit was repeated.

## Migration and rollback

Prepared migration: `supabase/migrations/202610040001_stage6_report_isolation.sql`. Apply once, transactionally, with `ON_ERROR_STOP=1`; do not blindly rerun after an uncertain outcome. It leaves the database switch false. A missing migration fails v2 storage closed; legacy routes do not require the new tables.

Prepared non-destructive rollback: `supabase/rollback/202610040001_stage6_report_isolation_disable.sql`. Disable the database switch first, then set the backend flag false. Stop new v2 jobs/writes; keep the capability API and client readers deployed, retain the isolated table and all legacy guards. Do not drop data, relabel reports, copy them to legacy tables, or revert readers to an old client. Completed v2 jobs and cached/saved v4 reports remain readable; legacy generation and reads continue. The local database was left disabled after tests.

For local reproduction in a fresh database in this isolated cluster, use `supabase/tests/stage6_local_bootstrap.sql`, then `supabase/tests/stage6_report_isolation.sql`. The latter rolls its fixtures back. The Python database test is explicitly opt-in (`OPENINGFIT_STAGE6_LOCAL_DB=1`) and pins loopback host, port, database `stage6_final` and data-directory identity. It resets the rollout switch to false in `finally`. Backend tests use the existing isolated `.release-build/stage6a/run_backend.py` runner and a workspace-local `--basetemp`.

## Exact remaining release steps

1. Decide whether to accept the report-only pilot scope described above or first implement isolated equivalents for the blocked report-derived RPC mutations. Keep creation disabled meanwhile.
2. After separate release authorisation, review/apply the migration to the intended environment with a backup and the existing-data preflight; deploy this backend with both switches still off. Verify the deployed schema/grants and genuine legacy imports on the old client. No production readiness is inferred from the local platform fixture.
3. Build and internally test a capability-enabled client from this commit. Android 1.0.19 (22) does **not** include this new negotiation/persistence wiring; choose a fresh unused Play code from current evidence when preparing its successor. Exercise the same account on old and new devices, both import platforms, restored history, profile/retention/settings, sign-out/account switch, and rollback reads. Keep the compatible reader available during rollback.
4. Only after that acceptance and explicit activation approval, enable the database and server creation switches for the agreed pilot. A Play release, client adoption percentage or API version check alone is never the protection for older direct Supabase readers; storage separation and the legacy guards remain mandatory.
