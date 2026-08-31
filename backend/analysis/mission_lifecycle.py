"""Pure server-authoritative lifecycle policy for OpeningFit Missions.

`other_legal` encounters are retained for audit but excluded from the repair and
failure denominator.  Only `correct` and `repeated_mistake` are qualifying.
Policy functions do not mutate storage and never accept a client-claimed prior
status.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Iterable, Mapping


MISSION_STATUSES = frozenset({
    "candidate", "assigned", "learning", "awaiting_evidence", "improving",
    "repaired", "needs_review", "dismissed", "superseded",
})
PRIMARY_ACTIVE_STATUSES = frozenset({"assigned", "learning", "awaiting_evidence", "improving", "needs_review"})
TERMINAL_STATUSES = frozenset({"repaired", "dismissed", "superseded"})
LEGAL_TRANSITIONS = {
    "candidate": frozenset({"assigned", "dismissed", "superseded"}),
    "assigned": frozenset({"learning", "dismissed", "superseded"}),
    "learning": frozenset({"awaiting_evidence", "dismissed", "superseded"}),
    "awaiting_evidence": frozenset({"improving", "needs_review", "repaired", "dismissed", "superseded"}),
    "improving": frozenset({"repaired", "needs_review", "dismissed", "superseded"}),
    "needs_review": frozenset({"learning", "dismissed", "superseded"}),
    "repaired": frozenset({"superseded"}),
    "dismissed": frozenset(),
    "superseded": frozenset(),
}


class MissionLifecycleError(ValueError):
    """Stable domain error suitable for mapping to an API error in Phase 3."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class EncounterEvidence:
    encounter_id: str
    classification: str
    played_at: datetime


@dataclass(frozen=True)
class VerificationSummary:
    correct: int
    repeated_mistake: int
    other_legal: int
    qualifying: int
    duplicates: int
    before_or_at_cutoff: int


def is_primary_active(status: str) -> bool:
    return status in PRIMARY_ACTIVE_STATUSES


def is_terminal(status: str) -> bool:
    return status in TERMINAL_STATUSES


def validate_transition(current_status: str, target_status: str) -> None:
    if current_status not in MISSION_STATUSES or target_status not in MISSION_STATUSES:
        raise MissionLifecycleError("unknown_mission_status", "Mission status is not recognised.")
    if target_status not in LEGAL_TRANSITIONS[current_status]:
        raise MissionLifecycleError("illegal_mission_transition", f"Cannot transition a mission from {current_status} to {target_status}.")


def summarise_verification_evidence(
    encounters: Iterable[EncounterEvidence | Mapping[str, Any]],
    *,
    cutoff_at: datetime,
) -> VerificationSummary:
    unique: dict[str, EncounterEvidence] = {}
    duplicates = 0
    before = 0
    for raw in encounters:
        item = raw if isinstance(raw, EncounterEvidence) else EncounterEvidence(
            encounter_id=str(raw.get("encounter_id") or raw.get("encounterId") or ""),
            classification=str(raw.get("classification") or ""),
            played_at=raw.get("played_at") or raw.get("playedAt"),
        )
        if not item.encounter_id or item.classification not in {"correct", "repeated_mistake", "other_legal"} or not isinstance(item.played_at, datetime):
            continue
        if item.encounter_id in unique:
            duplicates += 1
            continue
        unique[item.encounter_id] = item
        if item.played_at <= cutoff_at:
            before += 1
    usable = [item for item in unique.values() if item.played_at > cutoff_at]
    correct = sum(item.classification == "correct" for item in usable)
    repeated = sum(item.classification == "repeated_mistake" for item in usable)
    other = sum(item.classification == "other_legal" for item in usable)
    return VerificationSummary(correct, repeated, other, correct + repeated, duplicates, before)


def evidence_transition(current_status: str, summary: VerificationSummary) -> str | None:
    """Return a permitted evidence-driven target or None when evidence is insufficient."""
    if current_status not in {"awaiting_evidence", "improving"}:
        raise MissionLifecycleError("status_not_awaiting_verification", "This mission is not awaiting future-game evidence.")
    qualifying = summary.qualifying
    if qualifying >= 3 and summary.correct >= 2 and summary.correct * 100 >= qualifying * 67 and summary.repeated_mistake <= 1:
        return "repaired"
    if summary.repeated_mistake >= 2 and summary.correct * 2 < qualifying:
        return "needs_review"
    if current_status == "awaiting_evidence" and qualifying >= 2 and summary.correct >= 1:
        return "improving"
    return None


def next_generation(*, repaired_generation: int, recurrence_of_mission_id: str) -> dict[str, Any]:
    if repaired_generation < 1 or not str(recurrence_of_mission_id or "").strip():
        raise MissionLifecycleError("invalid_recurrence_link", "A returned leak must reference a prior mission and positive generation.")
    return {"generation": repaired_generation + 1, "recurrenceOfMissionId": recurrence_of_mission_id}
