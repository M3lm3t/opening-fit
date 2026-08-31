"""Server-authoritative exercise, attempt, scheduling and completion policy."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping

import chess

from .mission_persistence import MissionPersistenceError

EXERCISE_SET_VERSION = "mission_training_v1"
TRAINABLE_STATUSES = frozenset({"assigned", "learning", "needs_review"})


def _now(value: datetime | None = None) -> datetime:
    stamp = value or datetime.now(timezone.utc)
    return stamp if stamp.tzinfo else stamp.replace(tzinfo=timezone.utc)


def build_exercise_manifest(mission: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Build only exercises whose legal answer is explicit in persisted mission data."""
    try:
        board = chess.Board(str(mission.get("position_fen") or ""))
    except ValueError:
        return []
    side = "white" if board.turn == chess.WHITE else "black"
    if side != str(mission.get("player_turn") or "").lower():
        return []
    accepted = []
    for raw in mission.get("accepted_correction_moves") or []:
        try:
            move = chess.Move.from_uci(str(raw.get("uci") or ""))
        except ValueError:
            continue
        if move in board.legal_moves:
            accepted.append({"uci": move.uci(), "san": board.san(move)})
    accepted = sorted({row["uci"]: row for row in accepted}.values(), key=lambda row: row["uci"])
    if not accepted:
        return []
    identity = json.dumps({"mission": mission.get("id"), "fen": board.fen(), "moves": accepted,
                           "version": EXERCISE_SET_VERSION}, sort_keys=True, separators=(",", ":"))
    key = "mission-exercise-" + hashlib.sha256(identity.encode()).hexdigest()[:20]
    return [{
        "exerciseKey": key, "positionFen": board.fen(), "playerTurn": side,
        "acceptedMoves": accepted, "repeatedBadMoveUci": mission.get("repeated_played_move_uci"),
        "exerciseType": "core_exact_position", "source": mission.get("correction_source"),
        "provenance": list(mission.get("correction_provenance") or [])[:5], "difficulty": 1,
        "order": 1, "version": EXERCISE_SET_VERSION, "isCore": True,
    }]


def client_exercise(exercise: Mapping[str, Any], *, answered: bool = False) -> dict[str, Any]:
    result = {"exerciseId": exercise["exerciseKey"], "fen": exercise["positionFen"],
              "sideToMove": exercise["playerTurn"], "prompt": "Find the move that repairs this position.",
              "boardOrientation": exercise["playerTurn"], "assistanceAvailable": False}
    if answered:
        result["acceptedMoves"] = list(exercise.get("acceptedMoves") or [])
    return result


def review_schedule(*, prior_attempts: list[Mapping[str, Any]], correct: bool,
                    assisted: bool = False, now: datetime | None = None) -> dict[str, Any]:
    stamp = _now(now)
    prior_failures = any(row.get("result") in {"incorrect", "assisted_correct"} for row in prior_attempts)
    prior_successes = sum(row.get("result") == "correct" for row in prior_attempts)
    review_number = len(prior_attempts) + 1
    if assisted or not correct:
        days = 1
    elif prior_failures:
        days = 1
    else:
        days = (3, 7, 14, 30)[min(prior_successes, 3)]
    return {"reviewNumber": review_number, "intervalDays": days, "dueAt": stamp + timedelta(days=days)}


def completion_summary(manifest: list[Mapping[str, Any]], attempts: list[Mapping[str, Any]]) -> dict[str, Any]:
    by_exercise = {str(row["exerciseKey"]): [] for row in manifest}
    for attempt in attempts:
        if str(attempt.get("exercise_key")) in by_exercise:
            by_exercise[str(attempt["exercise_key"])].append(attempt)
    total = len(manifest)
    attempted = sum(any(row.get("result") in {"correct", "incorrect", "assisted_correct"} for row in rows) for rows in by_exercise.values())
    solved = sum(any(row.get("result") in {"correct", "assisted_correct"} for row in rows) for rows in by_exercise.values())
    unassisted = sum(any(row.get("result") == "correct" and not row.get("assistance_used") for row in rows) for rows in by_exercise.values())
    core_keys = {str(row["exerciseKey"]) for row in manifest if row.get("isCore")}
    core_unassisted = all(any(row.get("result") == "correct" and not row.get("assistance_used") for row in by_exercise[key]) for key in core_keys)
    if total <= 2:
        complete = total > 0 and attempted == total and solved == total and core_unassisted
    else:
        complete = attempted == total and solved * 100 >= total * 80 and unassisted * 100 >= total * 60 and core_unassisted
    unmet = []
    if attempted < total: unmet.append("every_exercise_requires_legal_attempt")
    if total <= 2 and solved < total: unmet.append("every_exercise_must_be_solved")
    if total > 2 and solved * 100 < total * 80: unmet.append("eventual_accuracy_below_80_percent")
    if total > 2 and unassisted * 100 < total * 60: unmet.append("unassisted_accuracy_below_60_percent")
    if not core_unassisted: unmet.append("core_exercise_requires_unassisted_solution")
    return {"eligible": complete, "exerciseCount": total, "attemptedCount": attempted,
            "solvedCount": solved, "unassistedSolvedCount": unassisted, "unmetRequirements": unmet}


class MissionTrainingService:
    def __init__(self, repository: Any, *, clock=None):
        self.repository = repository
        self.clock = clock or (lambda: datetime.now(timezone.utc))

    def start(self, *, user_id: str, mission_id: str, idempotency_key: str) -> dict[str, Any]:
        mission = self._owned(user_id, mission_id)
        if mission.get("status") not in TRAINABLE_STATUSES:
            raise MissionPersistenceError("mission_not_trainable", "Mission is not available for training.")
        manifest = build_exercise_manifest(mission)
        if not manifest:
            raise MissionPersistenceError("training_material_unavailable", "No trusted training material is available.")
        return self.repository.start_training_session_atomic(user_id=user_id, mission_id=mission_id,
            session_key=self._key(idempotency_key), manifest=manifest, exercise_set_version=EXERCISE_SET_VERSION,
            required_exercise_count=len(manifest), required_correct_count=len(manifest) if len(manifest) <= 2 else (len(manifest) * 80 + 99) // 100)

    def current(self, *, user_id: str, mission_id: str) -> dict[str, Any] | None:
        self._owned(user_id, mission_id)
        return self.repository.get_current_training_session(user_id, mission_id)

    def attempt(self, *, user_id: str, mission_id: str, session_id: str, exercise_id: str,
                attempted_move_uci: str, idempotency_key: str) -> dict[str, Any]:
        session = self._session(user_id, mission_id, session_id)
        if session.get("status") != "active":
            raise MissionPersistenceError("session_not_active", "Training session is not active.")
        exercise = next((row for row in session.get("exercise_manifest") or [] if row.get("exerciseKey") == exercise_id), None)
        if not exercise:
            raise MissionPersistenceError("exercise_not_in_session", "Exercise does not belong to this session.")
        try:
            board = chess.Board(exercise["positionFen"])
            move = chess.Move.from_uci(str(attempted_move_uci or "").lower())
        except ValueError as exc:
            raise MissionPersistenceError("malformed_move", "Move must be valid UCI.") from exc
        if move not in board.legal_moves:
            raise MissionPersistenceError("illegal_move", "Move is not legal in this position.")
        canonical = move.uci()
        accepted = {row["uci"] for row in exercise.get("acceptedMoves") or []}
        correct = canonical in accepted
        prior = self.repository.list_training_attempts(user_id, session_id, limit=100)
        schedule = review_schedule(prior_attempts=[row for row in prior if row.get("exercise_key") == exercise_id],
                                   correct=correct, now=self.clock())
        repeated = canonical == exercise.get("repeatedBadMoveUci")
        result = "correct" if correct else "incorrect"
        feedback = (f"Correct — {board.san(move)} is your prepared response." if correct else
                    "That repeats the move this mission is repairing." if repeated else
                    "Legal, but it is not the prepared response for this mission.")
        saved = self.repository.insert_training_attempt_atomic(user_id=user_id, mission_id=mission_id,
            session_id=session_id, exercise_key=exercise_id, attempt_key=self._key(idempotency_key),
            attempted_move_uci=canonical, result=result, assistance_used=False,
            review_number=schedule["reviewNumber"], interval_days=schedule["intervalDays"], due_at=schedule["dueAt"],
            validation_evidence={"validator": "python_chess_legal_v1", "repeatedRepairMove": repeated})
        attempts = self.repository.list_training_attempts(user_id, session_id, limit=100)
        public_attempt = {"attemptId": saved.get("id"), "exerciseId": exercise_id, "attemptedMoveUci": canonical,
                          "result": result, "reviewNumber": saved.get("review_number"),
                          "intervalDays": saved.get("interval_days"), "dueAt": saved.get("due_at")}
        return {"attempt": public_attempt, "legality": "legal", "result": result, "feedback": feedback,
                "acceptedMoves": exercise["acceptedMoves"], "progress": completion_summary(session["exercise_manifest"], attempts)}

    def complete(self, *, user_id: str, mission_id: str, session_id: str, idempotency_key: str) -> dict[str, Any]:
        session = self._session(user_id, mission_id, session_id)
        attempts = self.repository.list_training_attempts(user_id, session_id, limit=100)
        summary = completion_summary(session.get("exercise_manifest") or [], attempts)
        if not summary["eligible"]:
            return {"completed": False, "session": session, "progress": summary}
        saved = self.repository.complete_training_session_atomic(user_id=user_id, mission_id=mission_id,
            session_id=session_id, idempotency_key=self._key(idempotency_key), progress=summary)
        return {"completed": True, "session": saved, "progress": summary}

    def _owned(self, user_id: str, mission_id: str) -> dict[str, Any]:
        mission = self.repository.get_mission(mission_id)
        if not mission or mission.get("user_id") != user_id:
            raise MissionPersistenceError("mission_not_found", "Mission was not found.")
        return mission

    def _session(self, user_id: str, mission_id: str, session_id: str) -> dict[str, Any]:
        session = self.repository.get_training_session(user_id, session_id)
        if not session or session.get("mission_id") != mission_id:
            raise MissionPersistenceError("session_not_found", "Training session was not found.")
        return session

    @staticmethod
    def _key(value: str) -> str:
        clean = str(value or "").strip()
        if not clean or len(clean) > 200:
            raise MissionPersistenceError("invalid_idempotency_key", "A bounded idempotency key is required.")
        return clean
