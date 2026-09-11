# OpeningFit Missions: staged 10% rollout plan

This plan is preparation only. It does not authorize a Render change, deployment, SQL execution, notification delivery, or rollout expansion. Apply the Mission assignment forward migration and verify it separately before changing rollout configuration.

## Preconditions

- The assignment JSONB repair is applied and its read-only verification passes.
- `/api/health` and `/api/readiness` return HTTP 200; readiness reports Mission schema, training schema, activity projector, analytics, and component ready.
- The internal tester completes assignment, training, completion, dismissal, and retry smoke tests.
- Anonymous and ineligible authenticated sessions make zero `/api/v1/missions*` requests.
- Subscription and lifetime-access behavior is unchanged.
- Notification delivery remains deferred; there is no production delivery switch to enable.

## Exact Render changes

Use Render's secret environment editor. Never paste or record secret values in source control, command history, screenshots, tickets, or logs. Each save restarts/redeploys the backend; wait for health and readiness before the next save.

### Stage 1 — close the gate

- Change `OPENINGFIT_MISSIONS_ENABLED` from `true` to `false`.
- Keep `OPENINGFIT_MISSIONS_ROLLOUT_MODE=internal`.
- Keep `OPENINGFIT_MISSIONS_ROLLOUT_PERCENT=0`.
- Keep the existing `OPENINGFIT_MISSIONS_INTERNAL_USER_ID` unchanged.
- Do not change notification, Supabase, billing, or deployment variables.

Require readiness to report Missions disabled and confirm zero Mission UI/network requests for anonymous and authenticated ordinary page loads.

### Stage 2 — configure the deterministic cohort while disabled

- Set `OPENINGFIT_MISSIONS_ROLLOUT_MODE=percentage`.
- Set `OPENINGFIT_MISSIONS_ROLLOUT_PERCENT=10`.
- Set `OPENINGFIT_MISSIONS_ROLLOUT_SECRET` to a new stable, high-entropy secret held only in Render. Do not reuse or expose a token. Once cohort membership is accepted, do not rotate this value because rotation reshuffles users.
- Keep `OPENINGFIT_MISSIONS_ENABLED=false`.
- Keep the existing `OPENINGFIT_MISSIONS_INTERNAL_USER_ID` unchanged for rapid rollback; it is ignored in percentage mode.

Require readiness HTTP 200, Missions disabled, rollout percentage 10, and no UUID/secret exposure.

### Stage 3 — activate 10%

- Change only `OPENINGFIT_MISSIONS_ENABLED` from `false` to `true`.
- Confirm `OPENINGFIT_MISSIONS_ROLLOUT_MODE=percentage`.
- Confirm `OPENINGFIT_MISSIONS_ROLLOUT_PERCENT=10`.
- Leave `OPENINGFIT_MISSIONS_ROLLOUT_SECRET` and `OPENINGFIT_MISSIONS_INTERNAL_USER_ID` unchanged.

Require readiness HTTP 200 with all Mission components ready and rollout percentage 10. Test anonymous, one deterministically excluded authenticated account, and one deterministically eligible test account. Do not infer cohort membership from identifiers or expose bucket values.

## Observation and stop conditions

Observe bounded aggregate assignment, persistence, training, completion, failure, latency, and HTTP status metrics. Stop if readiness degrades, ordinary routes regress, excluded users make Mission requests, assignment failures recur, notification delivery occurs, or subscription/lifetime behavior changes.

## Rollback

1. Change only `OPENINGFIT_MISSIONS_ENABLED=false` and save.
2. Require health/readiness HTTP 200 and zero Mission UI/network requests.
3. To restore the single-account checkpoint, while still disabled set `OPENINGFIT_MISSIONS_ROLLOUT_MODE=internal` and `OPENINGFIT_MISSIONS_ROLLOUT_PERCENT=0`; retain the existing internal UUID.
4. Re-enable only under separate approval after readiness and containment checks pass.

Never delete Mission rows, alter migration history, rotate the rollout secret during an active cohort, or enable notification delivery as part of rollback.
