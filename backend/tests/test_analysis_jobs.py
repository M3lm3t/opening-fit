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
    assert called[0][:4] == ("lichess", "ExamplePlayer", 2, "rapid")
    assert callable(called[0][4])


def test_analysis_job_publishes_only_real_stage_updates(monkeypatch):
    monkeypatch.setattr(main.analysis_job_executor, "submit", lambda *_args: None)
    started = main.start_analysis_job(main.AnalysisJobRequest(platform="chesscom", username="Player", months=1))

    def run(_platform, _username, _months, _time_control, progress):
        progress("requesting_public_games")
        progress("games_found", fetchedGames=310)
        progress("filtering_eligible_games", fetchedGames=310)
        progress("identifying_openings", fetchedGames=310, eligibleGames=180, analysedGames=160)
        progress("building_recommendations", fetchedGames=310, eligibleGames=180, analysedGames=160)
        return {"gameCounts": {"fetchedGames": 310, "timeControlEligibleGames": 180, "analysedGames": 160}}

    monkeypatch.setattr(main, "run_import_route", run)
    main.execute_analysis_job(started["jobId"])
    completed = main.get_analysis_job(main.UUID(started["jobId"]))
    assert completed["progress"]["stage"] == "finishing_report"
    assert completed["progress"]["counts"] == {"fetchedGames": 310, "eligibleGames": 180, "analysedGames": 160}
    assert completed["progress"]["elapsedSeconds"] >= 0
    assert completed["progress"]["lastUpdatedAt"]


def test_analysis_progress_drops_unrecognised_and_sensitive_counts(monkeypatch):
    monkeypatch.setattr(main.analysis_job_executor, "submit", lambda *_args: None)
    started = main.start_analysis_job(main.AnalysisJobRequest(platform="lichess", username="Player", months=1))
    main.update_analysis_job_progress(
        started["jobId"],
        "requesting_public_games",
        fetchedGames=12,
        archivesProcessed=1,
        archivesTotal=3,
        processedGames=7,
        username="Player",
        pgn="1. e4",
    )
    current = main.get_analysis_job(main.UUID(started["jobId"]))
    assert current["progress"]["stage"] == "requesting_public_games"
    assert current["progress"]["counts"] == {
            "fetchedGames": 12,
            "archivesProcessed": 1,
            "archivesTotal": 3,
            "processedGames": 7,
    }
    assert "username" not in current["progress"]["counts"]
    assert "pgn" not in current["progress"]["counts"]


def test_analysis_progress_publishes_excluded_counts_without_sensitive_rows(monkeypatch):
    monkeypatch.setattr(main.analysis_job_executor, "submit", lambda *_args: None)
    started = main.start_analysis_job(main.AnalysisJobRequest(platform="chesscom", username="Player", months=1))
    main.update_analysis_job_progress(started["jobId"], "building_recommendations", fetchedGames=311, analysedGames=280, excludedGames=31)
    current = main.get_analysis_job(main.UUID(started["jobId"]))
    assert current["progress"]["counts"] == {"fetchedGames": 311, "analysedGames": 280, "excludedGames": 31}


def test_month_and_time_control_choices_are_part_of_the_job_identity(monkeypatch):
    monkeypatch.setattr(main.analysis_job_executor, "submit", lambda *_args: None)
    one_month = main.start_analysis_job(main.AnalysisJobRequest(platform="chesscom", username="Player", months=1, time_control="blitz"))
    three_month = main.start_analysis_job(main.AnalysisJobRequest(platform="chesscom", username="Player", months=3, time_control="blitz"))
    rapid = main.start_analysis_job(main.AnalysisJobRequest(platform="chesscom", username="Player", months=1, time_control="rapid"))
    assert len({one_month["jobId"], three_month["jobId"], rapid["jobId"]}) == 3


def test_chesscom_archive_progress_uses_completed_archives_and_cumulative_games(monkeypatch):
    events = []
    monkeypatch.setattr(main, "log_analytics_event", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(main, "validate_player", lambda username: {"username": username, "url": "https://example.test/player"})
    monkeypatch.setattr(main, "fetch_chesscom_stats", lambda _username: {})
    monkeypatch.setattr(main, "fetch_archives", lambda _username: ["2026/01", "2026/02", "2026/03"])
    monkeypatch.setattr(main, "fetch_games_from_archive", lambda archive: [{"white": {"username": "Player"}, "black": {"username": "Other"}, "archive": archive}])
    monkeypatch.setattr(main, "filter_games_by_time_control", lambda games, *_args: (games, 0))
    monkeypatch.setattr(main, "deduplicate_games", lambda games, *_args: (games, 0))
    monkeypatch.setattr(main, "split_usable_games", lambda *_args: ([], {}))

    main.import_chesscom_logic("Player", months=3, progress=lambda stage, **counts: events.append((stage, counts)))

    archive_events = [counts for stage, counts in events if stage == "requesting_public_games" and "archivesTotal" in counts]
    assert archive_events == [
        {"archivesProcessed": 0, "archivesTotal": 3, "fetchedGames": 0},
        {"archivesProcessed": 1, "archivesTotal": 3, "fetchedGames": 1},
        {"archivesProcessed": 2, "archivesTotal": 3, "fetchedGames": 2},
        {"archivesProcessed": 3, "archivesTotal": 3, "fetchedGames": 3},
    ]


def test_chesscom_partial_archive_failure_is_retryable_and_never_builds_a_partial_report(monkeypatch):
    events = []
    monkeypatch.setattr(main, "log_analytics_event", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(main, "validate_player", lambda username: {"username": username})
    monkeypatch.setattr(main, "fetch_chesscom_stats", lambda _username: {})
    monkeypatch.setattr(main, "fetch_archives", lambda _username: ["2026/01", "2026/02"])

    def fetch(archive):
        if archive.endswith("02"):
            raise HTTPException(status_code=404, detail="Archive unavailable")
        return [{"white": {"username": "Player"}, "black": {"username": "Other"}}]

    monkeypatch.setattr(main, "fetch_games_from_archive", fetch)

    with pytest.raises(HTTPException) as error:
        main.import_chesscom_logic("Player", months=2, progress=lambda stage, **counts: events.append((stage, counts)))

    assert error.value.status_code == 502
    assert "No partial report was created" in str(error.value.detail)
    assert not any(stage == "games_found" for stage, _counts in events)


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
