import copy
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

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
