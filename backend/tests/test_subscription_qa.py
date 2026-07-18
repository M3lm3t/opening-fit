"""Focused subscription lifecycle QA that does not contact Stripe or Supabase."""

import asyncio
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import main


class RequestStub:
    def __init__(self, authorization=""):
        self.headers = {"authorization": authorization} if authorization else {}
        self.url = SimpleNamespace(path="/api/account/create-portal-session")


def subscription(status="active", interval="month"):
    return {
        "id": "sub_test",
        "customer": "cus_test",
        "status": status,
        "current_period_start": 1782864000,
        "current_period_end": 1785542400,
        "metadata": {"user_id": "11111111-1111-4111-8111-111111111111"},
        "items": {"data": [{"price": {"id": f"price_{interval}", "recurring": {"interval": interval}}}]},
    }


@pytest.mark.parametrize(
    ("selected", "environment", "expected"),
    [
        ("monthly", "STRIPE_OPENINGFIT_PLUS_MONTHLY_PRICE_ID", "price_month_test"),
        ("annual", "STRIPE_OPENINGFIT_PLUS_ANNUAL_PRICE_ID", "price_year_test"),
    ],
)
def test_free_user_checkout_uses_the_selected_server_price(monkeypatch, selected, environment, expected):
    monkeypatch.setenv(environment, expected)
    assert main.checkout_price_configuration(selected)["price_id"] == expected


def test_invoice_renewal_keeps_access_and_payment_failure_becomes_past_due(monkeypatch):
    captured = []
    monkeypatch.setattr(main, "stripe_subscription_for_invoice", lambda _invoice: subscription())
    monkeypatch.setattr(main, "update_premium_from_subscription_event", lambda _client, value, event_type, **_kwargs: captured.append((event_type, value["status"])) or {"status": value["status"]})

    paid = {"id": "evt_paid", "type": "invoice.paid", "data": {"object": {"id": "in_paid", "subscription": "sub_test"}}}
    failed = {"id": "evt_failed", "type": "invoice.payment_failed", "data": {"object": {"id": "in_failed", "subscription": "sub_test"}}}
    assert main.process_stripe_webhook_event(paid, object()) == "processed"
    assert main.process_stripe_webhook_event(failed, object()) == "processed"
    assert captured == [("invoice.paid", "active"), ("invoice.payment_failed", "past_due")]


def test_signed_out_user_cannot_call_protected_account_helpers():
    with pytest.raises(HTTPException) as error:
        main.get_auth_user(RequestStub())
    assert error.value.status_code == 401


def test_incorrect_user_cannot_open_another_users_customer_portal(monkeypatch):
    monkeypatch.setattr(main, "get_auth_user", lambda _request: SimpleNamespace(id="user-a"))
    with pytest.raises(HTTPException) as error:
        main.require_matching_auth_user(RequestStub("Bearer test-token"), "user-b")
    assert error.value.status_code == 403


def test_existing_subscriber_portal_does_not_depend_on_checkout_price_configuration(monkeypatch):
    user_id = "11111111-1111-4111-8111-111111111111"

    class CustomerQuery:
        def select(self, _columns): return self
        def eq(self, _key, _value): return self
        def limit(self, _value): return self
        def execute(self): return SimpleNamespace(data=[{"stripe_customer_id": "cus_test"}])

    class CustomerSupabase:
        def table(self, name):
            assert name == "premium_entitlements"
            return CustomerQuery()

    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_placeholder")
    monkeypatch.delenv("STRIPE_OPENINGFIT_PLUS_ANNUAL_PRICE_ID", raising=False)
    monkeypatch.setattr(main, "require_matching_auth_user", lambda _request, requested: SimpleNamespace(id=requested))
    monkeypatch.setattr(main, "get_supabase_admin_client", lambda: CustomerSupabase())
    monkeypatch.setattr(main.stripe.billing_portal.Session, "create", lambda **_kwargs: {"url": "https://billing.stripe.test/session"})

    result = asyncio.run(main.create_portal_session({"userId": user_id}, RequestStub("Bearer test-token")))
    assert result == {"url": "https://billing.stripe.test/session"}


def test_missing_checkout_metadata_is_ignored_without_granting_access():
    event = {"id": "evt_missing", "type": "checkout.session.completed", "data": {"object": {"id": "cs_test", "status": "complete", "payment_status": "paid", "mode": "subscription"}}}
    assert main.process_stripe_webhook_event(event, object()) == "ignored"


def test_stripe_temporary_failure_propagates_for_webhook_retry(monkeypatch):
    monkeypatch.setattr(main.stripe.Subscription, "retrieve", lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("temporary Stripe failure")))
    with pytest.raises(RuntimeError, match="temporary Stripe failure"):
        main.stripe_subscription_for_invoice({"subscription": "sub_test"})


def test_supabase_temporary_failure_does_not_report_a_successful_write():
    class BrokenQuery:
        def upsert(self, *_args, **_kwargs): return self
        def execute(self): raise RuntimeError("temporary Supabase failure")

    class BrokenSupabase:
        def table(self, _name): return BrokenQuery()

    with pytest.raises(RuntimeError, match="temporary Supabase failure"):
        main.upsert_premium_entitlement(BrokenSupabase(), {"user_id": "user-1", "status": "active"})


def test_legacy_premium_migration_is_one_way_lifetime_backfill():
    migration = (Path(__file__).resolve().parents[2] / "supabase" / "migrations" / "202607170001_canonical_premium_entitlements.sql").read_text(encoding="utf-8")
    assert "legacy_lifetime_backfill" in migration
    assert "is_grandfathered_lifetime" in migration
    assert "profiles.is_premium is true" in migration
    assert "on conflict (user_id) do nothing" in migration.lower()
