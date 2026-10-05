# Stage 6 web report pilot — RC1

Base: `ceddc019`, preserving Stage 6A–6D and the tested Android 1.0.19 (22) artifacts. The user accepted report-only scope. No production SQL, push, deployment or Android upload has been performed. This document and its code form one separate candidate commit; the archive manifest identifies that commit and the web artifact hash.

## Smallest safe scope

Launch to **one explicitly approved internal test account**, on `/report-pilot` in a browser. Use one different, unlisted account as the denial/legacy control. No percentage rollout and no general user opt-in. The account list starts empty; each row defaults disabled, and both creation switches remain off. The exact approved Supabase user UUID is still required; local fixture IDs are not production enrolment.

The ordinary web entry and every native entry remain legacy, including Android 22 used by the approved tester. The pilot entry checks authenticated server admission before mounting its workspace. It rechecks on auth changes, clears/unmounts report state on sign-out/account changes, and never falls back to legacy after a pilot error. A link to the standard app does a full navigation. No report is passed through that link or cached into the standard app.

The pilot offers last-month Chess.com/Lichess imports, owner-scoped legacy and pilot history, the existing Stage 6 summary/priorities presentation, and expandable saved evidence. It does not mount the legacy profile/settings/retention synchronisers or training components. It writes no browser report cache. Only the worker saves new report history; a matching stored new-generation report must be read back before the UI says it was saved. An import or read-back failure leaves the previous report visible with an error and no new save/completion claim.

Mission actions, repertoire changes and training completion are unavailable, with a visible explanation. The client refuses report-derived RPCs; the API and database refuse isolated training/repertoire collection writes; the backend rejects pilot mission mutations and skips mission processing for every new job. This is deliberately not full training feature parity.

## Server and storage boundaries

Admission is `public.openingfit_report_pilot_accounts(user_id, enabled)`, readable only by the service role and writable only by privileged SQL operators. Neither a client flag, a supplied UUID, a capability header nor a claimed web header grants membership. Authenticated v2 start, poll and store requests require membership, explicit capabilities and the web pilot contract. Workers recheck membership before generation and before persistence; the database checks it again on writes. Revocation fails closed without changing job generation.

The web header identifies the client contract; it is **not proof of device type**. An approved account can reproduce it in another HTTP client. Account identity/admission, database isolation and ownership are the security controls. Android 22 never sends that contract and continues on genuine legacy generation/storage.

Older clients read Supabase directly. They remain protected by the API-only isolated table, grants/RLS, immutable ownership/history, the legacy-table marker guards, and a new guard rejecting isolated report IDs in legacy writes (including SECURITY DEFINER RPC writes with no version marker). Same-account legacy reports/RPCs still work. New unmarked profile/retention/settings mirrors remain routed into isolated storage in the capability adapter; none are written by this narrower pilot page. Do not copy pilot reports into an old mirror, remove provenance to make a legacy writer accept them, or assume API routing/client adoption protects direct reads. Inputs stripped of both provenance and report identity cannot be classified by the database; the supported pilot therefore exposes no derived legacy-write path.

The new reference guard scans the small isolated history on legacy writes. This is suitable for a one-account pilot; review/index the design before expanding it. Future public mirror tables must retain guard coverage. Existing old reports, grants and RLS are not rewritten.

## Exact migration and deployment order — approval required

1. Approve this candidate for the existing OpeningFit production web/API/Supabase environment and name **one real test-account UUID**. Record a backup/recovery reference. Inspect migration history to determine which of the two migrations is already applied; never blindly replay either transaction after an uncertain outcome. This is a bounded release preflight, not a new audit.
2. With `OPENINGFIT_STAGE6_REPORTS_ENABLED=false`, apply `supabase/migrations/202610040001_stage6_report_isolation.sql` if absent, using `ON_ERROR_STOP=1`. Its existing-data preflight must pass; investigate rather than bypass any detected new data in legacy tables. Then apply `supabase/migrations/202610050001_stage6_report_pilot.sql`. Verify the rollout row is false, the allowlist has no enabled accounts, and anon/authenticated have no access to the isolated store or allowlist. Missing pilot schema fails pilot requests closed; ordinary legacy routes do not depend on it.
3. Deploy the candidate backend with creation still false, then deploy the candidate web artifact built with `VITE_STAGE6_REPORTS_ENABLED=true`. Existing `frontend/vercel.json` sends `/report-pilot` to the SPA and `/api/*` to the backend. The artifact uses the existing public Supabase configuration and same-origin API; no service-role key is included. Do not sync Capacitor, rebuild or upload Android. Preserve all unrelated changes.
4. Check ordinary web and installed Android 22 import/read behaviour and denial of v2 access for the unlisted control. Confirm the pilot page refuses unenrolled accounts. This must pass before admission is opened.
5. Run `supabase/rollout/202610050001_activate_report_pilot.sql` with psql variable `pilot_user_id` set to the approved UUID. This transaction refuses pre-existing active membership, validates the auth-user FK, admits exactly one account, and enables the database switch. Keep the backend flag false while verifying one enabled account and saved-history read access; pilot creation must still report disabled.
6. Set backend `OPENINGFIT_STAGE6_REPORTS_ENABLED=true` as the final activation step. Run the checklist below. On any failed ownership/leakage/legacy check, execute rollback immediately. Do not widen membership or add training writes as part of this approval.

## Rollback

Run `supabase/rollback/202610040001_stage6_report_isolation_disable.sql` **first**, then set backend `OPENINGFIT_STAGE6_REPORTS_ENABLED=false`. The exact rollback SQL was re-exercised locally with the pilot migration. New/queued writes stop; jobs never reroute to legacy. Keep the allowlisted account enabled for read access, and retain the candidate web/API readers, both tables, grants/RLS and all legacy guards. The pilot page shows creation disabled and still loads saved reports. Existing legacy clients keep importing normally.

Do not roll the frontend back to a client that cannot read isolated reports, drop tables, delete reports, disable guards or mirror data into legacy paths. To revoke a compromised account separately, set its membership `enabled=false`; this intentionally removes both pilot reads and new writes. Membership removal is not the normal creation rollback.

## Short end-to-end pilot checklist

- Approved account: open `/report-pilot`; import Chess.com and Lichess separately, confirm current-generation summary/evidence and verified saved state, refresh and reopen both reports. Retry a failed/pending request on the same platform/user; it must remain v2 and owner-bound.
- Same account on Android 22 and ordinary web: import a genuine legacy report; existing profile/history/retention/settings reads remain legacy and do not contain the pilot report, its IDs, scores or markers. Compare stored old reports before/after.
- Unlisted control: normal legacy app works; a forged web/capability header still receives 403 on v2 create/read/poll. Use the approved token with another user's filters/owner to confirm denial. Verify old direct authenticated/anonymous Supabase readers cannot select the isolated table or allowlist.
- Pilot page: mission/training/repertoire actions are unavailable with an explanation. Attempt a new-report-derived RPC/write, including a bare isolated report ID; it must fail without mutation, completion or a success message. Test network failure during import and saved-history verification.
- Sign out/switch account: previous pilot history disappears before new account access. Execute rollback: new imports fail, saved pilot reports remain readable, ordinary web/Android legacy imports still work. Leave creation off if acceptance is incomplete.

## Validation and remaining work

Prior evidence under `.release-build/stage6-isolation/` is reused: genuine frozen generation, legacy deduplication/job regressions, direct-role SQL ownership/marker tests, report/profile/retention/settings isolation, and Stage 6 presentation fixes. No broad audit or full application suite was repeated.

Delta evidence under `.release-build/stage6-pilot/`: 24 affected backend contract tests; one API-to-real-local-database test; 25 frontend tests; eight browser component scenarios; changed-file ESLint; pilot web production build; new migration/SQL delta checks and exact activation/rollback scripts. The browser harness uses stubbed authentication and intercepted API responses; the local PostgreSQL fixture supplies Supabase roles/auth primitives rather than a full hosted Supabase instance. Actual hosted-auth/browser/Android end-to-end acceptance remains the launch checklist, not a claimed completed test.

No further code changes are required for this bounded report-only candidate. Remaining inputs/actions: the real tester UUID, explicit launch approval, production schema/config verification, deployment in the order above, and the end-to-end checklist. Training/RPC parity and any Android successor require separate scope and approval. Android 22 and all six pre-existing modified tracked files remain unchanged.
