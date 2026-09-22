# Stage 6A evidence integrity — local review candidate

Base: `main`, `263228cb82cd67237541d114dd4c07cad711abc2`. No commit, push or deployment performed. No AGENTS.md was found in the repository or applicable parent locations during instruction discovery.

## Verified root causes and changes

1. `opening_fit_metrics.py` grouped games and merged metrics by display name. Both import callers already supplied canonical context and game identities, but the merge discarded these boundaries. Metrics now use the existing canonical context identity (or the explicit legacy classified-record tuple), including colour, ownership and role. Canonical display-name aliases do not split the same context. Game IDs are deduplicated; conflicting context/result/move evidence is excluded rather than arbitrarily selecting a copy. Missing attribution is not inferred from an opening name. Supporting IDs and per-game results are retained. A metric only merges into an aggregate with the same context and supporting membership; incomplete move-bearing subsets cannot replace full aggregates. Name-level historical totals in both import paths no longer receive role-specific auxiliary metrics.
2. `opening_recommender.py` accumulated W/D/L but reused the first batch's derived `score`. It now computes performance from the reconciled completed outcomes each time. Win rate and draw-inclusive score are distinct. Unknown outcomes remain in total game counts and are excluded from performance denominators. Overlapping batches use per-game outcomes; when those outcomes are unavailable, performance stays unknown rather than allocating aggregate wins to guessed IDs. Explicitly faced openings do not become currently played repertoire evidence.
3. Suitability used `value or 50`, replacing genuine zero values. Numeric finite values in [0, 100], including zero, are retained. Missing/null and invalid inputs keep the existing neutral fallback of 50 but are separately labelled `missing` and `invalid` in `traitInputStatus`; valid inputs are `observed`. Booleans, non-numeric strings, non-finite and out-of-range values are invalid. Weights are unchanged. Reason/watch-out checks use the same handling.
4. Preferences already meant main = MAIN_REPERTOIRE, experimenting = EXPERIMENT, ignore = IGNORED, automatic = detected historical classification. Selection formerly checked the original EXPERIMENT classification while health concentration used the effective classification; role selection could still choose ignored/experimental rows. One effective-membership policy now controls role eligibility, health concentration and strength/problem selection, including aggregate-only recommendations with canonical IDs. Historical classifications and evidence remain available. A main preference does not bypass sample or attribution requirements.

## Versions and compatibility

- Decision policy: `report_decision_v7`; structural `schemaVersion` remains 6 because the schema remains compatible and additions are optional.
- Health generation: `repertoire_health_v4`. The same four components, weights (35/25/25/15), arithmetic and thresholds remain; corrected evidence membership can change their inputs.
- Suitability: `opening_suitability_v2`.
- Auxiliary metrics: `deterministic_opening_fit_metrics_v2`.
- Observed-performance and confidence contract versions remain unchanged: their definitions are unchanged.

No saved-report migration, rewrite or automatic recalculation is introduced. Historical versions and stored scores remain readable. Backend comparisons and frontend comparison/progress consumers reject crossing the v4 generation boundary; existing transparency and report-model equality guards also reject differing versions. Existing historical comparison policies are otherwise unchanged. The broader Stage 6B comparison overhaul is not included.

Mission identity construction, assignment/completion contracts, persistence and history code are unchanged. Newly generated decisions can select different eligible evidence; old reports and mission records are not rewritten.

## Examples

| Evidence | Correct output |
| --- | --- |
| Same opening: five White wins, five Black losses | Separate contexts, five games each; 100% and 0% performance respectively |
| Five wins plus five losses, either batch order | Ten games, 50% win rate and 50% opening score |
| Eleven wins, two draws, five losses | 61.1% win rate; 66.7% opening score |
| One win plus one unknown outcome | Two games, one known outcome, one unknown; 100% observed score on the known outcome |
| No completed outcomes | Performance unavailable, not 0%; auxiliary result confidence remains low |
| Duplicate supporting IDs | Count once; contradictory or unresolvable evidence is not guessed |
| Trait 0 / absent / invalid | Observed 0 / missing neutral fallback / invalid neutral fallback |
| Ignored established opening | Historical evidence retained; excluded from main-role establishment and strength/problem selection |

## Validation executed

Declared `backend/requirements.txt` installed unchanged in `.release-build/stage6a/venv` with Python 3.12.13 and pytest 9.1.1. This includes python-chess 1.999 and chess 1.11.2. No dependency manifest changed. Test runtime files were isolated under `.release-build/stage6a/test-runtime`; an initial existing test's analytics additions were removed only after matching the exact recorded baseline prefix/hash.

- **428 backend tests passed**, including 45 new Stage 6A cases and tracked opening, recommendation, decision, classified-game, analysis-job and mission suites. Full Chess.com and Lichess import entry points were executed with mocked platform responses, duplicate records and opposite-colour evidence.
- **734 frontend tests passed**, including new generation compatibility and report/share/training identity checks, and existing saved-report/sample contracts.
- **ESLint passed**, exit 0. Babel emitted its existing large-App.jsx generation notice.
- **Production Vite build passed**, exit 0. Large-chunk and plugin-timing advisories remain.
- **git diff --check passed**.
- Backend warnings: one pytest plugin assertion-rewrite warning from the isolation runner and eight Supabase client deprecation warnings; no test failures.

Exact backend invocation (PowerShell, repository root):

```powershell
$tests = @(git ls-files 'backend/tests/test_*mission*.py' 'backend/tests/test_*opening*.py' 'backend/tests/test_*decision*.py' 'backend/tests/test_*recommendation*.py' 'backend/tests/test_classified_game_attribution.py' 'backend/tests/test_analysis_engine_contract_audit.py' 'backend/tests/test_analysis_jobs.py')
& .release-build/stage6a/venv/Scripts/python.exe -B .release-build/stage6a/run_backend.py @tests backend/tests/test_stage6a_evidence_integrity.py -q -p no:cacheprovider --basetemp=.release-build/stage6a/pytest-final
```

Frontend commands, from `frontend` with the existing local Node 22.18.0 on PATH: `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`.

Logs: `.release-build/stage6a/backend-final.log`, `frontend-tests.log`, `lint.log`, `build.log`. The runner and environment are local validation artifacts, not proposed source changes.

## Intended files

Production backend:

- `backend/analysis/opening_fit_metrics.py`
- `backend/analysis/opening_recommender.py`
- `backend/analysis/report_decision.py`
- `backend/main.py` (both import callers)

Backend regressions:

- `backend/tests/test_stage6a_evidence_integrity.py` (new)
- `backend/tests/test_opening_fit_metrics.py`
- `backend/tests/test_authoritative_report_decision.py`
- `backend/tests/test_classified_game_attribution.py`
- `backend/tests/test_opening_perspective_decisions.py`
- `backend/tests/test_recommendation_evidence_integrity.py`

Frontend contract compatibility and tests:

- `frontend/src/lib/generationCompatibility.js` (new)
- `frontend/src/lib/generationCompatibility.test.js` (new)
- `frontend/src/lib/openingFitScoreTransparency.js`
- `frontend/src/lib/reportComparison.js`
- `frontend/src/lib/progressExperience.js`
- `frontend/src/lib/canonicalReportSurfaces.test.js`
- `frontend/src/components/PublicTrustPage.jsx`
- This review document.

## Preservation and limits

All 84 recorded protected-file hashes match the pre-task baseline, including tracked Android files, Capacitor configuration and the six unrelated tracked changes. Android files, bundled assets, versions, signing and submissions were not modified; Capacitor sync and Android builds were not run. No SQL, schema/RLS, production data, billing or authentication changes. Nothing staged or committed.

Tests use fixtures and mocked external services. No live game import, authenticated production session, real database/RPC execution, native device or pending Play build was verified. The existing Android bundle predates the frontend v4-disclosure/comparison support: native compatibility must be checked before deploying the backend; this patch does not update that bundle. The API shape remains compatible, but that is not a claim that the old native client's methodology presentation correctly recognises v4.

Before release: review the generated changes against representative real reports; confirm stored v3 reports retain their values and mixed-version comparison is unavailable; exercise main/experimenting/ignore with an authorised account; check report/share/training agreement and existing missions; verify the pending Android client's handling of new-version reports. Outcomes remain performance evidence, not proof an opening caused a loss. Suitability validation and the wider Stage 6B–6D work remain separate.

The local patch is ready for review, not deployed. `.release-build/stage6a/stage6a-review.patch` contains only these 18 intended files, excluding unrelated changes and validation artifacts.
