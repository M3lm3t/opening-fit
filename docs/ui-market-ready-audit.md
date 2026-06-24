# OpeningFit UI Market-Ready Audit

Date: 2026-06-24

## Current UI Architecture Summary

OpeningFit is a Vite React 19 app with Tailwind 4 installed through `@tailwindcss/vite`, but the current UI is almost entirely class-based CSS rather than Tailwind utility composition. The main application shell, routing decisions, page composition, report flow, profile flow, import form, premium page mounting, and many reusable view helpers live in `frontend/src/App.jsx`.

Routes are handled inside the app instead of through a router package. `frontend/src/appNavigation.js` maps route keys to path, active view, scroll target, and fallback IDs. `App.jsx` derives `activeView`, `activeAppSection`, and route-specific rendering from that state, while also calling `window.history.pushState` and scrolling to anchors. Public SEO/opening pages are separate component trees such as `SeoLandingPage.jsx`, `OpeningLandingPage.jsx`, `ChessOpeningSeoPage.jsx`, and `SeoGuidePages.jsx`.

The global foundation starts in `frontend/src/index.css`, which defines core theme variables, light/dark variables, base element reset, focus styles, form defaults, tap target sizes, container tokens, radii, shadows, and background treatment. Most component styling then comes from `frontend/src/App.css`, which is very large and contains the main landing, app shell, cards, navigation, report, training, profile, premium, responsive, and late-stage override rules. Additional cross-cutting style layers are imported through `ThemePolish.css`, `components/LayoutDensity.css`, and `components/OpeningFitPolish.css`, plus many component-specific CSS files.

The main app shell uses:

- `AppPrimaryNav` in `App.jsx` for sticky desktop navigation and a mobile menu panel.
- `MobileBottomNav.jsx` for bottom mobile navigation.
- `.container` and `.appShell` as the main page width/gutter containers.
- `AppStoreReadinessFooter` in `App.jsx` for privacy, terms, and support.
- `ReportCommandBar.jsx` for in-report navigation.

## Duplicated And Inconsistent UI Patterns

- Buttons exist as `primaryBtn`, `secondaryBtn`, `secondaryButton`, `ghostButton`, `landingPrimaryBtn`, `landingSecondaryBtn`, `reportPrimaryLink`, `reportSecondaryLink`, `premiumCheckoutBtn`, `premiumDemoBtn`, `savedProfileButton`, and local component buttons. Their sizes, radii, widths, disabled states, hover states, and color treatments are repeatedly overridden.
- Cards use many parallel shells: `card`, `heroCard`, `premiumCard`, `premiumMiniCard`, `profileDashboardCard`, `commandPanel`, `fullReportShell`, `reportTrainingPreview`, `nextBestTrainingAction`, `openingReportShell`, `simpleProfileCard`, SEO cards, and more. Many share the same border/background/shadow intent but are styled independently.
- Badges and chips repeat as `eyebrow`, `landingPill`, `landingEyebrow`, `premiumLabel`, `premiumBadge`, `sectionBadge`, `chip`, `landingFitBadge`, `landingPriceBadge`, `reportEyebrow`, verdict badges, confidence badges, and opening evidence chips.
- Tabs and segmented controls appear in `ReportCommandBar`, `AppViewTabs`, `styleStarterTabs`, `platformSelector`, `analysisTimeFormatButton`, quick nav, report mode controls, and opening filters. They share behavior but not a single primitive.
- Empty, loading, and status states are scattered across `EmptyState`, `ImportLoadingOverlay`, `ChessLoadingMark`, `loadingCard`, `productEmptyState`, `importStatusBox`, `cloudSaveStatusPill`, `statusMessage`, `successMessage`, `errorBox`, and component-local notices.
- Page headers are inconsistent: landing hero, analyse/import hero, report command header, report section headers, profile cards, premium hero, SEO hero, and opening guide hero all define their own heading scale and spacing.
- Chess-board containers appear in `ChessPositionBoard`, `GameReplayBoard`, `OpeningPracticeLinesPanel`, board CSS in `App.css`, and practice/replay shells. Several board wrappers rely on important rules and late responsive overrides.
- Navigation is duplicated between `AppPrimaryNav`, `MobileBottomNav`, `ReportCommandBar`, older `AppViewTabs`, quick nav cards, SEO nav, and route aliases in `appNavigation.js`.
- Responsive CSS is layered through multiple breakpoint systems: `900px`, `760px`, `700px`, `640px`, `430px`, `390px`, `380px`, `980px`, `999px`, `1000px`, `1100px`, and `1200px`. Some late rules repeat `.appShell`, `.mobileBottomNav`, `.appPrimaryNav`, `.reportCommandBar__tabs`, and board sizing with `!important`.

## Recommended Shared Design Primitives

- `AppShell`: owns max width, gutters, top spacing, bottom mobile nav clearance, and common scroll margins.
- `PageSection`: standard section spacing, header block, optional eyebrow, title, description, and actions.
- `Stack`, `Cluster`, and `ResponsiveGrid`: small layout primitives for vertical rhythm, wrapping action rows, and predictable 1/2/3-column grids.
- `Card`: variants for default, subtle, raised, hero, action, warning, premium, and interactive. This should replace repeated card selector groups over time.
- `Button`: variants for primary, secondary, ghost, danger, premium, icon, full-width-mobile, and loading. Keep the current class names as compatibility aliases during migration.
- `Badge` or `Chip`: variants for neutral, info, success, warning, danger, premium, confidence, and verdict.
- `Tabs` and `SegmentedControl`: one structure for report modes, filters, platform selection, style/detected recommendations, and compact tab navigation.
- `FormField`: label, help text, input/select/textarea, validation message, disabled/loading state.
- `StatusNotice`: info, success, warning, error, saving, offline, and cloud-sync states.
- `EmptyState`: shared icon/title/body/action layout with compact and full variants.
- `LoadingState`: shared spinner/mark, skeleton line/card states, and import/report progress copy containers.
- `BoardFrame`: stable square board sizing, surrounding metadata, controls, and responsive two-column/single-column behavior.
- `PageTitle`: standard title scale and spacing for app pages so hero typography is not reused inside dense product surfaces.
- `AppNav` primitives: shared nav item data and active state mapping for top nav, bottom nav, and report command tabs.

## Page-By-Page Structural Issues

### Root App Shell, Navigation, Header, Footer

Desktop:
- `AppPrimaryNav` has its own item list and active logic while `MobileBottomNav` has another list and `appNavigation.js` has the canonical route map. This creates drift and duplicated active states.
- `.appShell` and `.container` width rules are repeated in early, mid, and late parts of `App.css`, including several mobile overrides and final cleanup blocks.
- The footer is mounted inside the same app shell as task surfaces, so legal/support content competes with app workflows instead of acting as a quiet terminal section.

Mobile:
- Top mobile menu and bottom mobile nav both exist. This can feel like duplicated navigation unless each has a clear role: top for account/theme/legal, bottom for primary app sections.
- Multiple bottom padding rules try to clear fixed mobile nav. This should become a single shell variable and utility.

### Landing / Analyse Page

Desktop:
- Landing, public hero, and analyse import hero use separate visual systems and heading scales. The import area is wrapped in several hero/action/card treatments.
- The analyse hero has a dense top section with import form, visual panel, platform selector, sample controls, account sync, status, and CTA states close together.

Mobile:
- Several hero grids collapse around `900px` and `640px`, but form actions become full width through broad button selectors. That can over-widen secondary actions and make the top section feel long.
- Hero visual elements are hidden on smaller screens, which is safer than overlap, but it leaves some layouts relying on text-only density.

### Analysis / Report Screen

Desktop:
- Report structure is better organized than older sections through `FinalReportFlow`, `ReportCommandBar`, `ReportSectionGroup`, and `reportPriorityGrid`, but it still pulls in many older cards and detail panels with independent sizing.
- `FinalReportFlow` includes a dev-only width warning for verdict cards, which signals known desktop crowding.
- Report mode is managed locally in `FinalReportFlow` while route aliases and report modes are also handled in `appNavigation.js`.

Mobile:
- `ReportCommandBar__tabs` has multiple late scrolling/grid overrides. The intended mobile behavior should be one horizontal segmented nav or one two-row grid, not both across override layers.
- Tables require horizontal scrolling (`table` min-width appears in mobile CSS), but table wrappers and evidence chips have independent max widths.
- Secondary details help reduce density, but many report cards still render before the user reaches training or games.

### Training Screen

Desktop:
- `appResultsShellTrain` introduces a two-column layout at `1000px` with `TodayTrainingCard` sticky on the right. This is a good direction but should become a shared page layout primitive.
- Training stacks many full components: filters, continue card, daily mission, practice panel, today card, retention command center, daily habit, seven-day plan, coach plan, repertoire plan, study planner, collapsible training plan, replay. The structure risks overwhelming desktop and long-scroll fatigue.
- The practice board panel is tightly connected to chess logic and should be wrapped, not rewritten.

Mobile:
- Practice and replay need stable board sizing and controls. The current board CSS uses many important rules and breakpoint-specific caps.
- Training action cards and board controls should use shared button/cluster behavior so controls do not wrap unpredictably.

### Account / Profile

Desktop:
- `OpeningFitProfileDashboard` has recently moved toward a simpler two-column card layout with an advanced disclosure. That is a promising low-risk pattern.
- Profile still mixes new simple cards with older dashboard cards inside the advanced drawer.

Mobile:
- The simple profile grid collapses cleanly, but many nested cards and disclosure contents rely on component-specific CSS.
- Account sync status, login, saved reports, preferences, subscription, restore, and cloud state need a shared status/form pattern to feel consistent.

### Premium Page

Desktop:
- Premium surfaces are split between `PremiumPanel`, `PremiumDashboard`, `FounderPassProfileCard`, `FounderPassLoginUpgrade`, and `SeriousPremiumStrip`, each with its own visual vocabulary.
- Premium comparison rows are custom table-like divs. They need a responsive comparison primitive before cosmetic work.

Mobile:
- Price card, comparison table, preview grid, and final CTA need a predictable stacking order and horizontal overflow protection.
- Premium should keep Stripe/auth logic untouched; only shell and presentation primitives should wrap it.

### Openings / SEO Pages

Desktop:
- Opening pages use their own `seoPageShell`, `seoTopNav`, `seoHero`, `openingSeoCard`, `seoVisualCard`, and related grids. They are structurally separate from the app shell.
- This separation is useful for SEO, but the visual token layer should still align with app primitives.

Mobile:
- SEO/opening pages likely need a smaller page title and tighter section rhythm than the app dashboard. They should not inherit dense app report overrides.

## Proposed Responsive Layout Strategy

- Establish canonical breakpoints: mobile `0-639px`, tablet `640-899px`, small desktop `900-1199px`, wide desktop `1200px+`. Keep exceptions only for board-specific behavior.
- Define shell variables once: page gutter, shell max width, nav height, bottom nav height, section gap, card gap, and board max size.
- Use mobile-first layout: single-column by default, two-column only from `900px`, three-column only when cards can stay at least `260-280px` wide.
- Replace repeated fixed grids with `repeat(auto-fit, minmax(min(100%, Xpx), 1fr))` for card grids where content length varies.
- Keep dense product pages within `1080-1180px` depending on task: report summary around `1080px`, training with side rail around `1160px`, marketing/SEO around `1180-1240px`.
- Use one mobile bottom-nav clearance rule on `body`, `.page`, and `.appShell`, driven by a CSS variable such as `--mobile-nav-clearance`.
- Standardize section headers to avoid hero-scale type inside dashboards, cards, and command bars.
- Wrap chess boards in one `BoardFrame` with `aspect-ratio: 1`, `max-inline-size`, and responsive controls. Do not edit chess move/analysis logic while doing this.
- Make report navigation sticky only if it does not fight the primary nav. Otherwise keep it local and horizontally scrollable on mobile.

## Low-Risk Implementation Order

1. Freeze behavior and create compatibility primitives: add shared CSS tokens/classes for shell, page sections, cards, buttons, badges, grids, status notices, tabs, and board frame without changing markup broadly.
2. Consolidate app shell spacing: normalize `.container`, `.appShell`, mobile bottom-nav clearance, top nav height, scroll margins, and max widths.
3. Unify navigation data and active states: derive top nav, bottom nav, and report nav from route metadata where possible, while preserving current route behavior.
4. Normalize buttons, chips, badges, and form controls through compatibility aliases. Keep old class names working.
5. Stabilize report layout: apply shared `PageSection`, `ResponsiveGrid`, `Card`, and `Tabs` primitives to `FinalReportFlow`, `ReportCommandBar`, filters, and report cards.
6. Stabilize training layout: preserve `OpeningPracticeLinesPanel` logic, but wrap board/trainer/control layout in shared responsive board and action primitives.
7. Normalize profile and premium card shells after report/training are stable.
8. Align SEO/opening pages to shared tokens last, keeping public SEO structure and metadata untouched.
9. Only after structural consolidation, make visual polish changes and run screenshot/layout checks.

## Shared UI Foundation Implemented

Implemented on 2026-06-24 as the first low-risk foundation step. This does not redesign product logic or restyle every page.

- `frontend/src/styles/uiFoundation.css`: shared design tokens and mobile-first foundation classes.
- `frontend/src/components/ui/UiPrimitives.jsx`: reusable React primitives for `AppShell`, `PageContainer`, `PageHeader`, `SectionHeader`, `Surface` / `Card`, `PrimaryButton`, `SecondaryButton`, `IconButton`, `StatusBadge`, `EmptyState`, `LoadingState`, `Skeleton`, `TabNavigation`, `ResponsiveGrid`, and `FormField`.
- `frontend/src/components/ui/index.js`: barrel export for future page-specific migrations.
- `frontend/src/main.jsx`: imports the foundation stylesheet globally after `index.css`.
- `frontend/src/components/MobileBottomNav.jsx`: now carries the shared `of-mobile-bottom-nav` hook while preserving the existing navigation destinations and active-state logic.
- `frontend/src/components/ReportCommandBar.jsx`: now uses the shared `TabNavigation` primitive while preserving the existing report-mode and scroll-target behavior.

Foundation token coverage now includes page and elevated surface backgrounds, text hierarchy, muted text, border colors, success/warning/error/info states, spacing, radius, shadow, control height, input height, focus rings, mobile bottom-nav clearance, and breakpoint-aware gutters for 320px+, 375px+, 768px+, 1024px+, and 1280px+.

The current legacy classes remain intentionally supported through compatibility styling, especially `appShell`, `container`, `primaryBtn`, `secondaryBtn`, `secondaryButton`, `ghostButton`, `reportCommandBar__tabs`, `practiceBoardWrap`, and `replayBoardBox`. This lets future page work move component by component instead of through risky broad rewrites.

## Report Experience Structure Implemented

Implemented on 2026-06-24 as the first report-specific UX pass. This keeps chess analysis calculations, recommendation classifications, premium checks, imports, routes, and backend behavior unchanged.

- `frontend/src/styles/reportExperience.css`: dedicated report layout layer using the existing foundation tokens. It gives the report one visible identity/main-result area, a stable desktop priority grid, a single-column mobile flow, compact training entry cards, disclosure-based supporting data, and a mobile card fallback for the opening evidence table.
- `frontend/src/App.jsx`: promotes `CurrentReportSummary` into the visible report verdict section, moves `ReportTrainingPreview` near the main result, places `EvidenceTableSection` inside a supporting-data disclosure that opens for table mode, and keeps deeper score/journey/change details in the existing secondary disclosure.
- `frontend/src/App.jsx`: adds supportive context copy for pause/avoid/review states in `OpeningFitScoreList` without changing the underlying verdict logic. Pause/avoid language now explains whether the issue is limited data, repertoire overload, style mismatch, weaker recent results, low confidence, or a more urgent priority.

The intended report hierarchy is now:

1. Player/report identity and concise style/result summary.
2. Main result, score, best current signal, priority repair area, and next action.
3. Training entry point.
4. Supporting evidence table and deeper report detail through progressive disclosure.
5. Full repertoire, fixes, training plan, recent games, and export/history when selected.

Remaining report-specific work should focus on migrating the older nested report cards into smaller shared primitives, reducing duplicate summary/stat cards in the full report mode, and replacing more legacy copy inside individual recommendation/detail components.

## Major Product Screen Experience Implemented

Implemented on 2026-06-24 as the first cross-screen product pass after the report work. This keeps authentication, Stripe, Supabase policies, backend endpoints, import behavior, payment behavior, and chess logic unchanged.

- `frontend/src/styles/productScreensExperience.css`: shared screen-level layout and state layer for training/practice, profile/account, premium, public opening pages, replay, and connected loading/error/empty/status cards.
- `frontend/src/App.jsx`: imports the product screen layer after the legacy polish layers so it acts as the intentional final UI foundation for these screens.
- `frontend/src/components/AccountPanel.jsx`: replaces developer-facing Supabase wording in user-visible account states with calmer account/sign-in/sync copy while preserving all auth and sync behavior.

Training/practice improvements now focus the board first, keep the trainer panel beside it on desktop, group practice/review/next-line controls, preserve existing board flip and computer-response behavior, and keep the board constrained on mobile. Replay and practice picker states use the same surface, control, and touch-target rules.

Profile/account improvements separate the primary account card from stats, preferences, subscription, saved data, and advanced actions. Account-management actions remain visible but secondary, and account/sync states use user-facing language.

Premium improvements keep the Founder Pass offer calm and precise, use a clear price/action card, make free-versus-premium comparison rows readable on mobile, and standardize premium preview/locked cards without touching checkout or pricing logic.

Opening explorer/repertoire improvements align public opening hub and guide pages with the product tokens, keep route scanning desktop-friendly, and make opening category/guide cards wrap cleanly on mobile.

Global connected states now share calmer surface, spacing, icon, contrast, and retry-action treatment for `productEmptyState`, `loadingCard`, `errorBox`, `importStatusBox`, `cloudSaveStatusPill`, locked premium cards, and account notices.

## Exact Files Likely To Change In Next Tasks

- `frontend/src/index.css`: canonical tokens, shell variables, base form/focus/button defaults.
- `frontend/src/App.css`: remove duplicated shell/nav/card/button/mobile overrides gradually and replace with foundation classes.
- `frontend/src/ThemePolish.css`: fold durable polish tokens into the foundation or reduce late overrides.
- `frontend/src/components/LayoutDensity.css`: keep or retire density overrides after shell/card primitives exist.
- `frontend/src/components/OpeningFitPolish.css`: audit for duplicate button/card/nav/report polish before moving stable rules.
- `frontend/src/App.jsx`: introduce/reuse small primitives for `Section`, `EmptyState`, page sections, and shell layout while avoiding business logic changes.
- `frontend/src/appNavigation.js`: route metadata and shared nav item definitions.
- `frontend/src/components/MobileBottomNav.jsx`: consume shared nav data and foundation nav classes.
- `frontend/src/components/ReportCommandBar.jsx`: consume shared tabs/command bar structure.
- `frontend/src/components/OpeningPracticeLinesPanel.jsx`: only wrapper/layout class changes around board, trainer, controls, and browser.
- `frontend/src/components/ChessPositionBoard.jsx`: only if board sizing hooks/classes need a stable frame.
- `frontend/src/components/GameReplayBoard.jsx`: only board frame/layout alignment.
- `frontend/src/components/AccountPanel.jsx` and `frontend/src/components/AccountPanel.css`: form/status/card alignment only.
- `frontend/src/components/PremiumPanel.jsx`, `frontend/src/components/PremiumDashboard.jsx`, `frontend/src/components/PremiumDashboard.css`, `frontend/src/components/FounderPassLoginUpgrade.css`: premium shell/card/button alignment only.
- `frontend/src/components/SeoLandingPage.jsx`, `frontend/src/components/SeoLandingPage.css`, `frontend/src/components/OpeningLandingPage.jsx`, `frontend/src/components/ChessOpeningSeoPage.jsx`, `frontend/src/components/SeoGuidePages.jsx`: later SEO/public-page token alignment.
- Component CSS files for repeated cards: `TodayTrainingCard.css`, `DailyMissionCard.css`, `ContinueTrainingCard.css`, `RecommendedOpeningFit.css`, `OpeningJourney.css`, `OpeningInsights.css`, `OpeningHealthScore.css`, `OpeningCoachPlan.css`, `WeeklyOpeningReport.css`, and related report/training card styles.

## Components And Features Not To Touch During UI Foundation Work

- Supabase auth, session restore, sync, profile restore, cloud save, and premium entitlement logic in `AuthDataProvider.jsx`, `accountApi.js`, `supabase.js`, and `lib/supabaseClient.js`.
- Stripe / Founder Pass checkout behavior and premium access checks.
- Import backend behavior, API base URL handling, platform import logic, diagnostics, and analytics event posting.
- Chess analysis, opening scoring, weak-line detection, training recommendation generation, retention metrics, opening health, and gamification service logic.
- `OpeningPracticeLinesPanel` move validation, saved practice progress, exact weak-line parsing, and cloud training progress sync.
- `ChessPositionBoard` and `GameReplayBoard` chess behavior unless only adding layout wrappers or stable sizing classes.
- SEO data, JSON-LD generation, canonical/meta behavior, sitemap/robots, and public opening guide content.
- Supabase migrations, backend Python analysis modules, backend tests, and payment/sync QA docs.

## Safe Check Results

- `npm.cmd run lint` in `frontend`: passed. ESLint reported Babel deoptimized code generation for `frontend/src/App.jsx` because it exceeds 500 KB.
- `npm.cmd run build` in `frontend`: passed. Vite built successfully.
- Build warning: one or more chunks exceed 500 kB after minification.
- Post-foundation build asset sizes reported by Vite:
  - CSS bundle: `dist/assets/index-J86oFx_R.css`, 1,077.01 kB raw, 172.18 kB gzip.
  - JS bundle: `dist/assets/index-C3IOtbsj.js`, 1,264.19 kB raw, 343.17 kB gzip.

## Files Inspected

- Root/package: `package.json`, `package-lock.json`, `.gitignore`, repository file tree.
- Frontend config: `frontend/package.json`, `frontend/vite.config.js`, `frontend/eslint.config.js`, `frontend/index.html`, frontend file tree.
- App shell and routes: `frontend/src/App.jsx`, `frontend/src/appNavigation.js`, `frontend/src/main.jsx`.
- Global styles: `frontend/src/index.css`, `frontend/src/App.css`, `frontend/src/ThemePolish.css`.
- Cross-cutting/component styles: `frontend/src/components/LayoutDensity.css`, `frontend/src/components/OpeningFitPolish.css`, and the component CSS inventory under `frontend/src/components`.
- Navigation/report/training/premium/opening components: `MobileBottomNav.jsx`, `ReportCommandBar.jsx`, `OpeningPracticeLinesPanel.jsx`, `PremiumPanel.jsx`, `OpeningLandingPage.jsx`.
- Additional component tree inventory: `frontend/src/components/*.jsx`, `frontend/src/components/*.css`, `frontend/src/data/*`, `frontend/src/content/*`, `frontend/src/services/*`, `frontend/src/lib/*`.

## Terminal Summary

- Files inspected: root package/config, frontend package/config, `App.jsx`, `appNavigation.js`, `index.css`, `App.css`, `ThemePolish.css`, component CSS inventory, and representative navigation/report/training/profile/premium/opening components.
- Major issues found: oversized centralized app/component CSS, duplicated navigation, repeated button/card/badge/tab/status patterns, layered responsive overrides, mobile nav clearance duplication, report/training density, board sizing fragility, and large build bundles.
- Proposed implementation order: add compatibility primitives first, consolidate shell spacing, unify navigation metadata, normalize controls/status/tabs, then stabilize report, training, profile, premium, and SEO pages in that order.
- Build baseline: lint passes and production build passes before future UI work begins; Vite warns about chunks over 500 kB and reports a roughly 1 MB raw CSS bundle.
