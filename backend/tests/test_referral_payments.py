import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import (
    calculate_referral_commission,
    convert_registered_referral_after_checkout,
    get_registered_referral_checkout_metadata,
    refund_converted_referral,
)


class Result:
    def __init__(self, data):
        self.data = data


class Query:
    def __init__(self, store, table, fail_updates=False):
        self.store = store
        self.table = table
        self.filters = []
        self.action = "select"
        self.payload = None
        self.fail_updates = fail_updates

    def select(self, _columns):
        self.action = "select"
        return self

    def update(self, payload):
        self.action = "update"
        self.payload = payload
        return self

    def eq(self, column, value):
        self.filters.append((column, value))
        return self

    def limit(self, _count):
        return self

    def execute(self):
        rows = [
            row for row in self.store.get(self.table, [])
            if all(str(row.get(column)) == str(value) for column, value in self.filters)
        ]
        if self.action == "update":
            if self.fail_updates:
                raise RuntimeError("referral database unavailable")
            for row in rows:
                row.update(self.payload)
        return Result([dict(row) for row in rows])


class ReferralSupabase:
    def __init__(self, attributions=None, partners=None, fail_updates=False):
        self.store = {
            "referral_attributions": attributions or [],
            "referral_partners": partners or [],
        }
        self.fail_updates = fail_updates

    def table(self, name):
        return Query(self.store, name, self.fail_updates)


def attribution(status="registered"):
    return {
        "id": "attr-1",
        "referral_partner_id": "partner-1",
        "referral_code": "coach",
        "referred_user_id": "user-1",
        "status": status,
        "stripe_checkout_session_id": None,
        "stripe_payment_intent_id": None,
    }


def partner(commission_type="fixed", commission_value="2.00", active=True):
    return {
        "id": "partner-1",
        "commission_type": commission_type,
        "commission_value": commission_value,
        "is_active": active,
    }


def session(amount_total=1000):
    return {
        "id": "cs_referral",
        "payment_intent": "pi_referral",
        "amount_total": amount_total,
        "currency": "gbp",
        "metadata": {
            "user_id": "user-1",
            "openingfit_referred_user_id": "user-1",
            "openingfit_referral_code": "coach",
            "openingfit_referral_attribution_id": "attr-1",
        },
    }


def test_checkout_uses_server_side_registered_attribution_metadata():
    client = ReferralSupabase([attribution()], [partner()])
    metadata = get_registered_referral_checkout_metadata(client, "user-1")
    assert metadata == {
        "openingfit_referred_user_id": "user-1",
        "openingfit_referral_code": "coach",
        "openingfit_referral_attribution_id": "attr-1",
    }


def test_payment_without_referral_has_no_referral_metadata():
    assert get_registered_referral_checkout_metadata(ReferralSupabase(), "user-1") == {}


def test_fixed_commission_conversion_is_capped_and_rounded():
    client = ReferralSupabase([attribution()], [partner("fixed", "25.00")])
    result = convert_registered_referral_after_checkout(client, session(1000), "user-1")
    assert result == {"status": "converted", "gross_amount": 10.0, "commission_amount": 10.0}
    row = client.store["referral_attributions"][0]
    assert row["status"] == "converted"
    assert row["stripe_checkout_session_id"] == "cs_referral"
    assert row["stripe_payment_intent_id"] == "pi_referral"


def test_percentage_commission_uses_gross_amount_and_two_decimal_rounding():
    client = ReferralSupabase([attribution()], [partner("percentage", "12.50")])
    result = convert_registered_referral_after_checkout(client, session(1999), "user-1")
    assert result["commission_amount"] == 2.5
    assert str(calculate_referral_commission("19.99", "percentage", "12.50")) == "2.50"


def test_duplicate_webhook_does_not_recalculate_conversion():
    client = ReferralSupabase([attribution()], [partner("fixed", "2.00")])
    first = convert_registered_referral_after_checkout(client, session(), "user-1")
    original_commission = client.store["referral_attributions"][0]["commission_amount"]
    second = convert_registered_referral_after_checkout(client, session(5000), "user-1")
    assert first["status"] == "converted"
    assert second["status"] == "duplicate"
    assert client.store["referral_attributions"][0]["commission_amount"] == original_commission


def test_inactive_partner_after_registration_is_not_converted():
    client = ReferralSupabase([attribution()], [partner(active=False)])
    result = convert_registered_referral_after_checkout(client, session(), "user-1")
    assert result["status"] == "inactive_partner"
    assert client.store["referral_attributions"][0]["status"] == "registered"


def test_refund_preserves_original_financial_audit_values():
    row = attribution("converted")
    row.update({
        "stripe_payment_intent_id": "pi_referral",
        "gross_amount": 10.0,
        "commission_amount": 2.0,
    })
    client = ReferralSupabase([row], [partner()])
    result = refund_converted_referral(client, {"payment_intent": "pi_referral"}, "user-1")
    updated = client.store["referral_attributions"][0]
    assert result["status"] == "refunded"
    assert updated["status"] == "refunded"
    assert updated["refunded_at"]
    assert updated["gross_amount"] == 10.0
    assert updated["commission_amount"] == 2.0


def test_failed_referral_update_is_isolated_from_completed_premium_activation():
    client = ReferralSupabase([attribution()], [partner()], fail_updates=True)
    premium_was_activated = True
    result = convert_registered_referral_after_checkout(client, session(), "user-1")
    assert premium_was_activated is True
    assert result["status"] == "failed"
