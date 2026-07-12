import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from main import checkout_session_is_paid, entitlement_status_for_subscription, upsert_premium_entitlement


class Query:
    def __init__(self, calls):
        self.calls = calls

    def upsert(self, payload, on_conflict=None):
        self.calls.append((payload, on_conflict))
        return self

    def execute(self):
        return type("Result", (), {"data": []})()


class Supabase:
    def __init__(self):
        self.calls = []

    def table(self, name):
        assert name == "premium_entitlements"
        return Query(self.calls)


def test_paid_payment_and_subscription_sessions_are_accepted():
    assert checkout_session_is_paid({"status": "complete", "payment_status": "paid", "mode": "payment"})
    assert checkout_session_is_paid({"status": "complete", "payment_status": "paid", "mode": "subscription"})
    assert not checkout_session_is_paid({"status": "open", "payment_status": "unpaid", "mode": "payment"})


def test_duplicate_webhook_delivery_upserts_same_user_key():
    client = Supabase()
    payload = {"user_id": "user-1", "status": "active", "stripe_checkout_session_id": "cs_same"}
    upsert_premium_entitlement(client, payload)
    upsert_premium_entitlement(client, payload)
    assert len(client.calls) == 2
    assert all(on_conflict == "user_id" for _, on_conflict in client.calls)


def test_subscription_failure_and_cancellation_remove_active_status():
    assert entitlement_status_for_subscription("past_due", "invoice.payment_failed") != "active"
    assert entitlement_status_for_subscription("canceled", "customer.subscription.deleted") != "active"


def test_failed_entitlement_write_is_not_silently_accepted():
    class FailedQuery(Query):
        def execute(self):
            raise RuntimeError("database unavailable")

    class FailedSupabase(Supabase):
        def table(self, name):
            return FailedQuery(self.calls)

    with pytest.raises(RuntimeError):
        upsert_premium_entitlement(FailedSupabase(), {"user_id": "user-1", "status": "active"})
