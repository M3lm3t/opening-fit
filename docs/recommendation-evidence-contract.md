# Recommendation evidence contract

OpeningFit recommendation decisions use `reportDecision.schemaVersion: 2`. The backend is authoritative for a completed report; a filtered report rebuilds the same shape from the visible filtered game set.

Each recommendation contains:

- stable opening identity plus exact player role (`played_as_white`, `played_as_black`, `faced_as_white`, or `faced_as_black`);
- ownership and repertoire slot derived from that role, never from the opening name;
- one reconciled sample containing supporting game IDs, games, wins, draws, losses and chess `scoreRate`;
- an optional recurring issue with at least two supporting games and a concrete move sequence or position;
- one verdict, confidence object, training action, priority and validation result.

`scoreRate` means `(wins + 0.5 × draws) / games × 100`. `winRate` remains available in legacy payloads and means wins divided by games; it is not displayed as chess score when `scoreRate` exists.

Opening-specific confidence is low below 10 games, medium from 10 to 14, and high from 15 games when results and colour context reconcile. Fewer than five opening-specific games is insufficient for a strength or weakness claim. Overall report coverage is separate and cannot raise an opening recommendation's confidence.

The primary problem ranking is deterministic: evidence validity and ownership first, then a weighted priority made from sample size (20%), performance severity (20%), opening-specific confidence (15%), core repertoire importance (15%), actionable repeated issue evidence (20%), and recency relative to the report date (10%). Opening name and role are stable tie-breakers. If no owned opening has reliable weakness evidence, the report says so and recommends collecting more games instead of inventing a repair target.

Family and variation labels are matched exactly apart from whitespace, case, and the editorial `Defense`/`Defence` spelling. Aliases and variations are not pooled silently.

Stored schema-v1 reports pass through a compatibility adapter. Missing historical WDL detail is preserved as unavailable; contradictory WDL, score, sample size or supporting IDs cause the affected recommendation to be downgraded rather than trusted.
