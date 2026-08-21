# OpeningFit repertoire preferences — production verification record

Status: **APPLIED AND VERIFIED — DO NOT RERUN SECTION 2**

Production target: Supabase project `frtjfvhiimgruenqcuon`.

The owner confirmed all ten independent metadata inspections passed. Migration
`202608170001_user_repertoire_preferences.sql` is successfully applied. The
later missing `repertoire_preferences_release_baseline` error was a verification
script defect after persistent migration state existed; no repair SQL is needed.

This release applies only `202608170001_user_repertoire_preferences.sql`.
Retention migrations `202608200001–005` were already manually applied and are
deliberately excluded. Migration history remains intentionally unaligned;
normal `supabase db push` is prohibited.

The historical bundle can still be reproduced for audit only:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/prepare_repertoire_preferences_release_bundle.ps1
```

Output:
`release-artifacts/openingfit-repertoire-preferences-production-bundle.sql`

The generated file is marked `ARCHIVAL TEMPLATE ONLY` and must not be executed
against production. The current safe workflow is metadata inspection only:
`release-artifacts/openingfit-repertoire-preferences-production-inspection.sql`.

The previously reviewed 11,621-byte artifact with SHA-256
`E941AA34D27FC1CF154326C39C4F2D370FF1D66DBBACE667A212E54387138458`
is superseded and must not be run. Its Section 2 used a `CASE` expression that
still caused PostgreSQL to resolve an absent relation while parsing.

The owner ran this read-only query after the failed Section 2 attempt:

```sql
select to_regclass('public.user_repertoire_preferences') as table_state;
```

The result was `NULL`, confirming that the failed transaction left no lasting
preference schema. Corrected execution therefore restarts at Section 1.

Corrected reviewed artifact: 12,087 bytes; SHA-256
`DC0DEFF2FFAF70B46391D291E4708B419559DE35A82AC5D3C45CED2A63EEFF9D`.
This second bundle is also superseded because its verification depended on the
session-scoped `repertoire_preferences_release_baseline` relation. Do not run it.

## Completed verification

The owner ran all ten inspection queries independently and confirmed:

- `user_repertoire_preferences` has six canonical columns and RLS enabled;
- primary key is `(user_id, repertoire_role, canonical_opening_id)`;
- the partial unique index permits only one `main` preference per user/role;
- authenticated users have owner-filtered SELECT only and no direct writes;
- anon has no access;
- `set_user_repertoire_preference(text,text,text)` returns `jsonb`, is security
  definer, and is executable only by authenticated users;
- no unexpected triggers, policies, overloads, or grants exist;
- no profile, entitlement, report, coaching, billing, or retention objects are
  changed.

The migration is additive. Old clients do not reference the table or RPC and
continue to work. Migration history remains intentionally unaligned and normal
`supabase db push` remains prohibited.
