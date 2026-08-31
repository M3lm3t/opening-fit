from datetime import datetime, timedelta, timezone

import pytest

from backend.analysis.mission_lifecycle import (
    LEGAL_TRANSITIONS,
    MISSION_STATUSES,
    PRIMARY_ACTIVE_STATUSES,
    TERMINAL_STATUSES,
    EncounterEvidence,
    MissionLifecycleError,
    evidence_transition,
    is_primary_active,
    is_terminal,
    next_generation,
    summarise_verification_evidence,
    validate_transition,
)


NOW = datetime(2026, 8, 31, tzinfo=timezone.utc)


@pytest.mark.parametrize("source,target", [(source, target) for source, targets in LEGAL_TRANSITIONS.items() for target in targets])
def test_every_declared_transition_is_legal(source, target):
    assert validate_transition(source, target) is None


@pytest.mark.parametrize("source,target", [(source, target) for source in MISSION_STATUSES for target in MISSION_STATUSES if target not in LEGAL_TRANSITIONS[source]])
def test_every_other_transition_is_illegal(source, target):
    with pytest.raises(MissionLifecycleError, match="Cannot transition") as raised:
        validate_transition(source, target)
    assert raised.value.code == "illegal_mission_transition"


def test_active_terminal_and_candidate_classification_are_disjoint():
    assert {status for status in MISSION_STATUSES if is_primary_active(status)} == PRIMARY_ACTIVE_STATUSES
    assert {status for status in MISSION_STATUSES if is_terminal(status)} == TERMINAL_STATUSES
    assert not is_primary_active("candidate")
    assert not is_terminal("candidate")


def summary(*classes, before=(), duplicate=False):
    rows = [EncounterEvidence(f"future-{index}", classification, NOW + timedelta(days=index + 1)) for index, classification in enumerate(classes)]
    rows.extend(EncounterEvidence(f"old-{index}", classification, NOW - timedelta(days=index + 1)) for index, classification in enumerate(before))
    if duplicate and rows:
        rows.append(rows[0])
    return summarise_verification_evidence(rows, cutoff_at=NOW)


def test_evidence_policy_thresholds_and_other_legal_denominator():
    assert evidence_transition("awaiting_evidence", summary("correct")) is None
    assert evidence_transition("awaiting_evidence", summary("correct", "repeated_mistake")) == "improving"
    assert evidence_transition("awaiting_evidence", summary("correct", "correct")) == "improving"
    assert evidence_transition("awaiting_evidence", summary("correct", "correct", "repeated_mistake")) == "improving"
    assert evidence_transition("awaiting_evidence", summary("correct", "correct", "correct")) == "repaired"
    assert evidence_transition("awaiting_evidence", summary("correct", "repeated_mistake", "repeated_mistake")) == "needs_review"
    assert evidence_transition("awaiting_evidence", summary("correct", "repeated_mistake", "repeated_mistake", "repeated_mistake")) == "needs_review"
    with_other = summary("correct", "correct", "correct", "other_legal", "other_legal")
    assert with_other.qualifying == 3 and with_other.other_legal == 2
    assert evidence_transition("awaiting_evidence", with_other) == "repaired"


def test_integer_67_percent_rule_is_unambiguous():
    assert evidence_transition("awaiting_evidence", summary("correct", "correct", "repeated_mistake")) == "improving"  # 200 >= 201 is false
    assert evidence_transition("awaiting_evidence", summary("correct", "correct", "correct", "repeated_mistake")) == "repaired"


def test_duplicate_old_and_missing_positions_do_not_infer_progress():
    evidence = summary("correct", before=("correct", "repeated_mistake"), duplicate=True)
    assert evidence.correct == 1 and evidence.duplicates == 1 and evidence.before_or_at_cutoff == 2
    assert evidence_transition("awaiting_evidence", evidence) is None
    assert evidence_transition("awaiting_evidence", summary()) is None


def test_repaired_mission_never_returns_to_assigned_and_recurrence_links_generation():
    with pytest.raises(MissionLifecycleError):
        validate_transition("repaired", "assigned")
    assert next_generation(repaired_generation=2, recurrence_of_mission_id="mission-1") == {"generation": 3, "recurrenceOfMissionId": "mission-1"}
