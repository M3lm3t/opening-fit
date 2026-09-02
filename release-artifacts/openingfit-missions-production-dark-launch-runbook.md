# OpeningFit Missions production dark-launch runbook

Target: Supabase project `frtjfvhiimgruenqcuon`. This is production. Never use `supabase db push`, migration repair, or migration-history writes.

## Preconditions

1. Confirm openingfit.com and `/api/health` work; record `/api/readiness`.
2. Confirm `OPENINGFIT_MISSIONS_ENABLED` is absent/false, rollout is `0`, and notification delivery is disabled.
3. Confirm the Dashboard project reference exactly matches the target above.
4. Open Supabase Dashboard â†’ Database â†’ Backups and record backup/PITR availability. If a manual/downloadable backup exists, take it. If no recovery option exists, stop until the risk is explicitly accepted.

## Baseline

Run `openingfit-missions-production-baseline-inspection.sql` one numbered SELECT at a time and export results without private rows. Continue only for `no_mission_objects_present`, or after every existing object is independently proven exact. Stop on `partially_present`.

## Execution

The complete 001 wrapper was submitted twice through SQL Editor and both requests ended near line 208, before a function completed; the read-only baseline showed no persisted Mission objects. Do not use that full wrapper again in SQL Editor.

Confirm the baseline is `no_mission_objects_present`. Run 001A, then its verification; stop on mismatch. Run 001B and verify; then 001C and verify. Run the final combined 001 verification and stop before migration 002. A verified intermediate stage may remain committed. Never rerun a stage classified `stage_complete`; never proceed from `stage_partial`. Missions remains disabled throughout.

Only after separate approval, repeat the execute-then-verify pattern for 002, 003, and 004. Never paste wrappers together and never continue after failed verification.

## Final verification

Run the final security audit. Recheck public health/readiness, Missions disabled, subscriptions unchanged, one ordinary report analysis, and absence of Mission UI for normal users.

## Containment

Do not rerun blindly. Keep Missions disabled, rollout zero, and notifications disabled. Preserve exact error text; run baseline/partial-state inspection. Do not drop objects, edit migration history, deploy, or expose secrets. A connection failure near COMMIT is an uncertain state requiring metadata inspection.

## Approvalâ€”not yet granted

- [ ] I understand this is the production database, no separate staging environment exists, and backup/PITR may be unavailable. The migrations are additive, but production SQL still carries risk. I approve executing only migration 001 first while Missions remains disabled.
