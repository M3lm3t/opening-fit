# Stage 6 rollout proposal — disabled pending a separate contract decision

Local implementation is now prepared in [stage6-isolation-implementation.md](stage6-isolation-implementation.md), with creation still disabled. The text below records the original findings/proposal; it is not a claim that those controls remain unimplemented. The implementation note contains current validation, deliberately bounded report-only scope, rollback and remaining release steps. No production action has been taken.

The Stage 6 branch is local-only. **Do not deploy its backend to the existing production endpoints.** No feature gate or client negotiation currently makes that deployment safe.

## Verified boundary

Android 1.0.18(21), recorded source baseline `054626e7`, sends only platform, username, months and time_control to `/api/analysis/jobs` (plus an optional authentication token). `AnalysisJobRequest` has no client version/capability. Existing mission capabilities describe entitlements and mission availability, not report-generation support. User-agent guessing is not an acceptable replacement.

The old client also reads `report_history` directly through Supabase (`loadAnalysisHistory` → `selectUserRows`), with `*` projections. Profile/retention snapshots and local last-analysis storage provide additional report restore paths. A gate on the import API alone cannot protect an older device from a v4 report created on the web and saved by the same account. Neither an optional comparisonEligibility flag nor a newer Play release prevents its local comparison functions from computing unsupported deltas.

The recorded old bundle renders v4 health as legacy, omits its component breakdown, and accepts mixed-generation improvements. It has no supported mandatory-update flow. Existing import failures produce an ordinary error/retry explanation; failing a request cannot honestly be called a forced update. Existing history read failures likewise do not implement a version-specific recovery screen.

## Proposed explicit contract (not implemented here)

1. Keep the current unnegotiated import endpoint on the genuine pre-Stage-6 generator. No-capability clients remain legacy clients; never execute v4 and label it v3. A server-wide kill switch must default the new generator off.
2. Add a separately approved versioned report endpoint, e.g. `/api/v2/analysis/jobs`, with an explicit capability set (`report_decision_v7`, `repertoire_health_v4`, `opening_suitability_v2`, `deterministic_opening_fit_metrics_v2`, comparison policy identifier). Unknown/incomplete capabilities receive a bounded unsupported-report response before starting a job. Capabilities describe supported data, not identity, authentication or entitlements. A job keeps its negotiated generation through polling/retries.
3. Store new-generation reports in a version-isolated namespace that old direct queries cannot see. Existing rows remain immutable. Route new-client history reads and writes through a capability-aware service; retain original stored versions on all returned reports. Cover history, profile last-report, retention snapshots, shared reports and exports—not just the primary history table. No v4 blob may be mirrored into a legacy-readable column or row.
4. New clients may read old reports as historical values, but cannot compare incompatible generations or manufacture missing provenance. A cached v4 report must remain readable even if the server rollout is rolled back. Unsupported clients get an explicit update/read-only explanation in the new client code; old clients continue receiving the actual legacy dataset and ordinary legacy import behaviour.
5. Rollback disables creation of new-generation jobs and writes first. Preserve already-created v4 reports in their isolated namespace, available only to compatible readers. Never rewrite them or substitute v3 values. Keep legacy import/read routes unchanged. Resume only after testing cross-device reads and all mirrors.

## Why this is a blocker, not an implementation in this branch

Safe isolation needs a new API contract and a storage/read-access design or a separately authorised mandatory-update mechanism. The current direct database read contract cannot enforce a new per-client capability through an API-only patch. Changing schema/RLS, permissions, authentication or pending Android releases is explicitly outside this task. No speculative user-agent gate, migration, permission change or parallel legacy engine was added.

Required acceptance before rollout: no-signal old client imports and restores genuine legacy reports; capable web client creates v4; an old device on the same account cannot read any v4 mirror; new client reads both without cross-generation claims; unsupported/missing capabilities cannot start v4 jobs; interrupted jobs preserve generation; rollback leaves old behaviour and immutable v4 history intact. Existing exact-bundle failures are recorded in `stage6a-android-compatibility-review.md` and remain a release blocker until this design is approved and implemented.

## Current source preparation

The frontend now recognises explicit supported versions, displays their supplied components, preserves stored historical values, and withholds unknown/missing-version comparisons. Unknown decisions offer an updated-client explanation rather than an invented repair action. These are source changes for a future separately authorised Android build; the submitted bundle is unchanged.

Compatibility validation: 46 focused frontend tests, ESLint and production Vite build passed. This does not remove the old-client rollout blocker. Subsequent Stage 6B validation is documented separately.
