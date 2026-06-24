# OpeningFit UI Market-Ready Checklist

Date: 2026-06-24

## Routes Checked

- `/` landing and analyse entry.
- `/login` login and create-account entry.
- `/report` empty report state.
- `/report` seeded demo report and analysis screen.
- `/train` seeded training and practice screen.
- `/openings` opening explorer and opening guide hub.
- `/account` empty account/profile state.
- `/account` seeded account/profile state.
- `/premium` empty premium state.
- `/premium` seeded premium state.

## Viewport Checks Completed

- 320px mobile.
- 375px mobile.
- 768px tablet.
- 1024px desktop.
- 1440px wide desktop.

Checks covered horizontal scrolling, touch target height, fixed mobile bottom-nav obstruction, route load status, visible keyboard focus entry, seeded report restoration, practice-board sizing, empty report state, premium empty state, and public opening hub layout.

## Issues Fixed In Final Regression

- Removed user-facing Supabase wording from public privacy copy, account-session loading copy, and account-sync failure fallback copy.
- Restored reliable mobile bottom-nav clearance at 320px and 375px through the final product screen layer.
- Compacted mobile premium empty states so the Founder Pass action and analyse action are not hidden behind the mobile bottom navigation.
- Tightened standalone premium mobile card content by hiding lower-priority value-list and explanatory paragraph content where it caused fixed-nav overlap.

## Issues Intentionally Deferred

- The landing page has normal mid-scroll content passing underneath the fixed mobile bottom navigation. This is expected for a fixed nav; bottom-of-document clearance is present, and no final actions are trapped behind the nav.
- The training page still contains many downstream modules after the practice board. The board is now first and stable, but a future product-content pass should decide which secondary training modules belong behind disclosure.
- Large CSS and JS bundles remain. Vite still warns about chunks over 500 kB. This is not a UI regression blocker, but it should be handled with code splitting and CSS consolidation later.
- Premium and account checkout/sync states still need manual verification with real Stripe and Supabase sessions; the regression pass did not alter those integrations.

## Manual Release Checklist

- Analyse a real Chess.com username and confirm loading, success, empty, and error states read clearly.
- Analyse a real Lichess username and confirm the same import states.
- On mobile, check bottom navigation on `/`, `/report`, `/train`, `/account`, and `/premium`; verify final buttons at the bottom of each page can be reached.
- In the report, switch between summary, full report, and table modes; confirm no table or recommendation card overflows.
- In training, drag pieces, tap-to-move, use Hint, Show move, Back, Reset, Next line, board theme, and a Black-side line to confirm board orientation and computer replies still work.
- In replay, select a recent game and confirm the board and move list stay aligned.
- Create account, log in, log out, send login link, and retry sync with a real configured auth environment.
- Run Founder Pass checkout in test mode and confirm loading, failure, success, and entitlement states.
- Toggle dark and light mode on landing, report, train, account, premium, and openings pages.
- Keyboard-tab through top navigation, mobile menu, report tabs, training controls, account forms, premium actions, and opening hub links.
- Inspect `/openings` plus at least one individual opening page on mobile and desktop.

## Safe Check Results

- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed.
- Build warning remains: one or more chunks exceed 500 kB after minification.
