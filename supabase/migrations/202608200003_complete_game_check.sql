create or replace function public.complete_game_check(
  p_platform text,
  p_username text,
  p_checked_game_ids text[],
  p_idempotency_key text,
  p_payload jsonb default '{}'::jsonb,
  p_latest_platform_game_id text default null,
  p_last_imported_at timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  completed_at timestamptz := now();
  saved_activity public.activity_history;
  saved_checkpoint public.coaching_game_checkpoints;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if btrim(coalesce(p_platform, '')) = '' or btrim(coalesce(p_username, '')) = '' then raise exception 'Platform and username are required'; end if;
  if coalesce(array_length(p_checked_game_ids, 1), 0) = 0 then raise exception 'At least one checked game ID is required'; end if;

  saved_activity := public.record_meaningful_coaching_activity('game_check_completed', p_idempotency_key, p_payload, completed_at);

  insert into public.coaching_game_checkpoints(user_id, platform, username, last_completed_at, last_imported_at, latest_platform_game_id, checked_game_ids)
  values (owner_id, lower(btrim(p_platform)), lower(btrim(p_username)), completed_at, p_last_imported_at, p_latest_platform_game_id, to_jsonb(p_checked_game_ids))
  on conflict (user_id, platform, username) do update set
    last_completed_at = greatest(public.coaching_game_checkpoints.last_completed_at, excluded.last_completed_at),
    last_imported_at = coalesce(excluded.last_imported_at, public.coaching_game_checkpoints.last_imported_at),
    latest_platform_game_id = coalesce(excluded.latest_platform_game_id, public.coaching_game_checkpoints.latest_platform_game_id),
    checked_game_ids = (select coalesce(jsonb_agg(value order by value), '[]'::jsonb) from (select distinct value from jsonb_array_elements_text(public.coaching_game_checkpoints.checked_game_ids || excluded.checked_game_ids)) ids),
    updated_at = now()
  returning * into saved_checkpoint;

  return jsonb_build_object('activityId', saved_activity.id, 'checkpointId', saved_checkpoint.id, 'completedAt', saved_checkpoint.last_completed_at, 'checkedGameIds', saved_checkpoint.checked_game_ids);
end;
$$;

revoke all on function public.complete_game_check(text,text,text[],text,jsonb,text,timestamptz) from public, anon;
grant execute on function public.complete_game_check(text,text,text[],text,jsonb,text,timestamptz) to authenticated, service_role;
