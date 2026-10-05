"""API-to-database isolation checks, opt-in and hard-pinned to the test cluster.

Run with OPENINGFIT_STAGE6_LOCAL_DB=1 after stage6_local_bootstrap.sql and the
202610050001_stage6_report_pilot.sql migration in the isolated cluster.
No connection strings, production configuration, or credentials are read.
"""
import json
import os
from pathlib import Path
import re
import subprocess
from types import SimpleNamespace

import pytest
import main
from report_rollout import contains_new_report
from backend.tests.test_stage6_isolation import A, B, CAPS, contract, headers, start

pytestmark = pytest.mark.skipif(os.getenv("OPENINGFIT_STAGE6_LOCAL_DB") != "1", reason="Isolated local database test is opt-in")
ROOT = Path(__file__).resolve().parents[2]
PSQL = ROOT / ".release-build/postgresql17/runtime/bin/psql.exe"


def sql(command):
    env = {key: value for key, value in os.environ.items() if not key.startswith("PG")}
    result = subprocess.run([str(PSQL), "-X", "-q", "-A", "-t", "-h", "127.0.0.1", "-p", "55436",
        "-U", "postgres", "-d", "stage6_final", "-v", "ON_ERROR_STOP=1", "-c", command],
        env=env, capture_output=True, text=True, check=True)
    return result.stdout.strip()


def ident(value):
    assert re.fullmatch(r"[a-z_][a-z_0-9]*", value)
    return '"' + value + '"'


def literal(value):
    if isinstance(value, bool): return "true" if value else "false"
    if value is None: return "null"
    return "'" + str(value).replace("'", "''") + "'"


class LocalDB:
    def table(self, table):
        class Query:
            def __init__(self): self.filters = []; self.value = None; self.max_rows = 500
            def select(self, *_args): return self
            def eq(self, key, value): self.filters.append((key, value)); return self
            def limit(self, value): self.max_rows = int(value); return self
            def upsert(self, value, **_kwargs): self.value = value; return self
            def execute(self):
                if self.value is not None:
                    keys = list(self.value)
                    vals = [literal(json.dumps(v) if isinstance(v, (dict, list)) else v) for v in self.value.values()]
                    statement = f"insert into public.{ident(table)} ({','.join(map(ident, keys))}) values ({','.join(vals)}) on conflict (user_id,collection,row_key) do update set payload=excluded.payload returning *"
                    query = f"with changed as ({statement}) select coalesce(json_agg(changed),'[]') from changed"
                else:
                    where = " and ".join(f"{ident(k)}={literal(v)}" for k, v in self.filters) or "true"
                    query = f"select coalesce(json_agg(r),'[]') from (select * from public.{ident(table)} where {where} limit {self.max_rows}) r"
                output = sql("set role service_role; " + query)
                return SimpleNamespace(data=json.loads(output))
        return Query()


@pytest.fixture
def local_pilot_membership():
    directory = sql("show data_directory").replace("\\", "/").lower()
    assert directory == str(ROOT / ".release-build/stage6-isolation/postgres").replace("\\", "/").lower()
    assert sql("select count(*) from public.openingfit_report_pilot_accounts") == "0"
    sql(f"insert into public.openingfit_report_pilot_accounts(user_id,enabled) values ('{A}',true),('{B}',true)")
    try:
        yield
    finally:
        sql("update public.openingfit_report_rollout set enabled=false where id=1; delete from public.openingfit_report_pilot_accounts")


def test_real_database_api_reads_ownership_generation_and_rollback(contract, monkeypatch, local_pilot_membership):
    client, _ = contract
    directory = sql("show data_directory").replace("\\", "/").lower()
    assert directory == str(ROOT / ".release-build/stage6-isolation/postgres").replace("\\", "/").lower()
    monkeypatch.setattr(main, "get_supabase_admin_client", lambda: LocalDB())
    assert sql("select enabled from public.openingfit_report_rollout where id=1") == "f"
    assert start(client).status_code == 503
    sql("delete from public.openingfit_report_store_v2; update public.openingfit_report_rollout set enabled=true where id=1")
    # Real generator execution is covered independently by the frozen-builder
    # fixture; here exercise worker persistence through actual SQL constraints.
    monkeypatch.setattr(main, "run_import_route", lambda *_args: {"gamesImported": 12,
        "repertoireHealth": {"version": "repertoire_health_v4", "score": 83}})
    legacy_before = sql("select json_agg(r order by user_id) from public.report_history r")
    try:
        job = start(client).json()
        main.execute_analysis_job(job["jobId"])
        completed = client.get(f"/api/v2/analysis/jobs/{job['jobId']}", headers=headers()).json()
        assert completed["status"] == "completed"
        assert completed["result"]["reportGeneration"] == "stage6_v1"
        assert client.get(f"/api/analysis/jobs/{job['jobId']}", headers=headers()).status_code == 404
        for collection in ["report_history", "profiles", "openingfit_user_state", "openingfit_retention_snapshots", "recommendation_history", "settings"]:
            write = {"capabilities": CAPS, "collection": collection, "operation": "upsert", "values": {
                "user_id": A, "report_key": "api-test", "snapshot_key": "api-test",
                "last_report": completed["result"], "snapshot": {"score": 83}, "is_premium": True}}
            response = client.post("/api/v2/report-store/query", headers=headers(), json=write)
            assert response.status_code == 200, response.text
            read = {"capabilities": CAPS, "collection": collection}
            owner_rows = client.post("/api/v2/report-store/query", headers=headers(), json=read).json()["data"]
            assert contains_new_report(owner_rows)
            if collection == "profiles": assert not owner_rows[0]["is_premium"]
            other_rows = client.post("/api/v2/report-store/query", headers=headers(B), json=read).json()["data"]
            assert not contains_new_report(other_rows)
            write["values"]["user_id"] = B
            assert client.post("/api/v2/report-store/query", headers=headers(), json=write).status_code == 403
        assert sql("select json_agg(r order by user_id) from public.report_history r") == legacy_before
        assert sql("select count(*) from public.profiles where public.openingfit_contains_stage6(to_jsonb(profiles))") == "0"
        assert sql("select count(*) from public.openingfit_user_state") == "0"
        assert sql("select count(*) from public.openingfit_retention_snapshots") == "0"
    finally:
        sql("update public.openingfit_report_rollout set enabled=false where id=1")
    read = {"capabilities": CAPS, "collection": "report_history"}
    assert contains_new_report(client.post("/api/v2/report-store/query", headers=headers(), json=read).json()["data"])
    assert start(client).status_code == 503
    assert sql("select enabled from public.openingfit_report_rollout where id=1") == "f"
