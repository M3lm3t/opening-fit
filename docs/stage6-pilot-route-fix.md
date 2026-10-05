# Report pilot production entry fix

Base: production source commit `95634ee7535ea7ed5f2cdb6a620bd076d71d4579`. Local fix only: no push, deployment, migration or activation.

## Confirmed cause and trace

The public `/report-pilot` response returned HTTP 200 with entry asset `index-CTBVe2Zh.js`. That asset calls the pilot selector with **`enabled:!1`** (false), before rendering either authentication tree. RC1 required `enabled === true` to recognise the URL at all. False therefore mounted the ordinary `App` and `AuthDataProvider`, whose unknown-path fallback renders the homepage while leaving `/report-pilot` in the address bar. This is a compiled flag/route-selection failure, not an observed auth redirect or a cache diagnosis.

The repository's actual `frontend/package.json` build script is `vite build`; there is no prebuild/postbuild hook or repository build script assigning this flag to false. `vite.config.js` previously did not load or override it, and the configured local env file does not define it. A production build through **`npm run build`** with the process flag true compiles the selector with `enabled:!0`; false compiles `enabled:!1` and reproduces the homepage on direct entry and refresh. The production asset is not byte-identical to the local false build, so only the observed selector and reproduced behaviour are asserted.

The provided Vercel log excerpt begins after compilation and shows successful build/deployment plus a non-failing chunk-size warning. It does **not** show the invoked command or effective flag. Authenticated Vercel build settings/logs remain unavailable. Thus a dashboard command override or incorrectly scoped/overwritten environment variable has not been distinguished; no specific hidden script override is claimed.

`ReportPilot` already represents signed-out and denied accounts explicitly. It has no homepage redirect. Legacy `App` auth-return restoration only rewrites login/account routes, and saved-report restoration only rewrites home/login/account URLs; native startup redirects require a native platform. The production entry tests now prove those legacy flows never mount for the pilot URL, including when a legacy report and auth-return path exist in local storage.

## Changes

- Reserve `/report-pilot` and `/report-pilot/` on web independently of the flag. Pass availability into the pilot page: a disabled build shows an explicit unavailable state and makes no pilot or legacy restoration requests. Native and ordinary routes keep their existing entry.
- Keep signed-out, unenrolled and backend error states inside the pilot page. No eligibility bypass, report write or generation activation is introduced.
- Pin `frontend/vercel.json` to `buildCommand: "npm run build"`, which overrides a dashboard build command without modifying the process environment. See [Vercel buildCommand precedence](https://vercel.com/docs/project-configuration/vercel-json#buildcommand).
- Log only the effective non-secret pilot boolean and mode during builds. Use Vite's mode-aware `loadEnv`, which respects existing process variables, and never assign/force the flag. Invalid values fail the build with an explicit message; unset remains default-off. See [Vite environment precedence](https://vite.dev/guide/env-and-mode#env-loading-priorities).

## Targeted validation

Evidence: `.release-build/stage6-pilot-route-fix/`.

- Original false production build reproduces the defect on direct entry and refresh (`reproduction.log`). Service workers are blocked in a fresh browser context; no caching assumption is needed.
- Fixed true and false production builds pass 11 checks each (`entry-enabled.log`, `entry-disabled.log`): exact/trailing-slash URL, direct entry/refresh, logged-out/unenrolled sessions, stored legacy report/return-path protection, and ordinary home/login/sample-report routes. The enabled build requests server eligibility; the disabled build makes no such request. Both refuse to show import actions to unenrolled users.
- 15 affected unit tests, eight existing pilot component scenarios and changed-source ESLint pass. Both production builds pass with the existing chunk-size warning. API/auth responses in the browser tests are intercepted fixtures; no hosted data is read or written.

The enabled build's log must contain `[report-pilot] mode=production; VITE_STAGE6_REPORTS_ENABLED=true`. If a future Vercel build says false or unset, correct its production environment before expecting the enabled pilot; the page will now explain unavailability rather than disguise it as the homepage. This fix has not been deployed, so the live upstream environment cause remains a deployment verification item.
