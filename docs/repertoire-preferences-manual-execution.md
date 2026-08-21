# OpeningFit repertoire preferences — awaiting manual production execution

Status: **AWAITING MANUAL EXECUTION — DO NOT PUSH MAIN**

Production target: Supabase project `frtjfvhiimgruenqcuon`.

This release applies only `202608170001_user_repertoire_preferences.sql`.
Retention migrations `202608200001–005` were already manually applied and are
deliberately excluded. Migration history remains intentionally unaligned;
normal `supabase db push` is prohibited.

Generate the reviewed bundle:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/prepare_repertoire_preferences_release_bundle.ps1
```

Output:
`release-artifacts/openingfit-repertoire-preferences-production-bundle.sql`

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

## Manual execution order

1. Open only project `frtjfvhiimgruenqcuon` in Supabase SQL Editor and verify a
   recoverable backup exists.
2. Run Section 1, the read-only baseline transaction. Continue only when it
   returns `PRECONDITION_PASS` and raises no exception.
3. Run Section 2 as one complete transaction. Continue only when it returns
   `MIGRATION_POSTCONDITION_PASS` and commits successfully.
4. Run the Section 3 metadata queries individually. They query catalogues and
   grants only; do not copy private row data into the repository.
5. Confirm the expected results below, then notify the release owner. Do not
   align migration history and do not push code yet.

Expected results:

- `user_repertoire_preferences` has six canonical columns and RLS enabled;
- primary key is `(user_id, repertoire_role, canonical_opening_id)`;
- the partial unique index permits only one `main` preference per user/role;
- authenticated users have owner-filtered SELECT only and no direct writes;
- anon has no access;
- `set_user_repertoire_preference(text,text,text)` returns `jsonb`, is security
  definer, and is executable only by authenticated users;
- existing preference row count is unchanged when compatible state already
  exists, and is zero on first deployment;
- no profile, entitlement, report, coaching, billing, or retention objects are
  changed.

The migration is additive. Old clients do not reference the table or RPC and
continue to work. Deploying the new client first would not corrupt data or grant
access, but the repertoire editor would report that cloud sync is unavailable;
therefore apply and verify this bundle before pushing `main`.
