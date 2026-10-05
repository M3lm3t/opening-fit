"""Bounded report contract tests. No platform, production or auth network calls."""
from copy import deepcopy
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
import main
from legacy_reports.adapter import bind
from report_rollout import CAPABILITIES, LEGACY, STAGE6, generation_context, contains_new_report

A = "11111111-1111-4111-8111-111111111111"
B = "22222222-2222-4222-8222-222222222222"
CAPS = sorted(CAPABILITIES)


class MemoryDB:
    def __init__(self):
        self.rows = {"openingfit_report_rollout": [{"id": 1, "enabled": True}],
            "report_history": [{"id": "legacy-a", "user_id": A, "report": {"repertoireHealth": {"version": "repertoire_health_v3", "score": 61}}},
                               {"id": "legacy-b", "user_id": B, "report": {"repertoireHealth": {"version": "repertoire_health_v3", "score": 72}}}]}
        self.writes = []

    def table(self, table):
        db = self
        class Query:
            def __init__(self): self.filters = []; self.value = None
            def select(self, *_args): return self
            def eq(self, key, value): self.filters.append((key, value)); return self
            def limit(self, *_args): return self
            def upsert(self, value, **_kwargs): self.value = value; return self
            def execute(self):
                rows = db.rows.setdefault(table, [])
                if self.value is not None:
                    db.writes.append(table)
                    key = lambda r: (r.get("user_id"), r.get("collection"), r.get("row_key"))
                    rows[:] = [row for row in rows if key(row) != key(self.value)] + [deepcopy(self.value)]
                    return SimpleNamespace(data=[deepcopy(self.value)])
                return SimpleNamespace(data=deepcopy([row for row in rows if all(row.get(k) == v for k, v in self.filters)]))
        return Query()


@pytest.fixture
def contract(monkeypatch):
    db = MemoryDB()
    monkeypatch.setenv("OPENINGFIT_STAGE6_REPORTS_ENABLED", "true")
    monkeypatch.setattr(main, "get_supabase_admin_client", lambda: db)
    def auth(request):
        token = request.headers.get("authorization", "") if request else ""
        if token not in {f"Bearer {A}", f"Bearer {B}"}: raise HTTPException(401, "Sign in.")
        return SimpleNamespace(id=token.split()[1])
    monkeypatch.setattr(main, "get_auth_user", auth)
    monkeypatch.setattr(main, "trusted_entitlement_for_request", lambda *_a, **_k: None)
    monkeypatch.setattr(main, "enforce_game_history_limit", lambda _r, months: months)
    monkeypatch.setattr(main.analysis_job_executor, "submit", lambda *_a: None)
    main.analysis_jobs.clear(); main.analysis_job_keys.clear()
    yield TestClient(main.app), db
    main.analysis_jobs.clear(); main.analysis_job_keys.clear()


def headers(owner=A):
    return {"Authorization": f"Bearer {owner}", "X-OpeningFit-Report-Capabilities": ",".join(CAPS)}


def start(client, new=True, owner=A, capabilities=CAPS):
    return client.post("/api/v2/analysis/jobs" if new else "/api/analysis/jobs", headers=headers(owner),
        json={"platform": "lichess", "username": "Player", "months": 1, "capabilities": capabilities})


@pytest.mark.parametrize("capabilities", [[], CAPS[:-1], CAPS + ["unknown"]])
def test_missing_incomplete_unknown_capabilities_cannot_queue(contract, capabilities):
    client, _ = contract
    assert start(client, capabilities=capabilities).status_code == 409
    assert not main.analysis_jobs


def test_default_off_and_database_switch_both_required(contract, monkeypatch):
    client, db = contract
    monkeypatch.delenv("OPENINGFIT_STAGE6_REPORTS_ENABLED")
    assert start(client).status_code == 503
    assert start(client, new=False).status_code == 202
    monkeypatch.setenv("OPENINGFIT_STAGE6_REPORTS_ENABLED", "true")
    db.rows["openingfit_report_rollout"][0]["enabled"] = False
    assert start(client).status_code == 503
    assert client.post("/api/v2/analysis/jobs", json={"platform": "lichess", "username": "Player", "capabilities": CAPS}).status_code == 401


def test_jobs_never_cross_generations_owners_or_polling_routes(contract, monkeypatch):
    client, db = contract
    old, new = start(client, False).json(), start(client).json()
    assert old["jobId"] != new["jobId"]
    assert start(client).json()["jobId"] == new["jobId"]
    assert start(client, False).json()["jobId"] == old["jobId"]
    seen = []
    def generate(*_args):
        seen.append(generation_context.get())
        version = "repertoire_health_v4" if seen[-1] == STAGE6 else "repertoire_health_v3"
        return {"gamesImported": 12, "repertoireHealth": {"version": version, "score": 61}}
    monkeypatch.setattr(main, "run_import_route", generate)
    monkeypatch.setattr(main, "missions_enabled", lambda: False)
    main.execute_analysis_job(old["jobId"]); main.execute_analysis_job(new["jobId"])
    assert seen == [LEGACY, STAGE6]
    assert generation_context.get() == LEGACY
    assert client.get(f"/api/analysis/jobs/{new['jobId']}", headers=headers()).status_code == 404
    assert client.get(f"/api/v2/analysis/jobs/{old['jobId']}", headers=headers()).status_code == 404
    assert client.get(f"/api/v2/analysis/jobs/{new['jobId']}", headers=headers(B)).status_code == 403
    assert client.get(f"/api/v2/analysis/jobs/{new['jobId']}", headers={"Authorization": f"Bearer {A}"}).status_code == 409
    # Kill switch stops creation, not polling/reading completed v4 history.
    monkeypatch.setenv("OPENINGFIT_STAGE6_REPORTS_ENABLED", "false")
    response = client.get(f"/api/v2/analysis/jobs/{new['jobId']}", headers=headers())
    assert response.status_code == 200 and response.json()["generation"] == STAGE6
    assert response.json()["result"]["repertoireHealth"]["version"] == "repertoire_health_v4"
    assert db.writes == ["openingfit_report_store_v2"]
    assert not contains_new_report(db.rows["report_history"])


def test_queued_new_job_stays_new_when_disabled_then_retry(contract, monkeypatch):
    client, _ = contract
    job = start(client).json()
    monkeypatch.setenv("OPENINGFIT_STAGE6_REPORTS_ENABLED", "false")
    monkeypatch.setattr(main, "run_import_route", lambda *_: pytest.fail("disabled job generated a report"))
    main.execute_analysis_job(job["jobId"])
    failed = client.get(f"/api/v2/analysis/jobs/{job['jobId']}", headers=headers()).json()
    assert failed["status"] == "failed" and failed["generation"] == STAGE6
    assert failed["error"]["status"] == 503
    monkeypatch.setenv("OPENINGFIT_STAGE6_REPORTS_ENABLED", "true")
    retry = start(client).json()
    assert retry["generation"] == STAGE6 and retry["jobId"] != job["jobId"]


@pytest.mark.parametrize("collection", ["report_history", "profiles", "openingfit_user_state", "openingfit_retention_snapshots", "recommendation_history", "settings", "activity_history"])
def test_isolated_owner_reads_and_mirrors_never_write_legacy(contract, monkeypatch, collection):
    client, db = contract
    legacy_before = deepcopy(db.rows.get(collection, []))
    payload = {"capabilities": CAPS, "collection": collection, "operation": "upsert", "values": {
        "user_id": A, "report_key": "v4", "last_report": {"version": "repertoire_health_v4"},
        "snapshot": {"score": 83}, "preferences": {"legacyStorage": {"openingFit:stage6:lastAnalysis": "v4 cache"}}}}
    saved = client.post("/api/v2/report-store/query", headers=headers(), json=payload)
    assert saved.status_code == 200 and saved.json()["data"][0]["user_id"] == A
    assert db.rows.get(collection, []) == legacy_before
    payload["values"]["user_id"] = B
    assert client.post("/api/v2/report-store/query", headers=headers(), json=payload).status_code == 403
    read = {"capabilities": CAPS, "collection": collection}
    own = client.post("/api/v2/report-store/query", headers=headers(), json=read)
    other = client.post("/api/v2/report-store/query", headers=headers(B), json=read)
    assert contains_new_report(own.json()["data"])
    assert not contains_new_report(other.json()["data"])
    assert client.post("/api/v2/report-store/query", headers=headers(), json={**read, "filters": [["user_id", "eq", B]]}).status_code == 403
    monkeypatch.setenv("OPENINGFIT_STAGE6_REPORTS_ENABLED", "false")
    assert client.post("/api/v2/report-store/query", headers=headers(), json=read).json() == own.json()
    payload["values"]["user_id"] = A
    assert client.post("/api/v2/report-store/query", headers=headers(), json=payload).status_code == 503


def test_v4_never_writes_username_profile_and_legacy_api_rejects_it(contract, tmp_path, monkeypatch):
    client, _ = contract
    monkeypatch.setattr(main, "PROFILES_DIR", tmp_path)
    token = generation_context.set(STAGE6)
    try:
        assert main.previous_saved_report("Player", "lichess") is None
        main.save_user_profile("Player", {"version": "repertoire_health_v4"})
    finally: generation_context.reset(token)
    assert not list(tmp_path.iterdir())
    assert client.post("/api/account/sync", headers=headers(), json={"userId": A, "lastReport": {"version": "repertoire_health_v4"}}).status_code == 409
    assert client.post("/api/account/state", headers=headers(), json={"user_id": A, "coach_progress": {"version": "report_decision_v7"}}).status_code == 409


def test_frozen_legacy_calculations_are_real_and_demo_cannot_leak(monkeypatch, tmp_path):
    monkeypatch.setattr(main, "PROFILES_DIR", tmp_path)
    namespace = bind(vars(main))
    namespace["log_analytics_event"] = lambda *_a, **_k: None
    games = [{"id": str(i), "moves": "e4 e5 Nf3 Nc6 Bc4 Bc5 d3 Nf6", "opening": {"name": "Italian Game"},
        "players": {"white": {"user": {"name": "Player"}, "rating": 1500}, "black": {"user": {"name": "Other"}, "rating": 1500}},
        "winner": "white", "speed": "rapid", "lastMoveAt": 1700000000000 + i} for i in range(12)]
    legacy = namespace["build_lichess_analysis"]("Player", deepcopy(games), 1)
    assert legacy["repertoireHealth"]["version"] == "repertoire_health_v3"
    assert legacy["reportDecision"]["version"] == "report_decision_v6"
    assert not contains_new_report(legacy)
    files_before = {p.name: p.read_bytes() for p in tmp_path.iterdir()}
    token = generation_context.set(STAGE6)
    monkeypatch.setattr(main, "log_analytics_event", lambda *_a, **_k: None)
    try: new = main.build_lichess_analysis("Player", deepcopy(games), 1)
    finally: generation_context.reset(token)
    assert new["repertoireHealth"]["version"] == "repertoire_health_v4"
    assert new["reportDecision"]["version"] == "report_decision_v7"
    assert {p.name: p.read_bytes() for p in tmp_path.iterdir()} == files_before
    assert not contains_new_report(main.demo_profile())


def test_frozen_imports_cannot_fall_back_to_current_calculations():
    from legacy_reports.analysis import opening_training_opportunities, opening_recommender
    assert opening_training_opportunities.detect_opening.__module__ == "legacy_reports.opening_detection"
    assert opening_recommender.perspective_from_item.__module__ == "legacy_reports.analysis.opening_perspective"


def test_history_collision_cannot_replace_existing_legacy_report(contract):
    client, db = contract
    original = deepcopy(db.rows["report_history"][0])
    response = client.post("/api/v2/report-store/query", headers=headers(), json={
        "capabilities": CAPS, "collection": "report_history", "operation": "upsert",
        "values": {"id": original["id"], "user_id": A, "report": {"version": "repertoire_health_v4"}}})
    assert response.json()["data"] == [original]
    assert not db.writes


@pytest.mark.parametrize("route", ["/api/import/lichess/Player", "/import/lichess/Player", "/api/import/chesscom/Player", "/import/chesscom/Player"])
def test_all_legacy_import_aliases_use_frozen_dispatch(contract, monkeypatch, route):
    client, _ = contract
    from legacy_reports import adapter
    seen = []
    def frozen(runtime, *args, **_kwargs):
        seen.append((runtime, args))
        return {"repertoireHealth": {"version": "repertoire_health_v3", "score": 61}}
    monkeypatch.setattr(adapter, "run", frozen)
    monkeypatch.setenv("OPENINGFIT_STAGE6_REPORTS_ENABLED", "false")
    response = client.get(route, headers=headers())
    assert response.status_code == 200 and not contains_new_report(response.json())
    assert len(seen) == 1 and seen[0][1][1] == "Player"
