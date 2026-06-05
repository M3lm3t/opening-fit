alter table public.recommendation_history
add column if not exists snapshot_key text;

create unique index if not exists recommendation_history_user_snapshot_key
on public.recommendation_history(user_id, snapshot_key);

delete from public.analysed_games newer
using public.analysed_games older
where newer.ctid > older.ctid
  and newer.user_id = older.user_id
  and coalesce(newer.platform, '') = coalesce(older.platform, '')
  and coalesce(newer.username, '') = coalesce(older.username, '')
  and coalesce(newer.game_id, '') = coalesce(older.game_id, '');

create unique index if not exists analysed_games_user_game_key
on public.analysed_games(user_id, platform, username, game_id);
