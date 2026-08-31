"""Concrete backend-only Supabase transport for OpeningFit Missions."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Mapping

from .mission_persistence import MissionPersistenceError


HISTORY_LIMIT_MAX = 50
MUTABLE_CANDIDATE_FIELDS = {
    "opening_name", "repeated_played_move_san", "correction_provenance", "candidate_score",
    "score_components", "confidence", "confidence_reason_codes", "conflicts", "evidence_summary",
    "baseline_evidence_game_ids", "baseline_evidence_count", "first_evidence_at", "last_evidence_at",
    "source_report_id", "source_decision_id", "source_diagnosis_id",
}


def _error_code(error: Exception) -> str:
    text = " ".join(str(getattr(error, key, "") or "") for key in ("code", "message", "details", "hint")).lower()
    if any(token in text for token in ("pgrst205", "42p01", "does not exist", "schema cache")):
        return "schema_unavailable"
    if any(token in text for token in ("jwt", "authentication", "unauthorized", "401")):
        return "authentication_failure"
    if any(token in text for token in ("row-level", "permission", "forbidden", "42501")):
        return "ownership_failure"
    if any(token in text for token in ("duplicate", "unique", "23505", "conflict")):
        return "conflict"
    if "illegal mission transition" in text:
        return "illegal_transition"
    domain_errors = {
        "mission not trainable": "mission_not_trainable", "training material unavailable": "training_material_unavailable",
        "session not found": "session_not_found", "session not active": "session_not_active",
        "exercise not in session": "exercise_not_in_session", "session requirements unmet": "completion_requirements_unmet",
        "invalid idempotency key": "invalid_idempotency_key",
    }
    for token, code in domain_errors.items():
        if token in text:
            return code
    return "transient_storage_failure"


class SupabaseMissionRepository:
    """Uses the existing backend service client; credentials are never retained in rows or output."""

    def __init__(self, client: Any):
        self.client = client

    def _execute(self, operation):
        try:
            return operation.execute()
        except Exception as exc:
            raise MissionPersistenceError(_error_code(exc), "Mission storage operation failed.") from exc

    def schema_readiness(self) -> dict[str, Any]:
        try:
            result = self._execute(self.client.rpc("openingfit_missions_schema_readiness"))
            data = result.data or {}
            return {"ready": bool(data.get("ready")), "training_ready": bool(data.get("trainingReady")),
                    "activity_projector_ready": bool(data.get("activityProjectorReady")),
                    "analytics_ready": bool(data.get("analyticsReady")),
                    "notification_scheduling_ready": bool(data.get("notificationSchedulingReady")),
                    "schema_version": data.get("schemaVersion"), "reason": "ready" if data.get("ready") else "schema_unavailable"}
        except MissionPersistenceError as exc:
            return {"ready": False, "reason": exc.code}

    def upsert_candidate(self, row: Mapping[str, Any]) -> dict[str, Any]:
        query = self.client.table("openingfit_missions").select("*").eq("user_id", row["user_id"]).eq("candidate_key", row["candidate_key"]).eq("algorithm_version", row["algorithm_version"]).eq("generation", row["generation"]).limit(1)
        existing = (self._execute(query).data or [])
        if existing:
            patch = {key: value for key, value in row.items() if key in MUTABLE_CANDIDATE_FIELDS}
            result = self._execute(self.client.table("openingfit_missions").update(patch).eq("id", existing[0]["id"]).eq("user_id", row["user_id"]))
            return dict((result.data or existing)[0])
        result = self._execute(self.client.table("openingfit_missions").insert(dict(row)))
        return dict((result.data or [])[0])

    def get_mission(self, mission_id: str) -> dict[str, Any] | None:
        rows = self._execute(self.client.table("openingfit_missions").select("*").eq("id", mission_id).limit(1)).data or []
        return dict(rows[0]) if rows else None

    def get_current(self, user_id: str) -> dict[str, Any] | None:
        rows = self._execute(self.client.table("openingfit_missions").select("*").eq("user_id", user_id).eq("is_primary", True).in_("status", ["assigned", "learning", "awaiting_evidence", "improving", "needs_review"]).order("updated_at", desc=True).limit(1)).data or []
        return dict(rows[0]) if rows else None

    def list_history(self, user_id: str, limit: int = 20, before: str | None = None) -> list[dict[str, Any]]:
        bounded = max(1, min(HISTORY_LIMIT_MAX, int(limit or 20)))
        query = self.client.table("openingfit_missions").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(bounded)
        if before:
            query = query.lt("created_at", before)
        return [dict(row) for row in (self._execute(query).data or [])]

    def list_candidates(self, user_id: str, limit: int = 20) -> list[dict[str, Any]]:
        return [dict(row) for row in (self._execute(self.client.table("openingfit_missions").select("*").eq("user_id", user_id).eq("status", "candidate").order("candidate_score", desc=True).order("candidate_key").limit(max(1, min(20, limit)))).data or [])]

    def get_entitlement(self, user_id: str) -> dict[str, Any] | None:
        rows = self._execute(self.client.table("premium_entitlements").select("access_type,status,is_grandfathered_lifetime,current_period_end,expires_at,premium_since").eq("user_id", user_id).limit(1)).data or []
        return dict(rows[0]) if rows else None

    def get_allowance(self, user_id: str) -> dict[str, Any]:
        rows = self._execute(self.client.table("openingfit_mission_allowances").select("assignment_count,last_assigned_at,next_available_at").eq("user_id", user_id).limit(1)).data or []
        return dict(rows[0]) if rows else {"assignment_count": 0}

    def assign_with_allowance(self, *, user_id: str, mission_id: str, paid: bool, idempotency_key: str) -> dict[str, Any]:
        result = self._execute(self.client.rpc("assign_openingfit_mission_with_allowance", {"p_user_id": user_id, "p_mission_id": mission_id, "p_paid_access": paid, "p_idempotency_key": idempotency_key}))
        return dict(result.data or {})

    def project_activity(self, outbox_id: str) -> dict[str, Any]:
        return dict(self._execute(self.client.rpc("project_openingfit_mission_activity", {"p_outbox_id": outbox_id})).data or {})

    def project_session_activity(self, user_id: str, session_id: str) -> dict[str, Any]:
        return dict(self._execute(self.client.rpc("project_openingfit_mission_session_activity", {"p_user_id": user_id, "p_session_id": session_id})).data or {})

    def operator_diagnostics(self, window_hours: int = 24) -> dict[str, Any]:
        return dict(self._execute(self.client.rpc("openingfit_missions_operator_diagnostics", {"p_window_hours": max(1, min(168, window_hours))})).data or {})

    def record_event(self, *, user_id: str, mission_id: str | None, event_name: str,
                     deduplication_key: str, properties: Mapping[str, Any]) -> dict[str, Any]:
        result = self._execute(self.client.rpc("record_openingfit_mission_event", {"p_user_id": user_id,
            "p_mission_id": mission_id, "p_event_name": event_name, "p_deduplication_key": deduplication_key,
            "p_properties": dict(properties)}))
        return dict(result.data or {})

    def list_verifying(self, user_id: str, limit: int = 10) -> list[dict[str, Any]]:
        return [dict(row) for row in (self._execute(self.client.table("openingfit_missions").select("*").eq("user_id", user_id).in_("status", ["awaiting_evidence", "improving"]).limit(max(1, min(10, limit)))).data or [])]

    def transition_atomic(self, **values: Any) -> dict[str, Any]:
        result = self._execute(self.client.rpc("transition_openingfit_mission", {
            "p_user_id": values["user_id"], "p_mission_id": values["mission_id"], "p_to_status": values["target_status"],
            "p_cause_type": values["cause_type"], "p_cause_id": values.get("cause_id"), "p_idempotency_key": values["idempotency_key"],
            "p_evidence_summary": dict(values.get("evidence_summary") or {}),
        }))
        return dict(result.data or {})

    def dismiss(self, mission_id: str, reason: str, idempotency_key: str) -> dict[str, Any]:
        result = self._execute(self.client.rpc("dismiss_openingfit_mission", {"p_mission_id": mission_id, "p_reason": reason, "p_idempotency_key": idempotency_key}))
        return dict(result.data or {})

    def insert_attempt(self, row: Mapping[str, Any]) -> dict[str, Any]:
        return self.insert_training_attempt_atomic(**dict(row))

    def start_training_session_atomic(self, **values: Any) -> dict[str, Any]:
        result = self._execute(self.client.rpc("start_openingfit_mission_training_session", {
            "p_user_id": values["user_id"], "p_mission_id": values["mission_id"], "p_session_key": values["session_key"],
            "p_exercise_set_version": values["exercise_set_version"], "p_exercise_manifest": values["manifest"],
            "p_required_exercise_count": values["required_exercise_count"], "p_required_correct_count": values["required_correct_count"],
        }))
        return dict(result.data or {})

    def get_training_session(self, user_id: str, session_id: str) -> dict[str, Any] | None:
        rows = self._execute(self.client.table("openingfit_mission_training_sessions").select("*").eq("user_id", user_id).eq("id", session_id).limit(1)).data or []
        return dict(rows[0]) if rows else None

    def get_current_training_session(self, user_id: str, mission_id: str) -> dict[str, Any] | None:
        rows = self._execute(self.client.table("openingfit_mission_training_sessions").select("*").eq("user_id", user_id).eq("mission_id", mission_id).eq("status", "active").limit(1)).data or []
        return dict(rows[0]) if rows else None

    def list_training_attempts(self, user_id: str, session_id: str, limit: int = 100) -> list[dict[str, Any]]:
        query = self.client.table("openingfit_mission_training_attempts").select("id,exercise_key,attempt_key,attempted_move_uci,result,assistance_used,review_number,due_at,interval_days,created_at").eq("user_id", user_id).eq("session_id", session_id).order("created_at").limit(max(1, min(100, limit)))
        return [dict(row) for row in (self._execute(query).data or [])]

    def insert_training_attempt_atomic(self, **values: Any) -> dict[str, Any]:
        result = self._execute(self.client.rpc("record_openingfit_mission_training_attempt", {
            "p_user_id": values["user_id"], "p_mission_id": values["mission_id"], "p_session_id": values["session_id"],
            "p_exercise_key": values["exercise_key"], "p_attempt_key": values["attempt_key"],
            "p_attempted_move_uci": values["attempted_move_uci"], "p_result": values["result"],
            "p_review_number": values["review_number"], "p_interval_days": values["interval_days"],
            "p_due_at": values["due_at"].isoformat(), "p_validation_evidence": values.get("validation_evidence") or {},
        }))
        return dict(result.data or {})

    def complete_training_session_atomic(self, **values: Any) -> dict[str, Any]:
        result = self._execute(self.client.rpc("complete_openingfit_mission_training_session", {
            "p_user_id": values["user_id"], "p_mission_id": values["mission_id"], "p_session_id": values["session_id"],
            "p_idempotency_key": values["idempotency_key"],
        }))
        return dict(result.data or {})

    def insert_encounter(self, row: Mapping[str, Any]) -> dict[str, Any]:
        result = self._execute(self.client.table("openingfit_mission_encounters").upsert(dict(row), on_conflict="user_id,mission_id,platform,account_scope,game_id,exact_position_key"))
        return dict((result.data or [row])[0])

    def list_encounters(self, user_id: str, mission_id: str, limit: int = 100) -> list[dict[str, Any]]:
        return [dict(row) for row in (self._execute(self.client.table("openingfit_mission_encounters").select("id,classification,played_at,qualifies_for_verification").eq("user_id", user_id).eq("mission_id", mission_id).order("played_at").limit(max(1, min(100, limit)))).data or [])]

    def __repr__(self) -> str:
        return "SupabaseMissionRepository(client=<backend-only>)"
