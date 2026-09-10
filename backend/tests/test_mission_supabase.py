import copy
import json
from datetime import datetime, timezone
from types import SimpleNamespace

import httpx
import pytest
from supabase import create_client
from postgrest.exceptions import APIError

from backend.analysis.mission_candidates import build_mission_candidates
from backend.analysis.mission_persistence import (
    MissionPersistenceError,
    MissionPersistenceService,
)
from backend.analysis.mission_processing import _games, _trusted_corrections
from backend.analysis.mission_supabase import SupabaseMissionRepository, _error_code
from backend.tests.test_mission_processing import _large_three_role_report


class Operation:
    def __init__(self, outcomes):
        self.outcomes = list(outcomes)
        self.calls = 0

    def execute(self):
        outcome = self.outcomes[self.calls]
        self.calls += 1
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


class PostgrestError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = None
        self.hint = None


class Query:
    def __init__(self, client):
        self.client = client
        self.payload = None

    def select(self, *_args):
        return self

    def eq(self, *_args):
        return self

    def limit(self, *_args):
        return self

    def insert(self, payload):
        self.payload = payload
        self.client.insert_payload = payload
        return self

    def execute(self):
        self.client.dispatches += 1
        if self.payload is None:
            return SimpleNamespace(data=[])
        return SimpleNamespace(data=[{"id": "mission-1", **self.payload}])


class DispatchClient:
    def __init__(self):
        self.dispatches = 0
        self.insert_payload = None

    def table(self, _name):
        return Query(self)


def test_statement_timeout_is_classified_and_retried_once(monkeypatch):
    monkeypatch.setattr("backend.analysis.mission_supabase.time.sleep", lambda _seconds: None)
    operation = Operation([
        PostgrestError("57014", "cancelling statement due to statement timeout"),
        SimpleNamespace(data=[{"id": "mission-1"}]),
    ])

    result = SupabaseMissionRepository(object())._execute(operation)

    assert result.data == [{"id": "mission-1"}]
    assert operation.calls == 2


def test_statement_timeout_stops_after_one_retry(monkeypatch):
    monkeypatch.setattr("backend.analysis.mission_supabase.time.sleep", lambda _seconds: None)
    operation = Operation([
        PostgrestError("57014", "statement timeout"),
        PostgrestError("57014", "statement timeout"),
    ])

    with pytest.raises(MissionPersistenceError) as failure:
        SupabaseMissionRepository(object())._execute(operation)

    assert failure.value.code == "statement_timeout"
    assert operation.calls == 2


@pytest.mark.parametrize("code,message", [
    ("23505", "duplicate key"),
    ("42501", "permission denied"),
    ("PGRST205", "schema cache lookup failed"),
])
def test_permanent_storage_errors_are_never_retried(monkeypatch, code, message):
    monkeypatch.setattr("backend.analysis.mission_supabase.time.sleep", lambda _seconds: None)
    operation = Operation([PostgrestError(code, message)])

    with pytest.raises(MissionPersistenceError) as failure:
        SupabaseMissionRepository(object())._execute(operation)

    assert failure.value.code == _error_code(PostgrestError(code, message))
    assert operation.calls == 1


def test_realistic_large_candidate_is_serialized_before_request_dispatch():
    report = _large_three_role_report()
    for index, game in enumerate(copy.deepcopy(report["opening_games"][:11])):
        game["gameId"] = f"dispatch-extra-{index}"
        report["opening_games"].append(game)
    games = _games(report)
    generated = build_mission_candidates(games, _trusted_corrections(report, games))["candidates"]
    client = DispatchClient()
    service = MissionPersistenceService(SupabaseMissionRepository(client))

    saved = service.persist_candidate(
        user_id="11111111-1111-4111-8111-111111111111",
        candidate=generated[0],
        references={"baseline_cutoff_at": datetime.now(timezone.utc)},
    )

    assert len(games) == 211
    assert client.dispatches == 2
    assert isinstance(client.insert_payload["baseline_cutoff_at"], str)
    assert saved["id"] == "mission-1"


def test_invalid_candidate_fails_before_dispatch_with_bounded_stage():
    client = DispatchClient()
    service = MissionPersistenceService(SupabaseMissionRepository(client))

    with pytest.raises(MissionPersistenceError) as failure:
        service.persist_candidate(user_id="opaque", candidate={})

    assert failure.value.stage == "candidate_validation_failed"
    assert client.dispatches == 0


def test_unserializable_candidate_fails_before_dispatch_with_bounded_stage():
    report = _large_three_role_report()
    games = _games(report)
    candidate = build_mission_candidates(games, _trusted_corrections(report, games))["candidates"][0]
    candidate["acceptedCorrectionMoves"][0]["unsafe"] = object()
    client = DispatchClient()

    with pytest.raises(MissionPersistenceError) as failure:
        MissionPersistenceService(SupabaseMissionRepository(client)).persist_candidate(
            user_id="opaque", candidate=candidate
        )

    assert failure.value.stage == "candidate_serialization_failed"
    assert client.dispatches == 0


@pytest.mark.parametrize("paid", [False, True])
def test_real_supabase_client_builds_exact_assignment_rpc_contract(paid):
    captured = []

    def dispatch(request):
        captured.append(request)
        return httpx.Response(200, json={"assigned": True, "mission": {"status": "assigned"}})

    client = create_client("https://example.supabase.co", "bounded-test-key")
    client.postgrest.session = httpx.Client(transport=httpx.MockTransport(dispatch))
    repository = SupabaseMissionRepository(client)
    result = repository.assign_with_allowance(
        user_id="11111111-1111-4111-8111-111111111111",
        mission_id="22222222-2222-4222-8222-222222222222",
        paid=paid,
        idempotency_key="select-next:stable-key",
    )

    assert result["assigned"] is True
    assert len(captured) == 1
    request = captured[0]
    assert request.method == "POST"
    assert request.url == "https://example.supabase.co/rest/v1/rpc/assign_openingfit_mission_with_allowance"
    assert json.loads(request.content) == {
        "p_user_id": "11111111-1111-4111-8111-111111111111",
        "p_mission_id": "22222222-2222-4222-8222-222222222222",
        "p_paid_access": paid,
        "p_idempotency_key": "select-next:stable-key",
    }


def test_postgrest_argument_mismatch_is_bounded_and_never_retried():
    dispatches = 0

    def dispatch(_request):
        nonlocal dispatches
        dispatches += 1
        return httpx.Response(
            400,
            json={"code": "PGRST202", "message": "bounded mismatch", "details": None, "hint": None},
        )

    client = create_client("https://example.supabase.co", "bounded-test-key")
    client.postgrest.session = httpx.Client(transport=httpx.MockTransport(dispatch))

    with pytest.raises(MissionPersistenceError) as failure:
        SupabaseMissionRepository(client).assign_with_allowance(
            user_id="11111111-1111-4111-8111-111111111111",
            mission_id="22222222-2222-4222-8222-222222222222",
            paid=False,
            idempotency_key="select-next:stable-key",
        )

    assert failure.value.code == "rpc_argument_mismatch"
    assert failure.value.stage == "assignment_request_failed"
    assert dispatches == 1


def test_numeric_http_400_is_not_classified_as_transient_or_retried(monkeypatch):
    monkeypatch.setattr("backend.analysis.mission_supabase.time.sleep", lambda _seconds: None)
    operation = Operation([PostgrestError(400, "Bad Request")])

    with pytest.raises(MissionPersistenceError) as failure:
        SupabaseMissionRepository(object())._execute(operation, failure_stage="assignment_request_failed")

    assert failure.value.code == "postgrest_bad_request"
    assert operation.calls == 1


def test_real_api_error_survives_repository_wrapper_and_exception_chain():
    api_error = APIError({
        "code": "PGRST202", "message": "private mismatch detail",
        "details": "private response detail", "hint": "private hint",
    })
    operation = Operation([api_error])

    with pytest.raises(MissionPersistenceError) as failure:
        SupabaseMissionRepository(object())._execute(
            operation, failure_stage="assignment_request_failed"
        )

    assert failure.value.database_code == "rpc_argument_mismatch"
    assert failure.value.__cause__ is api_error
    assert _error_code(failure.value) == "rpc_argument_mismatch"
    assert operation.calls == 1


def test_unknown_sqlstate_is_preserved_as_bounded_identifier_without_retry():
    operation = Operation([APIError({
        "code": "22023", "message": "private invalid parameter detail",
        "details": None, "hint": None,
    })])

    with pytest.raises(MissionPersistenceError) as failure:
        SupabaseMissionRepository(object())._execute(operation)

    assert failure.value.database_code == "22023"
    assert operation.calls == 1


def test_nested_numeric_api_error_is_not_treated_as_transient():
    api_error = APIError({
        "code": 400, "message": "private malformed response",
        "details": None, "hint": None,
    })
    try:
        raise api_error
    except APIError as exc:
        wrapped = MissionPersistenceError(
            "storage_failure", "Mission storage operation failed.",
            stage="assignment_request_failed",
        )
        wrapped.__cause__ = exc

    assert _error_code(wrapped) == "postgrest_bad_request"
