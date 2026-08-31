# OpeningFit Missions Phase 4 training

Mission training is server-authoritative and remains disabled unless `OPENINGFIT_MISSIONS_ENABLED` is explicitly true. Phase 4 stores one immutable, bounded JSONB exercise manifest per resumable session. The exact mission position is always the core exercise; no nearby positions or engine answers are fabricated. A one-exercise session is valid when that is the only trusted material.

Illegal moves are rejected without creating a scored attempt. Assistance is deferred and every response reports `assistanceAvailable: false`. For Missions only, the backend schedules reviews: first-try correct is due in 3 days, correct after a failure in 1 day, and repeated clean successes use 7, 14, then a capped 30 days.

Completion uses integer comparisons. One- or two-exercise sessions require every exercise solved and the core solved unassisted. Larger sessions require every exercise attempted, at least 80% eventually solved, at least 60% solved unassisted, and the core solved unassisted. Completion atomically closes the session, transitions `learning` to `awaiting_evidence`, and writes one durable meaningful-activity marker. Projection into the existing streak/activity system is deferred so Phase 4 does not create a competing or unreliable activity write path.

Manual migration order:

1. `202608310001_openingfit_missions_foundation.sql`
2. `202608310002_openingfit_missions_readiness.sql`
3. `202608310003_openingfit_mission_training.sql`

No migration is executed automatically. Keep Missions disabled until all three are applied and readiness reports both the Missions and training schemas ready.
