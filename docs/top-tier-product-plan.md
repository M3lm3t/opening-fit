# OpeningFit top-tier product implementation map

Baseline: 2026-07-11, branch `audit/top-tier-product-plan`. This is an audit and sequencing document; no production logic, dependencies, database policy, payment logic, or data were changed.

## Architecture map

- Frontend entry and shell: `frontend/src/main.jsx` mounts React, the global error boundary, auth provider, Vercel Analytics, and service worker. `frontend/src/App.jsx` (661 KB) owns URL interpretation, marketing/app switching, import orchestration, report normalization, local persistence, most page composition, and many inline report/profile components. `appNavigation.js` provides imperative history/scroll navigation rather than a router.
- Public and SEO: homepage is composed in `App.jsx`; `SeoLandingPage.jsx`, `OpeningLandingPage.jsx`, `ChessOpeningSeoPage.jsx`, and `SeoGuidePages.jsx` render client-side routes from `data/openingSeoPages.js`, `data/chessOpeningSeoPages.js`, and `content/seoPages.js`. `public/sitemap.xml`, `robots.txt`, `index.html`, `_redirects`, and `vercel.json` provide discovery and SPA fallback. There is no server rendering or static route generation.
- Import client and states: `lib/importClient.js` calls `/api/import/{chesscom|lichess}/{username}` with a 90-second timeout. `App.jsx` validates input, sequences loading copy, normalizes the response, distinguishes no-game/thin-sample/success outcomes, and renders `ImportLoadingOverlay.jsx` plus inline empty/error states. `OpeningFitImportDoctor.jsx` exposes diagnostics.
- Report surface: `App.jsx` contains the main report hierarchy (`ReportPageShell`/overview, verdict, evidence, repertoire, fixes, training, games) and uses `CleanReportHeader`, `ReportCommandBar`, `OpeningFitDiagnosisFirst`, `OpeningFitVerdict`, `OpeningReportSummary`, `RecommendedOpeningFit`, `OpeningHealthScore`, `OpeningHealthTrends`, `OpeningCoachPlan`, replay/practice, sharing, and snapshot components.
- Fit score: backend `analysis/retention_metrics.py` is the authoritative OpeningFit score/identity/mastery/health snapshot builder; `analysis/opening_fit_metrics.py` calculates per-opening evidence and classification. Frontend presentation and fallback normalization are spread across `App.jsx`, `services/openingScorePresentation.js`, `OpeningScoreInfo.jsx`, `OpeningScoreExplanation.jsx`, `OpeningFitVerdict.jsx`, and `OpeningScoreProgress.jsx`.
- Recommendations: backend `analysis/opening_recommender.py`, `analysis/opening_recommendation_catalog.py`, `analysis/opening_coach_insights.py`, and large helpers in `main.py` combine style, rating, colour/context, sample confidence, trends, risk, fixability, ROI, and repertoire gaps. Frontend explanation/verdict adapters live in `services/recommendationExplanations.js`, `openingRecommendationVerdicts.js`, and related recommendation components.
- Repertoire/training/retention: `MyRepertoire.jsx`, `RepertoireStudyPlan.jsx`, `OpeningPracticeLinesPanel.jsx`, `CoachDashboard.jsx`, and services under `services/` implement weak-line practice, missions, habits, weekly sessions, XP, health, and progress. `RetentionJourneyPage.jsx`, `ReturningUserBriefing.jsx`, report history, and cloud snapshots drive returning-user UX.
- Navigation: `App.jsx`, `appNavigation.js`, `AppPrimaryNav`, `AppViewTabs`, `MobileBottomNav.jsx`, and `ProductAppShell.css`; URL state is manually synchronized with `pushState`/`popstate` and scroll targets.
- Auth and persistence: `lib/supabaseClient.js`, `context/AuthDataProvider.jsx`, `services/userDataService.js`, `AccountPanel.jsx`, `AccountRestoreSync.jsx`, and `accountApi.js`. Browser state uses `openingFit:*` localStorage keys; authenticated state restores and writes user-owned Supabase rows.
- Premium: `PremiumPanel.jsx`, `PremiumDashboard.jsx`, founder-pass components, `CheckoutStatusNotice.jsx`, and `accountApi.js`; backend Stripe/account endpoints are in `backend/main.py`; schema is in the premium migrations; `scripts/grantPremium.js` is a guarded service-role administrative helper.
- Backend: `backend/main.py` (486 KB) contains FastAPI routes, both platform import pipelines, analysis assembly, diagnostics, local JSON profile fallback, analytics/feedback, Stockfish endpoints, Supabase account endpoints, Stripe checkout/webhook lifecycle, and account deletion. Focused algorithms are under `backend/analysis/`; opening detection is in `opening_detection.py`.
- Styling/UI: `App.css` (1.1 MB), `index.css`, `ThemePolish.css`, four `styles/*.css` layers, and many component CSS files overlap. Shared primitives exist in `components/ui/UiPrimitives.jsx`, but much UI still uses local card/button patterns.
- Tests: 12 backend test modules cover opening detection, import enrichment, score/recommendation/retention algorithms, diagnostics, trends, and optional Stockfish. There is no automated frontend unit/component/E2E suite; `mobile-audit.cjs`, `frontend/scripts/visual-layout-check.mjs`, QA markdown, and screenshot folders are manual/utility coverage.

## Current flows

### Report generation

1. `App.jsx` validates username/platform/months/time-control, logs start events, and calls `lib/importClient.js`.
2. FastAPI `run_import_route` dispatches to Chess.com archive or Lichess NDJSON ingestion. Each pipeline normalizes profile/game metadata, filters unusable games, detects openings, builds style/fingerprint, fit metrics, recommendations, diagnostics, repertoire/training/retention data, progress comparison, and a dual snake/camel-case response. Middleware applies a final intelligence enrichment pass.
3. The backend saves a username/platform JSON profile under `data/profiles` and logs JSONL analytics; the response returns to `App.jsx`.
4. The frontend normalizes aliases and adds presentation fallbacks, stores the latest report locally, then renders `/report`.
5. For signed-in users, parallel best-effort writes save report history, analysed games, `openingfit_user_state`, recommendation history, activity, and retention/progress snapshots, followed by a refresh. Partial cloud failure does not discard the local report.

### Authentication and persistence

Supabase Auth persists under `openingfit:supabase.auth` and migrates legacy Supabase keys. `AuthDataProvider` restores the session, ensures/loads `profiles`, then loads current tables through `userDataService`; only `profiles` is required and optional table failures degrade gracefully. Guests restore the latest local report. Signed-in users restore cloud report/state/history/games and mirror selected legacy localStorage preferences into `settings.preferences.legacyStorage`. Sign-out clears restored user state; login remembers and restores the prior path. Direct client RLS writes are the main data path, while backend `/api/account/*` endpoints provide authenticated service-role profile/payment/account operations.

### Premium entitlement

The client derives access from an active, unexpired `premium_entitlements` row or legacy `profiles.is_premium`. Checkout requires Supabase auth; the backend validates the bearer user, resolves the Stripe price, creates payment/subscription checkout, and returns to `/account`. Access is activated idempotently from the signed checkout-session sync and Stripe webhook, recording Stripe lifecycle fields and updating the legacy profile flag. Subscription lifecycle webhook events update/cancel entitlement state. Do not change this path without webhook, idempotency, authorization, and restore regression tests.

## Overlap and later removal candidates

Overlapping concepts requiring consolidation, not immediate deletion:

- Report heroes/summaries: inline `OpeningFitReportHero` and `OpeningFitSummaryCard` in `App.jsx` overlap files `OpeningFitReportHero.jsx`, `OpeningFitSummary.jsx`, `OpeningReportSummary.jsx`, `OpeningSnapshot.jsx`, and `ReportSnapshot.jsx`.
- Diagnosis/verdict: `OpeningFitDiagnosisFirst`, `OpeningDiagnosisPanel`, `EvidenceBackedOpeningDiagnosis`, `OpeningFitVerdict`, `OpeningRecommendationVerdict`, and `AnalysisVerdictModal` repeat verdict/evidence framing.
- Recommendations/actions: `RecommendedOpeningFit`, `RecommendationExplanationPanel`, `RecommendationReasonHint`, `NextBestAction`, `NextBestActions`, `OneThingToFixCard`, and coach-plan cards overlap.
- Repertoire/plans: `MyRepertoire`, `RepertoirePlan`, `RepertoireStudyPlan`, `OpeningFitStudyPlanner`, and report-local repertoire blocks overlap.
- Progress/retention: `ProgressTracker`, `OpeningProgressTracker`, `OpeningScoreProgress`, `OpeningFitProgressionDashboard`, `OpeningFitRetentionCommandCenter`, `OpeningFitRetentionSystems`, health/trends, and several daily/weekly cards overlap.
- Premium: `PremiumPanel`, `PremiumDashboard`, `SeriousPremiumStrip`, `FounderPassLoginUpgrade`, and `FounderPassOutcomePanel` repeat entitlement/upgrade messaging.
- Navigation/actions: primary nav, view tabs, mobile nav, command bar, functionality hubs, and `AppActionRouter` maintain parallel action vocabularies.

Apparent safe-to-remove candidates after reference and visual verification: `assets/react.svg`, `assets/vite.svg`; deprecated wardrobe-era table compatibility (`onboarding_answers`, `measurements`, `outfits`, `favorites`, `uploads`, `ai_generations`); deprecated experimental retention defaults (`user_profiles`, `user_activity_log`, `user_streaks`, `user_goals`, `user_achievements`, `weekly_reports`); alternate persistence tables (`user_settings`, `analysis_history`, `saved_recommendations`, `opening_preferences`, `repertoire`, `saved_openings`, `chess_account_links`); legacy root `backend/opening_fit_backend.py`; and unwired experiment components such as `OpeningFitFunctionalTools`, `OpeningFitFunctionalityHub`, `DashboardHome`, `RepertoirePlan`, and `OpeningFitRetentionSystems`. Confirm via production analytics and a proper import graph before deletion.

## Highest-risk areas

1. Report response contract and alias normalization: two backend pipelines plus frontend fallbacks can silently diverge.
2. Premium checkout/webhook/legacy flag synchronization and service-role authorization.
3. Auth hydration races among local report restore, cloud restore, login redirects, and debounced localStorage mirroring.
4. `App.jsx` routing/view state: URL, active view, landing visibility, report availability, and scroll behavior are coupled.
5. Fit/recommendation logic: confidence thresholds, score scales, rating/time-control context, and sparse samples affect many surfaces.
6. Supabase migration history/RLS and dedupe keys across multiple persistence generations.
7. Chess.com/Lichess parity, external API rate/format behavior, and import timeouts.
8. Performance and CSS regressions: one 1.49 MB JS chunk and 1.27 MB CSS asset; large global selector surface.
9. Accessibility: many modals, accordions, imperative focus/scroll actions, charts/boards, and mobile navigation need keyboard/focus/screen-reader regression coverage.
10. SEO: client-only rendering and manually maintained parallel content sets/sitemap can produce incomplete crawler output or route drift.

## Prioritised phases

1. Contract safety: add shared report fixtures/schema assertions, import parity tests, frontend smoke tests for guest/auth restore, checkout state, navigation, empty/error states, and accessibility; document event taxonomy. No architecture replacement.
2. Product clarity: extract `App.jsx` page-level boundaries, establish one report composition and one score/recommendation explanation model, simplify homepage-to-import-to-report progression, and unify desktop/mobile navigation while preserving payload compatibility.
3. Core utility: make repertoire items and weak lines feed a single training queue; persist completion/progress consistently; create a focused returning-user dashboard and trustworthy comparison story.
4. Premium quality: align gates and upgrade copy to real entitlements, test checkout/restore lifecycle, and clearly distinguish free local history from cloud/premium value.
5. Quality/performance: route-level lazy loading, split heavy PDF/QR/chess views, reduce CSS duplication, meet WCAG keyboard/focus/contrast targets, and pre-render/static-generate public SEO routes.
6. Cleanup: remove proven-unused components/assets/tables only after import-graph, production-event, database-usage, and visual regression confirmation; then deduplicate the platform report builders behind tested shared helpers.

Expected Phase 2 files: `frontend/src/App.jsx`, `appNavigation.js`, `lib/importClient.js`, `context/AuthDataProvider.jsx`, `services/userDataService.js`, report/diagnosis/recommendation/navigation components and shared UI/styles; backend report contract tests and focused helpers in `backend/main.py`/`backend/analysis/*`. Payment endpoints and migrations remain out of scope unless tests reveal a defect.

## Database and environment

No migration is required for the Phase 2 UI/contract extraction. Likely later migrations: a canonical training-task/completion model; normalized repertoire selections/status; durable analytics event/session IDs if product analytics moves from JSONL; and, only after usage audit, a deprecation migration for legacy tables/columns. All must preserve existing rows and RLS.

Frontend variables: `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, optional `VITE_DEBUG_CLOUD_RESTORE`; `VITE_SUPABASE_SERVICE_ROLE_KEY` is explicitly forbidden. Backend/runtime variables: `FRONTEND_URL`, `FRONTEND_URL_WWW`, `SITE_URL`, `CLIENT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`/`STRIPE_PREMIUM_PRICE_ID`/`STRIPE_FOUNDER_PASS_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `OPENINGFIT_ENABLE_STOCKFISH`, `OPENINGFIT_STOCKFISH_PATH`, `STOCKFISH_PATH`, `ENGINE_ANALYSIS_CACHE_PATH`, `PUBLIC_HISTORICAL_GAMES_ANALYSED_BASELINE`, `APP_ENV`, `ENVIRONMENT`, and platform host marker `RENDER`.

## Baseline commands and results

- Frontend development: `cd frontend && npm run dev`; production build: `npm run build`; lint: `npm run lint`; layout utility: `npm run layout:check`; preview: `npm run preview`.
- Backend development: `uvicorn backend.main:app --reload --port 8001` from the repository root (or equivalent configured module path).
- Backend tests: `python -m pytest -q` from the repository root.
- Baseline results: build passed, with a large-chunk warning (JS 1,493.27 KB / 406.31 KB gzip; CSS 1,271.49 KB / 201.56 KB gzip); lint passed, with Babel deoptimizing generation for `App.jsx` over 500 KB; backend tests passed, 44 tests in 2.09s. No frontend test command exists. These are pre-change observations.

## Phase 2 shell implementation record

Implemented on 2026-07-11 without changing analysis, recommendations, authentication, entitlements, or payment behavior. `AppPrimaryNav` now has explicit marketing and authenticated-app modes; authenticated mobile navigation is one four-destination bottom bar (Report, Repertoire, Train, Progress), and `/progress` is a direct, back/forward-safe route. Existing UI primitives now include semantic status markers and reusable loading/empty/error/offline/insufficient/signed-out/locked page states. The final shell CSS layer standardizes safe-area clearance, focus visibility, touch targets, reduced motion, nested-card treatment, and modal interaction. `OpeningDetailsModal` now matches the existing verdict modal's focus trap, focus restoration, Escape handling, dialog semantics, and labelled close control.

Verification: build and lint pass; 44 backend tests pass; automated layout checks pass across 10 routes and 11 viewports from 320x568 to 1920x1080 in both dark and light themes. The expected missing-Supabase warning remains in local visual checks.

## Public homepage simplification record

Implemented on 2026-07-11 around a single outcome: submit a Chess.com or Lichess username and receive a personalised opening report. The previous live homepage combined a detailed mock dashboard, import controls, opening-guide cards, a four-benefit grid, another repertoire mock, three illustrated steps, returning-user modules, and the full application legal footer. The new public sequence is: direct outcome-led headline and import form; progressive analysis settings; compact three-result sample; verified aggregate count when available; three concise steps; five non-repeating outcomes; full-sample CTA; honest independent-product/founder note; guides link; and a complete public footer.

No lightweight public account-preview endpoint exists: `/api/profile/{username}` only returns previously saved OpeningFit profiles, while the platform import endpoints perform the full analysis. The homepage therefore does not pretend to provide a reliable pre-analysis avatar/rating/game-count card. Verified identity, avatar, rating context, and eligible-game counts remain sourced from the completed import response.

Live endpoint checks: Chess.com `hikaru` returned HTTP 200 with 130 imported games; Lichess `thibault` returned HTTP 200 with 95 imported games; deliberately invalid usernames returned HTTP 404 on both platforms. No API or report-generation changes were made.

## Import-journey reliability record

Implemented as a thin state model around the existing `lib/importClient.js` and `/api/import/{platform}/{username}` endpoints. States are idle, validating username, account found, fetching games, filtering eligible games, identifying openings, building recommendations, saving, complete, recoverable error, and fatal error. The loader no longer invents percentages or advances based on elapsed time. Since the backend request is synchronous and exposes neither a job ID nor progress events, fetching is the only long-running server stage; later stages reflect genuine client receipt/normalization/save work.

Supported error categories and recovery:

- Empty or unsupported username: correct the field; no request is sent and no report is replaced.
- Username not found/account unavailable: check spelling, visibility, or platform; previous report remains available.
- No public or too few eligible games: expand the supported period when possible, switch platform, or open the sample; small completed samples remain labelled as limited evidence.
- Platform rate limit/502/503/504: up to two controlled retries with increasing delay, then user-controlled retry.
- Backend/network unavailable: controlled retry for connection failure, then user retry; previous report retained.
- Timeout: no automatic retry because the synchronous server may still be working; user may retry after the original request is aborted.
- Empty/invalid API response: recoverable invalid-response state with user retry.
- Authentication expired or cloud save failure: completed report stays local; re-authenticate or retry sync.
- Premium entitlement verification failure: report remains complete; premium access requires account/checkout verification and does not gate the report payload.
- Local setup failure: fatal state for that attempt, with refresh/retry and last-report access.

Duplicate protection uses a deterministic platform/username/period/time-control request key, the existing `loading` guard, existing report-history upsert/dedupe keys, local latest-report replacement, and redirect deduplication. A session marker turns refresh during analysis into an honest interrupted/retry state. True refresh resume is not possible until the backend provides asynchronous job IDs/status polling. The selected frontend time-control preference is not currently sent to the backend import endpoint, so a distinct server error for “selected time control has too little data” cannot be produced without a future API contract change.

## Decision-first report record

The default `FinalReportFlow` now renders one decision path: compact player/report context; coach verdict; finite next session; available keep/repair/reduce decisions; compact health; role-based repertoire map; ranked recurring issues; supporting evidence; additional details; export/history. Mobile ordering is enforced in the same sequence. The current payload remains unchanged and `lib/reportDecisionModel.js` safely normalizes its snake/camel aliases.

Consolidated from the default path: `CurrentReportSummary`, `OpeningCoachSummary`, `DailyMissionCard`, `MissionImprovementCard`, `OpeningFitVerdictPanel`, `OneThingToFixCard`, `WeakLineSpotlightCard`, `ReportTrainingPreview`, `WeeklyOpeningSessionCard`, `RecurringOpeningHabits`, the duplicate `OpeningFitVerdict`, `RecommendedOpeningFit`, `FullReportHighlights`, `RepertoireCommandPanel`, `FocusedRepertoireSection`, `RepertoireMap`, `OpeningHealthScore`, `WeakSpotsCommandPanel`, `MobileReportQuickGuide`, `AnalysisNextStepsPanel`, and the separate recent-games section. These components were not deleted because other routes/legacy modes may still reference them.

Retained and relocated: `EvidenceTableSection`, `ReportOpeningFilters`, trust/import-quality panels, opening-health trends, previous-analysis changes, opening journey, score breakdown, thin-data detail, weekly report, gamification, report export/history, premium-aware evidence gates, game links, and training actions. Evidence and advanced modules now sit under progressive disclosure.

New report collaborators inside `App.jsx`: `DecisionReportHeader`, `CoachDecisionVerdict`, `ReportDecisionCards`, `CompactOpeningHealth`, `DecisionRepertoireMap`, `CostlyIssuesSection`, and `FiniteTrainingSession`. New selector: `reportDecisionModel.js` with variant tests. Missing backend fields are displayed as unavailable rather than inferred: recommendation-level opponent rating distribution, reliable recommendation recency timestamps, a canonical important-position/FEN reference, per-issue affected/lost-game IDs, and a stable prior-report comparison identifier. These should be added to the report payload in a future backend-contract phase.

## Fit trust and recommendation explanations

The real score sources are distinct. `opening_fit_metrics.py` supplies performance, early-loss rate, move-order/plan clarity and sample-aware classifications; confidence is low below 3 opening games, medium at 3–7, and high from 8. `opening_recommender.py` starts recommendation Fit from catalog trait-fit and applies rating/theory, successful-tag, current-opening, plan-clarity, recent-trend and opponent-rating adjustments. Retention mastery separately combines results, inverse loss rate, trend, consistency, sample size, weak-line penalties and completed training, with recency affecting confidence.

The UI now separates Opening Fit, performance, confidence and cross-report trend; qualitative Fit leads and the number is secondary. Explanations only render factors present in the payload. Samples below three games cannot become avoid/reduce decisions. Feedback uses the existing `recommendation_feedback` analytics event and stores no report contents or credentials, so no migration is required.

Backend limitation: candidates lack a stable structured relationship/complexity contract, so “simpler” and “more ambitious” alternatives are not manufactured. A later engine phase should emit structured factor identifiers, candidate relationships, learning burden, comparable-report trend provenance, and recommendation-level recency/opponent context.

## Repertoire workspace

The canonical editable workspace now uses `openingfit_user_state.coach_progress.repertoireWorkspace`, preserving the existing user-owned row, RLS policies, and `(user_id, platform, username)` upsert key. Anonymous state uses `openingFit:repertoireWorkspace:v1`; authenticated changes are written locally first and then reconciled into the matching cloud row. Manual status, role, lock, and notes win conflicts, while fresh report evidence refreshes games and Fit. Reanalysis never removes locked or manual-only openings.

The read-only `MyRepertoire` map and local-only positional `RepertoirePlan` overlapped. `MyRepertoire` is now the canonical route workspace; the legacy plan remains in the tree for import safety but is not another persistence source. Deprecated `repertoire`, `opening_preferences`, `saved_openings`, and `saved_recommendations` tables remain unused. No migration or RLS change is required. A future normalized table would only be justified for multi-device audit history or collaborative repertoires.

## Personal training sessions

The training route now places a finite three-task session ahead of the existing `OpeningPracticeLinesPanel`. Queue priority is: a task explicitly opened from report/repertoire; repeated weak lines; recent opening mistakes when supplied; failed/revealed prior tasks; newly selected Learning/Considering repertoire lines; then low-confidence opening fallbacks. No spaced-repetition claim is made because the product stores outcomes and reprioritises failures but does not yet implement interval scheduling.

The existing `chess.js` trainer remains canonical. It already flips for Black, advances opponent moves automatically, blocks opponent-piece input, supports click and drag/touch board interaction, shows history, retry/reset, reveal, explanations and exact saved weak lines. Supported alternative SAN moves can now be accepted when a line explicitly supplies `acceptedMoves`/`accepted_moves`. The queue persists its current task locally across refresh; existing cloud `coach_progress.openingTraining` continues to hold completed-line progress. Outcomes distinguish correct first attempt, correct after retry, revealed, and repeated failure and are stored locally under `openingFit:trainingOutcomes:v1`; authenticated completion continues through the existing activity/cloud-state path. No schema migration is required.

Real-game start FEN, played move, recommended continuation, source-game URL and practical explanation are consumed when the report supplies them. Missing or illegal PGN/move data falls back to the closest curated short line with an explicit notice. A later backend contract should provide a canonical deviation ply/FEN and structured alternative continuations for every mistake.

## Returning users and progress

The active Progress route now consolidates completed `report_history`, `activity_history`, the current report, and the local/cloud-backed repertoire workspace. The XP/achievement-led Journey is no longer the primary route experience. Progress is ordered as current health and coverage, completed-report comparison, training outcomes, recurring/resolved issues, and report history. Comparisons explicitly describe sequence rather than causation.

History normalisation excludes failed/pending rows, sorts newest-first, and deduplicates stable IDs/snapshot keys before comparison. Resolved issues require at least three prior occurrences, a reduction to at most half the previous frequency, and medium/high current confidence. Manual repertoire choices remain outside historical report payloads. Existing account deletion cascades and report-history ownership policies are unchanged.

New-game counts are displayed only when an existing response supplies `newEligibleGames`/`new_eligible_games`; otherwise the UI says a lightweight count is unavailable and offers an intentional check/reanalysis action. No full analysis runs automatically. Reanalysis is suggested after five verified new games, fourteen days, or a completed training cycle. The returning-user modal is suppressed in favour of the persistent dashboard and restrained dismissible notices. No database migration is required.

## Premium and checkout

Premium positioning now centres on the ongoing loop: reanalysis, cloud history, repertoire management, expanded personalised training, report comparisons and additional evidence. The active pricing route no longer stacks the legacy premium dashboard and repeated premium strip beneath the offer. Unbuilt weekly email and engine promises were removed. Display pricing remains configuration-driven through `VITE_FOUNDER_PASS_DISPLAY_PRICE` with the existing £8 fallback; Stripe remains authoritative for the actual charge and determines payment versus subscription mode from the configured Price.

Verified authority flow: authenticated checkout validates the bearer user, uses the authenticated email, attaches user ID to client reference and Stripe metadata, and returns only the hosted checkout URL. Signed success sync verifies session ownership and paid state. Webhook signatures are required. Entitlement writes use the service-role client and upsert on `premium_entitlements.user_id`; the checkout session ID is unique, making repeat delivery idempotent. Authenticated clients have select-only entitlement RLS, and a database trigger/revoked column permission prevents client changes to `profiles.is_premium`. Restore derives access from active entitlement rows (with the protected legacy profile flag fallback).

Checkout return now retries confirmation three times with increasing delay, reports confirmed versus delayed state, preserves the session context in the URL until dismissal, provides a support address, and explicitly says not to repurchase. Cancellation is non-destructive. Preview controls are development-only and the preview state never feeds `hasPremiumAccess`. Analytics record pricing views, prompt source, checkout start/completion/cancellation and entitlement confirmed/delayed without payment identifiers. No migration was required.

Remaining risks: there is no durable Stripe event ledger, so idempotency relies on entitlement upsert/unique session constraints rather than stored event IDs; the legacy protected profile flag remains a restore fallback; display price configuration must be kept aligned with the Stripe Price; and payment/webhook behaviour still requires Stripe test-mode integration checks in deployment.

## Public trust, privacy and support

Public direct routes now cover `/about`, `/how-it-works`, `/privacy`, `/terms`, and `/changelog`. They describe the deterministic opening/position analysis, confidence limits, public Chess.com/Lichess inputs, supporting-game inspection, independent builder, current third parties, recommendation limitations and support paths without claiming AI or engine capability.

Feedback remains on the existing Supabase-backed `/api/feedback` endpoint with the existing local backend fallback. The consolidated form supports general, recommendation, misidentification, import, payment and feature feedback. Category, route and a bounded non-secret report context are stored inside the existing message field so no parallel table or migration is needed; contact is optional or may use the authenticated account email. Tokens, PGNs, full reports and payment details are excluded.

Verified deletion flow: the client requires an authenticated session and explicit irreversible confirmation; the backend validates that bearer user, reads associated public usernames, removes matching server-side cached profile/latest-result files, deletes the profile, then deletes the Supabase Auth user. Current user-owned tables and premium entitlement rows cascade from `auth.users`; Stripe transaction records are not deleted because payment/accounting retention is separate. The client signs out, clears OpeningFit browser keys and shows a completion state before reload. A failure leaves the session available and presents a retry/support error. No RLS change or migration was required.

## Product analytics schema

One client helper, `lib/productAnalytics.js`, validates names, maps covered legacy events, allows only bounded scalar properties, adds route/device category, deduplicates explicit once-only events, logs detail only in development, and treats network failures as non-blocking. The backend repeats event-name and property validation before appending to the existing JSONL analytics stream. Vercel Analytics is mounted once in `main.jsx`; duplicate mounts in `App.jsx` and public route components are disabled.

Canonical events:

- Acquisition: `homepage_viewed`, `platform_selected`, `username_started`, `username_submitted`, `account_lookup_succeeded`, `account_lookup_failed`, `analysis_started`, `analysis_failed`, `analysis_completed`.
- Report: `report_viewed`, `coach_verdict_viewed`, `recommendation_expanded`, `evidence_viewed`, `supporting_game_opened`, `fit_explanation_opened`.
- Repertoire: `repertoire_viewed`, `opening_added`, `opening_replaced`, `opening_locked`, `recommendation_dismissed`.
- Training: `training_started`, `training_task_completed`, `training_task_failed`, `training_answer_revealed`, `training_session_completed`.
- Retention: `returning_dashboard_viewed`, `new_games_detected`, `reanalysis_started`, `report_comparison_viewed`, `resolved_issue_viewed`.
- Account/premium: `account_created`, `sign_in_completed`, `premium_page_viewed`, `checkout_started`, `checkout_cancelled`, `checkout_completed`, `entitlement_confirmed`, `entitlement_delayed`.
- Feedback: `recommendation_feedback_submitted`, `general_feedback_submitted`, `import_problem_reported`.

Allowed context is platform, route, authenticated/anonymous state, device category, result/error category, source, free/premium access, stage, bounded attempt/game/report counts, confidence/decision/feedback category and coarse opening category. Usernames, emails, IDs, session/payment/Stripe values, tokens, passwords, secrets, card data, PGNs, full games and report bodies are dropped.

Legacy mappings retained during transition: `frontend_import_started` → `analysis_started`; `frontend_import_completed` → `analysis_completed`; `frontend_import_no_games` → `analysis_failed`; coach practice/mission events → `training_started`; coach diagnostic → `evidence_viewed`; coach repertoire → `repertoire_viewed`; legacy entitlement and recommendation-feedback names map to their canonical equivalents. Obsolete import-stage/retry product events were removed; retry detail remains in operational diagnostics.

### Funnel reference and product metrics

- Analysis completion rate = unique `analysis_completed` / `analysis_started`.
- Time to first useful insight = `coach_verdict_viewed` time minus the corresponding `analysis_started` time where session-level joining is available.
- Report-to-training conversion = users with `training_started` after `report_viewed` / report viewers.
- Repertoire action rate = users with add/replace/lock / `repertoire_viewed` users.
- Seven-day return rate = users returning within seven days of first completed analysis; current anonymous JSONL events lack a privacy-safe stable visitor key, so this is authenticated/cohort-limited.
- Reanalysis rate = `reanalysis_started` / users with an earlier `analysis_completed`.
- Training completion rate = `training_session_completed` / `training_started`.
- Free-to-account conversion = `account_created` / anonymous users reaching `report_viewed` (cohort approximation until privacy-safe attribution exists).
- Free-to-paid conversion = `entitlement_confirmed` / free `premium_page_viewed` users.
- Import failure by platform = `analysis_failed` grouped by platform/error category / starts by platform.
- Mobile versus desktop conversion = the same funnel grouped by device category.

North-star metric: users who complete a recommended training action and later return after playing new games. Current events measure the component actions, but exact anonymous cross-visit attribution and verified new-game availability remain limited without a consented privacy-safe identifier and lightweight platform freshness endpoint.

## Performance, accessibility and reliability hardening

Production baseline before this pass: one 1,364.21 kB JavaScript application bundle (375.10 kB gzip) and 1,284.15 kB CSS (203.48 kB gzip). After route/feature splitting, the initial application chunk is 756.27 kB (203.10 kB gzip); initial vendor chunks are separated into React (190.80/60.01 gzip), Supabase (190.36/48.61), chess core (34.88/11.65) and icons (14.44/5.72). Account, repertoire, progress, premium, report-history and practice modules now load on demand in 7–36 kB chunks. Initial shared CSS is 1,231.98 kB (195.24 kB gzip), while 52.67 kB of account/dashboard/repertoire/progress CSS moved to lazy route chunks. The still-large inline `App.jsx` and legacy global CSS are the primary remaining bundle limits.

Confirmed changes: removed an unused eager `OpeningReportSummary` import; lazy-loaded account, practice/chessboard, premium, coach dashboard, repertoire, progress and report-history boundaries; separated vendor chunks without merging the lazy chessboard package into chess core; added stable route skeleton dimensions and reduced-motion behaviour; added explicit image dimensions/async decoding; and changed the service worker to cache-first hashed static assets plus stale-while-revalidate public guide/trust routes while keeping API and private navigation network-first.

Accessibility changes: replay controls have explicit start/previous/next/end names and Arrow/Home/End keyboard support; live replay status includes move count, side to move and last move; boards expose a position/orientation/turn/piece-count summary; interactive squares name their piece and coordinate; visual move lists remain keyboard buttons; import stages already announce through a polite live region; username errors now use `aria-invalid`, `aria-describedby` and an alert; lazy route fallback is a polite, fixed-size status; focus and reduced-motion foundations remain global.

Reliability: root error containment also covers lazy import failures; route chunks use one non-blocking Suspense fallback; invalid FEN still falls back to the initial position; missing replay moves, profiles, ratings, recommendations and history retain explicit empty states; service-worker API requests are never cached; checkout retries, import retry bounds, dedupe keys and cloud restore fallbacks are unchanged. Known limits: auth/Supabase and `chess.js` core remain in the homepage path because session restoration and inline PGN helpers live in `App.jsx`; legacy global CSS remains oversized; the existing board is not presented as a screen-reader move-entry system; and full signed-in/expired-session/slow-production-network checks still require environment-backed browser fixtures.
