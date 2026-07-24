from datetime import datetime, timezone
from pathlib import Path

from feature_entitlements import can_use_feature, entitlement_has_paid_access, feature_limit, normalise_entitlement_record


NOW = datetime(2026, 7, 18, tzinfo=timezone.utc)


def test_anonymous_and_authenticated_free_receive_the_useful_free_package():
    for entitlement in (None, {}):
        assert can_use_feature(entitlement, "basic_score", NOW)
        assert can_use_feature(entitlement, "style_profile", NOW)
        assert can_use_feature(entitlement, "next_action", NOW)
        assert not can_use_feature(entitlement, "weekly_plan", NOW)
        assert feature_limit(entitlement, "game_history", "months") == 3
        assert feature_limit(entitlement, "report_refresh", "minimum_minutes_between_refreshes") == 60


def test_monthly_annual_and_lifetime_receive_paid_features():
    entitlements = [
        {"access_type": "monthly_subscription", "status": "active"},
        {"access_type": "annual_subscription", "status": "active"},
        {"access_type": "lifetime", "status": "active"},
        {"access_type": "lifetime", "status": "expired", "is_grandfathered_lifetime": True},
    ]
    for entitlement in entitlements:
        assert entitlement_has_paid_access(entitlement, NOW)
        assert can_use_feature(entitlement, "report_comparison", NOW)
        assert can_use_feature(entitlement, "own_game_drills", NOW)
        assert feature_limit(entitlement, "report_refresh", "minimum_minutes_between_refreshes") == 5


def test_legacy_active_non_expiring_entitlement_is_adapted_as_lifetime():
    legacy = {"status": "active", "expires_at": None, "stripe_subscription_id": None}
    adapted = normalise_entitlement_record(legacy)
    assert adapted["access_type"] == "lifetime"
    assert adapted["is_grandfathered_lifetime"] is True
    assert entitlement_has_paid_access(legacy, NOW)


def test_legacy_subscription_marker_is_not_misclassified_as_lifetime():
    legacy_subscription = {"status": "active", "expires_at": None, "stripe_subscription_id": "sub_legacy"}
    assert normalise_entitlement_record(legacy_subscription).get("access_type") is None
    assert not entitlement_has_paid_access(legacy_subscription, NOW)


def test_canceled_is_active_only_until_period_end_and_expired_is_free():
    current = {"access_type": "annual_subscription", "status": "canceled", "current_period_end": "2026-08-01T00:00:00Z"}
    expired = {"access_type": "annual_subscription", "status": "canceled", "current_period_end": "2026-07-01T00:00:00Z"}
    assert can_use_feature(current, "saved_report_history", NOW)
    assert not can_use_feature(expired, "saved_report_history", NOW)
    assert can_use_feature(expired, "initial_report", NOW)


def test_backend_routes_resolve_entitlement_before_large_imports_and_engine_actions():
    source = (Path(__file__).parents[1] / "main.py").read_text(encoding="utf-8")
    assert "months = enforce_game_history_limit(request, payload.months)" in source
    assert 'require_feature_access(request, "own_game_drills")' in source
    assert source.count('require_feature_access(request, "own_game_drills")') >= 3
    migration = (Path(__file__).parents[2] / "supabase" / "migrations" / "202607180004_feature_entitlement_enforcement.sql").read_text(encoding="utf-8")
    assert "openingfit_has_paid_access" in migration
    assert "require_paid_mutation" in migration
    assert "report_history_insert_own" in migration
