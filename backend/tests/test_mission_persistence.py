from datetime import datetime, timedelta, timezone

import pytest

from backend.analysis.mission_persistence import (
    InMemoryMissionRepository,
    MissionPersistenceError,
    MissionPersistenceService,
    ValidatedTrainingAttempt,
)


NOW = datetime(2026, 8, 31, tzinfo=timezone.utc)
POSITION = "rnbqkbnr/ppp1pppp/5n2/3p4/2PP4/5N2/PP2PPPP/RNBQKB1R w KQkq -"


def candidate(key="candidate-key", score=72, evidence=2):
    return {
        "candidateId": f"candidate-{key}", "candidateKey": key, "algorithmVersion": "missions_candidate_v1",
        "missionType": "repertoire_deviation", "role": "white_repertoire", "canonicalOpeningId": "queens-gambit",
        "openingName": "Queen's Gambit", "exactPositionKey": POSITION, "positionFen": POSITION + " 0 4", "playerTurn": "white",
        "repeatedPlayedMove": {"uci": "b1c3", "san": "Nc3"}, "acceptedCorrectionMoves": [{"uci": "g2g3", "san": "g3"}],
        "correctionSource": "active_repertoire_line", "correctionProvenance": [{"source": "active_repertoire_line", "provenance": "rep-1"}],
        "score": score, "scoreComponents": {"frequency": 25}, "confidence": {"level": "low"},
        "confidenceReasonCodes": ["minimum_distinct_evidence"], "conflicts": [], "distinctEvidenceGameIds": [f"g-{i}" for i in range(evidence)],
        "evidenceCount": evidence, "firstSeenAt": None, "lastSeenAt": None,
    }


@pytest.fixture
def setup():
    repo = InMemoryMissionRepository()
    service = MissionPersistenceService(repo)
    return repo, service


def saved(service, user="user-1", **options):
    return service.persist_candidate(user_id=user, candidate=candidate(**options), references={"baseline_cutoff_at": NOW})


def test_candidate_persistence_is_idempotent_across_report_regeneration(setup):
    repo, service = setup
    first = saved(service)
    regenerated = service.persist_candidate(user_id="user-1", candidate=candidate(score=81, evidence=3), references={"baseline_cutoff_at": NOW, "source_report_id": None})
    assert regenerated["id"] == first["id"]
    assert regenerated["candidate_key"] == first["candidate_key"]
    assert regenerated["algorithm_version"] == first["algorithm_version"]
    assert regenerated["candidate_score"] == 81 and regenerated["baseline_evidence_count"] == 3
    assert regenerated["status"] == "candidate" and regenerated["is_primary"] is False


def test_report_regeneration_cannot_mutate_mission_identity_or_cutoff(setup):
    _, service = setup
    first = saved(service)
    changed = candidate(score=90, evidence=4)
    changed["acceptedCorrectionMoves"] = [{"uci": "e2e3", "san": "e3"}]
    regenerated = service.persist_candidate(user_id="user-1", candidate=changed, references={"baseline_cutoff_at": NOW + timedelta(days=30)})
    assert regenerated["accepted_correction_moves"] == first["accepted_correction_moves"]
    assert regenerated["baseline_cutoff_at"] == first["baseline_cutoff_at"]
    assert regenerated["candidate_score"] == 90 and regenerated["baseline_evidence_count"] == 4


def test_empty_legacy_account_and_optional_report_are_safe(setup):
    _, service = setup
    assert service.get_current_mission("legacy-user") is None
    assert service.list_mission_history("legacy-user") == []
    assert saved(service)["source_report_id"] is None


def test_assignment_is_atomic_primary_and_idempotent(setup):
    repo, service = setup
    mission = saved(service)
    first = service.assign_primary_mission(user_id="user-1", mission_id=mission["id"], idempotency_key="assign:1")
    retry = service.assign_primary_mission(user_id="user-1", mission_id=mission["id"], idempotency_key="assign:1")
    assert first["status"] == retry["status"] == "assigned"
    assert service.get_current_mission("user-1")["id"] == mission["id"]
    assert len(repo.events) == 1


def test_failed_transition_creates_no_event(setup):
    repo, service = setup
    mission = saved(service)
    with pytest.raises(Exception):
        service.transition_mission(user_id="user-1", mission_id=mission["id"], target_status="repaired", cause_type="test", idempotency_key="illegal:1")
    assert repo.events == {}
    assert repo.get_mission(mission["id"])["status"] == "candidate"


def test_cross_user_and_one_primary_invariants(setup):
    _, service = setup
    first = saved(service, key="one")
    second = saved(service, key="two")
    with pytest.raises(MissionPersistenceError) as owner:
        service.assign_primary_mission(user_id="other", mission_id=first["id"], idempotency_key="owner")
    assert owner.value.code == "mission_owner_mismatch"
    service.assign_primary_mission(user_id="user-1", mission_id=first["id"], idempotency_key="one")
    with pytest.raises(MissionPersistenceError) as active:
        service.assign_primary_mission(user_id="user-1", mission_id=second["id"], idempotency_key="two")
    assert active.value.code == "primary_mission_exists"


def test_terminal_mission_allows_linked_later_generation(setup):
    repo, service = setup
    mission = saved(service)
    repo.missions[mission["id"]]["status"] = "repaired"
    refs = service.recurrence_references(user_id="user-1", repaired_mission_id=mission["id"])
    later = service.persist_candidate(user_id="user-1", candidate=candidate(), generation=refs["generation"], references={"recurrence_of_mission_id": mission["id"], "baseline_cutoff_at": NOW})
    assert later["generation"] == 2 and later["recurrence_of_mission_id"] == mission["id"]
    assert later["status"] == "candidate" and later["id"] != mission["id"]


def test_attempt_is_server_validated_narrow_and_idempotent(setup):
    repo, service = setup
    mission = saved(service)
    validated = ValidatedTrainingAttempt("g2g3", "correct", review_number=1, validation_evidence={"validator": "legal_move_v1"})
    first = service.record_training_attempt(user_id="user-1", mission_id=mission["id"], exercise_key="ex-1", session_key=None, attempt_key="attempt-1", validated=validated)
    retry = service.record_training_attempt(user_id="user-1", mission_id=mission["id"], exercise_key="ex-1", session_key=None, attempt_key="attempt-1", validated=validated)
    assert first == retry and len(repo.attempts) == 1
    assert first["result"] == "correct"


def test_encounter_classification_cutoff_and_dedup_are_server_derived(setup):
    repo, service = setup
    mission = saved(service)
    old = service.record_encounter(user_id="user-1", mission_id=mission["id"], platform="lichess", account_scope="account-hash", game_id="old", played_at=NOW, exact_position_key=POSITION, observed_move_uci="b1c3")
    correct = service.record_encounter(user_id="user-1", mission_id=mission["id"], platform="lichess", account_scope="account-hash", game_id="new", played_at=NOW + timedelta(days=1), exact_position_key=POSITION, observed_move_uci="g2g3")
    duplicate = service.record_encounter(user_id="user-1", mission_id=mission["id"], platform="lichess", account_scope="account-hash", game_id="new", played_at=NOW + timedelta(days=1), exact_position_key=POSITION, observed_move_uci="g2g3")
    other = service.record_encounter(user_id="user-1", mission_id=mission["id"], platform="lichess", account_scope="account-hash", game_id="other", played_at=NOW + timedelta(days=2), exact_position_key=POSITION, observed_move_uci="e2e3")
    assert old["classification"] == "repeated_mistake" and old["qualifies_for_verification"] is False
    assert correct == duplicate and correct["classification"] == "correct" and correct["qualifies_for_verification"] is True
    assert other["classification"] == "other_legal" and len(repo.encounters) == 3


def test_identity_validation_and_generation_fail_closed(setup):
    _, service = setup
    bad = candidate(); bad["exactPositionKey"] = "not a fen"
    with pytest.raises(MissionPersistenceError) as position:
        service.persist_candidate(user_id="user-1", candidate=bad)
    assert position.value.code == "invalid_exact_position_key"
    with pytest.raises(MissionPersistenceError) as generation:
        service.persist_candidate(user_id="user-1", candidate=candidate(), generation=0)
    assert generation.value.code == "invalid_generation"
