# OpeningFit dead-code candidates

Audit date: 2026-08-10

This is a removal inventory, not removal authorization. Reference counts were checked against the current frontend source, tests, documented deployment entry point, conditional routes, and compatibility paths. Database objects and persisted-report aliases are deliberately excluded from the safe categories because production data and older saved reports may still depend on them.

## HIGH CONFIDENCE SAFE

| File | Symbol / block | Why apparently unused | Replacement, if any | Risk | Confidence |
|---|---|---|---|---|---|
| `frontend/src/App.jsx` | Commented legacy body inside `DecisionRepertoireMap` — **REMOVED 2026-08-10** | The function returns `RepertoireCoverageMap` before the old JSX, and the old implementation was fully commented. It could not execute or be referenced. | `frontend/src/components/RepertoireCoverageMap.jsx` | Very low; history remains in Git. | High |
| `frontend/src/App.jsx` | `onPractice` and `onAnalyse` props passed to `DecisionRepertoireMap` — **REMOVED 2026-08-10** | The current wrapper accepts only `model` and `onEvidence`; React ignored the two extra props. | Coverage evidence navigation | Very low; covered by Repertoire route/report tests. | High |
| `frontend/src/components/ProductAppShell.css` | `.decisionRepertoireMap dt`, `dd`, and `dl` rules — **REMOVED 2026-08-10** | The only current `decisionRepertoireMap` renderer contains no description list. These selectors belonged to the removed legacy JSX. | Current coverage grid/status/detail rules | Very low; no runtime consumer was found. | High |
| `frontend/src/App.jsx` | `ShareReport` import | The identifier occurs only in its import; no render or function reference exists. | Current report export/history controls | Very low for the import line only; this does not authorize deleting the component. | High |

## LIKELY SAFE

| File | Symbol / block | Why apparently unused | Replacement, if any | Risk | Confidence |
|---|---|---|---|---|---|
| `frontend/src/components/ReturningUserBriefing.jsx` and `.css` | `ReturningUserBriefing` | No external import or render reference was found. Current return-user experiences are provided by the Profile dashboard, Today dashboard, weekly recap, and Journey page. | `OpeningFitProfileDashboard`, `CoachDashboard`, `RetentionJourneyPage` | Low-to-medium: check product screenshots and any dynamically loaded name registry before deleting. | Medium-high |
| `frontend/src/App.jsx` | `OpeningFitSummaryCard`, `OpeningFitVerdictSection`, `TopActionsSection`, `MobileReportQuickGuide` | Definitions were found without JSX or call references. The canonical report command centre now supplies health, Keep, Repair, and Train next. | `PrimaryReportSummary` and report tabs | Medium: some may be retained as saved-report fallback intent; run old-report fixtures and visual route tests. | Medium-high |
| `frontend/src/App.jsx` | `share-report` navigation alias | It routes to Profile report history, not a share/export control, and no live call site was found in the current route audit. | Report export/history area | Medium: old stored actions or deep links may still emit the alias. Rename/migrate before removal if telemetry shows use. | Medium |
| `frontend/src/components/ShareReport.jsx` | Standalone share component | The component is imported but never rendered. Current report export controls cover clipboard/download/history. | Current report export/history controls | Medium: tests still assert its wording, and dedicated Web Share behavior would be lost if product intends to restore it. | Medium |

## UNCERTAIN — DO NOT REMOVE

| File | Symbol / block | Why apparently unused | Replacement, if any | Risk | Confidence |
|---|---|---|---|---|---|
| `backend/opening_fit_backend.py` | Secondary FastAPI application | Current documentation names `backend.main:app`, and no current frontend points at this smaller app. Deployment configuration outside the repository may still use it. | `backend/main.py` | High: deleting a live deployment entry point could take an environment offline. Require process/configuration and access-log proof. | Low-medium |
| `frontend/src/App.jsx` | Older report helpers driven by `fitData` and win-rate fallbacks | Several helpers appear superseded, but some feed deep Evidence/Profile/Progress sections and old saved-report compatibility. | Canonical `reportDecision` presentation | High: pruning can break restored reports and entitlement-specific branches. Build an import/call graph and old-report fixtures first. | Low |
| Backend response builders and frontend normalizers | Duplicate snake_case/camelCase and legacy recommendation aliases | New surfaces prefer canonical decisions, but cloud/browser report history contains mixed historical shapes. | Versioned report contract | High: silent loss of saved-report rendering. Remove only through a versioned migration. | Low |
| Supabase migrations and restore services | `analysis_history`, `saved_recommendations`, `opening_preferences`, `user_goals`, retention-era tables | Current UI primarily uses newer tables/settings, but historical rows may exist and restore/account-deletion flows enumerate some older stores. | Current report/recommendation/settings/activity models | Very high: production data loss or incomplete account deletion. Requires row census, migration, backup, RLS, and deletion validation. | Low |
| `frontend/src/lib/mobileNavigation.js` and entitlement compatibility branches | Preview/access compatibility checks | Some paths appear redundant under resolved entitlements but protect lifetime and loading states. | Canonical protected entitlement | High: could expose paid UI or hide lifetime access. | Low |

## Removal prerequisites

Before removing anything beyond the high-confidence items:

1. Build a production import/call graph that includes lazy imports and route aliases.
2. Exercise persisted reports from every supported schema version.
3. Check deployed process definitions and production traffic for backend entry points.
4. Check production row counts and last-write timestamps before any schema cleanup.
5. Run route, entitlement, lifetime-access, report-contract, frontend, and backend regression suites.
