import importlib.util
from datetime import datetime, timezone
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "audit_subscription_state.py"
spec = importlib.util.spec_from_file_location("audit_subscription_state", SCRIPT)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def test_clean_subscription_audit_has_no_findings():
    entitlement = {
        "user_id": "user-one",
        "status": "active",
        "access_type": "monthly_subscription",
        "stripe_subscription_id": "sub_active_one",
    }
    event = {
        "event_id": "evt_complete_one",
        "event_type": "invoice.paid",
        "status": "processed",
        "updated_at": "2026-07-18T12:00:00+00:00",
    }
    result = audit.build_audit_findings([entitlement], [event], [{"id": "sub_active_one", "status": "active"}])
    assert result["summary"]["finding_count"] == 0


def test_audit_detects_webhook_and_entitlement_inconsistencies_without_full_ids():
    entitlements = [
        {
            "user_id": "private-user-id",
            "status": "expired",
            "access_type": "monthly_subscription",
            "is_grandfathered_lifetime": True,
            "stripe_subscription_id": None,
            "expires_at": "2026-07-01T00:00:00+00:00",
        },
        {
            "user_id": "cancel-user",
            "status": "canceled",
            "access_type": "annual_subscription",
            "stripe_subscription_id": "sub_cancelled",
            "current_period_end": None,
            "expires_at": None,
        },
    ]
    events = [
        {"event_id": "evt_duplicate", "event_type": "invoice.paid", "status": "failed", "updated_at": "2026-07-18T11:00:00+00:00"},
        {"event_id": "evt_duplicate", "event_type": "invoice.paid", "status": "processing", "updated_at": "2026-07-18T11:00:00+00:00"},
    ]
    result = audit.build_audit_findings(
        entitlements,
        events,
        [{"id": "sub_unmatched", "status": "active"}],
        now=datetime(2026, 7, 18, 12, 0, tzinfo=timezone.utc),
    )
    assert result["summary"]["finding_count"] > 0
    assert result["duplicate_event_refs"]
    assert result["stuck_webhook_events"]
    assert result["subscriptions_without_entitlements"]
    assert result["downgraded_lifetime_entitlements"]
    assert result["canceled_access_end_inconsistencies"]
    assert "private-user-id" not in str(result)


def test_repair_flag_is_explicitly_refused():
    assert audit.main(["--repair"]) == 2
