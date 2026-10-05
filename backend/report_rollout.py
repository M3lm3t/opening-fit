"""Report generation contract. Capabilities never grant identity or entitlement."""
from contextvars import ContextVar
import os
from fastapi import HTTPException

LEGACY = "legacy_v1"
STAGE6 = "stage6_v1"
CAPABILITIES = frozenset({"report_decision_v7", "repertoire_health_v4", "opening_suitability_v2",
    "deterministic_opening_fit_metrics_v2", "report_comparison_v1", "isolated_report_store_v1"})
generation_context = ContextVar("report_generation", default=LEGACY)
PILOT_CLIENT = "web-report-pilot-v1"
REPORT_ONLY_MESSAGE = "This pilot supports report import and reading only. Missions, repertoire changes and training completion are unavailable. Those actions cannot save changes or record completion."


def require_pilot_client(request):
    if request.headers.get("x-openingfit-report-client", "") != PILOT_CLIENT:
        raise HTTPException(403, "This report service is restricted to the web report pilot.")


def pilot_account_allowed(client, owner):
    rows = client.table("openingfit_report_pilot_accounts").select("enabled").eq("user_id", owner).execute().data or []
    return bool(owner and rows and rows[0].get("enabled") is True)


def require_pilot_account(client, owner):
    if not pilot_account_allowed(client, owner):
        raise HTTPException(403, "This account is not enabled for the web report pilot. Use the standard app for legacy reports.")


def enabled():
    return os.getenv("OPENINGFIT_STAGE6_REPORTS_ENABLED", "false").strip().lower() == "true"


def require_enabled():
    if not enabled():
        raise HTTPException(503, "New report creation is disabled. Saved reports remain readable.")


def require_capabilities(values):
    if not isinstance(values, (list, tuple, set, frozenset)) or set(values) != CAPABILITIES:
        raise HTTPException(409, "Unsupported report capabilities. Update the client to use this report service.")


def request_capabilities(request):
    require_capabilities((request.headers.get("x-openingfit-report-capabilities", "") if request else "").split(","))


def contains_new_report(value):
    if isinstance(value, dict):
        return any(contains_new_report(item) for item in value.values())
    if isinstance(value, (list, tuple)):
        return any(contains_new_report(item) for item in value)
    return isinstance(value, str) and any(marker in value for marker in CAPABILITIES | {STAGE6})


def require_legacy_payload(value):
    if contains_new_report(value):
        raise HTTPException(409, "This report requires isolated report storage.")
