from datetime import datetime, timezone

import pytest

from backend.analysis.mission_persistence import InMemoryMissionRepository, MissionPersistenceError, MissionPersistenceService
from backend.analysis.mission_training import (
    MissionTrainingService, build_exercise_manifest, client_exercise, completion_summary, review_schedule,
)
from backend.tests.test_mission_persistence import candidate


def assigned():
    repository = InMemoryMissionRepository()
    service = MissionPersistenceService(repository)
    saved = service.persist_candidate(user_id="user-1", candidate=candidate())
    service.assign_primary_mission(user_id="user-1", mission_id=saved["id"], idempotency_key="assign")
    return repository, saved["id"]


def test_core_exercise_is_legal_stable_and_does_not_fabricate_positions():
    repository, mission_id = assigned()
    mission = repository.get_mission(mission_id)
    first = build_exercise_manifest(mission)
    assert first == build_exercise_manifest(mission)
    assert len(first) == 1
    assert first[0]["acceptedMoves"] == [{"uci": "g2g3", "san": "g3"}]
    assert first[0]["playerTurn"] == "white"
    assert "acceptedMoves" not in client_exercise(first[0])
    assert client_exercise(first[0], answered=True)["acceptedMoves"]
    assert build_exercise_manifest({**mission, "position_fen": "invalid"}) == []


def test_start_is_atomic_idempotent_resumable_and_transitions_to_learning():
    repository, mission_id = assigned()
    service = MissionTrainingService(repository)
    first = service.start(user_id="user-1", mission_id=mission_id, idempotency_key="start-1")
    replay = service.start(user_id="user-1", mission_id=mission_id, idempotency_key="start-1")
    another_key = service.start(user_id="user-1", mission_id=mission_id, idempotency_key="start-2")
    assert first["id"] == replay["id"] == another_key["id"]
    assert repository.get_mission(mission_id)["status"] == "learning"
    assert len(repository.training_sessions) == 1
    assert service.current(user_id="user-1", mission_id=mission_id)["exercise_manifest"] == first["exercise_manifest"]


def test_ownership_and_terminal_statuses_are_not_trainable():
    repository, mission_id = assigned()
    service = MissionTrainingService(repository)
    with pytest.raises(MissionPersistenceError, match="not found"):
        service.start(user_id="other", mission_id=mission_id, idempotency_key="x")
    repository.missions[mission_id]["status"] = "repaired"
    with pytest.raises(MissionPersistenceError) as error:
        service.start(user_id="user-1", mission_id=mission_id, idempotency_key="x")
    assert error.value.code == "mission_not_trainable"


def test_correct_incorrect_illegal_and_idempotent_attempts_preserve_history():
    repository, mission_id = assigned()
    service = MissionTrainingService(repository, clock=lambda: datetime(2026, 8, 31, tzinfo=timezone.utc))
    session = service.start(user_id="user-1", mission_id=mission_id, idempotency_key="start")
    exercise = session["exercise_manifest"][0]["exerciseKey"]
    wrong = service.attempt(user_id="user-1", mission_id=mission_id, session_id=session["id"], exercise_id=exercise,
                            attempted_move_uci="b1c3", idempotency_key="attempt-1")
    assert wrong["result"] == "incorrect"
    assert "repeats" in wrong["feedback"]
    with pytest.raises(MissionPersistenceError) as illegal:
        service.attempt(user_id="user-1", mission_id=mission_id, session_id=session["id"], exercise_id=exercise,
                        attempted_move_uci="a1a8", idempotency_key="illegal")
    assert illegal.value.code == "illegal_move"
    with pytest.raises(MissionPersistenceError) as malformed:
        service.attempt(user_id="user-1", mission_id=mission_id, session_id=session["id"], exercise_id=exercise,
                        attempted_move_uci="g3", idempotency_key="bad")
    assert malformed.value.code == "malformed_move"
    correct = service.attempt(user_id="user-1", mission_id=mission_id, session_id=session["id"], exercise_id=exercise,
                              attempted_move_uci="g2g3", idempotency_key="attempt-2")
    replay = service.attempt(user_id="user-1", mission_id=mission_id, session_id=session["id"], exercise_id=exercise,
                             attempted_move_uci="g2g3", idempotency_key="attempt-2")
    assert correct["result"] == replay["result"] == "correct"
    assert len(repository.attempts) == 2
    assert correct["attempt"]["intervalDays"] == 1


def test_attempt_key_conflict_and_cross_session_exercise_are_rejected():
    repository, mission_id = assigned()
    service = MissionTrainingService(repository)
    session = service.start(user_id="user-1", mission_id=mission_id, idempotency_key="start")
    exercise = session["exercise_manifest"][0]["exerciseKey"]
    service.attempt(user_id="user-1", mission_id=mission_id, session_id=session["id"], exercise_id=exercise,
                    attempted_move_uci="b1c3", idempotency_key="same")
    with pytest.raises(MissionPersistenceError) as conflict:
        service.attempt(user_id="user-1", mission_id=mission_id, session_id=session["id"], exercise_id=exercise,
                        attempted_move_uci="g2g3", idempotency_key="same")
    assert conflict.value.code == "idempotency_key_conflict"
    with pytest.raises(MissionPersistenceError) as foreign:
        service.attempt(user_id="user-1", mission_id=mission_id, session_id=session["id"], exercise_id="foreign",
                        attempted_move_uci="g2g3", idempotency_key="other")
    assert foreign.value.code == "exercise_not_in_session"


def test_one_exercise_completion_requires_core_correct_and_transitions_once():
    repository, mission_id = assigned()
    service = MissionTrainingService(repository)
    session = service.start(user_id="user-1", mission_id=mission_id, idempotency_key="start")
    incomplete = service.complete(user_id="user-1", mission_id=mission_id, session_id=session["id"], idempotency_key="complete")
    assert incomplete["completed"] is False
    assert repository.get_mission(mission_id)["status"] == "learning"
    exercise = session["exercise_manifest"][0]["exerciseKey"]
    service.attempt(user_id="user-1", mission_id=mission_id, session_id=session["id"], exercise_id=exercise,
                    attempted_move_uci="g2g3", idempotency_key="correct")
    completed = service.complete(user_id="user-1", mission_id=mission_id, session_id=session["id"], idempotency_key="complete")
    replay = service.complete(user_id="user-1", mission_id=mission_id, session_id=session["id"], idempotency_key="complete")
    assert completed["completed"] is replay["completed"] is True
    assert repository.get_mission(mission_id)["status"] == "awaiting_evidence"
    assert completed["session"]["meaningful_activity_recorded_at"] is not None
    assert len([event for event in repository.events.values() if event["to_status"] == "awaiting_evidence"]) == 1


def test_integer_completion_policy_for_small_and_large_manifests():
    def manifest(count):
        return [{"exerciseKey": f"e{i}", "isCore": i == 0} for i in range(count)]
    attempts = lambda correct: [{"exercise_key": f"e{i}", "result": "correct" if i < correct else "incorrect", "assistance_used": False} for i in range(5)]
    assert completion_summary(manifest(2), attempts(1))["eligible"] is False
    assert completion_summary(manifest(5), attempts(4))["eligible"] is True
    assisted = attempts(4)
    assisted[0]["assistance_used"] = True
    assert completion_summary(manifest(5), assisted)["eligible"] is False


def test_review_schedule_is_utc_deterministic_and_bounded():
    now = datetime(2026, 8, 31, tzinfo=timezone.utc)
    first = review_schedule(prior_attempts=[], correct=True, now=now)
    recovered = review_schedule(prior_attempts=[{"result": "incorrect"}], correct=True, now=now)
    repeated = review_schedule(prior_attempts=[{"result": "correct"}] * 20, correct=True, now=now)
    assert (first["intervalDays"], recovered["intervalDays"], repeated["intervalDays"]) == (3, 1, 30)
    assert first["dueAt"].tzinfo is not None
