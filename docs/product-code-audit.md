# OpeningFit codebase archaeology and feature audit

Audit date: 2026-08-10
Scope: repository inspection only. No production code, schema, dependencies, or behaviour were changed.
Method: static trace of frontend routes/components/state, API calls, FastAPI endpoints and response construction, Supabase migrations/RLS, entitlement gates, browser-storage keys, and cross-file references. “Reachable” means a reasonable current UI path exists in this repository; it does not prove the deployed build or production data is healthy.

## 1. Executive summary

OpeningFit has a large, mostly connected core product: Chess.com/Lichess import, an evidence-backed report, Keep/Repair/Watch decisions, a first training action, practice/replay, profile/history, a persistent repertoire, progress comparisons, cloud restore, and Stripe-backed Plus access. The current UI is narrower than the implementation.

The target-rating example is **not dead**, but it is also **not what its UI copy claims**. `/dashboard` renders a working “Road to Rating Goal” editor, stores `preferences.ratingGoal`, records `rating_goal_updated`, and calculates progress from the latest imported rating. However, the import request accepts only platform, username, months and time control; neither backend analysis nor recommendation code receives the target. Consequently, “OpeningFit will shape your training around it” is unsupported. The screen is a deep link and is absent from both desktop and mobile primary navigation. Classification: **RESTORE / FIX CLAIM**, not remove.

Other important findings:

- `/dashboard` (Today/coach) and `/journey` (training history) are implemented routes but missing from primary navigation. `/journey` is also Plus-gated.
- Share is split: report export/copy/download is live, but the standalone `ShareReport.jsx` component is unreferenced and the internal `share-report` action merely routes to report history.
- `ReturningUserBriefing.jsx` is the only plainly unreferenced top-level JSX component found by a filename/reference scan. Several older report/retention components are still referenced, so they are not deletion candidates merely because newer equivalents exist.
- The backend returns many rich analysis domains that have no literal frontend consumer: engine summary/validation, opponent-response report, rating-band benchmark, plan clarity, repertoire coherence/maintenance cost, opening ROI, “do not study yet,” and recent time-control/trend reports. Some may be folded indirectly into the authoritative decision; the raw response objects are nevertheless discarded by the UI.
- Schema history contains two overlapping generations of persistence. Current flows chiefly use `profiles`, `settings`, `activity_history`, `report_history`, `openingfit_user_state`, `recommendation_history`, `analysed_games`, `repertoire`, weekly plans/outcomes, and `premium_entitlements`. Generic `analysis_history`, `saved_recommendations`, `opening_preferences`, `saved_openings`, `chess_account_links`, plus retention-era `user_goals`, `user_achievements`, and `weekly_reports`, are restored/loaded or preserved but have little or no direct mutation/UI path.
- Avoid is not gone: firm Avoid/Replace is deliberately evidence- and rating-gated and is often presented as Watch/Improve/Park. Optional experiments also remain in backend recommendation sections and report consumers.

## 2. Complete current feature inventory

Status vocabulary: **Active** = visible normal path; **Partial** = some layer/gate is missing; **Hidden** = functional deep link or embedded control with poor discovery; **Orphaned** = no current UI entry/consumer found; **Legacy** = retained for compatibility and unsafe to remove without data checks.

| Feature | Frontend component(s) | Backend/API | Storage | Current entry | Tier | Status and notes |
|---|---|---|---|---|---|---|
| Chess.com import | `App`, `importClient` | `GET /api/import/chesscom/{username}`, analysis jobs | last report, report/game history | `/analyse` | Free limits / Plus limits | Active |
| Lichess import | `App`, `importClient` | `GET /api/import/lichess/{username}`, `/api/lichess/games` | same | `/analyse` | Free limits / Plus limits | Active |
| Demo/example flow | sample-report helpers, `AnalysisVerdictModal` | `GET /api/demo` | deliberately not user history | `/report/sample`, marketing CTAs | Free | Active and explicitly separated from real reports |
| Date/month controls | import form | import `months` query/job field | `openingFit:importMonths` | `/analyse` | 3 months free, 12 Plus | Active |
| Time-control import filter | import form | `time_control` query/job field | `openingFit:analysisTimeFormat`; report columns | `/analyse` | Both | Active |
| Report filters | `ReportOpeningFilters` | client-side over report data | `openingFit:reportFilters:v1` | full report | Both | Active: time control, date range, colour, opening query |
| Opening sample threshold | report filtering helpers | no backend input | `openingFit:openingSamplePercent` | import/report settings | Both | Active client presentation control, not analysis selection |
| Rating information/current rating | profile/report/player-level helpers | detected from platform games/profile; recommendation logic uses current rating | report JSON/profile | report/profile | Both | Active |
| Target ELO / target rating | `CoachDashboard.RatingGoalCard`, `todayRetention` | no dedicated endpoint and no analysis input | `settings.preferences.ratingGoal`; `activity_history.payload` | deep-link `/dashboard` only | Signed-in persistence; local display otherwise | Hidden/partial; does not shape training |
| Player style/style profile | report/profile components | `style_profile`, fingerprint, style recommendations | report history style fields | report/profile | Free | Active |
| Opening scores/opening confidence/sample confidence | evidence table, score info/disclosure | per-opening fit and confidence builders | report/snapshots | `/report` | Basic free; full evidence Plus | Active |
| Repertoire Health/methodology | primary report, score disclosure | retention/report-decision metrics | reports/snapshots/state | report; `/how-it-works` | Free | Active; not a chess rating |
| Keep decisions | decision map/evidence table | authoritative `reportDecision` | report/recommendation history | `/report` | first item free | Active |
| Repair/Improve decisions | same | authoritative decision and diagnosis | same | `/report`, `/train` | first item free | Active |
| Avoid/Replace/Park decisions | evidence/verdict helpers | generated only above evidence/player-level thresholds | report | evidence table | Both | Active but intentionally softened/gated; not removed |
| Optional experiment | style starter recommendations, repertoire plan | `experimental_rare`, style experiment, experimental repertoire slot | report/recommendation history | full report/profile | Both | Active/low prominence |
| Opening recommendations | decision map, focused repertoire, style starters | several recommendation payloads plus canonical `reportDecision` | report and recommendation history | `/report` | limited free/full evidence Plus | Active; multiple legacy payloads overlap |
| Saved recommendations/history | recommendation save flow and profile history section | Supabase direct | `recommendation_history`; local `openingFit:savedRecommendations` | report save action; profile | Both/account for cloud | Active, but legacy `saved_recommendations` table has no save flow |
| Train next/next action | primary summary, `ThisWeekTrainingExperience` | `trainingPriority`, `nextTrainingActions`, report decision | plans/state/outcomes | `/report` → `/train` | first task free/full week Plus | Active |
| Coach plan/seven-day plan | `SevenDayOpeningFitPlan`, `OpeningCoachPlan` | report training actions | local per-user state/settings | `/train` | Both | Active but several overlapping plan presentations |
| Weekly training plan | `ThisWeekTrainingExperience` | client plan builder, Supabase RPC/table | `weekly_training_plans`, tasks | `/train` | preview free/full Plus | Active |
| Training positions/own-game drills | `OpeningPracticeLinesPanel`, opportunity drill, game review | position analysis and Stockfish endpoints | progress/outcomes | `/train` | basic exercise free; own-game suite Plus | Active |
| Practice board/board settings | chess/position boards, `boardThemes` | optional position analysis | `openingFit:boardTheme`, training progress/session | `/train` | Both/advanced gates | Active |
| Game replay/evidence explorer | `GameReplayBoard`, evidence details | report `recentGames`/`openingGames`; saved analysed games | report and `analysed_games` | `/train`, report evidence | history limits by tier | Active |
| Excluded games/import quality | count summary/trust panels | explicit pipeline counts/reasons | report | full report/methodology | Both | Active as aggregate; no individual excluded-game explorer |
| Repertoire builder | `MyRepertoire`, workspace helpers | Supabase RPCs/direct fallback | typed `repertoire`; legacy state workspace | `/repertoire` | preview free/full Plus | Active |
| Saved repertoire/decisions | `MyRepertoire` | initialise/sync/accept/reject/replace RPCs | `repertoire`, settings intentions | `/repertoire` | Plus | Active; explicit confirmation prevents auto-replacement |
| Progress tracking | progress components/profile cards | comparison/retention metrics | report/state/history/outcomes | `/progress`, profile | mixed | Active |
| Historical reports/snapshots | `ReportHistoryVault`, profile saved reports | Supabase direct | `report_history` versioned snapshot + local history | profile/history action | saved vault Plus | Active; `/account` hosts it rather than its own route |
| Previous-report comparison | `ReportComparisonSection`, changed/health components | backend `progressComparison`; frontend snapshot comparison | versioned report snapshots | full report | Plus | Active when comparable baseline exists |
| Analysis history | restore layer | no dedicated backend UI API | `analysis_history` legacy table | none | Account | Legacy/orphaned as a distinct product concept; report history is canonical UI |
| Analysed games cloud sync | replay/mission/variation consumers | public count endpoint; client Supabase upsert | `analysed_games` | replay/training indirectly | Account | Active internally; no standalone library screen |
| Training history/journey | `RetentionJourneyPage` | client aggregation | activity, plans, outcomes | deep-link `/journey` | Plus | Hidden: route absent from primary nav |
| Activity/achievements/streak/XP | coach/profile/gamification cards | analytics plus Supabase direct | `activity_history`, state; legacy retention tables | `/dashboard`, profile | Account | Partial: live activity model, overlapping legacy tables |
| Account profile/account preferences | profile dashboard, `AccountPanel` | account profile/state APIs plus Supabase | profiles/settings | `/account`, `/login` | Account | Active |
| Training preferences | `PostReportOnboarding`, profile preferences | no analysis endpoint | settings JSON/local preferences | post-report and profile | Both | Active but indirect |
| Opening preferences | repertoire intentions | no dedicated API | settings JSON; separate `opening_preferences` legacy table | repertoire | Plus for full workspace | Partial: live concept bypasses old table |
| Cloud sync/restore | `AuthDataProvider`, `AccountRestoreSync` | `/api/account/sync`, state APIs; Supabase | current user-owned tables + local snapshot | login/account, automatic | Account | Active, deliberately optional per sub-save |
| Account deletion | `AccountPanel` | `DELETE /api/account/{user_id}` | current user-owned tables | account | Account | Active, destructive confirmation |
| Subscription/entitlements | premium/account panels | billing config, checkout, sync, portal, Stripe webhook | canonical `premium_entitlements` and webhook events | `/premium`, account | Paid | Active |
| Premium dashboard/coach features | Plus previews, weekly plan, outcomes, repertoire | feature-entitlement policy + protected rows | plans/repertoire/outcomes/history | report/train/repertoire/progress | Plus | Active; no single separate “premium dashboard” |
| Billing portal/controls | account/premium | `POST /api/account/create-portal-session` | Stripe/customer entitlement fields | account | Paid | Active |
| Share/export report | in-App `ReportExportAndHistory`; orphan `ShareReport` | none | download/clipboard/local history | full report export area | save-history gate | Partial: export works; dedicated share component and action are disconnected |
| Referral capture/code/admin | referral components/admin page/e2e | referral payment/admin endpoints | referral migrations | referral query/capture; admin deep path | Mixed/admin | Active but intentionally non-primary |
| Feedback | feedback UI | `POST /api/feedback`, local fallback | backend/Supabase depending config | contextual/action route | Both | Active |
| SEO opening pages | opening landing/SEO components | none | static data | `/openings`, `/openings/*`, `/chess-openings/*` | Public | Active and discoverable through SEO/footer links |
| SEO guides/trust/methodology | guide/trust/landing components | public contract/count endpoints | static | `/guides*`, `/about`, `/how-it-works`, `/privacy`, `/terms`, `/changelog` | Public | Active |
| Opponent preparation | inline opponent-prep UI | derives from report games | transient | report/profile context | Both | Active but not primary nav |
| Diagnostics/admin | import diagnostics, debug, referral admin | `/api/diagnostics/*`, `/api/debug/*`, `/api/admin/referrals*` | operational | deep/internal only | Internal | Keep internal; protect deployment access |

## 3. Reachable functionality and navigation audit

### Public and owned routes

| Route | Resolution and discoverability |
|---|---|
| `/` | Public landing; marketing nav and analysis CTA |
| `/analyse` | Primary import flow; marketing nav and “New analysis” |
| `/report` | Current persisted report; desktop/mobile Report |
| `/report/sample` | Example report; explicit marketing CTA |
| `/train` | Weekly plan, queue, practice, boards, replay; desktop/mobile Train |
| `/repertoire` | Workspace; desktop/mobile Repertoire |
| `/progress` | Progress; desktop/mobile Progress |
| `/account`, `/profile`, `/login` | Profile/account/auth; account control or mobile item |
| `/premium`, `/pricing`, `/upgrade` | Pricing/Plus; marketing nav, previews, mobile free-user item |
| `/dashboard` | Coach/Today dashboard; **deep-link only**—not in current primary desktop/mobile items |
| `/journey` | Training history; **deep-link/CTA only**, Plus-gated, absent from primary nav |
| `/guides`, `/guides/*` | public SEO hub/pages |
| `/openings`, `/openings/*`, `/chess-openings/*` | public opening hubs/pages |
| `/about`, `/how-it-works`, `/privacy`, `/terms`, `/changelog` | public trust/methodology pages |

Desktop app navigation is Report, Repertoire, Train, Progress, New analysis, and Account. Mobile bottom navigation is Report, Repertoire, Train, Progress, then Account for entitled users or Plus/Pricing for others (`frontend/src/App.jsx:11825`, `frontend/src/lib/mobileNavigation.js:1`). Mobile’s burger menu mirrors the desktop list and adds History only when a report exists. Neither navigation includes Dashboard/Today or Journey.

Report discovery uses a command bar/tabs plus in-page CTAs. Summary, full decisions, evidence, comparison, training launch, export/history and methodology are reachable. Some internal action aliases (`share-report`, `coach-plan`, `study-planner`) are scroll/router mappings, not standalone destinations (`frontend/src/App.jsx:15131`).

## 4. Hidden or disconnected functionality

| Item | Evidence | Classification | User impact / recommendation |
|---|---|---|---|
| Target rating card | dashboard card and save flow (`CoachDashboard.jsx:441`, `:812`) | **RESTORE / FIX CLAIM** | Users cannot discover it; saved target has no training effect. Add an entry only after choosing whether it is tracking-only or an actual model input. |
| Coach/Today dashboard | `/dashboard` resolves and renders (`App.jsx:12312`, `:16820`) but nav omits it (`App.jsx:11825`) | **RESTORE** | A substantial daily plan, streak, activity, goal and score surface is hidden. |
| Journey/training history | `/journey` route and component; Plus gate (`App.jsx:17117`) but no nav item | **RESTORE or MERGE** | Paid training history is hard to find; link it from Train/Progress or merge there. |
| `ShareReport.jsx` | exported but no import/render reference | **INVESTIGATE / REMOVE CANDIDATE** | A separate share UI is absent. Keep report export; decide whether social share is still desired. |
| `share-report` action | maps to profile/report-history, not Share UI (`App.jsx:15153`) | **MERGE/FIX** | CTA semantics can mislead; route to actual export/share control or rename. |
| `ReturningUserBriefing.jsx` | only self-reference found | **REMOVE CANDIDATE** | Superseded by live `ReturnUserDashboard`/`WeeklyRecap`; inspect design intent/tests before deletion. |
| Legacy repertoire workspace | fallback under `openingfit_user_state.coach_progress.repertoireWorkspace` | **KEEP INTERNAL** | Required to preserve/migrate older saved choices while typed repertoire rollout completes. |
| Retention-era tables | `user_goals`, achievements, weekly reports loaded but little direct current use | **INVESTIGATE** | Could contain historical users’ state; do not delete based on low code references. |
| Raw advanced analysis domains | backend returns objects with no frontend literal consumer | **MERGE/INVESTIGATE** | Potentially valuable evidence is computed/transferred then invisible; expose selectively or stop returning only after contract analysis. |

CSS contains older tab-visibility rules and many components overlap in purpose, but referenced code was not classified dead. Lazy imports, route action aliases, conditional entitlement rendering and compatibility fallbacks make reference count alone unsafe.

## 5. Target-ELO forensic analysis

### A–K answers

- **A. Exists?** Yes. A visible card/editor exists inside `CoachDashboard`.
- **B. Stored where?** Canonically as `settings.preferences.ratingGoal`; redundantly as an activity payload with type `rating_goal_updated`. The read model also accepts snake_case variants and legacy `profile.rating_goal` (`todayRetention.js:470`).
- **C. Persisted?** For an authenticated user, `onSaveSettings` and `onRecordActivity` flow through `AuthDataProvider` into Supabase `settings` and `activity_history`. There is no dedicated typed DB column or `user_goals` write. Without a connected authenticated save callback, the card closes but has no explicit local fallback.
- **D. Backend receives it?** The generic cloud persistence layer receives the JSON. The analysis backend does **not**: import requests carry `platform`, `username`, `months`, and `time_control` only (`frontend/src/lib/importClient.js:84`, `:150`).
- **E. Recommendation logic uses it?** No reference to target/goal rating exists in backend recommendation/analysis code. Recommendations use the detected **current** rating (`backend/main.py:9125`, `:9241`; Lichess equivalents `:9884`, `:10000`). Frontend training builders also do not read `ratingGoal`.
- **F. UI to change it?** Yes: current and target numeric inputs, Save and Cancel (`CoachDashboard.jsx:483`).
- **G. Why unreachable?** It requires `/dashboard` and a usable report. The route is implemented but omitted from primary desktop/mobile navigation.
- **H. Navigation removed?** Current code proves absence, not git history. No conclusion about when/why it was removed can be made without commit archaeology.
- **I. Fully functional but hidden?** No. Persistence/progress display works; promised personalization does not.
- **J. Partially broken?** Yes: undiscoverable, no local persistence fallback is evident, save errors are console-only, imported current rating overrides manually saved current rating, and no model uses target.
- **K. Obsolete/safe to remove?** Not established. Persisted settings/activity and a finished UI indicate product intent. First decide: restore as a tracking goal with accurate copy, or wire it as a genuine planning input with explicit semantics for platform/time-control rating.

### End-to-end trace

`/dashboard` → `RatingGoalCard` → `saveRatingGoal()` → `saveSettings({preferences:{ratingGoal}})` + `recordActivity("rating_goal_updated")` → Supabase generic JSON rows → `buildRatingGoalModel()` reads settings/profile/activity → detected current rating + start/target calculate a percentage → same dashboard card.

The trace stops there. There is no arrow into `importGames`, FastAPI analysis, `build_report_decision`, weekly training plan, report persistence payload construction, or report display.

## 6. Frontend/backend and persistence mismatches

| Mismatch | Evidence | Likely user impact |
|---|---|---|
| Rating-goal copy promises tailored training; model never receives goal | target trace above | User expectation is false even though save succeeds |
| `analysisTimeControl` backend alias is returned but UI relies on other normalized fields/local selection | response at `main.py:9294`; no literal frontend use | Low direct impact; duplicated contract increases drift risk |
| Backend produces rich raw reports with no consumer | section 7 | More payload/compute, and potentially useful insights invisible |
| Standalone Share component exists; action points to history | component scan and `App.jsx:15153` | “Share” may lead to saving/history rather than sharing |
| `saved_recommendations` table is restored but active saves use `recommendation_history` | `userDataService` table lists/save methods | Old saved items may not appear in current recommendation-history UI |
| `analysis_history` is restored as fallback/count, while profile/report UI uses `report_history` | `AuthDataProvider.jsx:185`; report UI | Historical analyses in only the older table may be under-surfaced |
| `opening_preferences` table exists; current intentions/training preferences live in settings | migration and `MyRepertoire.jsx:168` | Legacy preferences may not affect current UI |
| `user_goals` exists/loads; rating goal writes settings/activity | migration, provider, target save flow | Two goal models diverge; old goal rows do not drive rating card |
| `notification_preferences` loads but no clear current settings editor was found | provider/service references only | Persisted choices are not readily manageable |
| Public report keeps only recent 10 games while analysed games sync separately | `main.py:9252`, user-data sync | Replay/evidence breadth depends on successful account cloud sync and tier limits |
| `/api/user-state` legacy backend and direct Supabase `openingfit_user_state` coexist | endpoint list and current frontend service | Duplicate persistence paths raise restore/ownership risk |
| `backend/opening_fit_backend.py` exposes a second small FastAPI app | separate `/`, `/health`, Chess.com import | Deployment ambiguity; wrong entrypoint would provide a drastically reduced product API |

## 7. Analysis-response usage

The canonical Chess.com response is assembled at `backend/main.py:9277`; Lichess builds the parallel contract from `:10033`. Most fields are emitted in snake_case and camelCase aliases. The table groups aliases rather than pretending they are independent product data.

| Backend field/domain | Frontend consumer | Displayed? | Stored? | Assessment |
|---|---|---:|---:|---|
| identity, profile, current rating, title, platform | import normalization, profile/header/player-level | Yes | Yes | Used |
| pipeline game counts, exclusions | game-count summary, trust/analytics | Yes | Yes | Used |
| top/best/preferred openings | report decision/presentation/profile | Yes | Yes | Heavily used |
| `openingGames`, `recentGames` | evidence, replay, practice, cloud game extraction | Yes | Yes | Used |
| style profile/fingerprint | profile/style recommendations | Yes | Yes | Used; raw fingerprint less prominent |
| opening recommendations/style recommendations | compatibility normalizers, profile/report | Yes | Yes | Used, but overlapping sources |
| problem lines/training opportunities | weak lines, drills/practice | Yes | Yes | Used |
| fit metrics, retention metrics, health/mastery/one thing to fix | score, progress, training | Yes | Yes | Used |
| canonical `reportDecision`, diagnosis, training priority | primary report, repertoire, train | Yes | Yes | Authoritative current contract |
| next actions/training plan/study queue | training and compatibility fallbacks | Yes/partial | Yes | Canonical decision supersedes some legacy variants |
| progress comparison | comparison presentation/history | Yes when eligible | Yes | Used/gated |
| import quality | import summary/trust | Yes | Yes | `gameImportQuality` used; duplicate aliases not |
| engine summary + opening validation | no literal frontend consumer found | No | Only inside report blob | **Ignored raw data** |
| attribution diagnostics | no literal frontend consumer found | No | report blob | **Ignored raw data**; operationally useful |
| opening phase habits | no literal frontend consumer found | No | report blob | **Ignored raw data**, potentially useful training insight |
| opponent response report | no literal frontend consumer found | No | report blob | **High-value ignored data** for prep/repertoire |
| style-opening match | no literal frontend consumer found | No | report blob | **Ignored raw data**; some derived recommendations are shown |
| repertoire coherence + maintenance cost | no literal frontend consumer found | No | report blob | **High-value ignored data** |
| opening ROI + do-not-study-yet | no literal frontend consumer found | No | report blob | **High-value ignored prioritization** |
| rating-band benchmark | no literal frontend consumer found | No | report blob | **Ignored**, potentially useful but must avoid normative overclaim |
| plan-clarity report | no literal frontend consumer found | No | report blob | **High-value ignored training evidence** |
| time-control opening report | no literal frontend consumer found | No | report blob | **Ignored** despite report filter UI |
| recent-opening-trend report | no literal frontend consumer found | No | report blob | Raw object ignored; derived opening adjustments may surface |
| main-opening-leak | no literal frontend consumer found | No | report blob | Raw object ignored; canonical diagnosis/priority likely supersedes it |
| repertoire identity summary | one narrow consumer/reference | Limited | Yes | Underused |
| recommended repertoire plan/basic recommendations | limited compatibility/profile consumers | Partial | Yes | Overlaps canonical decision/workspace |
| archives checked | minor trust/debug consumer | Limited | Yes | Mostly diagnostic |

Frontend defensive normalizers expect many aliases and optional legacy shapes. The highest-risk expectation is not a single missing key but **contract multiplicity**: old recommendation arrays, derived fit data and authoritative `reportDecision` coexist. The code intentionally prefers the canonical decision in newer surfaces; removing legacy fields without fixture and persisted-report compatibility testing could break old reports.

## 8. Orphaned components

| Component/artifact | Reference result | Category | Notes |
|---|---|---|---|
| `ReturningUserBriefing.jsx` | no external source reference | REMOVE CANDIDATE | Likely superseded by inline `ReturnUserDashboard` and `WeeklyRecap`; confirm visual/product history |
| `ShareReport.jsx` | exported but never imported/rendered | INVESTIGATE / RESTORE or REMOVE | Web Share/clipboard/download implementation may still be useful; current report has a different export/history surface |
| legacy report/retention component family | many are imported/rendered conditionally | KEEP / MERGE | Do not label dead from age/name; current App renders numerous progress, weekly, retention and report components |
| `backend/opening_fit_backend.py` | separate app module, not frontend-referenced | INVESTIGATE | Could be an old deployment entrypoint; operational configuration must be checked before removal |

The scan found no broad population of exported-but-never-rendered JSX components beyond the two named frontend files. Internal helper functions and CSS selectors were not treated as components, and test-only libraries require a separate symbol-level bundler/dependency analysis before deletion.

## 9. Orphaned endpoints and backend capabilities

| Endpoint/capability | Current frontend relationship | Classification |
|---|---|---|
| `/api/import/chesscom/*`, `/api/import/lichess/*`, analysis jobs | active import client | Active |
| `/api/demo`, public analysis contract/count | sample, methodology/home metric | Active |
| account sync/profile/state, billing/portal/webhook | auth/account/premium | Active |
| `/api/openingfit/analyse-position`, premium Stockfish game/status | practice/advanced analysis paths | Active/gated |
| feedback and analytics | active clients | Active |
| diagnostics/debug endpoints | no normal product navigation | KEEP INTERNAL; deployment exposure review |
| admin referral endpoints | admin UI/deep route | KEEP INTERNAL |
| legacy `/api/user-state/*` | current UI primarily uses direct Supabase user state | INVESTIGATE; possible older clients |
| root-level non-`/api` import aliases | frontend uses `/api` paths | KEEP COMPATIBILITY until traffic/deployment logs prove unused |
| second app’s `/import/chesscom/{username}` | no current frontend need | INVESTIGATE deployment entrypoint |

## 10. Database/state archaeology

### Current, product-bearing persistence

- `profiles`: identity, linked chess usernames, last report and subscription compatibility fields.
- `settings`: generic preferences; current target rating, training preferences, repertoire intentions, response plans and recap state are nested JSON.
- `activity_history`: typed activity, points, dedupe and related-report metadata.
- `report_history`: full reports plus style/recommendation fields, analysis time format, dedupe keys and versioned normalized snapshots.
- `openingfit_user_state`: last report, coach progress, progress/import histories; also legacy repertoire workspace fallback.
- `recommendation_history`: detected/recommended openings, confidence, style, time-control and snapshot.
- `analysed_games`: saved game and per-game analysis used by replay/training/metrics.
- `repertoire`: evolved from one JSON row into typed active/considering/archived slot rows, with explicit transition RPCs and legacy migration.
- `weekly_training_plans`, tasks and `training_outcomes`: persistent Plus coaching loop.
- `premium_entitlements`, Stripe webhook events, referrals: canonical commercial/access state.

### Potentially abandoned or overlapping concepts

- `analysis_history`: older parallel to `report_history`; read/restore compatibility remains, no distinct UI.
- `saved_recommendations`: older parallel to `recommendation_history`; loaded/countable, active saves target recommendation history.
- `opening_preferences`: current preference writes use generic settings.
- original JSON `repertoire` column: retained explicitly for compatibility after typed repertoire migration.
- `saved_openings`, `chess_account_links`: schema exists; no normal current UI mutation path found.
- `user_goals`: does not back the current rating-goal editor.
- `user_achievements`, `weekly_reports`, `user_streaks`: overlap with activity/state/client-derived progression.
- `notification_preferences`: restored, but no clear current editor found.
- unrelated template-era tables (`onboarding_answers`, `measurements`, `outfits`, `favorites`, `uploads`, `ai_generations`) appear in the earliest persistence migration and are not OpeningFit product concepts. They are strong schema-cleanup candidates only after production inventory confirms whether they exist/contain data.

All user-owned tables have RLS/migration history. Do not collapse duplicates until production row counts, last-write timestamps, restore behavior and account deletion coverage are verified.

### Browser storage/state keys

Material keys include last analysis, report filters/history, username/platform/months/time format/sample percentage, theme/board theme, saved recommendations, repertoire workspace/pending action, training progress/session/outcomes, next study session, daily habit/missions, retention metrics/events, weekly recaps, training preferences, auth return path, checkout interval, import interruption (session storage), and Supabase auth/session data. Cloud restore snapshots broad `openingFit:`/`openingfit:` namespaces. Renaming or pruning keys without a migration can silently erase local-only users’ history.

## 11. Feature flags and gates

There is no general remote feature-flag system in the inspected code. The meaningful switches are:

- Central entitlement matrix (`frontend/src/lib/premiumEntitlement.js:17`): free initial report/basic score/style, one Keep/Repair/next action, 3-month history, one weekly preview task; Plus comparison, full repertoire/week/drills/history/outcomes/saved history/full evidence.
- Resolved entitlement derives only from protected entitlement rows, not URL/browser preview state. This is a strong boundary and should remain canonical.
- Environment capability switches: Supabase URL/anon key, API base, Stripe prices/config/backend secrets, support email, CORS/runtime configuration.
- Debug-only flags: `VITE_DEBUG_CLOUD_RESTORE`, `VITE_OPENINGFIT_SUPABASE_DEBUG`, and development logging. These do not hide customer features.
- Production-only service-worker registration.
- Conditional product states: authentication, report availability, sample mode, evidence/comparability thresholds, analysis completeness, and premium access. These are gates, not obsolete flags.
- `isPremiumPreview` remains in compatibility/test paths but mobile navigation explicitly ignores preview as authority.

No valuable feature was found behind a literal permanent `false` flag. The major invisibility problem is missing navigation, not a feature flag.

## 12. Valuable restoration candidates

1. **Target rating, with an explicit product decision.** Lowest-risk restoration is a tracking goal in Account/Progress with accurate copy. Higher-value work would pass a carefully defined platform/time-control target into plan generation—not retroactively distort evidence or opening scores.
2. **Today dashboard navigation.** It already combines daily plan, streak/XP, what changed, score, rating goal and recent activity. Add a desktop/mobile entry or merge the best cards into Progress/Train.
3. **Journey/training history discovery.** Link the paid feature from Train and Progress; it is part of the entitlement promise.
4. **Opponent responses, plan clarity, and do-not-study-yet.** These raw backend outputs align strongly with practical repertoire coaching. Reconcile them with the canonical report decision before adding UI.
5. **Time-control trends.** The app already collects/imports and filters time control, but the backend’s dedicated time-control opening report is invisible.
6. **Share semantics.** Choose one canonical export/share surface; either reuse the orphan component or remove misleading action aliases.
7. **Legacy saved-data visibility.** Migrate old `analysis_history`, `saved_recommendations`, goal and opening-preference data into the current models before retiring old tables.

## 13. Genuine dead-code candidates

These are candidates, not deletion authorization:

1. `ReturningUserBriefing.jsx` and its CSS after visual/history confirmation.
2. `ShareReport.jsx` only if product explicitly rejects dedicated sharing and current export covers requirements.
3. `backend/opening_fit_backend.py` only after deployment/process definitions prove `backend.main:app` is the sole entrypoint.
4. Duplicate snake/camel response aliases only through a versioned API/persisted-report migration.
5. Template-era non-chess tables only after production schema/data inventory and account-deletion/RLS review.
6. Legacy persistence tables only after row migration, restore tests, and usage telemetry.

## 14. High-risk areas that should not be touched casually

- Canonical report-decision, role attribution and confidence/evidence thresholds. These prevent side/context errors and overconfident Avoid calls.
- Report response aliases and normalization: old browser/cloud reports depend on mixed schemas.
- `report_history` dedupe/versioned snapshots and comparison eligibility.
- Typed repertoire transition RPCs, one-active-slot constraints and legacy workspace migration.
- Entitlement resolution, production reconciliation migrations, Stripe webhook idempotency and lifetime grants.
- RLS, auth UID/profile sync, account restore and deletion coverage.
- Game-count contract and analysed-game dedupe; public totals and trust copy rely on it.
- Local-storage namespace and migration logic; anonymous users may have no cloud copy.
- Optional cloud-save sequencing: analysis remains usable when a non-critical sync step fails.

## 15. Recommended priorities and deletion order

### Restoration priorities

1. Correct target-goal copy immediately in the next product change; then expose it via Progress/Account or remove the editor pending a real model design.
2. Make `/dashboard` and paid `/journey` discoverable, preferably by merging route ownership into the existing Train/Progress information architecture rather than adding many top-level tabs.
3. Establish one response contract: authoritative decision plus explicitly supported evidence domains. Decide whether ignored advanced objects become UI, decision inputs only, or are removed in a new API version.
4. Unify share/export/history semantics.
5. Run a production data census and migrate legacy persistence before schema cleanup.

### Deletion candidates, safest first

1. Unreferenced UI only after product confirmation and a production build/route test.
2. Stale action aliases and CSS only after DOM/visual tests.
3. Duplicate response fields through a versioned compatibility layer.
4. Old backend app/aliases only after deployment and access-log proof.
5. Database tables/columns last, after backups, row-level migration, RLS and account-deletion validation.

## Concise classification

**ACTIVE FEATURES:** Chess.com/Lichess analysis; demo; report scores, style, confidence and methodology; Keep/Repair/Watch/Avoid decisions; recommendations and experiments; first training action; weekly plan; practice board; own-game replay/evidence; repertoire workspace; progress/profile/report history/comparison; cloud restore; analysed games; account deletion; referrals; Plus checkout/portal/entitlements; SEO/trust/opening pages.

**HIDDEN BUT FUNCTIONAL:** `/dashboard` daily coach surface; rating-goal persistence/progress display; `/journey` training history; several advanced profile/retention cards; internal diagnostic/admin routes.

**PARTIALLY BROKEN:** target-rating personalization claim; share action/component split; older saved recommendations/analysis/preferences/goals versus current tables; notification preference management; overlapping legacy and canonical response/persistence models.

**LIKELY DEAD:** `ReturningUserBriefing.jsx`; possibly standalone `ShareReport.jsx`; possibly the secondary `backend/opening_fit_backend.py`; unused template-era schema—each requires the stated verification before removal.

**HIGH-VALUE RESTORATION CANDIDATES:** discoverable Today dashboard and Journey; honest target-goal tracking or real target-aware planning; opponent-response, plan-clarity, do-not-study and time-control insights; unified share/export; legacy-data migration.

**DO NOT CHANGE:** authoritative decision/evidence logic, role attribution, game-count contract, persisted-report aliases, repertoire transitions/migration, entitlement/Stripe reconciliation, RLS/auth restore, versioned report snapshots, or local-storage keys without dedicated migration and regression coverage.
