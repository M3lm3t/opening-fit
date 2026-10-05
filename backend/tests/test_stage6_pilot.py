"""Delta coverage for account admission and the web report-only contract."""
import pytest
import main
from report_rollout import STAGE6
from backend.tests.test_stage6_isolation import A, B, CAPS, contract, headers, start


@pytest.mark.parametrize("membership", [[], [{"user_id": A, "enabled": False}]])
def test_empty_or_disabled_allowlist_denies_all_v2_paths_but_not_legacy(contract, membership):
    client, db = contract
    job = start(client).json()
    db.rows["openingfit_report_pilot_accounts"] = membership
    assert start(client).status_code == 403
    assert client.get(f"/api/v2/analysis/jobs/{job['jobId']}", headers=headers()).status_code == 403
    assert client.post("/api/v2/report-store/query", headers=headers(), json={"capabilities": CAPS, "collection": "report_history"}).status_code == 403
    assert client.get("/api/report-pilot", headers=headers()).json()["allowed"] is False
    assert start(client, new=False).status_code == 202


def test_identity_and_explicit_web_contract_cannot_be_replaced_by_capabilities(contract):
    client, db = contract
    db.rows["openingfit_report_pilot_accounts"] = [{"user_id": A, "enabled": True}]
    assert start(client, owner=B).status_code == 403
    android = {"Authorization": f"Bearer {A}"}
    for claimed in [android, {**headers(), "X-OpeningFit-Report-Client": "android-22"}]:
        assert client.post("/api/v2/analysis/jobs", headers=claimed,
            json={"platform": "lichess", "username": "Player", "capabilities": CAPS}).status_code == 403
        assert client.get("/api/report-pilot", headers=claimed).status_code == 403
    assert client.get("/api/report-pilot", headers={"X-OpeningFit-Report-Client": "web-report-pilot-v1"}).status_code == 401
    old = client.post("/api/analysis/jobs", headers=android, json={"platform": "lichess", "username": "Player"})
    assert old.status_code == 202 and old.json()["generation"] == "legacy_v1"
    allowed = client.get("/api/report-pilot", headers=headers()).json()
    assert allowed == {"allowed": True, "creationEnabled": True, "scope": "reports-only", "userId": A}


def test_allowlist_revocation_before_worker_and_before_persistence_fails_closed(contract, monkeypatch):
    client, db = contract
    job = start(client).json()
    db.rows["openingfit_report_pilot_accounts"] = []
    monkeypatch.setattr(main, "run_import_route", lambda *_: pytest.fail("revoked worker generated"))
    main.execute_analysis_job(job["jobId"])
    assert main.analysis_jobs[job["jobId"]]["generation"] == STAGE6
    assert main.analysis_jobs[job["jobId"]]["error"]["status"] == 403
    db.rows["openingfit_report_pilot_accounts"] = [{"user_id": A, "enabled": True}]
    retry = start(client).json()
    def revoke_while_running(*_):
        db.rows["openingfit_report_pilot_accounts"] = []
        return {"gamesImported": 12, "repertoireHealth": {"version": "repertoire_health_v4"}}
    monkeypatch.setattr(main, "run_import_route", revoke_while_running)
    main.execute_analysis_job(retry["jobId"])
    assert main.analysis_jobs[retry["jobId"]]["status"] == "failed"
    assert not db.writes


@pytest.mark.parametrize("collection", ["repertoire", "weekly_training_plans", "coaching_response_plans"])
def test_report_derived_mutations_fail_without_saved_state(contract, collection):
    client, db = contract
    response = client.post("/api/v2/report-store/query", headers=headers(), json={"capabilities": CAPS,
        "collection": collection, "operation": "upsert", "values": {"user_id": A, "score": 83}})
    assert response.status_code == 409 and "report import and reading only" in response.json()["detail"]
    assert not db.writes


def test_new_mission_actions_are_blocked_before_repository_access(contract, monkeypatch):
    client, _ = contract
    monkeypatch.setattr(main, "mission_repository", lambda: pytest.fail("pilot reached mission persistence"))
    response = client.post("/api/v1/missions/select-next", headers=headers(), json={"idempotencyKey": "pilot-test"})
    assert response.status_code == 409 and response.json()["detail"]["code"] == "report_only_pilot"


def test_rollback_leaves_account_reader_eligible_but_creation_disabled(contract, monkeypatch):
    client, db = contract
    for backend, database in [("false", True), ("true", False)]:
        monkeypatch.setenv("OPENINGFIT_STAGE6_REPORTS_ENABLED", backend)
        db.rows["openingfit_report_rollout"][0]["enabled"] = database
        state = client.get("/api/report-pilot", headers=headers()).json()
        assert state["allowed"] is True and state["creationEnabled"] is False
        assert start(client).status_code == 503
