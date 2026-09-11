from pathlib import Path
import re


ROOT = Path(__file__).parents[2]
SOURCE = ROOT / "supabase/migrations/202608310004_openingfit_missions_rollout.sql"
FORWARD = ROOT / "supabase/migrations/202609110001_openingfit_mission_assignment_jsonb_repair.sql"
EXECUTE = ROOT / "release-artifacts/openingfit-missions-production-assignment-jsonb-repair-execute.sql"
VERIFY = ROOT / "release-artifacts/openingfit-missions-production-assignment-jsonb-repair-verification.sql"
SIGNATURE = "assign_openingfit_mission_with_allowance(p_user_id uuid,p_mission_id uuid,p_paid_access boolean,p_idempotency_key text)"


def _function(sql: str) -> str:
    start = sql.lower().index(f"create or replace function public.{SIGNATURE}")
    end = sql.index("$$;", start) + 3
    return sql[start:end]


def test_repair_changes_only_composite_to_jsonb_conversion():
    source = _function(SOURCE.read_text(encoding="utf-8"))
    repaired = _function(EXECUTE.read_text(encoding="utf-8"))
    assert "assigned:=to_jsonb(public.transition_openingfit_mission(" in source
    assert "assigned:=to_jsonb(public.transition_openingfit_mission(" in repaired
    assert repaired == source


def test_forward_migration_preserves_the_canonical_repaired_function():
    canonical = _function(SOURCE.read_text(encoding="utf-8"))
    forward = _function(FORWARD.read_text(encoding="utf-8"))
    assert forward == canonical
    sql = FORWARD.read_text(encoding="utf-8")
    assert "30dbcf29a48c79c62d4a06ce2f279660" in sql
    assert "f39bdc12016b0b7e8ac21d6d705ca3c4" in sql
    assert "unexpected function contract" in sql.lower()


def test_execution_is_transactional_idempotent_and_fail_closed():
    sql = EXECUTE.read_text(encoding="utf-8")
    assert re.search(r"(?m)^BEGIN;$", sql)
    assert re.search(r"(?m)^COMMIT;\s*$", sql)
    assert sql.lower().count("create or replace function public.assign_openingfit_mission_with_allowance") == 1
    assert "30dbcf29a48c79c62d4a06ce2f279660" in sql
    assert "f39bdc12016b0b7e8ac21d6d705ca3c4" in sql
    assert "unexpected function contract" in sql
    assert "dependency contract changed" in sql
    assert "assignment repair postcondition" in sql
    top_level = re.sub(r"AS \$\$.*?\$\$;", "", sql, flags=re.IGNORECASE | re.DOTALL)
    assert not re.search(r"(?im)^\s*(insert|update|delete|truncate)\b", top_level)


def test_verification_is_read_only_bounded_and_complete():
    sql = VERIFY.read_text(encoding="utf-8")
    without_comments = re.sub(r"--[^\n]*", "", sql)
    assert re.match(r"\s*WITH\b", without_comments, re.IGNORECASE)
    assert not re.search(r"(?im)^\s*(create|alter|drop|insert|update|delete|truncate|grant|revoke|do|call|execute)\b", without_comments)
    for check in (
        "definition_hash", "composite_conversion", "owner", "return_type", "security", "volatility",
        "strictness", "parallel", "search_path", "identity_arguments", "explicit_execute_acl",
        "public_execute", "anon_execute", "authenticated_execute", "service_role_execute",
        "transition_hash", "event_function_hash", "identity_function_hash", "identity_trigger_hash",
        "candidate_assignable", "allowance_side_effects", "assignment_transition_side_effects",
        "assignment_event_side_effects",
    ):
        assert f"'{check}'" in sql
    output = sql[sql.rfind("SELECT check_name"):].lower()
    for private_field in ("uuid", "pgn", "fen", "move", "username", "idempotency_key"):
        assert private_field not in output
