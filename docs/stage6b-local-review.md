# Stage 6B local review

Deployment remains blocked. This work is on `stage6-evidence-interpretation`; nothing was pushed or deployed.

## Separate preparation commits

- Stage 6A and its Android review: `6a7c12fa8e43e2b964129459bbe41af59a157644`.
- Version-aware client presentation and rollout proposal: `b829584b7f2e7c48e1af6907a68dcc2f2e402794`.
- Stage 6B is the separate commit containing this note.

## Completed scope

Backend and frontend comparison eligibility now require explicit compatible health and decision versions, player/platform identity, chronology, identified new games and matching cohort provenance. Window, requested and observed time controls, selection rule, cap, filtering contract and classification version must agree. Missing provenance withholds comparisons. Both Chess.com and Lichess attach cohort metadata from the complete analysed opening-game sample, not the ten-game recent preview. An explicitly unlimited cap remains distinct from a missing cap.

Opening comparisons require the same canonical context, repertoire role and colour. Duplicate contexts, insufficient known results, unknown outcome denominators and reduced opening exposure cannot produce improvement claims. W/D/L produce draw-inclusive opening score separately from win rate: 11/2/5 gives 66.7% opening score and 61.1% win rate. Historical fit scores are not substituted for these metrics.

Account/progress, report history, report decision presentation and dashboard comparison entry points use the shared eligibility policy. Disappearing or less frequent issues are not described as resolved. KEEP/REPAIR movement is a verdict change, not proof of a corrected move error. The dashboard no longer fabricates stability movement from half a health delta or from game count. Existing XP and achievements remain; new improvement awards cannot be inferred from legacy XP rows that lack comparison provenance.

Repeated legal continuations are described as observations. Training evaluates every accepted saved continuation, labels unlisted legal moves as saved-line deviations, and does not call an original legal move a validated error. New outcome metadata identifies `saved_line_adherence_v1` and explicitly leaves move quality unassessed. Generic issue labels without a matching position cannot establish a repeated move error. These changes do not add engine validation, alter mission identities, assignment/completion contracts or rewrite mission history.

## Versioning and historical compatibility

Stage 6A's unreleased health v4, decision v7, suitability v2 and auxiliary metrics v2 remain unchanged. Health weights are unchanged. The new comparison semantics are explicitly identified by `report_comparison_v1`; existing reports without that cohort provenance cannot silently opt in. Stored historical numeric values remain readable and are not recalculated or migrated. The new saved-line metric identifier distinguishes interpretation from old unversioned training outcomes; stored outcomes are not rewritten.

The submitted Android 1.0.18(21) bundle/source baseline `054626e7` is unchanged. Its recorded compatibility failures remain valid: it misdescribes v4 and can make unsupported mixed-generation comparisons. Current-source fixes do not update installed clients.

## Validation and preservation

Reused the affected-suite results: 456 backend passes and 341 frontend passes. The remaining one backend and three frontend failures were checked and resolved; assertions now require the intended provenance and distinguish legal moves from errors.

After the final edits, only failed or directly affected tests ran:

- 25 backend tests passed: shared comparison fixtures, cohort/context checks, both import callers and the previously failing methodology-comparison test.
- 47 frontend comparison/training tests passed, the failed presentation test passed, and 8 affected progress tests passed (56 total in these final runs; overlapping earlier coverage is not an additional unique-test count).
- ESLint passed; production Vite build passed; `git diff --check` passed.
- Existing Vite chunk-size/Babel large-file notices and pytest plugin/dependency warnings are non-failing.
- All 84 recorded preservation hashes matched, covering the six unrelated tracked changes and protected Android/Capacitor files. No Capacitor sync or Android build ran.

Logs are in `.release-build/stage6b/`: `backend-affected.log`, `frontend-affected.log`, `backend-final-targeted.log`, `frontend-final-targeted.log`, `frontend-failed-presentation.log`, `progress-final.log`, `lint-final.log`, `build-final.log`. No broad visual sweep, native-device verification, authenticated production import or cross-device production persistence check was performed in this task.

## Release blocker

The existing API receives no reliable report capability signal, and old clients read saved reports directly through Supabase and other mirrors. Neither an API-only switch nor a future Android release protects retained older clients from newly saved v4 reports. Keep this backend off production. The separate contract/storage-isolation and rollback proposal in [stage6-client-rollout.md](stage6-client-rollout.md) must be approved, implemented and tested before deployment. No guessed user-agent gate, schema/RLS change, historical relabelling or mandatory-update mechanism was introduced here.
