import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


client = TestClient(main.app)


def preflight(path, origin, method="POST"):
    return client.options(
        path,
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": method,
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )


def test_production_and_www_origins_are_allowed():
    for origin in ("https://openingfit.com", "https://www.openingfit.com"):
        response = preflight("/api/account/create-checkout-session", origin)
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == origin
        assert response.headers["access-control-allow-credentials"] == "true"


def test_localhost_is_allowed_in_development():
    response = preflight("/api/import/chesscom/player", "http://localhost:5173", "GET")
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_unknown_and_wildcard_style_origins_are_rejected():
    for origin in ("https://unknown.example", "https://anything.openingfit.com"):
        response = preflight("/api/stripe/webhook", origin)
        assert "access-control-allow-origin" not in response.headers


def test_preflight_covers_auth_import_stripe_and_account_routes():
    cases = (
        ("/api/account/profile/00000000-0000-0000-0000-000000000000", "GET"),
        ("/api/import/lichess/player", "GET"),
        ("/api/stripe/webhook", "POST"),
        ("/api/account/create-portal-session", "POST"),
    )
    for path, method in cases:
        response = preflight(path, "https://www.openingfit.com", method)
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == "https://www.openingfit.com"


def test_liveness_stays_up_when_readiness_is_not_configured(monkeypatch):
    for name in (
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "STRIPE_OPENINGFIT_PLUS_MONTHLY_PRICE_ID",
        "STRIPE_OPENINGFIT_PLUS_ANNUAL_PRICE_ID",
    ):
        monkeypatch.delenv(name, raising=False)
    assert client.get("/health").json() == {"status": "ok"}
    response = client.get("/api/readiness")
    assert response.status_code == 503
    payload = response.json()
    assert payload["status"] == "not_ready"
    assert "STRIPE_SECRET_KEY" not in str(payload)


def test_readiness_reports_only_safe_configured_statuses(monkeypatch):
    values = {
        "APP_ENV": "production",
        "SUPABASE_URL": "https://project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "sb_secret_live_value",
        "STRIPE_SECRET_KEY": "sk_live_value",
        "STRIPE_WEBHOOK_SECRET": "whsec_livevalue",
        "STRIPE_OPENINGFIT_PLUS_MONTHLY_PRICE_ID": "price_live_month",
        "STRIPE_OPENINGFIT_PLUS_ANNUAL_PRICE_ID": "price_live_year",
        "FRONTEND_URL": "https://www.openingfit.com",
        "STRIPE_CUSTOMER_PORTAL_RETURN_URL": "https://www.openingfit.com/account",
        "CORS_ALLOWED_ORIGINS": "https://openingfit.com,https://www.openingfit.com",
        "OPENINGFIT_SUBSCRIPTIONS_ENABLED": "false",
        "OPENINGFIT_FOUNDING_ANNUAL_OFFER_ENABLED": "false",
    }
    for name, value in values.items():
        monkeypatch.setenv(name, value)
    response = client.get("/api/readiness")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "database": "configured",
        "stripe": "configured",
        "webhook": "configured",
        "pricing": "configured",
        "portal": "configured",
        "cors": "configured",
        "subscriptions": "disabled",
        "environment": "production",
    }
    assert "sk_live_value" not in response.text
