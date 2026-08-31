# OpeningFit Missions Phase 3 rollout

Missions are an optional backend beta and `OPENINGFIT_MISSIONS_ENABLED` defaults to false. When disabled, analysis and application readiness do not depend on the Missions schema. When enabled with a missing schema, readiness reports the Missions component as degraded while normal analysis remains available.

The repair policy uses integer arithmetic. Repair requires at least three qualifying future encounters, at least two correct encounters, `correct * 3 >= qualifying * 2`, and no more than one repeated mistake. The separate `needs_review` rule is unchanged.

Database migrations must be applied manually, in this order:

1. `202608310001_openingfit_missions_foundation.sql`
2. `202608310002_openingfit_missions_readiness.sql`

Neither migration is executed automatically. Keep the feature flag disabled until both migrations have been applied and `/api/readiness` reports `missions_schema: ready`.
