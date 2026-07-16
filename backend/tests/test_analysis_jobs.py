import time
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


@pytest.fixture(autouse=True)
def clear_analysis_jobs():
    with main.analysis_jobs_lock:
        main.analysis_jobs.clear()
        main.analysis_job_keys.clear()
    yield
    with main.analysis_jobs_lock:
        main.analysis_jobs.clear()
        main.analysis_job_keys.clear()


def test_start_analysis_job_deduplicates_active_request(monkeypatch):
    submitted = []
    monkeypatch.setattr(main.analysis_job_executor, "submit", lambda function, job_id: submitted.append((function, job_id)))
    request = main.AnalysisJobRequest(platform="chesscom", username="ExamplePlayer", months=3)

    first = main.start_analysis_job(request)
    second = main.start_analysis_job(request)

    assert first["jobId"] == second["jobId"]
    assert first["deduplicated"] is False
    assert second["deduplicated"] is True
    assert len(submitted) == 1


def test_execute_analysis_job_publishes_completed_result(monkeypatch):
    monkeypatch.setattr(main.analysis_job_executor, "submit", lambda *_args: None)
    started = main.start_analysis_job(
        main.AnalysisJobRequest(platform="lichess", username="ExamplePlayer", months=2)
    )
    monkeypatch.setattr(main, "run_import_route", lambda *_args: {"gamesImported": 12})

    main.execute_analysis_job(started["jobId"])
    completed = main.get_analysis_job(main.UUID(started["jobId"]))

    assert completed["status"] == "completed"
    assert completed["result"] == {"gamesImported": 12}


def test_expired_analysis_job_is_removed(monkeypatch):
    monkeypatch.setattr(main.analysis_job_executor, "submit", lambda *_args: None)
    started = main.start_analysis_job(
        main.AnalysisJobRequest(platform="lichess", username="OldPlayer", months=1)
    )
    with main.analysis_jobs_lock:
        main.analysis_jobs[started["jobId"]].update(
            status="completed",
            result={},
            finishedMonotonic=time.monotonic() - main.ANALYSIS_JOB_TTL_SECONDS - 1,
        )

    with pytest.raises(HTTPException) as error:
        main.get_analysis_job(main.UUID(started["jobId"]))

    assert error.value.status_code == 404
