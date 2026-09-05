from datetime import datetime, timedelta, timezone
from pathlib import Path

from mission_rollout import (
    bounded_server_event, entitlement_tier, mission_capabilities, mission_notification_candidate,
    internal_rollout_user_id, rollout_bucket, rollout_eligibility, rollout_mode, rollout_percentage,
)

NOW = datetime(2026, 8, 31, tzinfo=timezone.utc)


def test_rollout_defaults_zero_and_is_stable_across_calls():
    assert rollout_percentage({}) == 0
    assert rollout_bucket("user-a", "private-secret") == rollout_bucket("user-a", "private-secret")
    assert not rollout_eligibility("user-a", enabled=False, schema_ready=True, env={})["eligible"]
    assert not rollout_eligibility("user-a", enabled=True, schema_ready=False, env={})["eligible"]
    internal_id = "11111111-1111-4111-8111-111111111111"
    assert rollout_eligibility(internal_id, enabled=True, schema_ready=True,
        env={"OPENINGFIT_MISSIONS_INTERNAL_USER_ID": internal_id})["eligible"]
    assert rollout_eligibility("user-a", enabled=True, schema_ready=True,
        env={"OPENINGFIT_MISSIONS_ROLLOUT_PERCENT": "100", "OPENINGFIT_MISSIONS_ROLLOUT_SECRET": "secret"})["eligible"]


def test_internal_rollout_allowlist_is_one_canonical_uuid_and_fails_closed():
    valid = "aaaaaaaa-1111-4111-8111-111111111111"
    assert internal_rollout_user_id({"OPENINGFIT_MISSIONS_INTERNAL_USER_ID": valid}) == valid
    for value in ("", "not-a-uuid", f"{valid},{valid}", valid.upper(), "  " + valid):
        assert internal_rollout_user_id({"OPENINGFIT_MISSIONS_INTERNAL_USER_ID": value}) is None
        assert not rollout_eligibility(valid, enabled=True, schema_ready=True,
            env={"OPENINGFIT_MISSIONS_INTERNAL_USER_ID": value,
                 "OPENINGFIT_MISSIONS_ROLLOUT_PERCENT": "100",
                 "OPENINGFIT_MISSIONS_ROLLOUT_MODE": "internal",
                 "OPENINGFIT_MISSIONS_ROLLOUT_SECRET": "secret"})["eligible"]
    assert not rollout_eligibility(valid, enabled=False, schema_ready=True,
        env={"OPENINGFIT_MISSIONS_INTERNAL_USER_ID": valid})["eligible"]
    assert not rollout_eligibility("bbbbbbbb-2222-4222-8222-222222222222", enabled=True, schema_ready=True,
        env={"OPENINGFIT_MISSIONS_INTERNAL_USER_ID": valid,
             "OPENINGFIT_MISSIONS_ROLLOUT_PERCENT": "100",
             "OPENINGFIT_MISSIONS_ROLLOUT_SECRET": "secret"})["eligible"]
    assert rollout_mode({"OPENINGFIT_MISSIONS_ROLLOUT_MODE": "unexpected"}) == "invalid"
    assert not rollout_eligibility(valid, enabled=True, schema_ready=True,
        env={"OPENINGFIT_MISSIONS_ROLLOUT_MODE": "unexpected", "OPENINGFIT_MISSIONS_ROLLOUT_PERCENT": "100",
             "OPENINGFIT_MISSIONS_ROLLOUT_SECRET": "secret"})["eligible"]


def test_capabilities_preserve_active_work_and_enforce_free_allowance():
    first = mission_capabilities(entitlement=None, active_mission=False, now=NOW)
    assert first["canSelectNextMission"] and first["historyLimit"] == 3 and first["tier"] == "free"
    limited = mission_capabilities(entitlement=None, active_mission=True, assignment_count=1,
        last_assigned_at=NOW - timedelta(days=10), now=NOW)
    assert limited["canStartCurrentMission"] and limited["canCompleteCurrentMission"] and limited["canVerifyCurrentMission"]
    assert not limited["canSelectNextMission"] and limited["reasonCode"] == "free_allowance_exhausted"
    reset = mission_capabilities(entitlement=None, active_mission=False, assignment_count=1,
        last_assigned_at=NOW - timedelta(days=31), now=NOW)
    assert reset["canSelectNextMission"]


def test_plus_lifetime_and_grace_share_paid_capability_without_client_tier():
    for entitlement, expected in [
        ({"access_type": "monthly_subscription", "status": "active"}, "plus"),
        ({"access_type": "lifetime", "status": "expired", "is_grandfathered_lifetime": True}, "lifetime"),
        ({"access_type": "annual_subscription", "status": "canceled", "current_period_end": "2026-09-02T00:00:00Z"}, "plus"),
    ]:
        assert entitlement_tier(entitlement, NOW) == expected
        result = mission_capabilities(entitlement=entitlement, active_mission=False, assignment_count=99, now=NOW, reminders_supported=True)
        assert result["canSelectNextMission"] and result["canViewFullHistory"] and result["historyLimit"] == 50


def test_server_events_are_bounded_private_and_deduplicable():
    event = bounded_server_event("mission_repaired", {"deduplicationKey": "repair:m1:g1", "evidenceCount": 999,
        "tier": "plus", "cohort": "beta", "pgn": "private", "username": "private", "error": "private"})
    assert event["evidenceCount"] == 50 and "pgn" not in event and "username" not in event and "error" not in event


def test_notification_contract_is_opt_in_quiet_hour_aware_and_delivery_disabled():
    assert not mission_notification_candidate(opted_in=False, global_enabled=True, in_quiet_hours=False,
        rollout_eligible=True, delivery_enabled=True, source_event_id="e1", kind="ready")["eligible"]
    deferred = mission_notification_candidate(opted_in=True, global_enabled=True, in_quiet_hours=True,
        rollout_eligible=True, delivery_enabled=True, source_event_id="e1", kind="review")
    assert deferred["eligible"] and deferred["deferred"] and "move" not in deferred["message"].lower()
    assert not mission_notification_candidate(opted_in=True, global_enabled=True, in_quiet_hours=False,
        rollout_eligible=True, delivery_enabled=False, source_event_id="e1", kind="ready")["eligible"]


def test_phase6_migration_is_additive_protected_and_projects_canonical_activity():
    sql = (Path(__file__).resolve().parents[2] / "supabase/migrations/202608310004_openingfit_missions_rollout.sql").read_text()
    for token in ["openingfit_mission_activity_outbox", "unique(user_id,session_id)", "project_openingfit_mission_activity",
                  "'training_session_completed'", "'mission-session:'||item.session_id", "on conflict(user_id,dedupe_key)",
                  "assign_openingfit_mission_with_allowance", "for update", "interval '30 days'",
                  "openingfit_missions_operator_diagnostics", "security definer", "set search_path=public",
                  "mission_reminders boolean not null default false", "revoke all"]:
        assert token in sql.lower()
    assert "grant execute" in sql.lower() and "to service_role" in sql.lower()
    assert "grant execute on function public.record_openingfit_mission_event(uuid,uuid,text,text,jsonb) to authenticated" not in sql.lower()
