from types import SimpleNamespace

import pytest
from fastapi import HTTPException, Request
from fastapi.testclient import TestClient
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
    monkeypatch.setattr(main, "_mission_endpoint_access", lambda *_args, **_kwargs: (True, "ready", {"eligible": True}))


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


def test_select_next_distinguishes_absent_from_below_confidence_candidates(monkeypatch):
    repository = InMemoryMissionRepository()
    enabled(monkeypatch, repository)
    assert main.select_next_mission(main.MissionSelectNextRequest(idempotencyKey="none"), request())["reasonCode"] == "no_trusted_candidate"
    low = candidate(); low["confidence"] = {"score": 69, "level": "medium"}
    MissionPersistenceService(repository).persist_candidate(user_id="user-1", candidate=low)
    assert main.select_next_mission(main.MissionSelectNextRequest(idempotencyKey="low"), request())["reasonCode"] == "candidate_below_confidence"


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


def test_current_surfaces_latest_repaired_result_when_no_active_mission(monkeypatch):
    repository = InMemoryMissionRepository()
    enabled(monkeypatch, repository)
    service = MissionPersistenceService(repository)
    saved = service.persist_candidate(user_id="user-1", candidate=candidate())
    for status in ("assigned", "learning", "awaiting_evidence", "repaired"):
        service.transition_mission(user_id="user-1", mission_id=saved["id"], target_status=status,
                                   cause_type="test", idempotency_key=f"to-{status}")
    response = main.get_current_mission(request())
    assert response["mission"]["status"] == "repaired"


def test_internal_eligibility_is_authenticated_boolean_only_and_fail_closed(monkeypatch):
    allowed = "11111111-1111-4111-8111-111111111111"
    monkeypatch.setenv("OPENINGFIT_MISSIONS_INTERNAL_USER_ID", allowed)
    monkeypatch.setenv("OPENINGFIT_MISSIONS_ROLLOUT_PERCENT", "0")
    monkeypatch.setattr(main, "missions_enabled", lambda *_args: True)
    monkeypatch.setattr(main, "missions_schema_readiness", lambda: {"ready": True, "training_ready": True})
    monkeypatch.setattr(main, "get_auth_user", lambda _request: SimpleNamespace(id=allowed))
    assert main.mission_client_eligibility(request()) == {"enabled": True}
    monkeypatch.setattr(main, "get_auth_user", lambda _request: SimpleNamespace(id="22222222-2222-4222-8222-222222222222"))
    assert main.mission_client_eligibility(request()) == {"enabled": False}
    monkeypatch.setenv("OPENINGFIT_MISSIONS_INTERNAL_USER_ID", "malformed")
    assert main.mission_client_eligibility(request()) == {"enabled": False}
    monkeypatch.setattr(main, "get_auth_user", lambda _request: (_ for _ in ()).throw(HTTPException(401, "forged")))
    with pytest.raises(HTTPException) as error:
        main.mission_client_eligibility(request(False))
    assert error.value.status_code == 401


def test_validated_identity_reaches_eligibility_http_contract(monkeypatch):
    allowed = "11111111-1111-4111-8111-111111111111"
    monkeypatch.setenv("OPENINGFIT_MISSIONS_INTERNAL_USER_ID", allowed)
    monkeypatch.setenv("OPENINGFIT_MISSIONS_ROLLOUT_PERCENT", "0")
    monkeypatch.setattr(main, "missions_enabled", lambda *_args: True)
    monkeypatch.setattr(main, "missions_schema_readiness", lambda: {"ready": True, "training_ready": True})
    monkeypatch.setattr(main, "get_supabase_admin_client", lambda: SimpleNamespace(
        auth=SimpleNamespace(get_user=lambda _token: SimpleNamespace(user=SimpleNamespace(id=allowed)))
    ))
    response = TestClient(main.app).get(
        "/api/features/missions/eligibility",
        headers={"Authorization": "Bearer current-token"},
    )
    assert response.status_code == 200
    assert response.json() == {"enabled": True}


def test_supabase_auth_validation_classifies_credentials_and_upstream_failures(monkeypatch):
    class Auth:
        error = None

        def get_user(self, _token):
            if self.error:
                raise self.error
            return SimpleNamespace(user=SimpleNamespace(id="11111111-1111-4111-8111-111111111111"))

    auth = Auth()
    monkeypatch.setattr(main, "get_supabase_admin_client", lambda: SimpleNamespace(auth=auth))
    monkeypatch.setattr(main, "log_supabase_diagnostic", lambda *_args, **_kwargs: None)

    assert main.get_auth_user(request()).id == "11111111-1111-4111-8111-111111111111"
    for invalid in (
        SimpleNamespace(status=401),
        SimpleNamespace(status_code=403),
    ):
        error = RuntimeError("credential rejected")
        for key, value in vars(invalid).items():
            setattr(error, key, value)
        auth.error = error
        with pytest.raises(HTTPException) as caught:
            main.get_auth_user(request())
        assert caught.value.status_code == 401
        assert caught.value.detail == {"code": "authentication_required"}

    for unavailable in (main.httpx.ReadTimeout("bounded timeout"), RuntimeError("unclassified upstream failure")):
        auth.error = unavailable
        with pytest.raises(HTTPException) as caught:
            main.mission_client_eligibility(request())
        assert caught.value.status_code == 503
        assert caught.value.detail == {"code": "authentication_service_unavailable"}


def test_auth_diagnostic_contains_only_bounded_metadata(monkeypatch):
    secret = "header.payload.signature"
    captured = []
    monkeypatch.setattr(main, "get_supabase_admin_client", lambda: SimpleNamespace(
        auth=SimpleNamespace(get_user=lambda _token: (_ for _ in ()).throw(main.httpx.ConnectError("offline")))
    ))
    monkeypatch.setattr(main, "log_supabase_diagnostic", lambda message, **details: captured.append((message, details)))
    with pytest.raises(HTTPException):
        main.get_auth_user(Request({"type": "http", "method": "GET", "path": "/api/features/missions/eligibility",
                                   "headers": [(b"authorization", f"Bearer {secret}".encode())]}))
    rendered = repr(captured)
    assert secret not in rendered
    assert "user" not in rendered.lower()
    assert set(captured[0][1]) == {"request_id", "authorization_present", "failure_category", "upstream_status", "exception_class"}


def test_non_allowlisted_direct_calls_touch_no_mission_repository(monkeypatch):
    user_id = "22222222-2222-4222-8222-222222222222"
    object_id = main.UUID("33333333-3333-4333-8333-333333333333")
    monkeypatch.setenv("OPENINGFIT_MISSIONS_INTERNAL_USER_ID", "11111111-1111-4111-8111-111111111111")
    monkeypatch.setenv("OPENINGFIT_MISSIONS_ROLLOUT_PERCENT", "0")
    monkeypatch.setattr(main, "missions_enabled", lambda *_args: True)
    monkeypatch.setattr(main, "get_auth_user", lambda _request: SimpleNamespace(id=user_id))
    monkeypatch.setattr(main, "missions_schema_readiness", lambda: (_ for _ in ()).throw(AssertionError("catalog touched")))
    monkeypatch.setattr(main, "mission_repository", lambda: (_ for _ in ()).throw(AssertionError("repository touched")))

    calls = [
        lambda: main.get_current_mission(request()),
        lambda: main.list_missions(request()),
        lambda: main.select_next_mission(main.MissionSelectNextRequest(idempotencyKey="select"), request()),
        lambda: main.dismiss_mission(object_id, main.MissionDismissRequest(reason="other", idempotencyKey="dismiss"), request()),
        lambda: main.start_mission_training(object_id, main.MissionTrainingStartRequest(idempotencyKey="start"), request()),
        lambda: main.current_mission_training(object_id, request()),
        lambda: main.submit_mission_training_attempt(object_id, object_id, main.MissionTrainingAttemptRequest(exerciseId="e", attemptedMoveUci="g2g3", idempotencyKey="attempt"), request()),
        lambda: main.complete_mission_training(object_id, object_id, main.MissionTrainingCompleteRequest(idempotencyKey="complete"), request()),
    ]
    for call in calls:
        result = call()
        assert result["featureAvailable"] is False
        assert result["reasonCode"] == "rollout_unavailable"


def test_public_readiness_never_exposes_internal_identity(monkeypatch):
    allowed = "11111111-1111-4111-8111-111111111111"
    base = {"status": "ready", "subscriptions": "enabled", "stripe": "configured", "webhook": "configured",
            "monthly_price": "configured", "annual_price": "configured", "missions": "enabled"}
    monkeypatch.setenv("OPENINGFIT_MISSIONS_INTERNAL_USER_ID", allowed)
    monkeypatch.setattr(main, "readiness_payload", lambda: dict(base))
    monkeypatch.setattr(main, "billing_schema_readiness", lambda: {"ready": True})
    monkeypatch.setattr(main, "missions_enabled", lambda *_args: True)
    monkeypatch.setattr(main, "missions_schema_readiness", lambda: {"ready": True, "training_ready": True,
        "activity_projector_ready": True, "analytics_ready": True, "notification_scheduling_ready": True})
    payload = main.api_readiness().body.decode()
    assert allowed not in payload
    assert "INTERNAL_USER" not in payload
