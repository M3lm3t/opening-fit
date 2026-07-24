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
        main.AnalysisJobRequest(platform="lichess", username="ExamplePlayer", months=2, time_control="rapid")
    )
    called = []
    monkeypatch.setattr(main, "run_import_route", lambda *args: called.append(args) or {"gamesImported": 12})

    main.execute_analysis_job(started["jobId"])
    completed = main.get_analysis_job(main.UUID(started["jobId"]))

    assert completed["status"] == "completed"
    assert completed["result"] == {"gamesImported": 12}
    assert called == [("lichess", "ExamplePlayer", 2, "rapid")]


def test_month_and_time_control_choices_are_part_of_the_job_identity(monkeypatch):
    monkeypatch.setattr(main.analysis_job_executor, "submit", lambda *_args: None)
    one_month = main.start_analysis_job(main.AnalysisJobRequest(platform="chesscom", username="Player", months=1, time_control="blitz"))
    three_month = main.start_analysis_job(main.AnalysisJobRequest(platform="chesscom", username="Player", months=3, time_control="blitz"))
    rapid = main.start_analysis_job(main.AnalysisJobRequest(platform="chesscom", username="Player", months=1, time_control="rapid"))
    assert len({one_month["jobId"], three_month["jobId"], rapid["jobId"]}) == 3


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


def test_compact_analysis_result_bounds_evidence_and_removes_large_aliases():
    games = [
        {
            "url": f"https://example.test/{index}",
            "end_time": index,
            "opening": "Test Opening",
            "pgn": "1. e4 e5 " * 100,
            "moves": ["e4", "e5"],
            "movesText": "e4 e5",
            "timeClass": "rapid",
        }
        for index in range(120)
    ]
    variations = [{"name": f"Line {index}", "games": index} for index in range(140)]
    source = {
        "opening_games": games,
        "openingGames": games,
        "opening_fit_metrics": {"variations": variations},
        "openingFitMetrics": {"variations": variations},
        "opening_recommendations": {"white": ["Italian Game"]},
        "openingRecommendations": {"white": ["Italian Game"]},
        "recommendedOpenings": {"white": ["Italian Game"]},
    }

    compact = main.compact_analysis_result(source)

    assert len(compact["opening_games"]) == main.ANALYSIS_EVIDENCE_GAME_LIMIT
    assert compact["opening_games"][0]["end_time"] == 119
    assert "movesText" not in compact["opening_games"][0]
    assert "openingGames" not in compact
    assert len(compact["opening_fit_metrics"]["variations"]) == main.ANALYSIS_VARIATION_LIMIT
    assert "openingFitMetrics" not in compact
    assert "openingRecommendations" not in compact
    assert "recommendedOpenings" not in compact
