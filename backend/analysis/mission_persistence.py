"""Persistence-facing service boundary for OpeningFit Missions.

Phase 2 deliberately separates lifecycle validation from transport.  The
repository protocol can be implemented by Phase 3's Supabase adapter; the
in-memory implementation exists for deterministic transaction/idempotency tests.
Public HTTP handling and candidate recalculation do not belong here.
"""

from __future__ import annotations

import copy
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Mapping, Protocol
from uuid import uuid4

from .mission_lifecycle import (
    PRIMARY_ACTIVE_STATUSES,
    MissionLifecycleError,
    is_primary_active,
    next_generation,
    validate_transition,
)


MISSION_TYPES = frozenset({"concrete_move_repair", "repertoire_deviation"})
ATTEMPT_RESULTS = frozenset({"correct", "incorrect", "assisted"})
ENCOUNTER_CLASSIFICATIONS = frozenset({"correct", "repeated_mistake", "other_legal"})
UCI_RE = re.compile(r"^[a-h][1-8][a-h][1-8][qrbn]?$")


class MissionPersistenceError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class ValidatedTrainingAttempt:
    attempted_move_uci: str
    result: str
    assistance_used: bool = False
    review_number: int = 1
    due_at: datetime | None = None
    interval_days: int = 0
    validation_evidence: Mapping[str, Any] | None = None


class MissionRepository(Protocol):
    def upsert_candidate(self, row: Mapping[str, Any]) -> dict[str, Any]: ...
    def get_mission(self, mission_id: str) -> dict[str, Any] | None: ...
    def get_current(self, user_id: str) -> dict[str, Any] | None: ...
    def list_history(self, user_id: str) -> list[dict[str, Any]]: ...
    def transition_atomic(self, *, user_id: str, mission_id: str, target_status: str, cause_type: str, cause_id: str | None, idempotency_key: str, evidence_summary: Mapping[str, Any]) -> dict[str, Any]: ...
    def insert_attempt(self, row: Mapping[str, Any]) -> dict[str, Any]: ...
    def insert_encounter(self, row: Mapping[str, Any]) -> dict[str, Any]: ...


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _required_text(value: Any, code: str) -> str:
    clean = str(value or "").strip()
    if not clean:
        raise MissionPersistenceError(code, "Required mission data is missing.")
    return clean


def validate_exact_position_key(value: Any) -> str:
    clean = _required_text(value, "invalid_exact_position_key")
    fields = clean.split()
    if len(fields) != 4 or fields[1] not in {"w", "b"} or not fields[2] or not fields[3]:
        raise MissionPersistenceError("invalid_exact_position_key", "Exact position identity must contain four legal FEN fields.")
    return " ".join(fields)


def _candidate_row(user_id: str, candidate: Mapping[str, Any], generation: int, references: Mapping[str, Any]) -> dict[str, Any]:
    if generation < 1:
        raise MissionPersistenceError("invalid_generation", "Mission generation must be positive.")
    mission_type = _required_text(candidate.get("missionType"), "invalid_mission_type")
    if mission_type not in MISSION_TYPES:
        raise MissionPersistenceError("invalid_mission_type", "Mission type is not supported.")
    score = float(candidate.get("score") or 0)
    if not 0 <= score <= 100:
        raise MissionPersistenceError("invalid_candidate_score", "Candidate score must be bounded.")
    candidate_key = _required_text(candidate.get("candidateKey"), "missing_candidate_key")
    algorithm = _required_text(candidate.get("algorithmVersion"), "missing_algorithm_version")
    position_key = validate_exact_position_key(candidate.get("exactPositionKey"))
    played = candidate.get("repeatedPlayedMove") or {}
    played_uci = _required_text(played.get("uci"), "missing_repeated_move")
    corrections = candidate.get("acceptedCorrectionMoves") or []
    if not corrections:
        raise MissionPersistenceError("missing_correction", "At least one accepted correction is required.")
    return {
        "user_id": _required_text(user_id, "missing_user_id"),
        "candidate_id": _required_text(candidate.get("candidateId"), "missing_candidate_id"),
        "candidate_key": candidate_key,
        "algorithm_version": algorithm,
        "generation": generation,
        "mission_type": mission_type,
        "status": "candidate",
        "is_primary": False,
        "role": _required_text(candidate.get("role"), "missing_role"),
        "opening_id": _required_text(candidate.get("canonicalOpeningId"), "missing_opening_id"),
        "opening_name": str(candidate.get("openingName") or "").strip() or None,
        "exact_position_key": position_key,
        "position_fen": _required_text(candidate.get("positionFen"), "missing_position_fen"),
        "player_turn": _required_text(candidate.get("playerTurn"), "missing_player_turn"),
        "repeated_played_move_uci": played_uci,
        "repeated_played_move_san": str(played.get("san") or "").strip() or None,
        "accepted_correction_moves": copy.deepcopy(corrections),
        "correction_source": _required_text(candidate.get("correctionSource"), "missing_correction_source"),
        "correction_provenance": copy.deepcopy(candidate.get("correctionProvenance") or []),
        "candidate_score": score,
        "score_components": copy.deepcopy(candidate.get("scoreComponents") or {}),
        "confidence": copy.deepcopy(candidate.get("confidence") or {}),
        "confidence_reason_codes": list(candidate.get("confidenceReasonCodes") or []),
        "conflicts": list(candidate.get("conflicts") or []),
        "evidence_summary": {"evidenceCount": int(candidate.get("evidenceCount") or 0)},
        "baseline_evidence_game_ids": sorted(set(map(str, candidate.get("distinctEvidenceGameIds") or []))),
        "baseline_evidence_count": int(candidate.get("evidenceCount") or 0),
        "first_evidence_at": candidate.get("firstSeenAt"),
        "last_evidence_at": candidate.get("lastSeenAt"),
        "baseline_cutoff_at": references.get("baseline_cutoff_at") or candidate.get("lastSeenAt") or references.get("created_at") or _now(),
        "source_report_id": references.get("source_report_id"),
        "source_decision_id": references.get("source_decision_id"),
        "source_diagnosis_id": references.get("source_diagnosis_id"),
        "recurrence_of_mission_id": references.get("recurrence_of_mission_id"),
        "supersedes_mission_id": references.get("supersedes_mission_id"),
    }


class MissionPersistenceService:
    def __init__(self, repository: MissionRepository):
        self.repository = repository

    def persist_candidate(self, *, user_id: str, candidate: Mapping[str, Any], generation: int = 1, references: Mapping[str, Any] | None = None) -> dict[str, Any]:
        return self.repository.upsert_candidate(_candidate_row(user_id, candidate, generation, references or {}))

    def assign_primary_mission(self, *, user_id: str, mission_id: str, idempotency_key: str) -> dict[str, Any]:
        return self.transition_mission(user_id=user_id, mission_id=mission_id, target_status="assigned", cause_type="candidate_selected", idempotency_key=idempotency_key)

    def get_current_mission(self, user_id: str) -> dict[str, Any] | None:
        return self.repository.get_current(user_id)

    def list_mission_history(self, user_id: str) -> list[dict[str, Any]]:
        return self.repository.list_history(user_id)

    def transition_mission(self, *, user_id: str, mission_id: str, target_status: str, cause_type: str, idempotency_key: str, cause_id: str | None = None, evidence_summary: Mapping[str, Any] | None = None) -> dict[str, Any]:
        self._owned(user_id, mission_id)
        if not idempotency_key or len(idempotency_key) > 200:
            raise MissionPersistenceError("invalid_idempotency_key", "A bounded idempotency key is required.")
        return self.repository.transition_atomic(user_id=user_id, mission_id=mission_id, target_status=target_status, cause_type=cause_type, cause_id=cause_id, idempotency_key=idempotency_key, evidence_summary=evidence_summary or {})

    def dismiss_mission(self, *, user_id: str, mission_id: str, reason: str, idempotency_key: str) -> dict[str, Any]:
        if reason not in {"not_relevant", "wrong_opening", "prefer_another", "other"}:
            raise MissionPersistenceError("invalid_dismissal_reason", "Dismissal reason is not supported.")
        return self.transition_mission(user_id=user_id, mission_id=mission_id, target_status="dismissed", cause_type="user_dismissed", cause_id=reason, idempotency_key=idempotency_key, evidence_summary={"reason": reason})

    def supersede_mission(self, *, user_id: str, mission_id: str, idempotency_key: str, cause_id: str | None = None) -> dict[str, Any]:
        return self.transition_mission(user_id=user_id, mission_id=mission_id, target_status="superseded", cause_type="domain_reconciliation", cause_id=cause_id, idempotency_key=idempotency_key)

    def record_training_attempt(self, *, user_id: str, mission_id: str, exercise_key: str, session_key: str | None, attempt_key: str, validated: ValidatedTrainingAttempt) -> dict[str, Any]:
        self._owned(user_id, mission_id)
        if validated.result not in ATTEMPT_RESULTS or not UCI_RE.fullmatch(validated.attempted_move_uci):
            raise MissionPersistenceError("invalid_validated_attempt", "Server-validated attempt data is invalid.")
        return self.repository.insert_attempt({
            "id": str(uuid4()), "user_id": user_id, "mission_id": mission_id,
            "exercise_key": _required_text(exercise_key, "missing_exercise_key"), "session_key": session_key,
            "attempt_key": _required_text(attempt_key, "missing_attempt_key"), "attempted_move_uci": validated.attempted_move_uci,
            "result": validated.result, "assistance_used": validated.assistance_used, "review_number": max(1, validated.review_number),
            "due_at": validated.due_at, "interval_days": max(0, validated.interval_days), "validation_evidence": dict(validated.validation_evidence or {}),
        })

    def record_encounter(self, *, user_id: str, mission_id: str, platform: str, account_scope: str, game_id: str, played_at: datetime, exact_position_key: str, observed_move_uci: str, observed_move_san: str | None = None, source_report_id: str | None = None, evidence_metadata: Mapping[str, Any] | None = None) -> dict[str, Any]:
        mission = self._owned(user_id, mission_id)
        if validate_exact_position_key(exact_position_key) != mission["exact_position_key"]:
            raise MissionPersistenceError("encounter_position_mismatch", "Encounter does not match the mission position.")
        if not UCI_RE.fullmatch(observed_move_uci):
            raise MissionPersistenceError("invalid_observed_move", "Observed move is invalid.")
        accepted = {str(move.get("uci")) for move in mission["accepted_correction_moves"]}
        classification = "correct" if observed_move_uci in accepted else "repeated_mistake" if observed_move_uci == mission["repeated_played_move_uci"] else "other_legal"
        cutoff = mission.get("training_completed_at") or mission.get("awaiting_evidence_at") or mission.get("baseline_cutoff_at")
        if isinstance(cutoff, str):
            try:
                cutoff = datetime.fromisoformat(cutoff.replace("Z", "+00:00"))
            except ValueError:
                cutoff = None
        qualifies = isinstance(cutoff, datetime) and played_at > cutoff
        return self.repository.insert_encounter({
            "id": str(uuid4()), "user_id": user_id, "mission_id": mission_id, "platform": platform.lower().strip(),
            "account_scope": _required_text(account_scope, "missing_account_scope").lower(), "game_id": _required_text(game_id, "missing_game_id"),
            "played_at": played_at, "exact_position_key": exact_position_key, "observed_move_uci": observed_move_uci,
            "observed_move_san": observed_move_san, "classification": classification, "qualifies_for_verification": qualifies,
            "source_report_id": source_report_id, "evidence_metadata": dict(evidence_metadata or {}),
        })

    def recurrence_references(self, *, user_id: str, repaired_mission_id: str) -> dict[str, Any]:
        repaired = self._owned(user_id, repaired_mission_id)
        if repaired["status"] != "repaired":
            raise MissionPersistenceError("recurrence_requires_repaired_mission", "Only a repaired mission can recur as a new generation.")
        return {**next_generation(repaired_generation=int(repaired["generation"]), recurrence_of_mission_id=repaired_mission_id), "recurrence_of_mission_id": repaired_mission_id}

    def _owned(self, user_id: str, mission_id: str) -> dict[str, Any]:
        mission = self.repository.get_mission(mission_id)
        if not mission:
            raise MissionPersistenceError("mission_not_found", "Mission was not found.")
        if mission.get("user_id") != user_id:
            raise MissionPersistenceError("mission_owner_mismatch", "Mission belongs to another user.")
        return mission


class InMemoryMissionRepository:
    """Transaction-shaped test repository; not a production persistence adapter."""

    def __init__(self):
        self.missions: dict[str, dict[str, Any]] = {}
        self.events: dict[tuple[str, str], dict[str, Any]] = {}
        self.attempts: dict[tuple[str, str, str], dict[str, Any]] = {}
        self.encounters: dict[tuple[str, str, str, str, str], dict[str, Any]] = {}
        self.training_sessions: dict[str, dict[str, Any]] = {}
        self.training_start_keys: dict[tuple[str, str], str] = {}
        self.training_completion_keys: dict[tuple[str, str], str] = {}

    def upsert_candidate(self, row: Mapping[str, Any]) -> dict[str, Any]:
        identity = (row["user_id"], row["candidate_key"], row["algorithm_version"], row["generation"])
        existing = next((item for item in self.missions.values() if (item["user_id"], item["candidate_key"], item["algorithm_version"], item["generation"]) == identity), None)
        if existing:
            immutable = {key: existing[key] for key in (
                "id", "user_id", "candidate_id", "candidate_key", "algorithm_version", "generation", "mission_type",
                "role", "opening_id", "exact_position_key", "position_fen", "player_turn", "repeated_played_move_uci",
                "accepted_correction_moves", "correction_source", "baseline_cutoff_at", "recurrence_of_mission_id",
                "supersedes_mission_id", "status", "is_primary", "created_at",
            )}
            existing.update(copy.deepcopy(dict(row)))
            existing.update(immutable)
            existing["updated_at"] = _now()
            return copy.deepcopy(existing)
        saved = {**copy.deepcopy(dict(row)), "id": str(uuid4()), "created_at": _now(), "updated_at": _now()}
        self.missions[saved["id"]] = saved
        return copy.deepcopy(saved)

    def get_mission(self, mission_id: str) -> dict[str, Any] | None:
        return copy.deepcopy(self.missions.get(mission_id))

    def get_current(self, user_id: str) -> dict[str, Any] | None:
        rows = [row for row in self.missions.values() if row["user_id"] == user_id and row["is_primary"] and row["status"] in PRIMARY_ACTIVE_STATUSES]
        return copy.deepcopy(sorted(rows, key=lambda row: str(row["updated_at"]), reverse=True)[0]) if rows else None

    def list_history(self, user_id: str, limit: int = 50, before: str | None = None) -> list[dict[str, Any]]:
        rows = sorted((row for row in self.missions.values() if row["user_id"] == user_id), key=lambda row: str(row["created_at"]), reverse=True)
        if before:
            rows = [row for row in rows if str(row["created_at"]) < before]
        return copy.deepcopy(rows[:max(1, min(50, limit))])

    def list_candidates(self, user_id: str, limit: int = 20) -> list[dict[str, Any]]:
        rows = [row for row in self.missions.values() if row["user_id"] == user_id and row["status"] == "candidate"]
        return copy.deepcopy(sorted(rows, key=lambda row: (-float(row["candidate_score"]), row["candidate_key"]))[:max(1, min(20, limit))])

    def list_verifying(self, user_id: str, limit: int = 10) -> list[dict[str, Any]]:
        rows = [row for row in self.missions.values() if row["user_id"] == user_id and row["status"] in {"awaiting_evidence", "improving"}]
        return copy.deepcopy(rows[:max(1, min(10, limit))])

    def list_encounters(self, user_id: str, mission_id: str, limit: int = 100) -> list[dict[str, Any]]:
        rows = [row for row in self.encounters.values() if row["user_id"] == user_id and row["mission_id"] == mission_id]
        return copy.deepcopy(sorted(rows, key=lambda row: row["played_at"])[:max(1, min(100, limit))])

    def transition_atomic(self, **values: Any) -> dict[str, Any]:
        event_key = (values["user_id"], values["idempotency_key"])
        if event_key in self.events:
            event = self.events[event_key]
            if event["mission_id"] != values["mission_id"] or event["to_status"] != values["target_status"]:
                raise MissionPersistenceError("idempotency_key_conflict", "Idempotency key was already used for another transition.")
            return self.get_mission(values["mission_id"]) or {}
        mission = self.missions.get(values["mission_id"])
        if not mission or mission["user_id"] != values["user_id"]:
            raise MissionPersistenceError("mission_owner_mismatch", "Mission ownership does not match.")
        validate_transition(mission["status"], values["target_status"])
        if is_primary_active(values["target_status"]):
            if any(row["user_id"] == values["user_id"] and row["id"] != mission["id"] and row["is_primary"] and row["status"] in PRIMARY_ACTIVE_STATUSES for row in self.missions.values()):
                raise MissionPersistenceError("primary_mission_exists", "A primary active mission already exists.")
        prior = mission["status"]
        mission["status"] = values["target_status"]
        mission["is_primary"] = is_primary_active(values["target_status"])
        stamp_fields = {"assigned": "assigned_at", "learning": "learning_started_at", "awaiting_evidence": "awaiting_evidence_at", "repaired": "repaired_at", "dismissed": "dismissed_at", "superseded": "superseded_at"}
        if field := stamp_fields.get(values["target_status"]):
            mission[field] = _now()
        mission["updated_at"] = _now()
        self.events[event_key] = {"user_id": values["user_id"], "mission_id": mission["id"], "from_status": prior, "to_status": values["target_status"], **values}
        return copy.deepcopy(mission)

    def insert_attempt(self, row: Mapping[str, Any]) -> dict[str, Any]:
        key = (row["user_id"], row["mission_id"], row["attempt_key"])
        if key not in self.attempts:
            self.attempts[key] = {**copy.deepcopy(dict(row)), "created_at": _now()}
        return copy.deepcopy(self.attempts[key])

    def insert_encounter(self, row: Mapping[str, Any]) -> dict[str, Any]:
        key = (row["user_id"], row["mission_id"], row["platform"], row["game_id"], row["exact_position_key"])
        if key not in self.encounters:
            self.encounters[key] = {**copy.deepcopy(dict(row)), "observed_at": _now()}
        return copy.deepcopy(self.encounters[key])

    def start_training_session_atomic(self, **values: Any) -> dict[str, Any]:
        mission = self.missions.get(values["mission_id"])
        if not mission or mission["user_id"] != values["user_id"]:
            raise MissionPersistenceError("mission_not_found", "Mission was not found.")
        replay = self.training_start_keys.get((values["user_id"], values["session_key"]))
        if replay:
            saved = self.training_sessions[replay]
            if saved["mission_id"] != values["mission_id"]:
                raise MissionPersistenceError("idempotency_key_conflict", "Start key was used for another mission.")
            return copy.deepcopy({**saved, "resumed": True})
        active = next((row for row in self.training_sessions.values() if row["user_id"] == values["user_id"] and row["mission_id"] == values["mission_id"] and row["status"] == "active"), None)
        if active:
            self.training_start_keys[(values["user_id"], values["session_key"])] = active["id"]
            return copy.deepcopy({**active, "resumed": True})
        if mission["status"] not in {"assigned", "learning", "needs_review"}:
            raise MissionPersistenceError("mission_not_trainable", "Mission is not available for training.")
        if mission["status"] in {"assigned", "needs_review"}:
            self.transition_atomic(user_id=values["user_id"], mission_id=mission["id"], target_status="learning",
                cause_type="training_session_started", cause_id=None, idempotency_key=f"session-start:{values['session_key']}", evidence_summary={})
        stamp = _now()
        saved = {**copy.deepcopy(values), "id": str(uuid4()), "status": "active", "exercise_manifest": copy.deepcopy(values["manifest"]),
                 "started_at": stamp, "last_activity_at": stamp, "completed_at": None,
                 "meaningful_activity_recorded_at": None, "created_at": stamp, "updated_at": stamp, "resumed": False}
        saved.pop("manifest", None)
        self.training_sessions[saved["id"]] = saved
        self.training_start_keys[(values["user_id"], values["session_key"])] = saved["id"]
        return copy.deepcopy(saved)

    def get_training_session(self, user_id: str, session_id: str) -> dict[str, Any] | None:
        row = self.training_sessions.get(session_id)
        return copy.deepcopy(row) if row and row["user_id"] == user_id else None

    def get_current_training_session(self, user_id: str, mission_id: str) -> dict[str, Any] | None:
        row = next((row for row in self.training_sessions.values() if row["user_id"] == user_id and row["mission_id"] == mission_id and row["status"] == "active"), None)
        return copy.deepcopy(row) if row else None

    def list_training_attempts(self, user_id: str, session_id: str, limit: int = 100) -> list[dict[str, Any]]:
        rows = [row for row in self.attempts.values() if row["user_id"] == user_id and row.get("session_key") == session_id]
        return copy.deepcopy(sorted(rows, key=lambda row: str(row["created_at"]))[:max(1, min(100, limit))])

    def insert_training_attempt_atomic(self, **values: Any) -> dict[str, Any]:
        session = self.training_sessions.get(values["session_id"])
        if not session or session["user_id"] != values["user_id"] or session["mission_id"] != values["mission_id"]:
            raise MissionPersistenceError("session_not_found", "Training session was not found.")
        key = (values["user_id"], values["mission_id"], values["attempt_key"])
        if key in self.attempts:
            existing = self.attempts[key]
            if existing["session_key"] != values["session_id"] or existing["exercise_key"] != values["exercise_key"] or existing["attempted_move_uci"] != values["attempted_move_uci"]:
                raise MissionPersistenceError("idempotency_key_conflict", "Attempt key was used for different input.")
            return copy.deepcopy(existing)
        if session["status"] != "active":
            raise MissionPersistenceError("session_not_active", "Training session is not active.")
        stamp = _now()
        saved = {**copy.deepcopy(values), "id": str(uuid4()), "session_key": values["session_id"], "created_at": stamp}
        self.attempts[key] = saved
        session["last_activity_at"] = stamp
        session["updated_at"] = stamp
        return copy.deepcopy(saved)

    def complete_training_session_atomic(self, **values: Any) -> dict[str, Any]:
        session = self.training_sessions.get(values["session_id"])
        if not session or session["user_id"] != values["user_id"] or session["mission_id"] != values["mission_id"]:
            raise MissionPersistenceError("session_not_found", "Training session was not found.")
        key = (values["user_id"], values["idempotency_key"])
        if key in self.training_completion_keys:
            if self.training_completion_keys[key] != session["id"]:
                raise MissionPersistenceError("idempotency_key_conflict", "Completion key was used for another session.")
            return copy.deepcopy(session)
        if session["status"] == "completed":
            return copy.deepcopy(session)
        mission = self.missions[values["mission_id"]]
        if mission["status"] != "learning":
            raise MissionPersistenceError("mission_not_learning", "Mission is not in learning.")
        stamp = _now()
        session.update(status="completed", completed_at=stamp, last_activity_at=stamp, updated_at=stamp,
                       meaningful_activity_recorded_at=stamp, completion_summary=copy.deepcopy(values["progress"]))
        self.transition_atomic(user_id=values["user_id"], mission_id=mission["id"], target_status="awaiting_evidence",
            cause_type="training_session_completed", cause_id=session["id"], idempotency_key=f"session-complete:{values['idempotency_key']}", evidence_summary=values["progress"])
        self.training_completion_keys[key] = session["id"]
        return copy.deepcopy(session)
