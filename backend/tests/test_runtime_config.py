import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from runtime_config import (
    PRODUCTION_ORIGINS,
    assert_valid_startup_configuration,
    build_allowed_origins,
    readiness_payload,
    subscriptions_enabled,
    validate_runtime_configuration,
)


def production_env(**overrides):
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
        "CORS_ALLOWED_ORIGINS": ",".join(PRODUCTION_ORIGINS),
        "OPENINGFIT_SUBSCRIPTIONS_ENABLED": "false",
        "OPENINGFIT_FOUNDING_ANNUAL_OFFER_ENABLED": "false",
    }
    values.update(overrides)
    return values


def test_development_and_test_do_not_require_production_secrets():
    assert validate_runtime_configuration({"APP_ENV": "development"}) == []
    assert validate_runtime_configuration({"APP_ENV": "test"}) == []
    assert subscriptions_enabled({"APP_ENV": "development"}) is True


def test_production_configuration_accepts_live_shaped_values_and_can_launch_disabled():
    env = production_env()
    assert validate_runtime_configuration(env) == []
    assert subscriptions_enabled(env) is False
    assert readiness_payload(env)["status"] == "ready"
    assert_valid_startup_configuration(env)


def test_production_rejects_missing_and_obvious_test_configuration_without_values_in_error():
    env = production_env(
        STRIPE_SECRET_KEY="sk_test_forbidden",
        STRIPE_OPENINGFIT_PLUS_MONTHLY_PRICE_ID="price_test_month",
        CORS_ALLOWED_ORIGINS="https://*.openingfit.com",
    )
    errors = validate_runtime_configuration(env)
    assert "STRIPE_SECRET_KEY" in errors
    assert "STRIPE_OPENINGFIT_PLUS_MONTHLY_PRICE_ID" in errors
    assert "CORS_ALLOWED_ORIGINS" in errors
    with pytest.raises(RuntimeError) as error:
        assert_valid_startup_configuration(env)
    assert "sk_test_forbidden" not in str(error.value)


def test_founding_offer_requires_a_non_test_coupon_only_when_enabled():
    disabled = production_env(STRIPE_OPENINGFIT_FOUNDING_ANNUAL_COUPON_ID="")
    assert validate_runtime_configuration(disabled) == []
    enabled = production_env(OPENINGFIT_FOUNDING_ANNUAL_OFFER_ENABLED="true")
    assert "STRIPE_OPENINGFIT_FOUNDING_ANNUAL_COUPON_ID" in validate_runtime_configuration(enabled)


def test_cors_origins_are_explicit_and_localhost_is_development_only():
    production = build_allowed_origins(production_env())
    assert "https://openingfit.com" in production
    assert "https://www.openingfit.com" in production
    assert "http://localhost:5173" not in production
    assert "http://localhost:5173" in build_allowed_origins({"APP_ENV": "development"})
    assert "https://unknown.example" not in production
    assert all("*" not in origin for origin in build_allowed_origins(production_env(CORS_ALLOWED_ORIGINS="*")))
    preview = build_allowed_origins({"APP_ENV": "preview", "CORS_ALLOWED_ORIGINS": "https://opening-fit-preview.vercel.app"})
    assert "https://opening-fit-preview.vercel.app" in preview


def test_readiness_is_safe_when_configuration_is_missing():
    result = readiness_payload({"APP_ENV": "development"})
    assert result["status"] == "not_ready"
    assert result["database"] == "not_configured"
    assert set(result) == {"status", "database", "stripe", "webhook", "pricing", "portal", "cors", "subscriptions", "environment"}
