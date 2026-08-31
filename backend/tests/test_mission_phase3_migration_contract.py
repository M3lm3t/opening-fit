from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase" / "migrations" / "202608310002_openingfit_missions_readiness.sql"
SQL = MIGRATION.read_text(encoding="utf-8").lower()


def test_phase3_migration_is_additive_backend_only_readiness_probe():
    assert "create or replace function public.openingfit_missions_schema_readiness" in SQL
    for relation in ("openingfit_missions", "openingfit_mission_training_attempts", "openingfit_mission_encounters", "openingfit_mission_status_events"):
        assert f"to_regclass('public.{relation}')" in SQL
    assert "transition_openingfit_mission" in SQL
    assert "dismiss_openingfit_mission" in SQL
    assert "revoke all" in SQL and "from public, anon, authenticated" in SQL
    assert "grant execute" in SQL and "to service_role" in SQL
    assert "drop table" not in SQL and "alter table" not in SQL
