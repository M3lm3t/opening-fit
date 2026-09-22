# Stage 6C: correction and evaluation record

## Implemented locally after approval

- Scandinavian attribution requires the demonstrated `e4 d5` entry; historic e5/exd5 alone no longer supplies it.
- A later ...c5 after ...e6 and ...d5 no longer supplies a spurious Sicilian signal. The first correction exposed an equal French/Sicilian vote in the French fixture, so this narrow temporal predicate was necessary; no weights were changed.
- London requires Bf4 in the analysed move history, even when that bishop later plays Bg5 or Bg3. Jobava and direct London controls remain valid.
- Equal family totals (with only floating-point-roundoff tolerance) use the existing unresolved result: Unknown Opening, low/zero confidence, no matched rule or inferred side. Diagnostic signals are retained. Stable summation prevents candidate input order from deciding a floating-point tie.
- New classified records use `classificationContractVersion: 2`. The shape, health/decision versions and health weights are unchanged. The existing cohort comparison guard rejects v1/v2 comparisons; regression coverage also verifies v2/v2 eligibility. Saved reports are not recalculated or rewritten.

All three strict expected failures were converted to ordinary passing assertions. The original real-signal permutation fixture changed to a Sicilian with later ...e6/...d5, because the spurious competing signals in the French fixture have now been removed. The French regression explicitly verifies their absence.

Validation used only classification and affected downstream tests: **23 Stage 6C regressions passed**, **56 existing classification/attribution/decision/import tests passed**, and **22 comparison-policy tests passed** (101 distinct covered cases, combining valid runs). Both Chess.com and Lichess import tests ran. The high-vote ambiguity test covers record usage, pipeline counts, role establishment, strengths/problems and recommendations. One non-failing pytest plugin-rewrite warning remains.

Logs: `.release-build/stage6c/implementation-tests.log` (initial failure), `implementation-final-tests.log` (subsequently corrected fixture assertion), and `regressions-final.log` (23 passed, no expected failures). The 56 existing downstream results in the second run and the 22 unchanged comparison-policy results in the first run were reused rather than repeating broader suites. No frontend code changed, so no frontend build ran.

All 84 preservation hashes match the baseline, including the six unrelated tracked changes and protected Android/Capacitor files. No Android build/sync, storage or rollout changes, push or deployment. Deployment remains blocked by the previously documented older-client isolation problem.

## Historical evaluation before implementation

Baseline: local Stage 6B commit `9bef4c76ad404f29fa518d34c898315ca50b6d7b`. The sections below record the original evaluation and proposal; their expected failures have now been resolved as described above.

## Confirmed findings

1. **French transposition misclassified.** `1. e4 e6 2. d4 d5 3. e5 c5` returns French Defence, while `1. d4 e6 2. e4 d5 3. e5 c5` returns Scandinavian Defence. Python-chess legally replays both to exactly the same EPD, including side to move, castling and en-passant state. The incorrect output has confidence label `medium` and numeric classification confidence `0.88`. `structure_signals` admits Scandinavian merely from historic e4/e5/d5 moves; its contribution edges out the French transposition contribution when the direct French first-move signal is absent. This is a specific reproducible classification error, not evidence that all transpositions fail.
2. **Bg5 mistaken for London.** `1. d4 Nf6 2. Nf3 e6 3. Bg5 d5 4. e3 Be7` returns London System (`medium`, numeric confidence `0.84`), although no Bf4 defining move occurred. The London rule explicitly accepts Bf4 **or Bg5**. The existing broad Queen's Pawn Opening signal is available. A genuine Bf4 London control remains correctly classified.
3. **Order-dependent tie.** Equal-weight existing Italian and Ruy Lopez book signals produce Italian when Italian is first and Ruy Lopez when Spanish is first. `aggregate_signals` uses insertion order to break equal family totals. This is a controlled injected conflict using existing signals, not a demonstrated naturally occurring same-game tie. Both outputs are medium confidence (score 37); no high-confidence natural tie was established.

Positive controls: existing English-to-QGD and Reti-to-Slav move orders reach identical legal positions and preserve their families. Conflicting Nimzo/French metadata cannot override Italian move evidence and remains recorded diagnostically. Permuting the real conflicting French/Sicilian/Scandinavian signals does not change the direct French fixture's winner.

## Smallest correction proposed for approval

- Narrow the Scandinavian predicate: e4/e5/d5 appearing somewhere in move history is insufficient. Retain the demonstrated direct Scandinavian prefix; do not assert other Scandinavian transpositions without verified supporting positions. In the recorded French fixture, existing French evidence should win without changing weights.
- Require Bf4 for the London-specific rule. Leave unsupported Bg5 systems in the existing broad Queen's Pawn fallback rather than adding a new opening taxonomy.
- Detect equal family totals before selecting a winner. Withhold a unique classification using the existing unresolved representation and retain candidate signals for diagnostics; do not resolve a semantic tie alphabetically. No ranking/scoring redesign is proposed.

Before an implementation is released, corrected classification semantics need an explicit classification-contract/version review so the Stage 6B comparison provenance cannot imply compatibility with previous attribution. Do not recalculate saved reports. The separate older-client rollout blocker remains in force.

## Executed evaluation

Added ten tests in `backend/tests/test_stage6c_classification_evaluation.py`. Seven pass and three desired-behaviour assertions are strict expected failures, with individual defect reasons; these are deliberately unresolved evaluation findings, not passing fixes. Reused six existing universal-detection tests.

Command: `.release-build/stage6a/venv/Scripts/python.exe .release-build/stage6a/run_backend.py backend/tests/test_stage6c_classification_evaluation.py backend/tests/test_universal_opening_detection.py -q -rx -p no:cacheprovider`.

Result: **13 passed, 3 expected failures**, one non-failing pytest plugin-rewrite warning. Evidence: `.release-build/stage6c/classification-evaluation.log`. No broad suites, frontend build, external research or device tests ran. No commit, push or deployment was performed.
