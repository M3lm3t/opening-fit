-- PRODUCTION WARNING: target frtjfvhiimgruenqcuon; stage 001B.
-- Required prior-stage verification must pass. Missions disabled; rollout 0%; notifications disabled.
-- Do not rerun after an uncertain failure; inspect this stage read-only first.
BEGIN;
DO $precondition$ begin if not ((select count(*) from pg_class r join pg_namespace n on n.oid=r.relnamespace where n.nspname='public' and r.relkind='r' and r.relname=any(array['openingfit_missions','openingfit_mission_training_attempts','openingfit_mission_encounters','openingfit_mission_status_events']))=4 and (select count(*)=8 and md5(string_agg(tablename||'|'||indexname||'|'||indexdef,chr(10) order by indexname))='7f724464ada49aa0ddca4f128d419715' from pg_indexes where schemaname='public' and indexname=any(array['openingfit_missions_one_primary_active_idx','openingfit_missions_current_lookup_idx','openingfit_missions_history_idx','openingfit_missions_position_idx','openingfit_missions_source_report_idx','openingfit_mission_attempts_history_idx','openingfit_mission_encounters_verification_idx','openingfit_mission_status_events_history_idx'])) and (select count(*)=46 and md5(string_agg(n.nspname||'.'||r.relname||'|'||c.conname||'|'||c.contype::text||'|'||pg_get_constraintdef(c.oid,false),chr(10) order by n.nspname,r.relname,c.conname))='cb93fc8e4263fd7b74d89d8fc1527d02' from pg_constraint c join pg_class r on r.oid=c.conrelid join pg_namespace n on n.oid=r.relnamespace where n.nspname='public' and r.relname=any(array['openingfit_missions','openingfit_mission_training_attempts','openingfit_mission_encounters','openingfit_mission_status_events'])) and (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(array['openingfit_missions','openingfit_mission_training_attempts','openingfit_mission_encounters','openingfit_mission_status_events']) and c.relrowsecurity)=4 and (select count(*) from public.openingfit_missions)+(select count(*) from public.openingfit_mission_training_attempts)+(select count(*) from public.openingfit_mission_encounters)+(select count(*) from public.openingfit_mission_status_events)=0 and not exists(select 1 from pg_policies where schemaname='public' and tablename=any(array['openingfit_missions','openingfit_mission_training_attempts','openingfit_mission_encounters','openingfit_mission_status_events'])) and not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%openingfit_mission%') and not exists(select 1 from pg_trigger t where t.tgrelid=any(array[to_regclass('public.openingfit_missions'),to_regclass('public.openingfit_mission_training_attempts'),to_regclass('public.openingfit_mission_encounters'),to_regclass('public.openingfit_mission_status_events')]) and not t.tgisinternal) and not exists(select 1 from (values('openingfit_missions'),('openingfit_mission_training_attempts'),('openingfit_mission_encounters'),('openingfit_mission_status_events')) t(name) cross join (values(0::oid),('anon'::regrole::oid),('authenticated'::regrole::oid)) r(oid) cross join (values('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(name) where has_table_privilege(r.oid,to_regclass('public.'||t.name),p.name)) and not exists(select 1 from (values('openingfit_missions'),('openingfit_mission_training_attempts'),('openingfit_mission_encounters'),('openingfit_mission_status_events')) t(name) cross join (values('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(name) where has_table_privilege('service_role',to_regclass('public.'||t.name),p.name))) then raise exception 'clean contained 001A is required'; end if; end $precondition$;
-- SOURCE MIGRATION 001 STAGE BEGIN
create policy openingfit_missions_select_own on public.openingfit_missions
for select to authenticated using (auth.uid() = user_id);
create policy openingfit_mission_attempts_select_own on public.openingfit_mission_training_attempts
for select to authenticated using (auth.uid() = user_id);
create policy openingfit_mission_encounters_select_own on public.openingfit_mission_encounters
for select to authenticated using (auth.uid() = user_id);
create policy openingfit_mission_status_events_select_own on public.openingfit_mission_status_events
for select to authenticated using (auth.uid() = user_id);

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
DO $assert$ begin if (select count(*) from pg_class where oid=any(array[to_regclass('public.openingfit_missions'),to_regclass('public.openingfit_mission_training_attempts'),to_regclass('public.openingfit_mission_encounters'),to_regclass('public.openingfit_mission_status_events')]) and relrowsecurity)<>4 or (select count(*) from pg_policies where schemaname='public' and policyname like 'openingfit_mission%select_own')<>4 or not exists(select 1 from pg_trigger where tgrelid=to_regclass('public.openingfit_missions') and tgname='openingfit_protect_mission_identity' and not tgisinternal) or not (not exists(select 1 from (values('openingfit_missions'),('openingfit_mission_training_attempts'),('openingfit_mission_encounters'),('openingfit_mission_status_events')) t(name) cross join (values(0::oid,'public'),('anon'::regrole::oid,'anon'),('authenticated'::regrole::oid,'authenticated'),('service_role'::regrole::oid,'service_role')) r(oid,name) cross join (values('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(name) where has_table_privilege(r.oid,to_regclass('public.'||t.name),p.name) is distinct from (case when r.name='authenticated' then p.name='SELECT' when r.name='service_role' then p.name in ('SELECT','INSERT') or (t.name='openingfit_missions' and p.name='UPDATE') else false end))) then raise exception '001B postcondition failed'; end if; end $assert$;
COMMIT;
