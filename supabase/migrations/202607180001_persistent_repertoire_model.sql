-- Evolve the existing repertoire table into the canonical persistent model.
-- The legacy `repertoire` jsonb column remains so old user data is preserved.

alter table public.repertoire drop constraint if exists repertoire_user_id_key;

alter table public.repertoire add column if not exists slot text;
alter table public.repertoire add column if not exists canonical_opening_id text;
alter table public.repertoire add column if not exists canonical_name text;
alter table public.repertoire add column if not exists display_name text;
alter table public.repertoire add column if not exists source text not null default 'imported';
alter table public.repertoire add column if not exists status text not null default 'archived';
alter table public.repertoire add column if not exists confidence text;
alter table public.repertoire add column if not exists sample_size integer;
alter table public.repertoire add column if not exists recent_score numeric(5, 2);
alter table public.repertoire add column if not exists key_strength text;
alter table public.repertoire add column if not exists key_weakness text;
alter table public.repertoire add column if not exists current_training_focus text;
alter table public.repertoire add column if not exists recommendation_reason text;
alter table public.repertoire add column if not exists expected_benefit text;
alter table public.repertoire add column if not exists added_at timestamptz not null default now();
alter table public.repertoire add column if not exists last_reviewed_at timestamptz;

update public.repertoire
set
  status = 'archived',
  source = 'imported',
  added_at = coalesce(added_at, created_at, now())
where slot is null;

alter table public.repertoire drop constraint if exists repertoire_slot_check;
alter table public.repertoire add constraint repertoire_slot_check check (
  slot is null or slot in ('white_primary', 'white_secondary', 'black_vs_e4', 'black_vs_d4', 'black_other')
);

alter table public.repertoire drop constraint if exists repertoire_source_check;
alter table public.repertoire add constraint repertoire_source_check check (
  source in ('recommended', 'user_selected', 'imported')
);

alter table public.repertoire drop constraint if exists repertoire_status_check;
alter table public.repertoire add constraint repertoire_status_check check (
  status in ('active', 'considering', 'archived')
);

alter table public.repertoire drop constraint if exists repertoire_sample_size_check;
alter table public.repertoire add constraint repertoire_sample_size_check check (
  sample_size is null or sample_size >= 0
);

alter table public.repertoire drop constraint if exists repertoire_recent_score_check;
alter table public.repertoire add constraint repertoire_recent_score_check check (
  recent_score is null or (recent_score >= 0 and recent_score <= 100)
);

alter table public.repertoire drop constraint if exists repertoire_entry_shape_check;
alter table public.repertoire add constraint repertoire_entry_shape_check check (
  (
    slot is null
    and status = 'archived'
  )
  or
  (
    slot is not null
    and nullif(trim(display_name), '') is not null
    and (
      nullif(trim(canonical_opening_id), '') is not null
      or nullif(trim(canonical_name), '') is not null
    )
  )
);

create unique index if not exists repertoire_one_active_slot_idx
on public.repertoire (user_id, slot)
where status = 'active';

create unique index if not exists repertoire_one_pending_recommendation_idx
on public.repertoire (
  user_id,
  slot,
  coalesce(canonical_opening_id, canonical_name)
)
where status = 'considering' and source = 'recommended';

create index if not exists repertoire_user_status_slot_idx
on public.repertoire (user_id, status, slot, updated_at desc);

-- Promote the previous cloud workspace into typed rows when it exists. This is
-- a migration of already-saved user choices, not automatic report creation.
with legacy_raw as (
  select
    state.user_id,
    state.updated_at as state_updated_at,
    item,
    case item->>'section'
      when 'white' then case when item->>'role' in ('Backup', 'Alternative') then 'white_secondary' else 'white_primary' end
      when 'blackE4' then 'black_vs_e4'
      when 'blackD4' then 'black_vs_d4'
      when 'other' then 'black_other'
      else null
    end as mapped_slot
  from public.openingfit_user_state state
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(state.coach_progress->'repertoireWorkspace'->'items') = 'array'
        then state.coach_progress->'repertoireWorkspace'->'items'
      else '[]'::jsonb
    end
  ) item
  where nullif(trim(item->>'name'), '') is not null
), legacy_items as (
  select
    user_id,
    item,
    mapped_slot,
    row_number() over (
      partition by user_id, mapped_slot
      order by
        case when item->>'role' in ('Main', 'Current') then 0 else 1 end,
        case when coalesce((item->>'locked')::boolean, false) then 0 else 1 end,
        state_updated_at desc
    ) as slot_rank
  from legacy_raw
  where mapped_slot is not null
)
insert into public.repertoire (
  user_id, slot, canonical_name, display_name, source, status, confidence,
  sample_size, recent_score, key_weakness, current_training_focus, added_at,
  last_reviewed_at
)
select
  user_id,
  mapped_slot,
  item->>'name',
  item->>'name',
  case when item->>'source' = 'manual' then 'user_selected' else 'imported' end,
  case
    when item->>'status' in ('Paused', 'Avoided') then 'archived'
    when slot_rank = 1 and not exists (
      select 1 from public.repertoire current_entry
      where current_entry.user_id = legacy_items.user_id
        and current_entry.slot = legacy_items.mapped_slot
        and current_entry.status = 'active'
    ) then 'active'
    else 'considering'
  end,
  nullif(item->>'confidence', ''),
  case when item->>'games' ~ '^\d+$' then (item->>'games')::integer else null end,
  case when item->>'fit' ~ '^\d+(\.\d+)?$' then (item->>'fit')::numeric else null end,
  nullif(item->>'weakness', ''),
  nullif(item->>'trainingFocus', ''),
  case when item->>'addedAt' ~ '^\d{4}-\d{2}-\d{2}T' then (item->>'addedAt')::timestamptz else now() end,
  now()
from legacy_items
where mapped_slot is not null
on conflict do nothing;

alter table public.repertoire enable row level security;

drop policy if exists repertoire_select_own on public.repertoire;
create policy repertoire_select_own
on public.repertoire for select to authenticated
using (auth.uid() = user_id);

drop policy if exists repertoire_insert_own on public.repertoire;
create policy repertoire_insert_own
on public.repertoire for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists repertoire_update_own on public.repertoire;
create policy repertoire_update_own
on public.repertoire for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists repertoire_delete_own on public.repertoire;

-- Reads use RLS directly. Mutations go through the transition functions below,
-- preventing clients from bypassing archive/history and active-slot rules.
revoke insert, update, delete on public.repertoire from authenticated;
grant select on public.repertoire to authenticated;

drop trigger if exists set_repertoire_updated_at on public.repertoire;
create trigger set_repertoire_updated_at
before update on public.repertoire
for each row execute function public.set_updated_at();

create or replace function public.initialise_repertoire_from_report(p_entries jsonb)
returns setof public.repertoire
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  entry jsonb;
  required_slot text;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then
    raise exception 'A report repertoire is required';
  end if;
  if exists (select 1 from public.repertoire where user_id = owner_id and status = 'active') then
    raise exception 'An active repertoire already exists';
  end if;

  foreach required_slot in array array['white_primary', 'black_vs_e4', 'black_vs_d4'] loop
    if not exists (select 1 from jsonb_array_elements(p_entries) item where item->>'slot' = required_slot) then
      raise exception 'Missing required repertoire slot: %', required_slot;
    end if;
  end loop;

  for entry in select value from jsonb_array_elements(p_entries) loop
    insert into public.repertoire (
      user_id, slot, canonical_opening_id, canonical_name, display_name,
      source, status, confidence, sample_size, recent_score, key_strength,
      key_weakness, current_training_focus, recommendation_reason, expected_benefit,
      added_at, last_reviewed_at
    ) values (
      owner_id, entry->>'slot', nullif(entry->>'canonical_opening_id', ''),
      nullif(entry->>'canonical_name', ''), entry->>'display_name',
      coalesce(nullif(entry->>'source', ''), 'recommended'), 'active',
      nullif(entry->>'confidence', ''), nullif(entry->>'sample_size', '')::integer,
      nullif(entry->>'recent_score', '')::numeric, nullif(entry->>'key_strength', ''),
      nullif(entry->>'key_weakness', ''), nullif(entry->>'current_training_focus', ''),
      nullif(entry->>'recommendation_reason', ''), nullif(entry->>'expected_benefit', ''),
      coalesce((entry->>'added_at')::timestamptz, now()), now()
    );
  end loop;

  return query select * from public.repertoire where user_id = owner_id and status = 'active' order by slot;
end;
$$;

create or replace function public.accept_repertoire_recommendation(p_recommendation_id uuid)
returns public.repertoire
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  recommendation public.repertoire;
begin
  select * into recommendation from public.repertoire
  where id = p_recommendation_id and user_id = owner_id
    and source = 'recommended' and status = 'considering'
  for update;
  if recommendation.id is null then raise exception 'Recommendation not found'; end if;

  update public.repertoire set status = 'archived', last_reviewed_at = now()
  where user_id = owner_id and slot = recommendation.slot and status = 'active';
  update public.repertoire set status = 'active', last_reviewed_at = now()
  where id = recommendation.id returning * into recommendation;
  return recommendation;
end;
$$;

create or replace function public.reject_repertoire_recommendation(p_recommendation_id uuid)
returns public.repertoire
language plpgsql
security definer
set search_path = public
as $$
declare rejected public.repertoire;
begin
  update public.repertoire set status = 'archived', last_reviewed_at = now()
  where id = p_recommendation_id and user_id = auth.uid()
    and source = 'recommended' and status = 'considering'
  returning * into rejected;
  if rejected.id is null then raise exception 'Recommendation not found'; end if;
  return rejected;
end;
$$;

create or replace function public.replace_repertoire_entry(p_slot text, p_entry jsonb)
returns public.repertoire
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  replacement public.repertoire;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if p_slot not in ('white_primary', 'white_secondary', 'black_vs_e4', 'black_vs_d4', 'black_other') then
    raise exception 'Invalid repertoire slot';
  end if;

  update public.repertoire set status = 'archived', last_reviewed_at = now()
  where user_id = owner_id and slot = p_slot and status = 'active';
  insert into public.repertoire (
    user_id, slot, canonical_opening_id, canonical_name, display_name,
    source, status, confidence, sample_size, recent_score, key_strength,
    key_weakness, current_training_focus, recommendation_reason, expected_benefit,
    last_reviewed_at
  ) values (
    owner_id, p_slot, nullif(p_entry->>'canonical_opening_id', ''),
    nullif(p_entry->>'canonical_name', ''), p_entry->>'display_name',
    'user_selected', 'active', nullif(p_entry->>'confidence', ''),
    nullif(p_entry->>'sample_size', '')::integer, nullif(p_entry->>'recent_score', '')::numeric,
    nullif(p_entry->>'key_strength', ''), nullif(p_entry->>'key_weakness', ''),
    nullif(p_entry->>'current_training_focus', ''), nullif(p_entry->>'recommendation_reason', ''),
    nullif(p_entry->>'expected_benefit', ''), now()
  ) returning * into replacement;
  return replacement;
end;
$$;

create or replace function public.archive_repertoire_entry(p_entry_id uuid)
returns public.repertoire
language plpgsql
security definer
set search_path = public
as $$
declare archived public.repertoire;
begin
  select * into archived from public.repertoire
  where id = p_entry_id and user_id = auth.uid() for update;
  if archived.id is null then raise exception 'Repertoire entry not found'; end if;
  if archived.status = 'active' and archived.slot in ('white_primary', 'black_vs_e4', 'black_vs_d4') then
    raise exception 'Replace a required active slot instead of archiving it';
  end if;
  update public.repertoire set status = 'archived', last_reviewed_at = now()
  where id = p_entry_id returning * into archived;
  return archived;
end;
$$;

create or replace function public.sync_repertoire_report(p_metrics jsonb, p_recommendations jsonb)
returns setof public.repertoire
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  item jsonb;
  active_entry public.repertoire;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;

  if jsonb_typeof(p_metrics) = 'array' then
    for item in select value from jsonb_array_elements(p_metrics) loop
      update public.repertoire set
        confidence = coalesce(nullif(item->>'confidence', ''), confidence),
        sample_size = coalesce(nullif(item->>'sample_size', '')::integer, sample_size),
        recent_score = coalesce(nullif(item->>'recent_score', '')::numeric, recent_score),
        key_strength = coalesce(nullif(item->>'key_strength', ''), key_strength),
        key_weakness = coalesce(nullif(item->>'key_weakness', ''), key_weakness),
        current_training_focus = coalesce(nullif(item->>'current_training_focus', ''), current_training_focus),
        last_reviewed_at = now()
      where user_id = owner_id and status = 'active'
        and (
          (nullif(item->>'canonical_opening_id', '') is not null and canonical_opening_id = item->>'canonical_opening_id')
          or (nullif(item->>'canonical_name', '') is not null and canonical_name = item->>'canonical_name')
        );
    end loop;
  end if;

  if jsonb_typeof(p_recommendations) = 'array' then
    for item in select value from jsonb_array_elements(p_recommendations) loop
      select * into active_entry from public.repertoire
      where user_id = owner_id and slot = item->>'slot' and status = 'active';
      if active_entry.id is not null
         and coalesce(active_entry.canonical_opening_id, active_entry.canonical_name)
             is distinct from coalesce(nullif(item->>'canonical_opening_id', ''), nullif(item->>'canonical_name', '')) then
        update public.repertoire set
          display_name = item->>'display_name',
          confidence = nullif(item->>'confidence', ''),
          sample_size = nullif(item->>'sample_size', '')::integer,
          recent_score = nullif(item->>'recent_score', '')::numeric,
          key_strength = nullif(item->>'key_strength', ''),
          key_weakness = nullif(item->>'key_weakness', ''),
          current_training_focus = nullif(item->>'current_training_focus', ''),
          recommendation_reason = nullif(item->>'recommendation_reason', ''),
          expected_benefit = nullif(item->>'expected_benefit', ''),
          last_reviewed_at = now()
        where user_id = owner_id
          and slot = item->>'slot'
          and status = 'considering'
          and source = 'recommended'
          and coalesce(canonical_opening_id, canonical_name)
              = coalesce(nullif(item->>'canonical_opening_id', ''), nullif(item->>'canonical_name', ''));

        insert into public.repertoire (
          user_id, slot, canonical_opening_id, canonical_name, display_name,
          source, status, confidence, sample_size, recent_score, key_strength,
          key_weakness, current_training_focus, recommendation_reason, expected_benefit,
          last_reviewed_at
        ) values (
          owner_id, item->>'slot', nullif(item->>'canonical_opening_id', ''),
          nullif(item->>'canonical_name', ''), item->>'display_name',
          'recommended', 'considering', nullif(item->>'confidence', ''),
          nullif(item->>'sample_size', '')::integer, nullif(item->>'recent_score', '')::numeric,
          nullif(item->>'key_strength', ''), nullif(item->>'key_weakness', ''),
          nullif(item->>'current_training_focus', ''), nullif(item->>'recommendation_reason', ''),
          nullif(item->>'expected_benefit', ''), now()
        ) on conflict do nothing;
      end if;
    end loop;
  end if;

  return query select * from public.repertoire where user_id = owner_id order by updated_at desc;
end;
$$;

revoke all on function public.initialise_repertoire_from_report(jsonb) from public, anon;
revoke all on function public.accept_repertoire_recommendation(uuid) from public, anon;
revoke all on function public.reject_repertoire_recommendation(uuid) from public, anon;
revoke all on function public.replace_repertoire_entry(text, jsonb) from public, anon;
revoke all on function public.archive_repertoire_entry(uuid) from public, anon;
revoke all on function public.sync_repertoire_report(jsonb, jsonb) from public, anon;
grant execute on function public.initialise_repertoire_from_report(jsonb) to authenticated;
grant execute on function public.accept_repertoire_recommendation(uuid) to authenticated;
grant execute on function public.reject_repertoire_recommendation(uuid) to authenticated;
grant execute on function public.replace_repertoire_entry(text, jsonb) to authenticated;
grant execute on function public.archive_repertoire_entry(uuid) to authenticated;
grant execute on function public.sync_repertoire_report(jsonb, jsonb) to authenticated;
