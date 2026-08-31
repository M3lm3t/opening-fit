import json
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, Request
from pydantic import ValidationError

import main
from analysis.mission_persistence import InMemoryMissionRepository, MissionPersistenceService
from tests.test_mission_persistence import candidate


def request():
    return Request({"type": "http", "method": "POST", "path": "/api/v1/missions/x/training/sessions", "headers": [(b"authorization", b"Bearer valid")]})


def setup(monkeypatch):
    repository = InMemoryMissionRepository()
    persisted = MissionPersistenceService(repository).persist_candidate(user_id="user-1", candidate=candidate())
    MissionPersistenceService(repository).assign_primary_mission(user_id="user-1", mission_id=persisted["id"], idempotency_key="assign")
    monkeypatch.setattr(main, "get_auth_user", lambda _request: SimpleNamespace(id="user-1"))
    monkeypatch.setattr(main, "missions_enabled", lambda *_args: True)
    monkeypatch.setattr(main, "missions_schema_readiness", lambda: {"ready": True, "training_ready": True})
    monkeypatch.setattr(main, "mission_repository", lambda: repository)
    main._mission_training_requests.clear()
    return repository, persisted["id"]


def test_training_payloads_reject_client_authority():
    with pytest.raises(ValidationError):
        main.MissionTrainingAttemptRequest(exerciseId="e", attemptedMoveUci="g2g3", idempotencyKey="a", correctness=True)
    with pytest.raises(ValidationError):
        main.MissionTrainingCompleteRequest(idempotencyKey="c", accuracy=100)


def test_training_api_start_attempt_complete_and_hides_unattempted_answer(monkeypatch):
    repository, mission_id = setup(monkeypatch)
    started = main.start_mission_training(main.UUID(mission_id), main.MissionTrainingStartRequest(idempotencyKey="start"), request())
    session = started["session"]
    assert started["created"] is True and session["exerciseCount"] == 1
    assert "acceptedMoves" not in session["currentExercise"]
    exercise = session["currentExercise"]["exerciseId"]
    attempt = main.submit_mission_training_attempt(main.UUID(mission_id), main.UUID(session["id"]),
        main.MissionTrainingAttemptRequest(exerciseId=exercise, attemptedMoveUci="g2g3", idempotencyKey="attempt"), request())
    assert attempt["result"] == "correct"
    assert attempt["acceptedMoves"] == [{"uci": "g2g3", "san": "g3"}]
    completed = main.complete_mission_training(main.UUID(mission_id), main.UUID(session["id"]),
        main.MissionTrainingCompleteRequest(idempotencyKey="complete"), request())
    assert completed["completed"] is True
    assert completed["missionStatus"] == "awaiting_evidence"
    assert completed["meaningfulActivity"] == "durable_marker_recorded"


def test_disabled_and_ownership_responses_are_stable(monkeypatch):
    repository, mission_id = setup(monkeypatch)
    monkeypatch.setattr(main, "missions_enabled", lambda *_args: False)
    disabled = main.start_mission_training(main.UUID(mission_id), main.MissionTrainingStartRequest(idempotencyKey="start"), request())
    assert disabled["reasonCode"] == "missions_disabled"
    monkeypatch.setattr(main, "missions_enabled", lambda *_args: True)
    monkeypatch.setattr(main, "get_auth_user", lambda _request: SimpleNamespace(id="other-user"))
    with pytest.raises(HTTPException) as error:
        main.start_mission_training(main.UUID(mission_id), main.MissionTrainingStartRequest(idempotencyKey="start"), request())
    assert error.value.status_code == 404


def test_illegal_move_is_bounded_domain_error_and_not_persisted(monkeypatch):
    repository, mission_id = setup(monkeypatch)
    started = main.start_mission_training(main.UUID(mission_id), main.MissionTrainingStartRequest(idempotencyKey="start"), request())
    session = started["session"]
    with pytest.raises(HTTPException) as error:
        main.submit_mission_training_attempt(main.UUID(mission_id), main.UUID(session["id"]),
            main.MissionTrainingAttemptRequest(exerciseId=session["currentExercise"]["exerciseId"], attemptedMoveUci="a1a8", idempotencyKey="illegal"), request())
    assert error.value.status_code == 400
    assert error.value.detail == {"code": "illegal_move"}
    assert repository.attempts == {}


def test_incorrect_exercise_remains_current_for_retry(monkeypatch):
    _repository, mission_id = setup(monkeypatch)
    started = main.start_mission_training(main.UUID(mission_id), main.MissionTrainingStartRequest(idempotencyKey="start"), request())
    session = started["session"]
    exercise = session["currentExercise"]["exerciseId"]
    result = main.submit_mission_training_attempt(main.UUID(mission_id), main.UUID(session["id"]),
        main.MissionTrainingAttemptRequest(exerciseId=exercise, attemptedMoveUci="b1c3", idempotencyKey="wrong"), request())
    assert result["result"] == "incorrect"
    assert result["session"]["currentExercise"]["exerciseId"] == exercise


def test_enabled_missing_training_schema_is_degraded_not_globally_blocking(monkeypatch):
    base = {"status": "ready", "subscriptions": "disabled", "stripe": "configured", "webhook": "configured",
            "monthly_price": "configured", "annual_price": "configured", "missions": "enabled"}
    monkeypatch.setattr(main, "readiness_payload", lambda: dict(base))
    monkeypatch.setattr(main, "billing_schema_readiness", lambda: {"ready": True})
    monkeypatch.setattr(main, "missions_enabled", lambda *_args: True)
    monkeypatch.setattr(main, "missions_schema_readiness", lambda: {"ready": True, "training_ready": False})
    response = main.api_readiness()
    payload = json.loads(response.body)
    assert response.status_code == 200
    assert payload["missions_training_schema"] == "not_ready"
    assert payload["missions_component"] == "degraded"
