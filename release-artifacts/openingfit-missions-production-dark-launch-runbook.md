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

The containment artifact remains an idempotent recovery tool for an older or legacy 001A state that inherited forbidden privileges. Use it only with separate approval, and continue only from `containment_complete`; stop on `containment_absent` or `containment_partial`.

The revised 001A artifact is for future clean deployments only and now commits with RLS plus all ordinary and service-role table privileges revoked. A fresh revised 001A that verifies `stage_complete` does not require the recovery containment transaction. Current production has already completed 001A, containment and 001B: never rerun any of them; use the read-only post-001B checkpoint inspection before requesting 001C approval.

Only after containment is verified and 001B receives separate approval, run the revised 001B artifact, whose wrapper first removes inherited service-role privileges before the source grants its narrower contract. Verify exact grants, policies, RLS and the identity trigger before considering 001C.

Never submit 001C through SQL Editor. After separate approval, follow `openingfit-missions-production-001c-psql-runbook.md` and execute the exact artifact from disk using Direct or Shared Pooler Session mode on port 5432 with `psql -f` and `ON_ERROR_STOP=1`. Transaction-pooler port 6543 is prohibited for this DDL stage.

Only after separate approval, repeat the execute-then-verify pattern for 002, 003, and 004. Never paste wrappers together and never continue after failed verification.

## Final verification

Run the final security audit. Recheck public health/readiness, Missions disabled, subscriptions unchanged, one ordinary report analysis, and absence of Mission UI for normal users.

## Containment

Do not rerun blindly. Keep Missions disabled, rollout zero, and notifications disabled. Preserve exact error text; run containment verification after any uncertain result. Do not drop objects, edit migration history, deploy, or expose secrets. The containment transaction may revoke privileges only on the four exact 001A tables.

## Approvalâ€”not yet granted

- [ ] I understand this is the production database, no separate staging environment exists, and backup/PITR may be unavailable. The migrations are additive, but production SQL still carries risk. I approve executing only migration 001 first while Missions remains disabled.
