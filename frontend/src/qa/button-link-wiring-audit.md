# OpeningFit Button And Link Wiring Audit

Internal QA map for the June 2026 full wiring audit. "Actual result" records the post-fix behavior expected in the running app.

| Button/link label | Component/file | Expected action | Actual result | Fixed |
| --- | --- | --- | --- | --- |
| Analyse / Analyse New Games / Analyse Username | `App.jsx`, `AppPrimaryNav`, `ReturnUserDashboard`, `OpeningFitProfileDashboard`, `AppActionRouter.jsx` | Switch to analyse view and scroll to import form | Routes to `/`, opens analyse state, scrolls to `#import` or analyse hero | Yes |
| Import games / Analyse My Games | `App.jsx`, `LandingModal.jsx` | Start platform import when username is present | Calls `importGames`, disabled while loading or without a username | Yes |
| Chess.com / Lichess tabs | `App.jsx`, `LandingModal.jsx` | Select import platform | Updates `platform`; disabled during import in main form | Yes |
| Time format buttons | `App.jsx` | Select analysis time format | Updates `analysisTimeFormat`; selected state uses `aria-pressed` | Yes |
| Try demo / View sample report / View Example Report / Example Report | `App.jsx`, `LandingModal.jsx`, `AppPrimaryNav`, `AppActionRouter.jsx` | Load sample report and go to report | Calls `loadDemoReport` where rendered; router fallback sends report CTAs to `/report` | Yes |
| Go to Analyse | `App.jsx`, `AppActionRouter.jsx` | Return from empty report/train states to import | Switches to analyse and scrolls to import | Yes |
| Go to report / Report / View report | `MobileBottomNav.jsx`, `FloatingAppMenu`, `AppPrimaryNav`, `AppActionRouter.jsx` | Open report view | Routes to `/report` and scrolls to `#app-results`; empty state explains import requirement | Yes |
| Start training / Start training plan / Training / Train / Add to study plan | `App.jsx`, `MobileBottomNav.jsx`, `ReportCommandBar.jsx`, `AppActionRouter.jsx` | Open training view/plan | Routes to `/train`, opens train state, scrolls to `#training-plan` or `#study-planner` | Yes |
| Practice / Practise / Review this opening | `App.jsx`, `OpeningDetailsModal.jsx`, practice components | Open practice panel for selected opening | Calls `startOpeningPractice`; low-confidence rows are disabled rather than clickable | Yes |
| Replay / Games / Data | `App.jsx`, `MobileBottomNav.jsx`, `ReportCommandBar.jsx`, `AppActionRouter.jsx` | Open training/data replay area | Routes to train state and scrolls to `#game-replay`; empty state explains missing PGN/move data | Yes |
| View recommendations / Repertoire / My White Repertoire / My Black Repertoire | `App.jsx`, `AppPrimaryNav`, `ReturnUserDashboard`, `AppActionRouter.jsx` | Open repertoire/report recommendations | Routes to report state and scrolls to repertoire anchors with report fallback | Yes |
| See verdicts / Full report / Evidence table / See What We Learned | `App.jsx`, `CurrentReportSummary`, `AppActionRouter.jsx` | Show full report/table sections | Toggles report mode and scrolls to evidence/verdict sections; router fallback covers label clicks | Yes |
| Save report / History / Saved reports | `ReportHistoryVault.jsx`, `App.jsx`, `AppActionRouter.jsx` | Save/load local or cloud report history | Save/load/delete handlers remain wired; History routes to profile history | Yes |
| Export / Download report / Export report JSON | `OpeningReportActions.jsx`, `OpeningFitFunctionalTools.jsx`, `OpeningFitFunctionalityHub.jsx`, `AppActionRouter.jsx` | Download PDF/JSON where implemented, explain unavailable PDF fallback | Implemented export buttons keep their handlers; router shows friendly message only for unwired PDF/download labels | Yes |
| Share / Copy text / social share buttons | `ShareReport.jsx`, `OpeningReportActions.jsx`, `DashboardHome.jsx` | Copy/open share destination | Existing handlers copy text, use Web Share where available, or open social/email URLs | Yes |
| Sign in / Login / Account | `App.jsx`, `AccountPanel.jsx`, `AppActionRouter.jsx` | Open account/login panel | Routes to `/login` or `/account`, scrolls to login/account panel | Yes |
| Sign out | `AccountPanel.jsx`, `AppActionRouter.jsx` | Sign out through account panel | Existing account-panel handler owns sign-out; router gives friendly direction for stray sign-out labels | Yes |
| Get Founder Pass / Upgrade / Unlock full report / Pricing | `FounderPassLoginUpgrade.jsx`, `App.jsx`, `AppActionRouter.jsx` | Open Founder Pass explanation/checkout flow | Routes to premium/account and opens Founder Pass modal; unauthenticated users are sent to login/account first | Yes |
| Profile / Progress / Settings | `MobileBottomNav.jsx`, `AppPrimaryNav`, `ReturnUserDashboard`, `AppActionRouter.jsx` | Open profile and target section | Routes to `/account`, opens profile, scrolls to account/progress/settings anchors when present | Yes |
| Feedback / Send Feedback | `App.jsx`, `OpeningFitFunctionalityHub.jsx`, `AppActionRouter.jsx` | Open feedback or submit feedback | Feedback nav opens `#feedback`; submit validates message and posts feedback | Yes |
| Burger menu items | `FloatingAppMenu` in `App.jsx` | Toggle menu and route each item | Toggle opens/closes menu; Analyse, Report, Train, Profile, Feedback route and scroll correctly | Yes |
| Mobile bottom nav items | `MobileBottomNav.jsx` | Large tap targets route main states | Analyse, Report, Train, Profile set view, push path, and retry scroll after render | Yes |
| Theme toggle | `App.jsx` | Toggle light/dark mode | Updates theme state, localStorage, document classes, and `data-theme` | Yes |
| Close modal buttons / Escape / outside click | `LandingModal.jsx`, `FounderPassLoginUpgrade.jsx`, `OpeningDetailsModal.jsx`, modal components | Close modal by visible close button, Escape, and backdrop when appropriate | Landing and opening details support Escape/backdrop/close; Founder Pass now supports Escape, backdrop, and close | Yes |
| Disabled premium import ranges | `App.jsx` | Prevent free users from selecting 6/12 month import | Options are disabled with Premium label until `isPremium` is true | Yes |
| Error retry / cloud-save login CTA | `App.jsx` | Retry import or open login/account explanation | Retry calls `importGames`; cloud-save CTA opens login/account panel | Yes |

Audit coverage: landing before analysis, sample report, imported report states, logged-out/local profile, logged-in profile, free/premium CTA behavior, mobile and desktop nav, light/dark shared states, loading overlay, empty/error states, modal close behavior, and report/practice/history/export/share flows.
