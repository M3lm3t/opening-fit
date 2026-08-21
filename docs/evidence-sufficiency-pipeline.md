# Evidence sufficiency pipeline

Current authoritative pipeline (audited 2026-08-19):

- Import and exclusion accounting is built in `backend/main.py` by `build_game_count_summary` and validated by `validate_game_count_contract`. Its v4 funnel is fetched → structurally usable → PGN available → parsed → attributed → classified → used for opening statistics. Every gap is assigned one canonical exclusion reason; duplicates are recorded separately because fetched games are already unique.
- Parsed games are assigned to White, Black vs 1.e4, Black vs 1.d4, outside-core, or unresolved by `build_role_evidence_accounting` in `backend/main.py`. `analysis.opening_perspective.canonical_repertoire_role` derives this from the player colour and White's first meaningful move. It does not require a recognised repertoire opening.
- Canonical game records are defined in `backend/analysis/classified_game.py`. They retain player colour, first White move, canonical opening identity, attribution trust, and exclusion reason.
- Opening recommendations use `backend/analysis/evidence_thresholds.py`: 5 opening games is the minimum recommendation sample, 10 is moderate confidence, and 25 is high confidence. These thresholds govern recommendation strength; they must not erase smaller observed samples.
- `backend/analysis/report_decision.py` validates role-specific supporting IDs, separates observed performance from suitability, and fails closed when role attribution is untrusted. It also attaches the evidence hierarchy to the canonical report decision.
- `backend/analysis/evidence_hierarchy.py` groups trusted games from account → colour → role → canonical opening family → variation → exact canonical position. Parent evidence remains available when a narrower position or move-order sample is small.
- Frontend reconciliation is adapted by `frontend/src/lib/reportGameCounts.js`; Report evidence is rendered by `ReportGameCountSummary.jsx`, while the canonical decision model is consumed by `primaryReportSummary.js` and `repertoireCoverage.js`.

Identified systemic gap:

The funnel already reconciles aggregate losses and role attribution correctly, but the hierarchy exposed only binary sample-size tiers. It did not expose deterministic recency weighting, per-game evidence-use decisions, additional-game guidance, or the requested Strong / Developing / Limited / Analysis failure states. Consequently a fragmented exact-position sample could be described as insufficient even when its role or canonical family had useful evidence.

Implemented policy:

- Keep existing recommendation thresholds unchanged.
- Add a weighted sufficiency contract at every hierarchy level. Recent eligible games have weight 1.0 and older eligible games retain weight 0.65.
- Use canonical family IDs before display names, and retain exact-position grouping across move orders.
- Expose per-game ledger rows for opening-family and position use.
- Present small samples as Limited evidence with observed facts and a next step; reserve firm recommendations for Strong evidence.
- Emit Analysis failure only for systemic attribution failure, with a deterministic diagnostic reference.
