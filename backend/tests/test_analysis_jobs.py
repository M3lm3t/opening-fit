import time
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

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


def test_mission_failure_cannot_fail_authenticated_analysis(monkeypatch):
    allowed = "11111111-1111-4111-8111-111111111111"
    job_id = str(main.uuid4())
    with main.analysis_jobs_lock:
        main.analysis_jobs[job_id] = {
            "jobId": job_id, "requestKey": f"{allowed}:lichess:player:1:rapid", "status": "queued",
            "platform": "lichess", "username": "Player", "months": 1, "timeControl": "rapid",
            "ownerUserId": allowed, "createdAt": main.now_iso(), "updatedAt": main.now_iso(),
            "result": None, "error": None, "progress": {"stage": "queued", "counts": {}},
        }
    report = {"gameCounts": {"fetchedGames": 1}, "opening_games": [{"pgn": "sensitive"}]}
    monkeypatch.setattr(main, "run_import_route", lambda *_args: report)
    monkeypatch.setattr(main, "missions_enabled", lambda *_args: True)
    monkeypatch.setenv("OPENINGFIT_MISSIONS_INTERNAL_USER_ID", allowed)
    monkeypatch.setattr(main, "missions_schema_readiness", lambda: {"ready": True})
    monkeypatch.setattr(main, "mission_repository", lambda: object())
    monkeypatch.setattr(main, "process_completed_analysis", lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("storage secret")))
    main.execute_analysis_job(job_id)
    assert main.analysis_jobs[job_id]["status"] == "completed"
    assert main.analysis_jobs[job_id]["result"] is not None
    assert main.analysis_jobs[job_id]["result"]["missionProcessing"] == {
        "status": "unavailable", "reasonCode": "persistence_failed",
    }
    assert main.analysis_jobs[job_id]["missionOutcome"] == {
        "outcome": "failed", "reasonCode": "persistence_failed", "candidateCount": 0, "assignedCount": 0,
    }


def test_authenticated_async_job_runs_mission_processing_after_success(monkeypatch, caplog):
    allowed = "11111111-1111-4111-8111-111111111111"
    submitted = []
    monkeypatch.setattr(main.analysis_job_executor, "submit", lambda function, job_id: submitted.append((function, job_id)))
    monkeypatch.setattr(main, "get_auth_user", lambda _request: type("User", (), {"id": allowed})())
    monkeypatch.setattr(main, "trusted_entitlement_for_request", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(main, "enforce_game_history_limit", lambda _request, months: months)
    monkeypatch.setattr(main, "run_import_route", lambda *_args: {"reportId": "report-1", "opening_games": []})
    monkeypatch.setattr(main, "missions_enabled", lambda *_args: True)
    monkeypatch.setattr(main, "missions_schema_readiness", lambda: {"ready": True})
    monkeypatch.setattr(main, "_mission_rollout", lambda *_args: {"eligible": True})
    repository = object()
    monkeypatch.setattr(main, "mission_repository", lambda: repository)
    calls = []
    monkeypatch.setattr(main, "process_completed_analysis", lambda **kwargs: calls.append(kwargs) or {"encounters": 0, "candidates": 1, "assigned": 1})

    with caplog.at_level("INFO"):
        response = TestClient(main.app).post(
            "/api/analysis/jobs",
            headers={"Authorization": "Bearer opaque-test-token"},
            json={"platform": "lichess", "username": "ExamplePlayer", "months": 2, "time_control": "rapid"},
        )
        assert response.status_code == 202
        submitted[0][0](submitted[0][1])

    job = main.analysis_jobs[response.json()["jobId"]]
    assert job["status"] == "completed"
    assert job["ownerUserId"] == allowed
    assert calls[0]["user_id"] == allowed
    assert calls[0]["report"]["reportId"] == "report-1"
    assert job["result"]["missionProcessing"]["assigned"] == 1
    owner_payload = TestClient(main.app).get(
        f"/api/analysis/jobs/{response.json()['jobId']}", headers={"Authorization": "Bearer opaque-test-token"},
    ).json()
    assert owner_payload["missionOutcome"] == {
        "outcome": "created_assigned", "reasonCode": "none", "candidateCount": 1, "assignedCount": 1,
    }
    assert owner_payload["result"]["missionOutcome"] == owner_payload["missionOutcome"]
    assert "outcome=created_assigned" in caplog.text
    assert allowed not in caplog.text


@pytest.mark.parametrize(
    ("enabled", "eligible", "expected_reason"),
    [(False, False, "missions_disabled"), (True, False, "rollout_unavailable")],
)
def test_async_job_skips_disabled_and_ineligible_users(monkeypatch, enabled, eligible, expected_reason, caplog):
    job_id = str(main.uuid4())
    with main.analysis_jobs_lock:
        main.analysis_jobs[job_id] = {
            "jobId": job_id, "requestKey": "opaque:lichess:player:1:rapid", "status": "queued",
            "platform": "lichess", "username": "Player", "months": 1, "timeControl": "rapid",
            "ownerUserId": "22222222-2222-4222-8222-222222222222", "createdAt": main.now_iso(),
            "updatedAt": main.now_iso(), "result": None, "error": None, "progress": {"stage": "queued", "counts": {}},
        }
    monkeypatch.setattr(main, "run_import_route", lambda *_args: {"gamesImported": 1})
    monkeypatch.setattr(main, "missions_enabled", lambda *_args: enabled)
    monkeypatch.setattr(main, "missions_schema_readiness", lambda: {"ready": True})
    monkeypatch.setattr(main, "_mission_rollout", lambda *_args: {"eligible": eligible, "reasonCode": "rollout_unavailable"})
    monkeypatch.setattr(main, "process_completed_analysis", lambda **_kwargs: (_ for _ in ()).throw(AssertionError("must not run")))
    with caplog.at_level("INFO"):
        main.execute_analysis_job(job_id)
    assert main.analysis_jobs[job_id]["status"] == "completed"
    assert main.analysis_jobs[job_id]["result"]["missionProcessing"] == {"status": "skipped", "reasonCode": expected_reason}
    assert main.analysis_jobs[job_id]["missionOutcome"]["outcome"] == ("disabled" if not enabled else "ineligible")
    assert f"reason={expected_reason}" in caplog.text


def test_async_job_logs_no_candidate_and_completed_job_dedupe(monkeypatch, caplog):
    allowed = "11111111-1111-4111-8111-111111111111"
    job_id = str(main.uuid4())
    with main.analysis_jobs_lock:
        main.analysis_jobs[job_id] = {
            "jobId": job_id, "requestKey": f"{allowed}:lichess:player:1:rapid", "status": "queued",
            "platform": "lichess", "username": "Player", "months": 1, "timeControl": "rapid",
            "ownerUserId": allowed, "createdAt": main.now_iso(), "updatedAt": main.now_iso(), "createdMonotonic": time.monotonic(),
            "result": None, "error": None, "progress": {"stage": "queued", "counts": {}},
        }
        main.analysis_job_keys[f"{allowed}:lichess:player:1:rapid"] = job_id
    monkeypatch.setattr(main, "run_import_route", lambda *_args: {"gamesImported": 1})
    monkeypatch.setattr(main, "missions_enabled", lambda *_args: True)
    monkeypatch.setattr(main, "missions_schema_readiness", lambda: {"ready": True})
    monkeypatch.setattr(main, "_mission_rollout", lambda *_args: {"eligible": True})
    monkeypatch.setattr(main, "mission_repository", lambda: object())
    monkeypatch.setattr(main, "process_completed_analysis", lambda **_kwargs: {"encounters": 0, "candidates": 0, "assigned": 0})
    monkeypatch.setattr(main, "get_auth_user", lambda _request: type("User", (), {"id": allowed})())
    monkeypatch.setattr(main, "trusted_entitlement_for_request", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(main, "enforce_game_history_limit", lambda _request, months: months)
    monkeypatch.setattr(main.analysis_job_executor, "submit", lambda *_args: None)
    with caplog.at_level("INFO"):
        main.execute_analysis_job(job_id)
        main.start_analysis_job(main.AnalysisJobRequest(platform="lichess", username="Player", months=1, time_control="rapid"),
                                request=type("Request", (), {"headers": {"authorization": "Bearer token"}})())
    assert "outcome=no_eligible_candidate" in caplog.text
    assert "outcome=already_processed" in caplog.text


@pytest.mark.parametrize(
    ("enabled", "eligible", "processing", "expected"),
    [
        (True, True, {"encounters": 0, "candidates": 1, "assigned": 1}, "created_assigned"),
        (True, True, {"encounters": 0, "candidates": 1, "assigned": 0}, "created"),
        (True, True, {"encounters": 0, "candidates": 0, "assigned": 0}, "no_eligible_candidate"),
        (False, False, None, "disabled"),
        (True, False, None, "ineligible"),
        (True, True, RuntimeError("bounded failure"), "failed"),
    ],
)
def test_real_post_worker_get_exposes_every_bounded_owner_outcome(monkeypatch, enabled, eligible, processing, expected):
    owner = "11111111-1111-4111-8111-111111111111"
    submitted = []
    monkeypatch.setattr(main.analysis_job_executor, "submit", lambda function, job_id: submitted.append((function, job_id)))
    monkeypatch.setattr(main, "get_auth_user", lambda _request: type("User", (), {"id": owner})())
    monkeypatch.setattr(main, "trusted_entitlement_for_request", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(main, "enforce_game_history_limit", lambda _request, months: months)
    monkeypatch.setattr(main, "run_import_route", lambda *_args: {"reportId": "report-1", "opening_games": []})
    monkeypatch.setattr(main, "missions_enabled", lambda *_args: enabled)
    monkeypatch.setattr(main, "missions_schema_readiness", lambda: {"ready": True})
    monkeypatch.setattr(main, "_mission_rollout", lambda *_args: {"eligible": eligible, "reasonCode": "rollout_unavailable"})
    monkeypatch.setattr(main, "mission_repository", lambda: object())

    def process(**_kwargs):
        if isinstance(processing, Exception):
            raise processing
        return processing

    monkeypatch.setattr(main, "process_completed_analysis", process)
    client = TestClient(main.app)
    started = client.post(
        "/api/analysis/jobs", headers={"Authorization": "Bearer opaque-test-token"},
        json={"platform": "lichess", "username": "Player", "months": 1, "time_control": "rapid"},
    )
    assert started.status_code == 202
    submitted[0][0](submitted[0][1])
    completed = client.get(
        f"/api/analysis/jobs/{started.json()['jobId']}", headers={"Authorization": "Bearer opaque-test-token"},
    )
    assert completed.status_code == 200
    outcome = completed.json()["missionOutcome"]
    assert outcome["outcome"] == expected
    assert set(outcome) == {"outcome", "reasonCode", "candidateCount", "assignedCount"}
    assert 0 <= outcome["candidateCount"] <= main.MISSION_OUTCOME_COUNT_LIMIT
    assert 0 <= outcome["assignedCount"] <= main.MISSION_OUTCOME_COUNT_LIMIT


def test_anonymous_job_does_not_expose_diagnostics_and_non_owner_is_denied(monkeypatch):
    monkeypatch.setattr(main.analysis_job_executor, "submit", lambda *_args: None)
    monkeypatch.setattr(main, "run_import_route", lambda *_args: {"gamesImported": 1})
    anonymous = main.start_analysis_job(main.AnalysisJobRequest(platform="lichess", username="Guest", months=1))
    main.execute_analysis_job(anonymous["jobId"])
    anonymous_payload = main.get_analysis_job(main.UUID(anonymous["jobId"]))
    assert "missionOutcome" not in anonymous_payload
    assert "missionOutcome" not in anonymous_payload.get("result", {})

    owner = "11111111-1111-4111-8111-111111111111"
    job_id = str(main.uuid4())
    with main.analysis_jobs_lock:
        main.analysis_jobs[job_id] = {
            "jobId": job_id, "requestKey": "owned", "status": "completed", "platform": "lichess",
            "username": "Player", "months": 1, "timeControl": "rapid", "ownerUserId": owner,
            "createdAt": main.now_iso(), "updatedAt": main.now_iso(), "result": {}, "error": None,
            "missionOutcome": main.bounded_mission_outcome("created", "none", candidates=1),
            "progress": {"stage": "complete", "counts": {}}, "finishedMonotonic": time.monotonic(),
        }
    monkeypatch.setattr(main, "get_auth_user", lambda _request: type("User", (), {"id": "different-owner"})())
    with pytest.raises(HTTPException) as denied:
        main.get_analysis_job(main.UUID(job_id), request=type("Request", (), {"headers": {}})())
    assert denied.value.status_code == 403


def test_mission_outcomes_use_uvicorn_logger_and_bound_untrusted_values():
    assert main.mission_outcome_logger.name == "uvicorn.error"
    outcome = main.bounded_mission_outcome("unexpected", "UPSTREAM value with spaces/and punctuation", candidates=1000, assigned=-3)
    assert outcome == {
        "outcome": "failed", "reasonCode": "upstream_value_with_spaces_and_punctuation",
        "candidateCount": 100, "assignedCount": 0,
    }


def test_non_allowlisted_analysis_creates_no_mission_state(monkeypatch):
    job_id = str(main.uuid4())
    with main.analysis_jobs_lock:
        main.analysis_jobs[job_id] = {
            "jobId": job_id, "requestKey": "excluded:lichess:player:1:rapid", "status": "queued",
            "platform": "lichess", "username": "Player", "months": 1, "timeControl": "rapid",
            "ownerUserId": "22222222-2222-4222-8222-222222222222", "createdAt": main.now_iso(), "updatedAt": main.now_iso(),
            "result": None, "error": None, "progress": {"stage": "queued", "counts": {}},
        }
    monkeypatch.setattr(main, "run_import_route", lambda *_args: {"gamesImported": 1})
    monkeypatch.setattr(main, "missions_enabled", lambda *_args: True)
    monkeypatch.setenv("OPENINGFIT_MISSIONS_INTERNAL_USER_ID", "11111111-1111-4111-8111-111111111111")
    monkeypatch.setenv("OPENINGFIT_MISSIONS_ROLLOUT_PERCENT", "0")
    monkeypatch.setattr(main, "missions_schema_readiness", lambda: {"ready": True})
    monkeypatch.setattr(main, "mission_repository", lambda: (_ for _ in ()).throw(AssertionError("Mission repository touched")))
    monkeypatch.setattr(main, "process_completed_analysis", lambda **_kwargs: (_ for _ in ()).throw(AssertionError("Mission processing ran")))
    main.execute_analysis_job(job_id)
    assert main.analysis_jobs[job_id]["status"] == "completed"


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


def test_homepage_job_serializes_two_d4_nimzo_games_only_under_d4(monkeypatch):
    monkeypatch.setattr(main.analysis_job_executor, "submit", lambda *_args: None)
    monkeypatch.setattr(main, "previous_saved_report", lambda *_args: None)
    monkeypatch.setattr(main, "save_user_profile", lambda username, _payload: {
        "username": username, "lastUpdated": "2026-08-04T12:00:00Z", "importHistory": [], "isPremium": False,
    })
    monkeypatch.setattr(main, "log_analytics_event", lambda *_args, **_kwargs: None)

    def game(game_id):
        return {
            "id": game_id,
            "moves": "d4 Nf6 c4 e6 Nc3 Bb4 e3 O-O",
            "opening": {"name": "Nimzo-Indian Defense"},
            "players": {
                "white": {"user": {"name": "Opponent"}, "rating": 1500},
                "black": {"user": {"name": "ContractPlayer"}, "rating": 1500},
            },
            "winner": "white", "speed": "rapid", "lastMoveAt": 1_700_000_000_000 + int(game_id),
        }

    monkeypatch.setattr(
        main,
        "run_import_route",
        lambda *_args: main.build_lichess_analysis("contractplayer", [game("11"), game("12")], 1),
    )
    started = main.start_analysis_job(main.AnalysisJobRequest(platform="lichess", username="ContractPlayer", months=1))
    main.execute_analysis_job(started["jobId"])
    payload = main.get_analysis_job(main.UUID(started["jobId"]))["result"]
    roles = {row["repertoireRole"]: row for row in payload["reportDecision"]["roleDecisions"]}
    recommendations = payload["reportDecision"]["recommendations"]

    assert roles["black_vs_e4"]["status"] == "insufficient"
    assert roles["black_vs_e4"]["currentOpening"] is None
    assert roles["black_vs_d4"]["relevantGameCount"] == 2
    assert all(row["repertoireRole"] != "black_vs_e4" for row in recommendations if row["openingName"] == "Nimzo-Indian Defence")
    assert {row["firstWhiteMove"] for row in payload["analysis_game_index"]} == {"d4"}
    assert all(row["playerColour"] == "black" and row["relationship"] == "played_by_user" for row in payload["analysis_game_index"])


def test_raw_e4_games_with_external_nimzo_metadata_never_create_a_nimzo_context(monkeypatch):
    monkeypatch.setattr(main, "previous_saved_report", lambda *_args: None)
    monkeypatch.setattr(main, "save_user_profile", lambda username, _payload: {
        "username": username, "lastUpdated": "2026-08-04T12:00:00Z", "importHistory": [], "isPremium": False,
    })
    monkeypatch.setattr(main, "log_analytics_event", lambda *_args, **_kwargs: None)
    def game(game_id, moves):
        return {
            "id": game_id, "moves": moves,
            "opening": {"name": "Nimzo-Indian Defense", "eco": "B00"},
            "players": {
                "white": {"user": {"name": "Opponent"}, "rating": 1500},
                "black": {"user": {"name": "ContractPlayer"}, "rating": 1500},
            },
            "winner": "white", "speed": "rapid", "lastMoveAt": 1_700_000_000_000 + int(game_id),
        }

    report = main.build_lichess_analysis("contractplayer", [
        game("21", "e4 e5 d4 Nc6 d5 Nd4 c3 Bc5 Nf3 d6 cxd4 exd4"),
        game("22", "e4 e5 d4 Nc6 d5 Nce7 Nf3 h6 c4 d6 Nc3 Nf6"),
    ], 1)
    games = report["analysis_game_index"]
    recommendations = (report.get("reportDecision") or {}).get("recommendations") or []

    assert all(row["openingFamily"] != "Nimzo-Indian Defence" for row in games)
    assert all(row["classificationConflictReason"] in {"metadata_without_move_rule", "metadata_conflicts_with_move_rule"} for row in games)
    assert not any(row.get("openingName") == "Nimzo-Indian Defence" for row in recommendations)


def test_compact_serializer_rejects_malformed_legacy_black_e4_claim():
    game = {
        "gameId": "d4-1", "url": "https://example.test/d4-1", "playerColour": "black",
        "relationship": "played_by_user", "firstWhiteMove": "d4", "opening": "Nimzo-Indian Defence",
    }
    illegal = {
        "repertoireRole": "black_vs_e4", "openingName": "Nimzo-Indian Defence", "currentOpening": "Nimzo-Indian Defence",
        "supportingGameCount": 1, "evidenceGameIds": ["d4-1"], "status": "building",
    }
    compact = main.compact_analysis_result({
        "opening_games": [game],
        "reportDecision": {"schemaVersion": 5, "repertoireRoles": [illegal], "recommendations": [{**illegal, "sample": {"games": 1, "gameIds": ["d4-1"]}}]},
    })

    role = compact["reportDecision"]["repertoireRoles"][0]
    assert role["currentOpening"] is None
    assert role["status"] == "insufficient"
    assert role["validation"] == {"valid": False, "reason": "unverifiable_role_context"}
    assert compact["reportDecision"]["recommendations"] == []
