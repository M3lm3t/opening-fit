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
            return {"ready": bool(data.get("ready")), "reason": "ready" if data.get("ready") else "schema_unavailable"}
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
        raise MissionPersistenceError("not_implemented", "Training attempts are deferred to Phase 4.")

    def insert_encounter(self, row: Mapping[str, Any]) -> dict[str, Any]:
        result = self._execute(self.client.table("openingfit_mission_encounters").upsert(dict(row), on_conflict="user_id,mission_id,platform,account_scope,game_id,exact_position_key"))
        return dict((result.data or [row])[0])

    def list_encounters(self, user_id: str, mission_id: str, limit: int = 100) -> list[dict[str, Any]]:
        return [dict(row) for row in (self._execute(self.client.table("openingfit_mission_encounters").select("id,classification,played_at,qualifies_for_verification").eq("user_id", user_id).eq("mission_id", mission_id).order("played_at").limit(max(1, min(100, limit)))).data or [])]

    def __repr__(self) -> str:
        return "SupabaseMissionRepository(client=<backend-only>)"
