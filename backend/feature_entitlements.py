"""Central server-side OpeningFit feature packaging and trusted access checks."""

from datetime import datetime, timezone
from typing import Any, Dict, Optional


FEATURE_ACCESS: Dict[str, Dict[str, Any]] = {
    "initial_report": {"tier": "free", "limits": {"reports": 1}},
    "basic_score": {"tier": "free"},
    "style_profile": {"tier": "free"},
    "keep_recommendation": {"tier": "free", "limits": {"items": 1}},
    "repair_recommendation": {"tier": "free", "limits": {"items": 1}},
    "next_action": {"tier": "free", "limits": {"items": 1}},
    "report_refresh": {"tier": "free", "limits": {"minimum_minutes_between_refreshes": 60}},
    "game_history": {"tier": "free", "limits": {"months": 3, "evidence_games": 8}},
    "weekly_plan_preview": {"tier": "free", "limits": {"tasks": 1}},
    "report_comparison": {"tier": "paid"},
    "full_repertoire": {"tier": "paid"},
    "weekly_plan": {"tier": "paid", "limits": {"tasks": 5}},
    "own_game_drills": {"tier": "paid"},
    "training_history": {"tier": "paid"},
    "progress_outcomes": {"tier": "paid"},
    "saved_report_history": {"tier": "paid", "limits": {"reports": 50}},
    "full_recommendation_evidence": {"tier": "paid", "limits": {"evidence_games": 48}},
}


def _parse_timestamp(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def entitlement_has_paid_access(entitlement: Optional[Dict[str, Any]], now: Optional[datetime] = None) -> bool:
    row = entitlement or {}
    access_type = str(row.get("access_type") or "").lower()
    status = str(row.get("status") or "").lower().replace("cancelled", "canceled")
    if access_type == "lifetime":
        return bool(row.get("is_grandfathered_lifetime")) or status in {"active", "trialing"}
    if access_type not in {"monthly_subscription", "annual_subscription"}:
        return False
    if status in {"active", "trialing"}:
        return True
    if status not in {"canceled", "past_due"}:
        return False
    if status == "past_due" and not row.get("premium_since"):
        return False
    period_end = _parse_timestamp(row.get("current_period_end") or row.get("expires_at"))
    return bool(period_end and period_end > (now or datetime.now(timezone.utc)))


def can_use_feature(entitlement: Optional[Dict[str, Any]], feature_name: str, now: Optional[datetime] = None) -> bool:
    feature = FEATURE_ACCESS.get(feature_name)
    if not feature:
        return False
    return feature["tier"] == "free" or entitlement_has_paid_access(entitlement, now)


def feature_limit(entitlement: Optional[Dict[str, Any]], feature_name: str, limit_name: str, default: Any = None) -> Any:
    feature = FEATURE_ACCESS.get(feature_name)
    if not feature:
        return default
    if entitlement_has_paid_access(entitlement):
        paid_overrides = {
            ("game_history", "months"): 12,
            ("game_history", "evidence_games"): 48,
            ("report_refresh", "minimum_minutes_between_refreshes"): 5,
        }
        if (feature_name, limit_name) in paid_overrides:
            return paid_overrides[(feature_name, limit_name)]
    return feature.get("limits", {}).get(limit_name, default)
