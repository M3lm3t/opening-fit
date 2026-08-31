from types import SimpleNamespace

import pytest
from fastapi import HTTPException, Request
from pydantic import ValidationError

import main
from analysis.mission_persistence import InMemoryMissionRepository, MissionPersistenceService
from tests.test_mission_persistence import candidate


def request(token=True):
    headers = [(b"authorization", b"Bearer valid")] if token else []
    return Request({"type": "http", "method": "GET", "path": "/api/v1/missions/current", "headers": headers})


def enabled(monkeypatch, repository):
    monkeypatch.setattr(main, "get_auth_user", lambda _request: SimpleNamespace(id="user-1"))
    monkeypatch.setattr(main, "missions_enabled", lambda *_args: True)
    monkeypatch.setattr(main, "missions_schema_readiness", lambda: {"ready": True, "reason": "ready"})
    monkeypatch.setattr(main, "mission_repository", lambda: repository)


def test_authentication_required_and_disabled_response_is_stable(monkeypatch):
    monkeypatch.setattr(main, "get_auth_user", lambda _request: (_ for _ in ()).throw(HTTPException(401, "secret detail")))
    with pytest.raises(HTTPException) as error:
        main.get_current_mission(request(False))
    assert error.value.detail == {"code": "authentication_required"}
    monkeypatch.setattr(main, "get_auth_user", lambda _request: SimpleNamespace(id="user-1"))
    monkeypatch.setattr(main, "missions_enabled", lambda *_args: False)
    assert main.get_current_mission(request())["reasonCode"] == "missions_disabled"


def test_select_next_rejects_client_authored_candidate_and_never_replaces_active(monkeypatch):
    with pytest.raises(ValidationError):
        main.MissionSelectNextRequest(idempotencyKey="one", score=100)
    repository = InMemoryMissionRepository()
    enabled(monkeypatch, repository)
    trusted = candidate(); trusted["confidence"] = {"score": 90, "level": "high"}
    saved = MissionPersistenceService(repository).persist_candidate(user_id="user-1", candidate=trusted)
    first = main.select_next_mission(main.MissionSelectNextRequest(idempotencyKey="one"), request())
    second = main.select_next_mission(main.MissionSelectNextRequest(idempotencyKey="two"), request())
    assert first["mission"]["id"] == saved["id"]
    assert second["reasonCode"] == "active_mission_exists"
    assert len(repository.missions) == 1


def test_history_is_owned_bounded_and_dismissal_validates_reason(monkeypatch):
    repository = InMemoryMissionRepository()
    enabled(monkeypatch, repository)
    service = MissionPersistenceService(repository)
    saved = service.persist_candidate(user_id="user-1", candidate=candidate())
    service.assign_primary_mission(user_id="user-1", mission_id=saved["id"], idempotency_key="assign")
    history = main.list_missions(request(), limit=1000)
    assert len(history["missions"]) == 1
    with pytest.raises(HTTPException) as error:
        main.dismiss_mission(saved["id"], main.MissionDismissRequest(reason="client_chosen_status", idempotencyKey="d"), request())
    assert error.value.status_code == 400
    dismissed = main.dismiss_mission(saved["id"], main.MissionDismissRequest(reason="prefer_another", idempotencyKey="d"), request())
    replay = main.dismiss_mission(saved["id"], main.MissionDismissRequest(reason="prefer_another", idempotencyKey="d"), request())
    assert dismissed["mission"]["status"] == replay["mission"]["status"] == "dismissed"
