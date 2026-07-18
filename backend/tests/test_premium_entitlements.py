import pytest
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from main import (
    checkout_session_is_paid,
    claim_stripe_webhook_event,
    entitlement_status_for_subscription,
    finish_stripe_webhook_event,
    process_stripe_webhook_event,
    should_preserve_lifetime_entitlement,
    stripe_customer_id_for_user,
    stripe_timestamp_iso,
    subscription_access_type,
    subscription_grants_access,
    update_premium_from_subscription_event,
    upsert_premium_entitlement,
)


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
    assert entitlement_status_for_subscription("trialing") == "trialing"
    assert entitlement_status_for_subscription("past_due", "invoice.payment_failed") == "past_due"
    assert entitlement_status_for_subscription("canceled", "customer.subscription.deleted") == "canceled"
    assert entitlement_status_for_subscription("incomplete_expired") == "expired"


def test_subscription_interval_maps_to_canonical_access_type():
    annual = {"items": {"data": [{"price": {"recurring": {"interval": "year"}}}]}}
    monthly = {"items": {"data": [{"price": {"recurring": {"interval": "month"}}}]}}
    assert subscription_access_type(annual) == "annual_subscription"
    assert subscription_access_type(monthly) == "monthly_subscription"


def test_stripe_period_timestamp_is_normalized():
    assert stripe_timestamp_iso(1784289600) == "2026-07-17T12:00:00+00:00"
    assert stripe_timestamp_iso(None) is None


def test_failed_entitlement_write_is_not_silently_accepted():
    class FailedQuery(Query):
        def execute(self):
            raise RuntimeError("database unavailable")

    class FailedSupabase(Supabase):
        def table(self, name):
            return FailedQuery(self.calls)

    with pytest.raises(RuntimeError):
        upsert_premium_entitlement(FailedSupabase(), {"user_id": "user-1", "status": "active"})


class DuplicateError(RuntimeError):
    code = "23505"


class LedgerQuery:
    def __init__(self, store):
        self.store = store
        self.operation = None
        self.payload = None
        self.filters = []

    def insert(self, payload):
        self.operation, self.payload = "insert", payload
        return self

    def select(self, _columns):
        self.operation = "select"
        return self

    def update(self, payload):
        self.operation, self.payload = "update", payload
        return self

    def eq(self, key, value):
        self.filters.append((key, value))
        return self

    def limit(self, _value):
        return self

    def execute(self):
        event_id = dict(self.filters).get("event_id") or (self.payload or {}).get("event_id")
        if self.operation == "insert":
            if event_id in self.store:
                raise DuplicateError("duplicate key")
            self.store[event_id] = dict(self.payload)
            return type("Result", (), {"data": [dict(self.payload)]})()
        row = self.store.get(event_id)
        if self.operation == "select":
            return type("Result", (), {"data": [dict(row)] if row else []})()
        if self.operation == "update" and row:
            expected_status = dict(self.filters).get("status")
            if expected_status and row.get("status") != expected_status:
                return type("Result", (), {"data": []})()
            row.update(self.payload)
            return type("Result", (), {"data": [dict(row)]})()
        return type("Result", (), {"data": []})()


class LedgerSupabase:
    def __init__(self):
        self.events = {}

    def table(self, name):
        assert name == "stripe_webhook_events"
        return LedgerQuery(self.events)


def test_duplicate_event_replay_is_deliberately_ignored_after_completion():
    client = LedgerSupabase()
    event = {"id": "evt_same", "type": "customer.subscription.updated", "data": {"object": {"id": "sub_1"}}}
    first = claim_stripe_webhook_event(client, event)
    assert first["claimed"] is True
    finish_stripe_webhook_event(client, "evt_same", "processed")
    replay = claim_stripe_webhook_event(client, event)
    assert replay == {"claimed": False, "duplicate": True, "event_id": "evt_same", "status": "processed"}


def test_lifetime_entitlement_wins_over_subscription_events():
    existing = {"access_type": "lifetime", "is_grandfathered_lifetime": True}
    incoming = {"access_type": "monthly_subscription", "source": "stripe_customer.subscription.updated"}
    assert should_preserve_lifetime_entitlement(existing, incoming) is True


def test_canceled_subscription_retains_access_only_until_period_end():
    now = datetime(2026, 7, 17, 12, tzinfo=timezone.utc)
    assert subscription_grants_access("canceled", "2026-08-01T00:00:00+00:00", now) is True
    assert subscription_grants_access("canceled", "2026-07-01T00:00:00+00:00", now) is False


def test_checkout_without_protected_user_metadata_is_ignored():
    event = {
        "id": "evt_unknown",
        "type": "checkout.session.completed",
        "data": {"object": {"id": "cs_unknown", "status": "complete", "payment_status": "paid"}},
    }
    assert process_stripe_webhook_event(event, object()) == "ignored"


class EntitlementQuery:
    def __init__(self, client, table):
        self.client = client
        self.table_name = table
        self.operation = None
        self.payload = None

    def select(self, _columns):
        self.operation = "select"
        return self

    def eq(self, _key, _value):
        return self

    def limit(self, _value):
        return self

    def upsert(self, payload, on_conflict=None):
        self.operation, self.payload = "upsert", payload
        self.client.upserts.append((self.table_name, payload, on_conflict))
        return self

    def execute(self):
        if self.operation == "select":
            return type("Result", (), {"data": [{"access_type": "monthly_subscription", "is_grandfathered_lifetime": False}]})()
        return type("Result", (), {"data": [self.payload] if self.payload else []})()


class EntitlementSupabase:
    def __init__(self):
        self.upserts = []

    def table(self, name):
        return EntitlementQuery(self, name)


def test_subscription_update_after_checkout_upserts_full_lifecycle_state():
    client = EntitlementSupabase()
    subscription = {
        "id": "sub_1",
        "customer": "cus_1",
        "status": "active",
        "current_period_start": 1782864000,
        "current_period_end": 1785542400,
        "cancel_at_period_end": False,
        "metadata": {"user_id": "user-1"},
        "items": {"data": [{"price": {"id": "price_year", "recurring": {"interval": "year"}}}]},
    }
    result = update_premium_from_subscription_event(
        client,
        subscription,
        "customer.subscription.updated",
        event_id="evt_update",
        event_created_at="2026-07-17T12:00:00+00:00",
    )
    entitlement_payload = next(payload for table, payload, _ in client.upserts if table == "premium_entitlements")
    assert result["status"] == "active"
    assert entitlement_payload["user_id"] == "user-1"
    assert entitlement_payload["stripe_customer_id"] == "cus_1"
    assert entitlement_payload["stripe_subscription_id"] == "sub_1"
    assert entitlement_payload["plan_interval"] == "year"
    assert entitlement_payload["current_period_start"] is not None
    assert entitlement_payload["current_period_end"] is not None
    assert entitlement_payload["last_stripe_event_id"] == "evt_update"


def test_portal_customer_is_resolved_from_the_users_protected_entitlement():
    class CustomerQuery:
        def select(self, _columns): return self
        def eq(self, key, value):
            assert key == "user_id"
            assert value == "user-1"
            return self
        def limit(self, _value): return self
        def execute(self): return type("Result", (), {"data": [{"stripe_customer_id": "cus_safe"}]})()

    class CustomerSupabase:
        def table(self, name):
            assert name == "premium_entitlements"
            return CustomerQuery()

    assert stripe_customer_id_for_user(CustomerSupabase(), "user-1") == "cus_safe"
