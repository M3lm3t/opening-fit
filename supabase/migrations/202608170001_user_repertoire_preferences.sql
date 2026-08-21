-- Manual repertoire presentation choices. Historical evidence remains immutable.

create table if not exists public.user_repertoire_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  repertoire_role text not null check (repertoire_role in ('white', 'black_vs_e4', 'black_vs_d4')),
  canonical_opening_id text not null check (length(btrim(canonical_opening_id)) between 1 and 160),
  preference text not null check (preference in ('main', 'experimenting', 'ignore')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, repertoire_role, canonical_opening_id)
);

create unique index if not exists user_repertoire_preferences_one_main_role_idx
on public.user_repertoire_preferences (user_id, repertoire_role)
where preference = 'main';

alter table public.user_repertoire_preferences enable row level security;

drop policy if exists user_repertoire_preferences_select_own on public.user_repertoire_preferences;
create policy user_repertoire_preferences_select_own
on public.user_repertoire_preferences for select to authenticated
using (auth.uid() = user_id);

revoke insert, update, delete on public.user_repertoire_preferences from anon, authenticated;
grant select on public.user_repertoire_preferences to authenticated;

create or replace function public.set_user_repertoire_preference(
  p_repertoire_role text,
  p_canonical_opening_id text,
  p_preference text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  opening_id text := nullif(btrim(p_canonical_opening_id), '');
  saved public.user_repertoire_preferences;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if p_repertoire_role not in ('white', 'black_vs_e4', 'black_vs_d4') then raise exception 'Invalid repertoire role'; end if;
  if opening_id is null or length(opening_id) > 160 then raise exception 'A canonical opening ID is required'; end if;
  if p_preference not in ('automatic', 'main', 'experimenting', 'ignore') then raise exception 'Invalid repertoire preference'; end if;

  if p_preference = 'automatic' then
    delete from public.user_repertoire_preferences
    where user_id = owner_id and repertoire_role = p_repertoire_role and canonical_opening_id = opening_id;
    return jsonb_build_object(
      'userId', owner_id, 'repertoireRole', p_repertoire_role,
      'canonicalOpeningId', opening_id, 'preference', 'automatic'
    );
  end if;

  if p_preference = 'main' then
    delete from public.user_repertoire_preferences
    where user_id = owner_id and repertoire_role = p_repertoire_role
      and preference = 'main' and canonical_opening_id <> opening_id;
  end if;

  insert into public.user_repertoire_preferences (
    user_id, repertoire_role, canonical_opening_id, preference, updated_at
  ) values (owner_id, p_repertoire_role, opening_id, p_preference, now())
  on conflict (user_id, repertoire_role, canonical_opening_id) do update set
    preference = excluded.preference,
    updated_at = now()
  returning * into saved;

  return jsonb_build_object(
    'userId', saved.user_id, 'repertoireRole', saved.repertoire_role,
    'canonicalOpeningId', saved.canonical_opening_id,
    'preference', saved.preference, 'updatedAt', saved.updated_at
  );
end;
$$;

revoke all on function public.set_user_repertoire_preference(text, text, text) from public, anon;
grant execute on function public.set_user_repertoire_preference(text, text, text) to authenticated;

comment on table public.user_repertoire_preferences is
  'User-controlled presentation status keyed by account, canonical role and canonical opening ID; never raw game evidence.';
