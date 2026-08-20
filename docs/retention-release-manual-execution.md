# OpeningFit retention release — awaiting manual production execution

Status: **AWAITING MANUAL EXECUTION — DO NOT PUSH MAIN**

The first bundle (`SHA-256 83B47793E27A53607AB404176CCA8F87BDE5310D9CFB66EBF2BD6FFC59B79F6C`)
is **superseded and must not be run**. Its baseline check stopped because
`public.qualified_streak_activities` was absent. No migration section ran; the
owner did not provide an exact execution timestamp. That table belongs to the
optional legacy streak migration `202608160001`, while canonical consistency
only needs to copy its trustworthy history when it exists.

Production target confirmed by the owner: Supabase project `frtjfvhiimgruenqcuon` at
`https://frtjfvhiimgruenqcuon.supabase.co`. Automated access was unavailable on
2026-08-20 because the local Supabase CLI had no authenticated access token.

Generate the reviewed SQL Editor bundle without credentials:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/prepare_retention_release_bundle.ps1
```

The output is `release-artifacts/openingfit-retention-production-bundle.sql`.
Corrected bundle: 35,884 bytes; SHA-256
`116E5E63A84406C6C557099B90C45FF4F9AC489868C93460E88EE02F15999EB5`.
Open only the confirmed production project in Supabase Dashboard, take/verify a
recoverable backup, and run only the corrected bundle's read-only baseline
transaction. If it reports any missing or incompatible prerequisite, stop. Then
execute each labelled migration transaction separately in filename order. Each
transaction now contains its own postcondition and rolls back if verification
fails. Finish with the metadata verification queries.
Do not paste results containing user rows or payloads into the repository.

| Migration | Expected production state / prerequisite | Precondition | Action | Postcondition | History alignment | Recovery note |
| --- | --- | --- | --- | --- | --- | --- |
| `202608200001` | `activity_history`, `report_history`, and `settings` exist | Bundle prerequisite block; inspect existing coaching objects before execution | Execute its labelled transaction only if effects are absent/incomplete | Three coaching tables exist with RLS; canonical recorder and selectors exist; activity columns exist | Keep separate; record applied only after verification | Transaction rollback on error; restore backup if a committed change is later found unsafe |
| `202608200002` | `coaching_response_plans` from `001` exists | Confirm function signature is absent or differs | Execute after verified `001` | `save_coaching_response_plan(text,text,text,uuid,text,text)` exists and is authenticated-only | Separate after postcondition | `create or replace`; restore prior definition from backup if required |
| `202608200003` | Activity recorder and checkpoints from `001` exist | Confirm dependencies and current function signature | Execute after verified `002` | Atomic `complete_game_check(...)` exists; grants exclude public/anon | Separate after postcondition | Function replacement is transactional |
| `202608200004` | `001` activity fields exist; `qualified_streak_activities` is optional | If the legacy table exists, inspect only its aggregate eligible count | Execute after verified `003`; migrate supported legacy completions only when their ledger exists | Immutable `activity_local_date`, consistency functions, weekly target 3; any migrated rows deduplicated | Separate after postcondition | Optional legacy copy and function replacement are transactional and idempotent |
| `202608200005` | Existing owner-private `notification_preferences` exists | Confirm table/RLS and absence or compatible definitions of new columns/review table | Execute after verified `004` | Weekly reviews table has owner RLS; all reminder columns exist; `reminders_enabled` default is false | Separate after postcondition | Transaction protects the table/column changes from partial application |

Before history alignment, independently verify:

- all listed tables, functions and columns;
- owner-only RLS policies and no public cross-user access;
- `reminders_enabled` is non-null with default `false`;
- aggregate enabled/disabled preference counts are plausible;
- entitlement/profile/billing table aggregate counts match the private pre-release baseline;
- no migration changed entitlement, profile or billing rows;
- old-client columns and policies remain available.

Do not use `supabase db push`. Migration-history repair/alignment remains a
separate reviewed operation under `docs/production-schema-reconciliation.md`.

The next section to run is the corrected bundle's initial `begin; ...
$preconditions$ ... $baseline_columns$ ... rollback;` read-only baseline block.
Only after it completes without error should the owner execute the complete
labelled `BEGIN 202608200001_canonical_coaching_activity.sql` transaction.

## Dependency and verification stages

| Object | Expected baseline state | Creating migration | Correct verification stage |
| --- | --- | --- | --- |
| `activity_history` plus identity, payload, dedupe, report and timestamp columns | Required | Earlier persistence/reconciliation migrations | Initial baseline |
| `report_history.id` | Required | Earlier persistence/reconciliation migrations | Initial baseline |
| `settings.preferences` | Required | Earlier persistence/reconciliation migrations | Initial baseline |
| `notification_preferences.user_id` and owner RLS | Required | `202605250002`/production reconciliation | Initial baseline; policy metadata again at final verification |
| `qualified_streak_activities` | Optional legacy source; absence is valid | `202608160001` when deployed | Inspect before `004` only when present; never require initially |
| Coaching activity columns and protection trigger | Absent or compatible | `202608200001` | Inside `001`, before commit |
| `coaching_priorities` and current-priority index/policies | Absent or compatible | `202608200001` | Inside `001`, before commit; policy metadata again at final verification |
| `coaching_game_checkpoints` and policies | Absent or compatible | `202608200001` | Inside `001`, before commit; final metadata check |
| `coaching_response_plans`, active-subject index and policies | Absent or compatible | `202608200001` | Inside `001`, before commit; final metadata check |
| `record_meaningful_coaching_activity`, priority and weekly-goal functions | Absent or replaceable | `202608200001` | Inside `001`, before commit |
| `save_coaching_response_plan` | Absent or replaceable | `202608200002` | Inside `002`, before commit |
| `complete_game_check` | Absent or replaceable | `202608200003` | Inside `003`, before commit |
| `activity_local_date` and consistency functions | Absent or compatible | `202608200004` | Inside `004`, before commit |
| `coaching_weekly_reviews`, its indexes and owner policy | Absent or compatible | `202608200005` | Inside `005`, before commit; final RLS check |
| Reminder preference extension columns | Absent or compatible | `202608200005` | Inside `005`, before commit; final defaults/metadata check |
