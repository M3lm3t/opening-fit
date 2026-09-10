from types import SimpleNamespace

import pytest

from backend.analysis.mission_persistence import MissionPersistenceError
from backend.analysis.mission_supabase import SupabaseMissionRepository, _error_code


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
