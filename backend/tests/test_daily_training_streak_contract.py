from pathlib import Path


SQL = (Path(__file__).parents[2] / "supabase" / "migrations" / "202608160001_daily_training_streak.sql").read_text(encoding="utf-8")


def test_first_same_next_and_missed_day_rules_are_atomic():
    assert "when streak.last_qualified_date = canonical_today - 1 then streak.current_streak + 1" in SQL
    assert "else 1" in SQL
    assert "streak.last_qualified_date = canonical_today" in SQL
    assert "for update" in SQL.lower()


def test_longest_streak_survives_reset_and_same_day_activity_types_count_once():
    assert "longest_streak = greatest(longest_streak, next_current)" in SQL
    assert "if inserted_id is null or streak.last_qualified_date = canonical_today" in SQL


def test_duplicate_source_is_idempotent_and_concurrent_submissions_serialize():
    assert "unique (user_id, activity_type, source_id)" in SQL
    assert "on conflict (user_id, activity_type, source_id) do nothing" in SQL
    assert "where user_id = owner_id for update" in SQL


def test_utc_boundary_is_server_owned_and_no_history_is_fabricated():
    assert "(canonical_now at time zone 'UTC')::date" in SQL
    assert "(now() at time zone 'UTC')::date" in SQL
    assert "No historical activity is backfilled" in SQL


def test_authentication_rls_and_activity_allowlist_prevent_cross_account_mutation():
    assert "owner_id uuid := auth.uid()" in SQL
    assert "if owner_id is null then raise exception 'Authentication required'" in SQL
    assert "using (auth.uid() = user_id)" in SQL
    assert "revoke insert, update, delete on public.training_streaks from authenticated" in SQL
    for activity in ("analysis_completed", "today_training_completed", "training_task_completed", "repair_review_completed"):
        assert activity in SQL
