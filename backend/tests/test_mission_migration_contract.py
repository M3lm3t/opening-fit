from pathlib import Path


ROOT = Path(__file__).parents[2]
MIGRATION = ROOT / "supabase" / "migrations" / "202608310001_openingfit_missions_foundation.sql"
SQL = MIGRATION.read_text(encoding="utf-8").lower()


def test_dedicated_tables_are_additive_and_leave_coaching_priorities_untouched():
    for table in ("openingfit_missions", "openingfit_mission_training_attempts", "openingfit_mission_encounters", "openingfit_mission_status_events"):
        assert f"create table public.{table}" in SQL
        assert f"alter table public.{table} enable row level security" in SQL
    assert "alter table public.coaching_priorities" not in SQL
    assert "update public.coaching_priorities" not in SQL
    assert "premium_entitlements" not in SQL


def test_identity_uniqueness_primary_index_and_lookup_indexes_exist():
    assert "unique (user_id, candidate_key, algorithm_version, generation)" in SQL
    assert "create unique index openingfit_missions_one_primary_active_idx" in SQL
    assert "where is_primary and status in ('assigned', 'learning', 'awaiting_evidence', 'improving', 'needs_review')" in SQL
    for name in ("current_lookup_idx", "history_idx", "position_idx", "source_report_idx"):
        assert f"openingfit_missions_{name}" in SQL
    for protected in ("accepted_correction_moves", "correction_source", "baseline_cutoff_at", "recurrence_of_mission_id"):
        assert f"new.{protected} is distinct from old.{protected}" in SQL


def test_composite_foreign_keys_enforce_matching_ownership_and_cascades():
    assert SQL.count("foreign key (mission_id, user_id) references public.openingfit_missions(id, user_id) on delete cascade") == 3
    assert "user_id uuid not null references auth.users(id) on delete cascade" in SQL
    assert "source_report_id uuid references public.report_history(id) on delete set null" in SQL


def test_authenticated_role_has_select_only_and_truth_writes_are_service_owned():
    assert "grant select on public.openingfit_missions, public.openingfit_mission_training_attempts, public.openingfit_mission_encounters, public.openingfit_mission_status_events to authenticated" in SQL
    assert "grant insert" not in "\n".join(line for line in SQL.splitlines() if "authenticated" in line)
    assert "grant update" not in "\n".join(line for line in SQL.splitlines() if "authenticated" in line)
    assert "grant delete" not in SQL
    assert SQL.count("using (auth.uid() = user_id)") == 4


def test_transition_is_atomic_idempotent_and_service_only():
    assert "security definer set search_path = public" in SQL
    assert "for update" in SQL
    assert "unique (user_id, idempotency_key)" in SQL
    assert "insert into public.openingfit_mission_status_events" in SQL
    assert "revoke all on function public.transition_openingfit_mission" in SQL
    assert "grant execute on function public.transition_openingfit_mission" in SQL and "to service_role" in SQL
    assert "p_from_status" not in SQL
    assert "openingfit mission lifecycle must use the protected transition function" in SQL
    assert "set_config('openingfit.mission_transition', 'allowed', true)" in SQL


def test_status_events_are_append_only_for_ordinary_and_service_clients():
    status_grants = [line for line in SQL.splitlines() if "openingfit_mission_status_events" in line and line.startswith("grant")]
    assert not any("update" in line or "delete" in line for line in status_grants)
    assert "update public.openingfit_mission_status_events" not in SQL


def test_safe_user_dismissal_rpc_is_narrowly_scoped():
    assert "create or replace function public.dismiss_openingfit_mission" in SQL
    assert "owner_id uuid := auth.uid()" in SQL
    assert "('not_relevant','wrong_opening','prefer_another','other')" in SQL
    assert "revoke all on function public.dismiss_openingfit_mission" in SQL


def test_no_migration_backfill_generation_or_raw_private_game_content():
    assert "insert into public.openingfit_missions" not in SQL
    assert "raw_pgn" not in SQL and "opponent_username" not in SQL
    assert "rollback (manual, not executed)" in SQL
