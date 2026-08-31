"""Privacy-safe Mission rollout, entitlement capabilities and event contracts."""

from __future__ import annotations

import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping

from feature_entitlements import entitlement_has_paid_access, normalise_entitlement_record

FREE_HISTORY_LIMIT = 3
FREE_ALLOWANCE_DAYS = 30
MISSION_CLIENT_EVENTS = frozenset({
    "mission_card_viewed", "mission_why_opened", "mission_start_clicked",
    "mission_history_opened", "mission_dismiss_opened", "mission_retry_clicked",
    "mission_upgrade_prompt_viewed", "mission_upgrade_clicked",
})
MISSION_SERVER_EVENTS = frozenset({
    "mission_candidate_generated", "mission_candidate_rejected", "mission_assigned",
    "mission_training_started", "mission_training_completed", "mission_awaiting_evidence",
    "mission_encounter_detected", "mission_correct_response", "mission_repeated_mistake",
    "mission_other_legal_response", "mission_improving", "mission_needs_review",
    "mission_repaired", "mission_dismissed", "mission_superseded",
    "mission_activity_projected", "mission_activity_projection_failed",
    "mission_schema_unavailable", "mission_processing_failed",
})


def rollout_percentage(env: Mapping[str, str] | None = None) -> int:
    source = env if env is not None else os.environ
    try:
        return max(0, min(100, int(str(source.get("OPENINGFIT_MISSIONS_ROLLOUT_PERCENT") or "0"))))
    except ValueError:
        return 0


def rollout_bucket(user_id: str, secret: str) -> int:
    """Stable across processes/devices without exposing the user identifier."""
    digest = hmac.new(secret.encode(), str(user_id).encode(), hashlib.sha256).digest()
    return int.from_bytes(digest[:8], "big") % 100


def rollout_eligibility(user_id: str, *, enabled: bool, schema_ready: bool,
                        operator: bool = False, env: Mapping[str, str] | None = None) -> dict[str, Any]:
    source = env if env is not None else os.environ
    percentage = rollout_percentage(source)
    if not enabled:
        return {"eligible": False, "reasonCode": "missions_disabled", "cohort": "disabled", "percentage": percentage}
    if not schema_ready:
        return {"eligible": False, "reasonCode": "schema_unavailable", "cohort": "unavailable", "percentage": percentage}
    if operator:
        return {"eligible": True, "reasonCode": None, "cohort": "operator", "percentage": percentage}
    secret = str(source.get("OPENINGFIT_MISSIONS_ROLLOUT_SECRET") or source.get("SUPABASE_SERVICE_ROLE_KEY") or "")
    if not secret:
        return {"eligible": False, "reasonCode": "rollout_not_configured", "cohort": "excluded", "percentage": percentage}
    eligible = rollout_bucket(user_id, secret) < percentage
    return {"eligible": eligible, "reasonCode": None if eligible else "rollout_unavailable",
            "cohort": "beta" if eligible else "excluded", "percentage": percentage}


def entitlement_tier(entitlement: Mapping[str, Any] | None, now: datetime | None = None) -> str:
    row = normalise_entitlement_record(dict(entitlement or {}))
    if entitlement_has_paid_access(row, now):
        return "lifetime" if row.get("access_type") == "lifetime" else "plus"
    return "free"


def mission_capabilities(*, entitlement: Mapping[str, Any] | None, active_mission: bool,
                         assignment_count: int = 0, last_assigned_at: datetime | None = None,
                         now: datetime | None = None, rollout_reason: str | None = None,
                         reminders_supported: bool = False) -> dict[str, Any]:
    stamp = now or datetime.now(timezone.utc)
    tier = entitlement_tier(entitlement, stamp)
    paid = tier in {"plus", "lifetime"}
    next_at = None
    can_select = paid or assignment_count == 0
    if not paid and assignment_count > 0 and last_assigned_at:
        base = last_assigned_at if last_assigned_at.tzinfo else last_assigned_at.replace(tzinfo=timezone.utc)
        next_stamp = base + timedelta(days=FREE_ALLOWANCE_DAYS)
        can_select = next_stamp <= stamp
        if not can_select:
            next_at = next_stamp.isoformat()
    reason = rollout_reason
    if not reason and not can_select:
        reason = "free_allowance_exhausted"
    rollout_allowed = not rollout_reason
    return {
        "canStartCurrentMission": bool(active_mission and rollout_allowed),
        "canCompleteCurrentMission": bool(active_mission and rollout_allowed),
        "canVerifyCurrentMission": bool(active_mission and rollout_allowed),
        "canSelectNextMission": bool(can_select and rollout_allowed),
        "canViewFullHistory": paid,
        "canReceiveMissionReminders": bool(paid and reminders_supported and rollout_allowed),
        "nextMissionAvailableAt": next_at,
        "historyLimit": 50 if paid else FREE_HISTORY_LIMIT,
        "tier": tier,
        "reasonCode": reason,
    }


def bounded_server_event(event_name: str, data: Mapping[str, Any]) -> dict[str, Any]:
    if event_name not in MISSION_SERVER_EVENTS:
        raise ValueError("Unknown Mission server event")
    allowed = {"deduplicationKey", "status", "algorithmVersion", "missionType", "role",
               "confidenceBand", "evidenceCount", "tier", "cohort", "platform", "resultCategory"}
    result = {key: value for key, value in data.items() if key in allowed and isinstance(value, (str, int, bool))}
    result["evidenceCount"] = max(0, min(50, int(result.get("evidenceCount") or 0)))
    for key, value in list(result.items()):
        if isinstance(value, str):
            result[key] = value[:100]
    if not result.get("deduplicationKey"):
        raise ValueError("Mission server events require a deduplication key")
    return result


def mission_notification_candidate(*, opted_in: bool, global_enabled: bool, in_quiet_hours: bool,
                                   rollout_eligible: bool, delivery_enabled: bool, source_event_id: str,
                                   kind: str) -> dict[str, Any]:
    allowed_copy = {
        "ready": "Your next OpeningFit mission is ready.",
        "progress": "A recent game added progress to your mission.",
        "review": "Your opening mission is ready to review.",
    }
    eligible = all((opted_in, global_enabled, rollout_eligible, delivery_enabled, bool(source_event_id), kind in allowed_copy))
    return {"eligible": eligible, "deferred": bool(eligible and in_quiet_hours),
            "sourceEventId": source_event_id[:100] if eligible else None,
            "message": allowed_copy.get(kind) if eligible else None}
