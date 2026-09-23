# Stage 6D bounded local review

## Changes

- Retain defaulted and partial trait provenance without changing numeric heuristics or ranking weights. The UI withholds unsupported trait bars, preserves legitimate zero, and qualifies historical estimates with unavailable provenance.
- Describe unplayed recommendations as heuristic catalogue suggestions, not personally proven fits. Remove fabricated style-text fallback trait values and unsupported recurring-mistake/drill promises.
- Require a legal position recoverable from a same-colour supporting game or an existing authoritative legal reference continuation before offering a drill. Respect the selected opening/role. Otherwise route the review action to report Evidence using the existing navigation contract.
- Describe legal alternatives outside a saved line as unassessed and reset the board for a usable retry. Preserve stored training history when saving a currently eligible task.

## Validation

- 48 affected backend tests passed through the existing isolated backend runner, including identity invariance, suitability, style, recommendations, decisions and diagnosis.
- Initial affected frontend run: 64 passed. Three additional reference-source, historical-training preservation and Evidence-navigation regressions subsequently passed, giving 67 distinct passing tests. The final targeted pair of files passed 17 tests and exposed a missing browser timer stub in the navigation fixture; that fixture now disables irrelevant delayed scrolling, and the failed test passed on its targeted rerun. Assertions were retained.
- ESLint and production Vite build passed. Existing large-file/chunk warnings remain. Git diff whitespace check passed.
- All 84 recorded preservation hashes matched, including the six unrelated tracked changes and protected Android files.
- No browser, native-device, live account or production checks were performed. Existing passing evidence was reused rather than broad suites repeated.

## Compatibility and limits

`traitProvenanceVersion: 1` is additive provenance metadata. Suitability v2, health v4, decision v7 and classification contract v2 remain unchanged: numeric calculation and ranking semantics did not change. Historical reports are not recalculated or rewritten. Training source eligibility is checked at presentation time; existing item IDs, storage version, mission assignment/completion contracts and retained history are unchanged.

No engine assessment is added. Missing source games, unrecognised opening-name aliases or unsupported historical tasks conservatively fall back to review. Older estimates without provenance cannot be reconstructed as measured preferences.

The older Android client rollout/storage-isolation blocker documented in `stage6-client-rollout.md` remains. These source changes require a future client build; this work does not change Android bundles or the pending Google submission. Nothing was pushed or deployed.
