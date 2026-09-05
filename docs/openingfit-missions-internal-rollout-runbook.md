# OpeningFit Missions: one-account internal rollout

This runbook keeps Mission percentage rollout at zero and notification delivery disabled. It enables only one existing authenticated account through a server-side UUID configuration value. Never store the UUID, credentials, tokens, or production environment values in source control, tickets, screenshots, logs, or shell history.

## Configuration contract

- `OPENINGFIT_MISSIONS_ENABLED`: existing global kill switch. Only an accepted true value permits any Mission access; absent, false, or malformed fails closed.
- `OPENINGFIT_MISSIONS_INTERNAL_USER_ID`: one canonical lowercase hyphenated Supabase Auth user UUID. Empty, whitespace-padded, comma-separated, noncanonical, or malformed values fail closed.
- `OPENINGFIT_MISSIONS_ROLLOUT_MODE`: set exactly `internal`. Accepted modes are `internal` and `percentage`; missing mode selects internal only when the internal-user variable is present, and any other value fails closed.
- `OPENINGFIT_MISSIONS_ROLLOUT_PERCENT`: keep exactly `0` for the internal rollout.
- `OPENINGFIT_MISSIONS_ROLLOUT_SECRET`: not required for a zero-percent internal rollout; do not change it as part of this procedure.
- Mission notification delivery has no enabled production transport or environment switch. Keep it deferred; do not add or enable delivery configuration. The database preference default remains false.

When the internal-user variable is present, internal-only mode overrides percentage selection: only the exact valid UUID can be eligible. A malformed value disables eligibility for everyone rather than falling through to percentage rollout.

Public `/api/readiness` exposes only global availability and component health. It never exposes the internal UUID or individual eligibility. Authenticated clients check `/api/features/missions/eligibility`, which returns only `{ "enabled": true|false }`, performs no writes, and is outside `/api/v1/missions*`.

## Find the existing tester UUID

In the Supabase dashboard for project `frtjfvhiimgruenqcuon`, open Authentication, then Users. Locate the operator's existing test account manually and copy its User UID directly into Render's secret environment editor. Do not query application tables, run SQL, paste the UUID into repository files, or include it in screenshots or reports. Confirm visually that exactly one existing Auth user was selected.

## Deployment and enablement order

1. Keep `OPENINGFIT_MISSIONS_ENABLED=false`, rollout percentage `0`, and notification delivery deferred.
2. Deploy the backend code first. Because pushes to `main` may independently trigger both Render and Vercel, use reviewed platform controls/manual deployment so the backend is healthy before releasing the frontend. Do not rely on an unordered simultaneous auto-deploy.
3. Verify `/api/health` is 200 and `/api/readiness` still reports Missions disabled. Verify ordinary authenticated and anonymous routes issue zero `/api/v1/missions*` requests.
4. Deploy the frontend code. Repeat the disabled-state checks. The frontend must remain invisible while the global switch is false.
5. In Render only, set `OPENINGFIT_MISSIONS_INTERNAL_USER_ID` to the single existing canonical UUID and explicitly keep `OPENINGFIT_MISSIONS_ROLLOUT_PERCENT=0`. Saving environment configuration restarts/redeploys the backend; wait for health and readiness before continuing.
6. Confirm the public readiness response contains no UUID or allowlist information and still reports Missions disabled.
7. Under a separate approval, change only `OPENINGFIT_MISSIONS_ENABLED=true`. Expect another Render restart/redeploy. Do not change Vercel variables, rollout percentage, notification settings, billing settings, or database state.
8. Require health 200 and readiness `status=ready`, Mission schema/component ready, rollout percentage `0`, and notification delivery deferred before testing accounts.

## Smoke tests

Use browser Network tools with Preserve log enabled and filter on `missions`.

1. Anonymous: load `/`, `/analyse`, `/train`, `/account`, and `/premium`. Expect no Mission UI, no eligibility request, and zero `/api/v1/missions*` requests.
2. Non-allowlisted authenticated test account: restore/sign in normally and load the same existing pages. Expect one deduplicated `/api/features/missions/eligibility` response containing only `enabled:false`, no Mission UI, zero `/api/v1/missions*` requests, and unchanged report/train/account behaviour.
3. Allowlisted account: restore/sign in normally. Expect the eligibility response `enabled:true`, one deduplicated `/api/v1/missions/current` request, and Mission UI only after both checks complete. Exercise current Mission, training, and completion through the normal UI; do not manually author rows.
4. Confirm subscription and lifetime-access views are unchanged for both authenticated accounts.

Do not use an administrator account as the negative test if it is the allowlisted UUID. Never inspect or record bearer tokens.

## Aggregate-only safety checks

Use the already-reviewed operator diagnostics/read-only verification path. Record only aggregate counts for Mission tables, sessions, attempts, events, outbox, allowances, and notification candidates. Before allowing the tester, establish a baseline. After the negative test, every count must be unchanged. After the allowlisted test, only expected tester-driven categories may increase; notification candidates/outbound delivery must remain absent or deferred according to the verified contract. Do not expose row contents or identifiers.

## Immediate rollback

The fastest kill switch is setting `OPENINGFIT_MISSIONS_ENABLED=false` in Render. Wait for restart, require health/readiness, and verify both accounts make zero `/api/v1/missions*` requests. Then remove `OPENINGFIT_MISSIONS_INTERNAL_USER_ID` in a separately reviewed configuration change. Keep rollout at zero. Existing Mission rows are retained and protected; do not delete them or alter migration history.

Stop immediately if health or readiness degrades, the UUID appears publicly or in logs, a non-allowlisted account sees Mission UI or calls a Mission endpoint, a negative test changes aggregate counts, rollout is nonzero, notification delivery is not deferred, existing subscription/lifetime access changes, or any request bypasses normal authentication.
