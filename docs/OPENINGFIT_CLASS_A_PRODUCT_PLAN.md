# OpeningFit Class A Product Plan

## Purpose

Turn OpeningFit from a useful report site into a premium-feeling personal opening coach web app without replacing existing import, report, auth, premium, Stripe, Supabase restore, or persistence logic.

This plan is intentionally incremental. It keeps the current React/Vite SPA and FastAPI report contract, then organizes existing report, repertoire, practice, progress, and profile surfaces into clearer product routes.

## Proposed Route Structure

Current routing is SPA-driven with `activeView` plus `window.history` paths. Keep that model for the first rollout and consolidate route definitions in `frontend/src/appNavigation.js`.

Recommended product routes:

- `/dashboard` - personal coach home after a report exists. Initially an alias to the current analyse/report dashboard shell.
- `/report` - current report experience, including verdict, evidence, weaknesses, games/data, and report command bar.
- `/repertoire` - focused repertoire view. Initially route to the existing recommended repertoire section on `/report`.
- `/practice` - practice-first route. Initially route to current `/train` opening practice target.
- `/progress` - progress and milestones. Initially route to existing profile progress section on `/account`.
- `/profile` - account/profile surface. Currently `/profile`, `/account`, and `/login` all resolve into the profile section.

Compatibility mapping for the current app:

- `/` maps to `analyse`.
- `/report` maps to `report`, with section modes for verdict, repertoire, weak spots, training, and games.
- `/train` maps to `train`, `practice`, `interactive`, `games`, and `data`.
- `/account` maps to profile, account, history, and progress.
- `/login` maps to profile/login.
- `/premium` and `/upgrade` map to premium.
- `/openings`, `/openings/:slug`, `/chess-openings/:slug`, and `/guides/:slug` remain SEO/content routes.

## Proposed Component Structure

Add route-level product shells only after this audit:

- `CoachDashboardRoute` - reads the latest report and existing history, then composes coach summary, next action, mission, progress, and recent report cards.
- `ReportRoute` - thin wrapper around existing report sections and `ReportCommandBar`.
- `RepertoireRoute` - focused wrapper around existing repertoire/recommendation components.
- `PracticeRoute` - wrapper around existing practice board, weak-line training, and game replay.
- `ProgressRoute` - wrapper around existing health trends, milestones, report history, and retention snapshots.
- `ProfileRoute` - wrapper around current profile/account cards.

Keep reusable feature components under `frontend/src/components`. If route wrappers are added, place them in `frontend/src/routes` or `frontend/src/components/routes`, but do not move existing working components during the first implementation phase.

## Existing Components To Reuse

Practice:

- `OpeningPracticeLinesPanel`
- `GameReplayBoard`
- `TodayTrainingCard`
- `ContinueTrainingCard`
- `DailyMissionCard`
- `ResumeTrainingPrompt`
- `WeeklyOpeningSessionCard`
- `OpeningFitStudyPlanner`
- `RecurringOpeningHabits`
- `weakestLineTraining` and `trainingRecommendations` services

Report summaries and verdicts:

- `CleanReportHeader`
- `ReportCommandBar`
- `OpeningFitVerdict`
- `OpeningCoachSummary`
- `OpeningReportSummary`
- `OpeningFitReportHero`
- `OpeningFitDiagnosisFirst`
- `OpeningDiagnosisPanel`
- `EvidenceBackedOpeningDiagnosis`
- `OpeningEvidence`
- `OpeningInsights`
- `OneThingToFixCard`
- `WhatChangedSinceLastAnalysis`
- `ReportSnapshot`

Recommendations and repertoire:

- `RecommendedOpeningFit`
- `RepertoirePlan`
- `RepertoireStudyPlan`
- `OpeningRecommendationVerdict`
- `RecommendationReasonHint`
- `OpeningCoachPlan`
- `openingCopy`

Progress tracking:

- `OpeningHealthScore`
- `OpeningHealthTrends`
- `OpeningProgressTracker`
- `ProgressTracker`
- `OpeningJourney`
- `OpeningGamificationProgress`
- `WeeklyOpeningReport`
- `WeeklyOpeningSummary`
- `ReportHistoryVault`
- `ReturningUserBriefing`
- `retentionMetrics`, `retentionEvents`, and `openingHealth` services

Profile/account:

- `AccountPanel`
- `AccountRestoreSync`
- profile card functions currently in `App.jsx`
- `ReportHistoryVault`
- `PremiumDashboard` and `PremiumPanel` only as existing gated surfaces

Navigation:

- `appNavigation.js`
- `AppPrimaryNav` in `App.jsx`
- `MobileBottomNav`
- `ReportCommandBar`
- `AppActionRouter`

## New Components To Add Later

Do not add these in the audit phase. Proposed later components:

- `CoachDashboardRoute`
- `CoachHomeSummary`
- `NextBestActionCard`
- `CoachMissionPanel`
- `RepertoireMap`
- `OpeningComparisonPanel`
- `ProgressMilestonesPanel`
- `CoachDataAdapter`

The most important new module should be a client-side adapter, not a new database/backend system:

- `frontend/src/services/coachDashboardAdapter.js`

It should accept `{ report, reportHistory, openingFitUserState, retentionSnapshots, recommendationHistory, analysedGames }` and produce a defensive view model for dashboard/repertoire/progress components.

## Existing Report Data Fields

Opening stats and opening rows:

- `top_openings` / `topOpenings`
- `best_openings` / `bestOpenings`
- `opening_stats` / `openingStats`
- `opening_fit_metrics` / `openingFitMetrics`
- `opening_games` / `openingGames`
- Per-opening fields currently used include `name`, `opening`, `games`, `wins`, `draws`, `losses`, `winRate`, `win_rate`, `score`, `fitScore`, `fit_score`, `openingFitScore`, `verdict`, `fitVerdict`, `confidence`, `confidenceLevel`, `context`, `side`, `openingRiskProfile`, `fitScoreBreakdown`, and recommendation reason fields.

Top/best/preferred openings:

- `preferred_white` / `preferredWhite`
- `preferred_black` / `preferredBlack`
- `opening_win_rates` / `openingWinRates`

Recommendations:

- `recommendations`
- `opening_recommendations` / `openingRecommendations` / `recommendedOpenings`
- `style_based_recommendations` / `styleBasedRecommendations`
- `basic_opening_recommendations` / `basicOpeningRecommendations`
- Recommendation buckets include `white_repertoire`, `black_vs_e4`, `black_vs_d4`, `black_vs_other`, `experimental_rare`, `too_little_data`, plus camel-case variants and `sections`.

Training plan:

- `training_plan` / `trainingPlan`
- `openingCoachInsights.focusMission`
- `recommended_action` / `recommendedAction`
- weak-line and training services derive additional targets from report rows and games.

Style profile:

- `style_profile` / `styleProfile`
- `styleProfile.summary`, `label`, `labels`, `scores`, `styleSignals`, and snake-case variants.

Recent games:

- `recent_games` / `recentGames`
- `opening_games` / `openingGames`
- game fields used defensively include `pgn`, `moves`, `movesText`, `result`, `opening`, `openingName`, `url`, `gameUrl`, `end_time`, `white_username`, `black_username`, player colour, ratings, and loss timing fields.

Opening score / health score:

- `opening_fit_score` / `openingFitScore`
- `opening_fit_score_v2`
- `openingfit_score`
- `opening_fit_score_explanation`
- `averageOpeningScore` / `average_opening_score`
- Client-derived `buildOpeningHealthSnapshot` returns `score`, `factors`, `breakdown`, `openingRatings`, `monthlyChange`, and `historyPoints`.

Coach insights:

- `opening_coach_insights` / `openingCoachInsights`
- Existing backend module: `backend/analysis/opening_coach_insights.py`
- Existing frontend component: `OpeningCoachSummary`

Import/profile metadata:

- `username`, `platform`, `player_profile` / `playerProfile`
- `gamesImported`, `gamesFound`, `gamesAnalysed`, `gamesAnalyzed`, `total_games`, `totalGames`
- `import_quality` / `importQuality`
- `months_checked` / `monthsChecked`

## Existing Data Sources For Product Surfaces

Coach dashboard:

- Latest report payload from local state, saved report history, or `report_history`.
- `openingCoachInsights`, `training_plan`, `openingHealth`, `recommended_action`, `styleProfile`, `best_openings`, `top_openings`, `recent_games`.
- `openingfit_user_state` for saved progress.
- `openingfit_retention_snapshots` for weekly/progress context.

Next-best-action card:

- Prefer `openingCoachInsights.focusMission`.
- Fallback to `recommended_action`, `training_plan[0]`, weakest low-fit opening from `best_openings`, or `buildTrainingRecommendations`.

Repertoire map:

- `opening_recommendations.sections`.
- `preferred_white`, `preferred_black`, `best_openings` context fields.
- Client-derived grouping into White, Black vs 1.e4, Black vs 1.d4, and later/not-now.

Opening comparison view:

- `best_openings`, `top_openings`, `opening_fit_metrics.openings`, `openingHealth.openingRatings`.
- Historical comparisons from `report_history` snapshots.

Progress milestones:

- `report_history`
- `openingfit_retention_snapshots`
- `openingfit_user_state.coach_progress`
- `openingHealthTrends`
- `OpeningJourney`
- `WeeklyOpeningSummary`

## Missing Data To Derive Client-Side First

Use safe client-side derived values before backend/API changes:

- Dashboard readiness state: derive from latest report presence and `gamesImported`.
- Repertoire completeness: derive from availability of White, Black vs 1.e4, and Black vs 1.d4 buckets.
- Opening comparison deltas: derive from latest two saved reports when available.
- Progress milestones: derive from report history health score changes and completed activity rows.
- Opponent response summaries: derive from `recent_games`, `opening_games`, PGN/move text, and existing common-opponent-response service; hide when parsing confidence is low.
- Next action priority: derive from `openingCoachInsights.focusMission`, weak lines, low fit score, or first training plan item.
- Dashboard confidence labels: derive from sample size and existing confidence fields.

Do not add backend fields or migrations until a client-derived version proves useful and stable.

## Sensitive Areas Not To Touch

Do not alter these systems during dashboard/repertoire/product-shell work unless there is a specific bug fix:

- Authentication and OAuth redirect logic.
- Supabase client, cloud restore, saved report sync, RLS-sensitive table access.
- Stripe checkout, webhooks, premium entitlement checks, Founder Pass gating.
- Chess.com/Lichess import endpoints and import request contracts.
- Existing report JSON contract.
- Report persistence and history save logic.
- Backend analysis algorithms unless a future phase explicitly asks for backend insight improvements.

## Phased Implementation Order

1. Route consolidation only:
   - Add aliases for `/dashboard`, `/repertoire`, `/practice`, and `/progress` in `appNavigation.js`.
   - Keep current sections and targets.
   - Do not move components.

2. Data adapter:
   - Add `coachDashboardAdapter`.
   - Normalize existing snake/camel report fields into one defensive view model.
   - Unit-test low/no data behavior if the repo has nearby test patterns.

3. Dashboard composition:
   - Add `CoachDashboardRoute` using existing components first.
   - Show latest report summary, next best action, weekly mission, opening health, and report history preview.

4. Repertoire route:
   - Wrap `RecommendedOpeningFit`, `RepertoirePlan`, and existing recommendation verdicts into a focused `/repertoire` view.
   - Use client-derived buckets from current recommendations.

5. Practice route:
   - Wrap `OpeningPracticeLinesPanel`, `TodayTrainingCard`, `GameReplayBoard`, and weak-line training actions.
   - Route all practice CTAs through the same handler currently used by report/profile.

6. Progress route:
   - Wrap `OpeningHealthTrends`, `OpeningJourney`, `ReportHistoryVault`, and weekly summaries.
   - Use report history only; do not add new progress tables.

7. Cleanup pass:
   - Reduce duplicated route maps in `AppActionRouter`, `MobileBottomNav`, `ReportCommandBar`, and `AppPrimaryNav`.
   - Only after route wrappers are stable.

## Current Duplication And Naming Risks

- Route knowledge is duplicated across `appNavigation.js`, `AppPrimaryNav`, `MobileBottomNav`, `ReportCommandBar`, and `AppActionRouter`.
- `/account`, `/profile`, and `/login` share the profile section but use different names, which can confuse future product routing.
- `/train` currently hosts practice, training, games, data, and interactive modes; future `/practice` should be an alias first.
- Repertoire currently lives as a report subview (`recommendations` / `repertoire`) rather than a standalone route.
- Progress currently lives partly under report and partly under account/profile.
- Many report fields support both snake_case and camelCase, so new components should use an adapter rather than repeating fallback chains.
- Several components overlap in purpose: `OpeningHealthScore` vs `AppOpeningHealthScore`, progress/gamification/retention cards, and multiple recommendation/repertoire cards. Reuse one canonical product surface before adding more.

## Build Requirement

After each implementation phase, run:

```bash
cd frontend
npm.cmd run build
```

Also run lint when code changes touch imports, components, or services:

```bash
cd frontend
npm.cmd run lint
```
