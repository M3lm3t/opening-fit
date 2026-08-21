# OpeningFit analysis engine contract audit

Audit date: 2026-08-10
Scope: analysis correctness and contract consistency only. No UI redesign, pricing, billing, authentication, schema, or broad refactor was undertaken.

## Executive conclusion

The current **canonical** analysis contract is logically defensible and considerably safer than several older helper layers still present in the repository. It uses correctly attributed opening-specific games, separates observed performance from suitability and confidence, makes coverage gaps distinct from weaknesses, and fails closed when role or evidence reconciliation is uncertain.

No engine change was justified by this audit. A focused 12-case regression matrix was added to make the requested invariants explicit. Test execution is currently blocked on this machine because no usable Python interpreter is installed or accessible; therefore nothing was committed or pushed.

The principal remaining risk is contract multiplicity. `backend/main.py` still computes legacy fit, trend, retention and recommendation objects before `analysis.report_decision.build_report_decision()` creates the authoritative decision. Several frontend compatibility helpers also call a draw-inclusive chess score `winRate`. The canonical report surfaces generally normalize this correctly, but older/secondary surfaces can still use misleading terminology.

## 1. Pipeline and source of truth

| Stage | Source of truth | Contract notes |
|---|---|---|
| Frontend import request | `frontend/src/lib/importClient.js:126` | Sends platform, username, month window and time control. Target rating is absent. Supports async analysis jobs. |
| Platform fetch | `backend/main.py:8679` (Chess.com), `:10226` (Lichess), `:10425` dispatcher | Fetches public games and platform profile/rating metadata. |
| Date/time filtering and dedupe | archive/month selection plus `filter_games_by_time_control`, `deduplicate_games`, `select_analysis_candidates` | Deduplication precedes canonical fetched count; newest-first analysis cap is explicit. |
| Game eligibility | `chesscom_skip_reason`, `lichess_skip_reason`, `split_usable_games` | Unsupported variants/time controls, incomplete/very short games, missing/invalid move data and similar cases get named reasons. |
| Exclusion accounting | `build_game_count_summary`, `validate_game_count_contract` | Fail-closed monotonic funnel; fetched = used + excluded; reason totals must reconcile. |
| Opening classification | `backend/opening_detection.py:726` | Combines exact book prefixes, ECO/tag evidence, transposition/structure and piece-placement signals; returns family, variation/provenance and confidence. |
| Role/context classification | `backend/analysis/opening_perspective.py:205` | Canonical user relationship and repertoire roles: White, Black vs 1.e4, Black vs 1.d4; other/unresolved Black contexts fail safe. |
| Canonical game serialization | classified-game record construction in `backend/main.py`; `enforce_serialized_role_contract` | Stable game/context IDs and role legality are checked before compact response serialization. |
| Aggregation | context-aware opening aggregates in `backend/main.py`; rechecked by `_matching_games` in report decision | Canonical recommendation replaces raw aggregate counts with matching traceable game rows when report games exist. |
| Observed evidence | `_result_counts`, `_observed_performance_contract` | W/D/L and known-result denominator; score and win rate are separate. |
| Evidence confidence | `analysis/evidence_thresholds.py`; `_confidence`; `_evidence_confidence_contract` | 1–3 insufficient, 4–9 low, 10–24 medium, 25+ high; traceability/results can cap confidence. |
| Recommendation/verdict | `_canonical_recommendation` | Under 5 games or untrusted role → insufficient. Owned opening: score <45 or a supported recurring issue → Repair; score ≥55 → Keep; otherwise Explore. Faced openings are preparation, never repertoire repair. |
| Relevant baseline | `_attach_relevant_baselines` | Repairs without a specific recurring issue must underperform their role baseline by at least 10 points or are demoted to Explore. |
| Repertoire roles/coverage | `build_repertoire_roles` | Establishment requires five correctly attributed games in the exact role; missing role is a coverage gap. |
| Health score | `build_repertoire_coverage_score` | Versioned, reproducible, available-component reweighting; recent results are explicitly not scored. |
| Train next | `build_report_decision` action priority; `_training_priority` | Repair → missing-role gap → collect evidence → consolidate Keep → mixed review → experiment. |
| Contract validation | `assert_decision_consistency` | Rejects duplicate/conflicting context decisions, evidence leakage, alias divergence, illegal health arithmetic and training/diagnosis mismatch. |
| Canonical presentation | frontend `reportDecisionModel`, `primaryReportSummary`, authoritative presentation helpers | Newer surfaces prefer `reportDecision`; compatibility fallbacks still accept older payload shapes. |
| Response serialization | `compact_analysis_result`, `enforce_serialized_role_contract` | Preserves compact evidence plus full analysis index and compatibility aliases. |
| Local persistence | `frontend/src/lib/reportPersistence.js:25` | Persists last analysis transactionally in browser storage. |
| Cloud persistence | `frontend/src/services/userDataService.js` report snapshot and analysed-game saves; `AuthDataProvider` orchestration | Saves report history, recommendation snapshot, analysed games and user state as separate optional cloud steps. |

## 2. Invariant audit

### A. Sample size

Authoritative thresholds are centralized in `backend/analysis/evidence_thresholds.py`:

| Opening-specific games | Internal/public confidence | Firm Keep/Repair allowed? |
|---:|---|---|
| 1–3 | insufficient | No |
| 4 | low / very early evidence | No: below five-game threshold |
| 5–9 | low | Yes, but explicitly low confidence |
| 10–24 | moderate / medium | Yes |
| 25+ | high sample / high | Yes, provided results and IDs reconcile |

Win rate, suitability and fit score cannot bypass the five-game role-attributed threshold in the canonical recommendation. A 3/4 or 4/5 result may look strong but the former remains insufficient and the latter remains low confidence. Five games can technically produce Keep or Repair; this is a deliberate minimum, not high certainty.

Remaining risk: legacy helpers in `backend/main.py` use additional thresholds (often 3, 5, 7, 8, 10 or 20) and may generate noncanonical labels. The authoritative decision should remain the only user-facing source of Keep/Repair/Train Next.

### B. Chess score versus win rate

Canonical semantics are correct:

- win rate = wins / known results;
- chess score rate = (wins + 0.5 × draws) / known results;
- the response includes `drawTreatment` and rejects inconsistent W/D/L aggregates.

Concrete terminology debt remains outside the canonical contract:

- `App.findWeakLinesFromGames` calculates wins plus half draws but stores it as `winRate`/`win_rate` (`frontend/src/App.jsx:4083`).
- `App.aggregateFilteredOpeningGames` does the same (`frontend/src/App.jsx:4311`).
- multiple older components/services use a `getWinRate` helper that falls back to W/D/L chess score, then display “win rate.”
- backend `retention_metrics._win_rate` calculates chess score when direct fields are absent, and some legacy insight code treats `winRate`/`scoreRate` interchangeably.

These do not control canonical decisions, but they can mislabel secondary filtered, training or retention surfaces. Fixing them safely requires a frontend compatibility pass with explicit `scoreRate` fields and presentation tests; it was not folded into this engine-only change.

### C. Repertoire Health consistency

`repertoire_health_v2` is made from:

| Component | Weight | Category | Meaning |
|---|---:|---|---|
| Role completeness | 35% | coverage | proportion of White, Black-vs-e4 and Black-vs-d4 roles established |
| Concentration / consistency | 25% | consistency | average leading-opening share within roles with evidence |
| Evidence strength | 25% | confidence | role sample counts scaled to the 25-game high-confidence threshold |
| Unresolved recurring problems | 15% | weakness | 0 for the primary repair role, 50 for sufficient mixed signal, otherwise 100 |

There is no direct recent-performance component. Unavailable evidence is `null`, not zero, and available weights are renormalized to 100%. Every component includes value, effective weight, contribution, direction, evidence IDs and an explanation; `assert_decision_consistency` reproduces the total.

The specific “63/100 + no clear weakness” contradiction is addressed in the canonical contract: when there is no repair target, `weaknessExplanation` names missing roles, limited evidence, or the main limiting components. `repairStatus` says “No reliable repair target yet,” which is different from claiming that the repertoire has no health limitations.

Remaining risk: older `openingFitScore`, retention health and presentation helpers coexist. `apply_repertoire_coverage_score` overwrites the primary report aliases with the canonical score, but a stale persisted report may still carry an older formula/version.

### D. Weakness, coverage, confidence and inconsistency

The canonical model keeps these distinct:

- **Weakness:** owned opening, at least five correctly attributed games, score below 45 or a supported recurring issue; baseline guard applies where no issue exists.
- **Coverage gap:** no established opening in one of the three repertoire roles; action is `fill_repertoire_gap`, never Repair.
- **Low confidence:** evidence contract and `gamesNeeded`; it does not itself imply poor performance.
- **Inconsistency:** sufficient sample with score between 45 and 55, or a repair demoted against its role baseline; verdict Explore/mixed signal.

Unresolved Black-vs-other roles remain fail-safe rather than being mixed into Black-vs-e4/d4. This is conservative but means c4/Nf3 coverage is not currently a fourth scored repertoire role.

### E. Keep logic

Keep is conservative in the authoritative layer. It requires:

- owned repertoire context;
- trusted role attribution;
- at least five matching games;
- reconciled evidence;
- score rate at least 55;
- no supported recurring issue.

A declining recent trend can alter a legacy fit verdict from Keep to Fix in `apply_recent_trends_to_openings`, but the canonical recommendation ignores that legacy verdict and recomputes from traceable aggregate evidence. An established opening with a small new losing run therefore moves at most into Explore at the 55 boundary; it does not automatically become Repair/Replace. A genuine supported branch issue appropriately yields Keep-the-opening-and-repair-the-branch behavior through the diagnosis/training task.

### F. Recommendation churn

There is no explicit cross-report hysteresis. `previous_report` affects comparison eligibility, not the verdict. Hard score boundaries are 45 and 55, so a result close to either boundary can move between Repair/Explore or Explore/Keep after a few games.

Mitigations already present:

- no direct Keep → Experiment transition for a played owned opening;
- five-game minimum and confidence labels;
- 10-point role-baseline guard on issue-less Repair;
- recent trend does not override the canonical decision;
- Explore copy explicitly tells the user not to change the opening yet;
- persistent repertoire changes require explicit user acceptance.

The focused matrix locks down that a few losses can move Keep to Explore but not to Repair or Experiment in the examined stable samples. Explicit hysteresis should only be added if production history demonstrates harmful churn; otherwise it risks preserving stale decisions and obscuring current evidence.

### G. Opening classification

Classification uses exact move prefixes, ECO/tag signals, transposition/structure and piece placement, with deterministic ranking/provenance. Existing tests cover major ECO families and several transpositions.

Known limitation: `_opening_key` intentionally normalizes only spelling/whitespace. It does not pool arbitrary family/variation aliases because silent pooling can combine distinct evidence. Canonical family IDs from the classifier are therefore critical. Untagged or ambiguous structures can remain broad (“Queen's Pawn Opening”) rather than claiming a precise variation, which is the safer failure mode.

### H. Role/context

The three scored roles are White, Black vs 1.e4 and Black vs 1.d4. Evidence matching checks canonical context, opening identity, relationship, colour and legal role attribution. Faced openings cannot become repertoire repairs. Unknown player colour, unresolved opponent first move or contradictory role data fail closed.

The existing consistency validator rejects conflicting verdicts for the same canonical context and diagnosis/training evidence that escapes its target sample. The new focused matrix adds another unresolved-role regression.

### I. Exclusion accounting

The count contract is deterministic:

`fetched unique games = games used for opening stats + excluded games`

and:

`excluded games = sum(canonical exclusion reasons)`.

Canonical reasons are outside date window, unsupported time control/type, incomplete game, missing PGN/moves, insufficient opening plies, beyond analysis cap, parse failure, attribution failure, unclassified opening, not used for opening stats, and other. Duplicates are counted separately as `duplicateGamesRemoved` because the fetched denominator is already deduplicated. Any unassigned remainder is explicitly placed in `other`; there are no numerically missing games, though an unexpected `other` count should be operationally investigated.

### J. Target rating/ELO

Target rating has no analysis effect:

- import request does not send it;
- FastAPI import/job models do not accept it as an analysis parameter;
- recommendation thresholds and training difficulty use detected current rating where applicable, not the goal;
- canonical report decision has no target-rating reference;
- adding target fields to an in-memory report does not change recommendations or health in the focused regression.

Restoring the UI as an analysis control would currently provide no value. It can be valuable as progress tracking, but copy must not say it shapes training unless a separately designed, tested difficulty/planning contract is introduced. It should never change the evidence, score or confidence of observed games.

## 3. Root causes found

1. **Multiple generations of analysis outputs coexist.** Legacy fit/trend/retention recommendations remain in the response alongside `reportDecision`, creating semantic and presentation drift risk.
2. **Historical `winRate` aliases carry two meanings.** Canonical observed performance is correct, but several secondary frontend/backend helpers store chess score under a win-rate name.
3. **Decision boundaries are discrete and stateless.** This is understandable and conservative, but decisions near 45/55 can move between adjacent Repair/Explore/Keep states without cross-report hysteresis.
4. **Classification precision depends on canonical family propagation.** The code wisely avoids aggressive alias pooling; incomplete provenance can therefore split related broad/variation rows instead of risking false merges.
5. **Target-rating product copy and engine contract diverged.** The goal is persisted in generic settings/activity but never reaches analysis.

## 4. Behavior before and after

### Before

- The above invariants were distributed across several existing test files.
- There was no single compact matrix covering all twelve requested audit scenarios.
- Target-rating non-effect and Keep-to-nonreplacement behavior were inferred from implementation rather than explicitly locked down together.

### After

- Runtime behavior is unchanged.
- `backend/tests/test_analysis_engine_contract_audit.py` specifies the requested twelve cases using small synthetic samples.
- The audit documents the actual source of truth and separates verified canonical behavior from legacy semantic debt.

## 5. Tests added

The focused test file covers:

1. four games at 75% score → low evidence, no firm verdict;
2. forty games at stable 55% → high-confidence established Keep;
3. established opening plus three losses → Explore, not replacement;
4. poor 30-game established opening → genuine Repair;
5. missing Black-vs-d4 evidence → coverage gap;
6. unresolved/mixed role → fail safe;
7. transposed King's Indian move orders → deterministic family/ID;
8. W/D/L win-rate versus chess-score distinction;
9. exact import/exclusion reconciliation with zero unexplained `other`;
10. low health/no repair → coverage/confidence explanation;
11. a few new games cannot jump Keep to Repair/Experiment;
12. target-ELO fields do not change decisions or health.

Attempted focused command:

```text
python -m pytest backend/tests/test_analysis_engine_contract_audit.py backend/tests/test_authoritative_report_decision.py backend/tests/test_opening_perspective_decisions.py backend/tests/test_classified_game_attribution.py backend/tests/test_opening_diagnosis.py backend/tests/test_report_game_counts.py -q
```

It did not start: Windows resolves `python.exe` only to the Microsoft Store alias, which is inaccessible, and `uv` found no installed interpreter. No packages or interpreter were installed because the task forbids installation. The broader suite was therefore not run; per instruction it was not repeatedly attempted.

## 6. Files changed

- `backend/tests/test_analysis_engine_contract_audit.py` — new focused regression matrix.
- `docs/analysis-engine-contract-audit.md` — this audit.

The pre-existing untracked `docs/product-code-audit.md` is from the prior audit and was not modified as part of this engine-contract task.

## 7. Remaining risks

- Focused and full backend tests still need execution in an environment with the repository’s Python dependencies.
- No commit/push is permitted until those tests pass.
- Frontend score terminology needs a separate surgical compatibility task and tests; changing aliases directly could break persisted reports.
- Production report history should be sampled for real boundary churn before adding hysteresis.
- Production telemetry should monitor nonzero `exclusionReasons.other`, unresolved role rates and raw-versus-supporting sample replacements.
- Persisted pre-v6 reports need compatibility coverage whenever legacy response objects or aliases are retired.
- Black vs c4/Nf3 remains unscored/unresolved by the three-role health contract; this is transparent and fail-safe but may be a future product-model decision.

## Final status

**ROOT CAUSES FOUND:** contract multiplicity; legacy win-rate/chess-score aliasing; stateless decision boundaries; target-goal copy without engine input.

**FILES CHANGED:** one focused backend test file and this audit document only.

**BEHAVIOR BEFORE:** canonical behavior was mostly defensible but the requested scenarios were not consolidated into one explicit contract matrix.

**BEHAVIOR AFTER:** production behavior is unchanged; twelve requested invariants are documented and encoded as focused regressions.

**TESTS ADDED:** 12 focused engine-contract tests. Execution blocked before pytest startup due unavailable Python.

**REMAINING RISKS:** tests must pass before merge; no commit or push performed; legacy metric terminology and response duplication remain follow-up work.
