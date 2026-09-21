# Stages 1–5 UI release candidate

This candidate contains the report consistency and presentation work, shared layouts,
Account/Profile save-state cleanup, public-page refinement, and confirmed acceptance
fixes. It does not implement Stage 6A or change recommendation formulas, database
schemas/RLS, authentication contracts, billing configuration, or Android metadata.

## Repository and scope

- Branch: `main`; refreshed `origin/main` on 2026-09-21 and HEAD both point to `054626e7`.
- No AGENTS.md was found in the repository root, parent, tracked files, or searched
  frontend/backend source trees. No repository instruction file was available to read.
- The index was initially empty. The intended candidate is frontend source,
  frontend regression harnesses/fixtures, package test commands, and this document.
- Six pre-existing tracked diffs are preserved and excluded: analytics JSONL,
  Android build.gradle, two Mission containment SQL artifacts, and two Mission
  artifact PowerShell scripts. Unrelated untracked artifacts/tests/caches are excluded.
- Protected Android configuration/manifest, OAuth/deep-link/native startup,
  entitlement, and authoritative billing configuration hashes match the Stage 5 baseline.

## Exact unfinished Stage 5 issues

| Issue and evidence | Release treatment | Resolution |
| --- | --- | --- |
| Restoring a saved report replaced direct `/train`, `/account`, and other destinations with `/report`. The restore callback always applied the report landing journey. | Blocker: incorrect destination and inaccessible intended state. | Restore redirects are limited to the existing root/login landing case. Explicit destinations survive. Unit and browser direct-entry checks cover this. |
| Mission history HTTP 503 produced an unhandled rejection without recoverable UI. The original Stage 5 state-results recorded this failure. | Blocker: failed customer action without recovery. | Local pending/error/retry state; empty success only after a successful empty response; pagination only with a cursor. Browser regression verifies failure followed by successful retry. |
| Light-mode training definition labels had contrast around 1.13:1; position-plan copy and move tags also failed contrast. | Blocker: unreadable customer text. | Scoped theme-token colours/backgrounds, without changing training logic. |
| Board coordinates, theme toggle, import controls and SEO definition/link colours had pending contrast validation. | Acceptance gate. | Scoped fixes retained and included in final route/state checks. |
| SEO pages competed with the app for theme ownership. | Blocker where displayed theme disagreed with the selected theme. | Shared app owns theme when it supplies navigation; standalone fallback remains available. |
| `scrollToAppTarget` explicitly requested smooth scrolling even with reduced motion. | Accessibility defect within Stage 5 scope. | Reduced motion requests instant scrolling; targeted regression retains normal smooth behaviour. |
| The last Mission history and coordinate edits had not received final tests/build. | Acceptance gate, not a separate code defect. | Final-candidate validation recorded below. |

The acceptance harness also needed deterministic waits: hold the fixture save until
the pending-state assertion completes, and wait for finite theme transitions before
measuring contrast. These fix test races rather than concealing application failures.
The initial save-state test and a concurrently overloaded navigation attempt failed;
their corrected final runs pass. Intermediate theme frames were not accepted as
settled-theme contrast results.

One Stage 4 methodology sentence overclaimed that all historical comparison paths
reject incompatible formulas. It now states only the verified preservation of stored
scores and formula versions. No comparison or scoring algorithm was changed.

## Validation

- `npm test`: 731 passing frontend unit/integration tests, including existing auth,
  entitlement, report-version, result consistency and training handoff coverage.
- `npm run lint`: pass.
- `npm run build`: pass; existing large-chunk warning remains.
- `npm run account:check`: 119 passing component/layout/state checks.
- `npm run report:check`: 120 passing report/layout/history/loading checks.
- `npm run public:check`: 88 passing public checks, including import pending/error,
  login methods, keyboard use, pricing states and disabled-checkout behaviour.
- `npm run acceptance:states`: 78 passing mission/native-bridge/reflow checks,
  including a failed history request followed by successful retry.
- `npm run report:production-check`: built-assets sample checks at 390/1440px and
  restored real-report-fixture separation; no production auth substitution.
- Broad route/contrast matrix: 816 verified states with zero remaining findings in
  `final-acceptance-summary.json`. The corrected 1280px sweep recorded 254 successful
  states and one homepage cold-server timeout; a targeted homepage rerun passed all
  four theme states. These supersede the earlier 1280px transition-frame measurements.
- `git diff --check`: pass; staged-diff validation is recorded with the final manifest.

Detailed local logs are `release-*.log` under `.release-build/ui-stage5/`; screenshots
also exist under ui-stage2/3/4/5. Generated evidence and dist output are not staged.
The interrupted final unit run had one outdated methodology-copy assertion after
the overclaim was removed. The assertion now checks the truthful wording and rejects
the old overclaim; the resumed full run passes all 731 tests. Production code did not
change during recovery, so the saved final build/lint and browser results remain valid.

## Coverage and limits

The Chromium matrix covers 360, 390, 768, 1280 and 1440px, dark/light themes,
public sitemap/content routes, sample reports, restored real-report fixtures,
dashboard, Report sections, training, Account/Profile, and legacy route aliases.
Focused fixtures cover missing roles, low evidence, long names, empty accounts,
free/monthly/annual/lifetime membership, pending/failed saves, reminder retry,
canceled deletion, supporting evidence, filtering, browser history and lazy failures.
Fixture identities and successful/failed responses exist only in local test harnesses.
They do not bypass production authentication or entitlements.

The native checks simulate the Capacitor bridge and safe-area insets, check a single
navigation shell, and reduce viewport height for keyboard reflow. They are not Android
device tests. The 200% checks use equivalent CSS viewport widths, not browser-menu zoom.
Contrast automation handles solid colour composition and skips image/gradient
backgrounds; it is not a full accessibility certification. Viewport screenshots were
also inspected for mobile training/report and desktop Account layout.

Not tested live: Google OAuth, email delivery/passwordless recovery, authenticated
cloud writes/restoration across devices, paid billing/portal, real import servers,
production Mission persistence, notification delivery, Android keyboard/deep links,
or TalkBack. No backend suite or Android lint/unit/signing/build was run for this
frontend-only candidate. No Capacitor sync was performed.

## Deployment and Android

`frontend/vercel.json` hosts the SPA routing, redirects the apex hostname to www, and
forwards `/api/*` to `https://opening-fit.onrender.com/api/*`. The Mission rollout
runbook explicitly warns that pushes to `main` may independently trigger both Vercel
and Render. Therefore a push must be treated as potentially deploying the web frontend
and rebuilding/restarting the backend, even for a frontend-only commit.

The exact live Git integrations, production branches, auto-deploy switches and path
filters are dashboard configuration, not established by the repository. They were
not accessed or changed. No repository workflow was found that would automatically
run Supabase SQL or submit an Android release. This is not proof that no external
automation exists; check the two hosting dashboards before authorising a push.

`frontend/capacitor.config.json` uses `webDir: "dist"` and has no remote `server.url`.
Android bundles web assets. A Vercel push will not update the installed Android UI.
These UI changes require a later web build, Capacitor sync and new signed Android
build/release. The existing Android version/signing/artifacts are excluded here.

## Remaining risks and approval gate

- No confirmed new UI blocker remains after the final acceptance matrix.
- Pre-existing Stage 6 findings remain: auxiliary role aggregation, catalogue
  zero/merge handling, experiment eligibility and incompatible legacy progress
  comparisons. They are genuine recommendation/data-integrity risks, not optional
  visual polish, and are not resolved by this UI release. No Stage 6A work is included.
- Large bundle size and further layout simplification are optional follow-ups.
- This candidate is ready for local review/commit approval after the recorded checks,
  but is **not an unconditional production deployment approval**. Verify hosting
  triggers, complete the live account smoke below, and explicitly accept or defer
  the known pre-existing recommendation risks before pushing.

Manual release preflight:

1. Confirm Vercel/Render production branches, auto-deploy and path filters; confirm
   whether the intended push restarts Render and choose the deployment order.
2. With authorised free and paid accounts, verify sign-in, explicit-route restoration,
   a reversible username save/restore, membership display and reminder save/retry.
3. Verify one real import, report-to-supporting-game navigation, share output and the
   existing training action; inspect browser-menu 200% zoom and keyboard focus.
4. For a later Android release, test an actual device: keyboard/insets, bottom nav,
   OAuth return, deep links and cold-start/session restoration. Not a web push gate.

Proposed commit title: `Refine report, account and public UI; complete acceptance fixes`.
No commit, push, deploy, database operation or Play Store submission is authorised
by preparation of this candidate.
