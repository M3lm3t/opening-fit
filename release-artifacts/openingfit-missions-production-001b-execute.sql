-- PRODUCTION WARNING: target frtjfvhiimgruenqcuon only; split stage 001B.
-- Required prior-stage verification must pass. Missions disabled; rollout 0%; notifications disabled.
-- Do not rerun after an uncertain failure; inspect this stage read-only first.
BEGIN;
DO $precondition$ begin if to_regclass('public.openingfit_missions') is null then raise exception '001A is required'; end if; end $precondition$;
-- SOURCE MIGRATION 001 STAGE BEGIN
alter table public.openingfit_missions enable row level security;
alter table public.openingfit_mission_training_attempts enable row level security;
alter table public.openingfit_mission_encounters enable row level security;
alter table public.openingfit_mission_status_events enable row level security;

create policy openingfit_missions_select_own on public.openingfit_missions
for select to authenticated using (auth.uid() = user_id);
create policy openingfit_mission_attempts_select_own on public.openingfit_mission_training_attempts
for select to authenticated using (auth.uid() = user_id);
create policy openingfit_mission_encounters_select_own on public.openingfit_mission_encounters
for select to authenticated using (auth.uid() = user_id);
create policy openingfit_mission_status_events_select_own on public.openingfit_mission_status_events
for select to authenticated using (auth.uid() = user_id);

revoke all on public.openingfit_missions from public, anon, authenticated;
revoke all on public.openingfit_mission_training_attempts from public, anon, authenticated;
revoke all on public.openingfit_mission_encounters from public, anon, authenticated;
revoke all on public.openingfit_mission_status_events from public, anon, authenticated;
grant select on public.openingfit_missions, public.openingfit_mission_training_attempts, public.openingfit_mission_encounters, public.openingfit_mission_status_events to authenticated;
grant select, insert, update on public.openingfit_missions to service_role;
grant select, insert on public.openingfit_mission_training_attempts, public.openingfit_mission_encounters, public.openingfit_mission_status_events to service_role;

create or replace function public.openingfit_protect_mission_identity()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.user_id is distinct from old.user_id
     or new.candidate_id is distinct from old.candidate_id
     or new.candidate_key is distinct from old.candidate_key
     or new.algorithm_version is distinct from old.algorithm_version
     or new.generation is distinct from old.generation
     or new.mission_type is distinct from old.mission_type
     or new.role is distinct from old.role
     or new.opening_id is distinct from old.opening_id
     or new.exact_position_key is distinct from old.exact_position_key
     or new.position_fen is distinct from old.position_fen
     or new.player_turn is distinct from old.player_turn
     or new.repeated_played_move_uci is distinct from old.repeated_played_move_uci
     or new.accepted_correction_moves is distinct from old.accepted_correction_moves
     or new.correction_source is distinct from old.correction_source
     or new.baseline_cutoff_at is distinct from old.baseline_cutoff_at
     or new.recurrence_of_mission_id is distinct from old.recurrence_of_mission_id
     or new.supersedes_mission_id is distinct from old.supersedes_mission_id then
    raise exception 'OpeningFit mission identity is immutable';
  end if;
  if (new.status is distinct from old.status
      or new.is_primary is distinct from old.is_primary
      or new.assigned_at is distinct from old.assigned_at
      or new.learning_started_at is distinct from old.learning_started_at
      or new.training_completed_at is distinct from old.training_completed_at
      or new.awaiting_evidence_at is distinct from old.awaiting_evidence_at
      or new.repaired_at is distinct from old.repaired_at
      or new.dismissed_at is distinct from old.dismissed_at
      or new.dismissed_reason is distinct from old.dismissed_reason
      or new.superseded_at is distinct from old.superseded_at)
     and coalesce(current_setting('openingfit.mission_transition', true), '') <> 'allowed' then
    raise exception 'OpeningFit mission lifecycle must use the protected transition function';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger openingfit_protect_mission_identity
before update on public.openingfit_missions
for each row execute function public.openingfit_protect_mission_identity();

-- SOURCE MIGRATION 001 STAGE END
DO $assert$ begin if (select count(*) from pg_class where oid=any(array[to_regclass('public.openingfit_missions'),to_regclass('public.openingfit_mission_training_attempts'),to_regclass('public.openingfit_mission_encounters'),to_regclass('public.openingfit_mission_status_events')]) and relrowsecurity)<>4 or (select count(*) from pg_policies where schemaname='public' and policyname like 'openingfit_mission%select_own')<>4 or not exists(select 1 from pg_trigger where tgrelid=to_regclass('public.openingfit_missions') and tgname='openingfit_protect_mission_identity' and not tgisinternal) then raise exception '001B postcondition failed'; end if; end $assert$;
COMMIT;
