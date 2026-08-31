from pathlib import Path


SQL = (Path(__file__).resolve().parents[2] / "supabase" / "migrations" / "202608310003_openingfit_mission_training.sql").read_text(encoding="utf-8").lower()


def test_training_schema_is_additive_owned_and_bounded():
    assert "create table public.openingfit_mission_training_sessions" in SQL
    assert "exercise_manifest jsonb" in SQL and "jsonb_array_length(exercise_manifest) between 1 and 5" in SQL
    assert "foreign key(mission_id,user_id)" in SQL
    assert "openingfit_mission_one_active_training_session_idx" in SQL
    assert "enable row level security" in SQL
    assert "grant select on public.openingfit_mission_training_sessions to authenticated" in SQL
    assert "revoke insert,update,delete" in SQL
    assert "training session identity and manifest are immutable" in SQL
    assert "openingfit_protect_training_session" in SQL


def test_training_mutations_are_protected_atomic_rpcs():
    for name in ("start_openingfit_mission_training_session", "record_openingfit_mission_training_attempt", "complete_openingfit_mission_training_session"):
        assert f"function public.{name}" in SQL
    assert SQL.count("security definer set search_path=public") >= 4
    assert SQL.count("from public,anon,authenticated") >= 4
    assert "for update" in SQL
    assert "session-start:" in SQL and "session-complete:" in SQL
    assert "meaningful_activity_recorded_at=now()" in SQL


def test_readiness_requires_phase4_training_contract():
    assert "'schemaversion',3" in SQL
    assert "'trainingready'" in SQL
    assert "to_regclass('public.openingfit_mission_training_sessions')" in SQL
