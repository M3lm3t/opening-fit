-- OpeningFit cloud sync identity strategy:
-- auth.users.id is the only account owner key. App-owned rows store it in user_id
-- and RLS checks auth.uid() = user_id. Email, chess username, and platform are
-- profile metadata or dedupe fields; they must not be used as ownership keys.

alter table if exists public.user_profiles
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

update public.user_profiles
set user_id = id
where user_id is null
  and id in (select auth_users.id from auth.users as auth_users);

with ranked_profiles as (
  select
    id,
    row_number() over (
      partition by user_id
      order by
        case when id = user_id then 0 else 1 end,
        updated_at desc nulls last,
        created_at desc nulls last,
        id
    ) as keep_rank
  from public.user_profiles
  where user_id is not null
)
delete from public.user_profiles duplicate_profile
using ranked_profiles
where duplicate_profile.id = ranked_profiles.id
  and ranked_profiles.keep_rank > 1;

create unique index if not exists user_profiles_user_id_key
  on public.user_profiles(user_id);

alter table if exists public.user_profiles enable row level security;

drop policy if exists user_profiles_select_own on public.user_profiles;
create policy user_profiles_select_own
  on public.user_profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_profiles_insert_own on public.user_profiles;
create policy user_profiles_insert_own
  on public.user_profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists user_profiles_update_own on public.user_profiles;
create policy user_profiles_update_own
  on public.user_profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists user_profiles_delete_own on public.user_profiles;
create policy user_profiles_delete_own
  on public.user_profiles
  for delete
  to authenticated
  using (auth.uid() = user_id);

comment on column public.profiles.user_id is
  'Canonical OpeningFit owner id. Matches auth.users.id/auth.uid(); email and chess usernames are metadata.';

comment on column public.user_profiles.user_id is
  'Canonical OpeningFit owner id for retention profile rows. Matches auth.users.id/auth.uid().';

comment on table public.premium_entitlements is
  'Premium access rows keyed by user_id = auth.users.id. Client code may read its own row; trusted server code writes Stripe lifecycle fields.';

comment on column public.openingfit_user_state.user_id is
  'Canonical OpeningFit owner id. Platform and username dedupe workspaces but do not identify the authenticated account.';

comment on column public.report_history.user_id is
  'Canonical OpeningFit owner id for saved analyses. report_key dedupes saves within a user only.';

comment on column public.analysed_games.user_id is
  'Canonical OpeningFit owner id for imported game history. game_id dedupes within user/platform/username.';
