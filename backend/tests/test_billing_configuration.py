import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import main
from main import billing_configuration, checkout_price_configuration


PRICE_ENV = [
    "STRIPE_OPENINGFIT_PLUS_MONTHLY_PRICE_ID",
    "STRIPE_OPENINGFIT_PLUS_ANNUAL_PRICE_ID",
    "STRIPE_OPENINGFIT_FOUNDING_ANNUAL_COUPON_ID",
    "OPENINGFIT_FOUNDING_ANNUAL_OFFER_ENABLED",
    "OPENINGFIT_PLUS_MONTHLY_PRICE_GBP",
    "OPENINGFIT_PLUS_ANNUAL_PRICE_GBP",
    "OPENINGFIT_FOUNDING_FIRST_YEAR_PRICE_GBP",
    "OPENINGFIT_SUBSCRIPTIONS_ENABLED",
]


def clear_billing_env(monkeypatch):
    for name in PRICE_ENV:
        monkeypatch.delenv(name, raising=False)


def test_public_billing_config_never_exposes_price_ids(monkeypatch):
    clear_billing_env(monkeypatch)
    monkeypatch.setenv("STRIPE_OPENINGFIT_PLUS_MONTHLY_PRICE_ID", "price_month_secret")
    monkeypatch.setenv("STRIPE_OPENINGFIT_PLUS_ANNUAL_PRICE_ID", "price_year_secret")
    result = billing_configuration()
    assert result["monthly"] == {"available": True, "amount": 4.99, "currency": "GBP"}
    assert result["annual"] == {"available": True, "amount": 39.99, "currency": "GBP"}
    assert "price_month_secret" not in str(result)
    assert "price_year_secret" not in str(result)


def test_founding_offer_requires_flag_annual_price_and_one_use_coupon(monkeypatch):
    clear_billing_env(monkeypatch)
    monkeypatch.setenv("STRIPE_OPENINGFIT_PLUS_ANNUAL_PRICE_ID", "price_year")
    monkeypatch.setenv("STRIPE_OPENINGFIT_FOUNDING_ANNUAL_COUPON_ID", "coupon_first_year")
    assert billing_configuration()["foundingOffer"]["enabled"] is False
    monkeypatch.setenv("OPENINGFIT_FOUNDING_ANNUAL_OFFER_ENABLED", "true")
    assert billing_configuration()["foundingOffer"] == {"enabled": True, "firstYearAmount": 29.99, "renewsAtAmount": 39.99}
    selected = checkout_price_configuration("annual")
    assert selected == {"interval": "annual", "price_id": "price_year", "coupon_id": "coupon_first_year", "founding_offer": True}


def test_monthly_and_annual_checkout_only_use_server_selected_prices(monkeypatch):
    clear_billing_env(monkeypatch)
    monkeypatch.setenv("STRIPE_OPENINGFIT_PLUS_MONTHLY_PRICE_ID", "price_month")
    monkeypatch.setenv("STRIPE_OPENINGFIT_PLUS_ANNUAL_PRICE_ID", "price_year")
    assert checkout_price_configuration("monthly")["price_id"] == "price_month"
    assert checkout_price_configuration("annual")["price_id"] == "price_year"
    with pytest.raises(HTTPException):
        checkout_price_configuration("lifetime")


def test_unconfigured_interval_fails_closed(monkeypatch):
    clear_billing_env(monkeypatch)
    with pytest.raises(HTTPException) as error:
        checkout_price_configuration("monthly")
    assert error.value.status_code == 503


def test_launch_control_disables_new_checkout_without_hiding_existing_account_services(monkeypatch):
    clear_billing_env(monkeypatch)
    monkeypatch.setenv("OPENINGFIT_SUBSCRIPTIONS_ENABLED", "false")
    monkeypatch.setenv("STRIPE_OPENINGFIT_PLUS_MONTHLY_PRICE_ID", "price_month")
    monkeypatch.setenv("STRIPE_OPENINGFIT_PLUS_ANNUAL_PRICE_ID", "price_year")
    config = billing_configuration()
    assert config["subscriptionsEnabled"] is False
    assert config["monthly"]["available"] is False
    assert config["annual"]["available"] is False

    result = asyncio.run(main.create_checkout_session({}, object()))
    assert result.status_code == 503
    assert b"Existing paid access is unaffected" in result.body


def test_launch_control_allows_server_selected_checkout_prices(monkeypatch):
    clear_billing_env(monkeypatch)
    monkeypatch.setenv("OPENINGFIT_SUBSCRIPTIONS_ENABLED", "true")
    monkeypatch.setenv("STRIPE_OPENINGFIT_PLUS_MONTHLY_PRICE_ID", "price_month")
    monkeypatch.setenv("STRIPE_OPENINGFIT_PLUS_ANNUAL_PRICE_ID", "price_year")
    assert billing_configuration()["monthly"]["available"] is True
    assert checkout_price_configuration("annual")["price_id"] == "price_year"


def test_production_billing_fails_closed_when_required_schema_is_missing(monkeypatch):
    clear_billing_env(monkeypatch)
    monkeypatch.setenv("OPENINGFIT_SUBSCRIPTIONS_ENABLED", "true")
    monkeypatch.setenv("STRIPE_OPENINGFIT_PLUS_MONTHLY_PRICE_ID", "price_month")
    monkeypatch.setenv("STRIPE_OPENINGFIT_PLUS_ANNUAL_PRICE_ID", "price_year")
    monkeypatch.setattr(main, "is_production_environment", lambda: True)
    main.BILLING_SCHEMA_CACHE.update({"checked_at": 0.0, "ready": None})

    class MissingSchemaQuery:
        def select(self, _columns): return self
        def limit(self, _value): return self
        def execute(self): raise RuntimeError("required relation is missing")

    class MissingSchemaClient:
        def table(self, _name): return MissingSchemaQuery()

    monkeypatch.setattr(main, "get_supabase_admin_client", lambda: MissingSchemaClient())
    config = billing_configuration()
    assert config["subscriptionsEnabled"] is False
    assert config["checkoutStatus"] == "schema_upgrade_required"
    assert config["monthly"]["available"] is False

    result = asyncio.run(main.create_checkout_session({}, object()))
    assert result.status_code == 503
    assert b"Existing paid access is unaffected" in result.body


def test_unsigned_checkout_and_sync_return_controlled_auth_errors(monkeypatch):
    clear_billing_env(monkeypatch)
    monkeypatch.setenv("OPENINGFIT_SUBSCRIPTIONS_ENABLED", "true")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_placeholder")
    monkeypatch.setenv("STRIPE_OPENINGFIT_PLUS_ANNUAL_PRICE_ID", "price_year")
    request = SimpleNamespace(headers={}, url=SimpleNamespace(path="/api/account/create-checkout-session"))
    user_id = "11111111-1111-4111-8111-111111111111"

    checkout = asyncio.run(main.create_checkout_session({"userId": user_id, "billingInterval": "annual"}, request))
    assert checkout.status_code == 401
    assert b"sign in or create an account" in checkout.body

    sync = asyncio.run(main.sync_checkout_session({"userId": user_id, "sessionId": "cs_test_audit"}, request))
    assert sync.status_code == 401
    assert b"sign in or create an account" in sync.body


@pytest.mark.parametrize(
    ("selected", "expected_price", "expected_interval"),
    (("monthly", "price_month", "month"), ("annual", "price_year", "year")),
)
def test_authenticated_checkout_creates_session_with_selected_recurring_price(
    monkeypatch, selected, expected_price, expected_interval
):
    clear_billing_env(monkeypatch)
    monkeypatch.setenv("OPENINGFIT_SUBSCRIPTIONS_ENABLED", "true")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_placeholder")
    monkeypatch.setenv("STRIPE_OPENINGFIT_PLUS_MONTHLY_PRICE_ID", "price_month")
    monkeypatch.setenv("STRIPE_OPENINGFIT_PLUS_ANNUAL_PRICE_ID", "price_year")
    monkeypatch.setenv("FRONTEND_URL", "https://www.openingfit.com")

    user_id = "11111111-1111-4111-8111-111111111111"
    captured = {}
    request = SimpleNamespace(headers={}, url=SimpleNamespace(path="/api/account/create-checkout-session"))
    monkeypatch.setattr(
        main,
        "require_matching_auth_user",
        lambda _request, requested: SimpleNamespace(id=requested, email="buyer@example.test"),
    )
    monkeypatch.setattr(main, "get_registered_referral_checkout_metadata", lambda *_args: {})
    monkeypatch.setattr(main, "get_supabase_admin_client", lambda: object())
    monkeypatch.setattr(
        main.stripe.Price,
        "retrieve",
        lambda price_id: {"id": price_id, "recurring": {"interval": expected_interval}},
    )

    def create_session(**params):
        captured.update(params)
        return SimpleNamespace(
            id="cs_test_checkout",
            url="https://checkout.stripe.test/session",
            mode=params["mode"],
        )

    monkeypatch.setattr(main.stripe.checkout.Session, "create", create_session)

    result = asyncio.run(
        main.create_checkout_session(
            {"userId": user_id, "email": "ignored@example.test", "billingInterval": selected},
            request,
        )
    )

    assert result == {"url": "https://checkout.stripe.test/session"}
    assert captured["mode"] == "subscription"
    assert captured["line_items"] == [{"price": expected_price, "quantity": 1}]
    assert captured["metadata"]["billing_interval"] == selected
    assert captured["subscription_data"]["metadata"]["user_id"] == user_id
