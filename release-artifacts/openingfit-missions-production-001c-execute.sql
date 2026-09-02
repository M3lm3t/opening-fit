-- PRODUCTION WARNING: target frtjfvhiimgruenqcuon only; split stage 001C.
-- Required prior-stage verification must pass. Missions disabled; rollout 0%; notifications disabled.
-- Do not rerun after an uncertain failure; inspect this stage read-only first.
BEGIN;
DO $precondition$ begin if not exists(select 1 from pg_trigger where tgrelid=to_regclass('public.openingfit_missions') and tgname='openingfit_protect_mission_identity' and not tgisinternal) then raise exception '001B is required'; end if; end $precondition$;
-- SOURCE MIGRATION 001 STAGE BEGIN
create or replace function public.transition_openingfit_mission(
  p_user_id uuid, p_mission_id uuid, p_to_status text, p_cause_type text, p_cause_id text,
  p_idempotency_key text, p_evidence_summary jsonb default '{}'::jsonb
) returns public.openingfit_missions language plpgsql security definer set search_path = public as $$
declare current_mission public.openingfit_missions; prior_status text; prior_event public.openingfit_mission_status_events;
begin
  if auth.role() <> 'service_role' and current_user <> 'postgres' then raise exception 'Service authority required'; end if;
  if nullif(btrim(p_idempotency_key), '') is null or length(p_idempotency_key) > 200 then raise exception 'A valid idempotency key is required'; end if;
  select * into prior_event from public.openingfit_mission_status_events where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if prior_event.id is not null then
    if prior_event.mission_id <> p_mission_id or prior_event.to_status <> p_to_status then raise exception 'Idempotency key conflict'; end if;
    select * into current_mission from public.openingfit_missions where id = p_mission_id and user_id = p_user_id;
    return current_mission;
  end if;
  select * into current_mission from public.openingfit_missions where id = p_mission_id and user_id = p_user_id for update;
  if current_mission.id is null then raise exception 'Mission not found'; end if;
  prior_status := current_mission.status;
  if not case prior_status
    when 'candidate' then p_to_status in ('assigned','dismissed','superseded')
    when 'assigned' then p_to_status in ('learning','dismissed','superseded')
    when 'learning' then p_to_status in ('awaiting_evidence','dismissed','superseded')
    when 'awaiting_evidence' then p_to_status in ('improving','needs_review','repaired','dismissed','superseded')
    when 'improving' then p_to_status in ('repaired','needs_review','dismissed','superseded')
    when 'needs_review' then p_to_status in ('learning','dismissed','superseded')
    when 'repaired' then p_to_status = 'superseded'
    else false end then raise exception 'Illegal mission transition'; end if;
  perform set_config('openingfit.mission_transition', 'allowed', true);
  update public.openingfit_missions set status = p_to_status,
    is_primary = p_to_status in ('assigned','learning','awaiting_evidence','improving','needs_review'),
    assigned_at = case when p_to_status='assigned' then coalesce(assigned_at,now()) else assigned_at end,
    learning_started_at = case when p_to_status='learning' then now() else learning_started_at end,
    training_completed_at = case when prior_status='learning' and p_to_status='awaiting_evidence' then now() else training_completed_at end,
    awaiting_evidence_at = case when p_to_status='awaiting_evidence' then coalesce(awaiting_evidence_at,now()) else awaiting_evidence_at end,
    repaired_at = case when p_to_status='repaired' then now() else repaired_at end,
    dismissed_at = case when p_to_status='dismissed' then now() else dismissed_at end,
    superseded_at = case when p_to_status='superseded' then now() else superseded_at end
  where id=p_mission_id returning * into current_mission;
  insert into public.openingfit_mission_status_events(user_id,mission_id,from_status,to_status,cause_type,cause_id,idempotency_key,evidence_summary)
  values(p_user_id,p_mission_id,prior_status,p_to_status,btrim(p_cause_type),p_cause_id,p_idempotency_key,coalesce(p_evidence_summary,'{}'::jsonb));
  return current_mission;
end $$;

create or replace function public.dismiss_openingfit_mission(
  p_mission_id uuid, p_reason text, p_idempotency_key text
) returns public.openingfit_missions language plpgsql security definer set search_path = public as $$
declare owner_id uuid := auth.uid(); saved public.openingfit_missions;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if p_reason not in ('not_relevant','wrong_opening','prefer_another','other') then raise exception 'Unsupported dismissal reason'; end if;
  saved := public.transition_openingfit_mission(owner_id,p_mission_id,'dismissed','user_dismissed',p_reason,p_idempotency_key,jsonb_build_object('reason',p_reason));
  update public.openingfit_missions set dismissed_reason=p_reason where id=saved.id and user_id=owner_id returning * into saved;
  return saved;
end $$;

revoke all on function public.transition_openingfit_mission(uuid,uuid,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.transition_openingfit_mission(uuid,uuid,text,text,text,text,jsonb) to service_role;
revoke all on function public.dismiss_openingfit_mission(uuid,text,text) from public, anon;
grant execute on function public.dismiss_openingfit_mission(uuid,text,text) to authenticated, service_role;

comment on table public.openingfit_missions is 'Server-authoritative OpeningFit Mission aggregates. Legacy coaching_priorities are intentionally separate.';
comment on table public.openingfit_mission_status_events is 'Append-only lifecycle audit written transactionally by protected functions; ordinary clients have SELECT only.';
comment on column public.openingfit_mission_encounters.qualifies_for_verification is 'Server-derived cutoff decision; old encounters may be retained for idempotency but cannot advance lifecycle.';
comment on column public.openingfit_missions.baseline_evidence_game_ids is 'Bounded stable game identifiers only; raw PGNs and opponent identities are not stored.';

-- Rollback (manual, not executed): revoke functions/grants, drop the two functions,
-- then drop status_events, encounters, attempts and missions in dependency order.
-- SOURCE MIGRATION 001 STAGE END
DO $assert$ begin if not exists(select 1 from pg_proc where oid=to_regprocedure('public.transition_openingfit_mission(uuid,uuid,text,text,text,text,jsonb)') and prosecdef and proconfig @> array['search_path=public']) or not exists(select 1 from pg_proc where oid=to_regprocedure('public.dismiss_openingfit_mission(uuid,text,text)') and prosecdef and proconfig @> array['search_path=public']) or has_function_privilege('public',to_regprocedure('public.transition_openingfit_mission(uuid,uuid,text,text,text,text,jsonb)'),'execute') or has_function_privilege('anon',to_regprocedure('public.dismiss_openingfit_mission(uuid,text,text)'),'execute') then raise exception '001C postcondition failed'; end if; end $assert$;
COMMIT;
