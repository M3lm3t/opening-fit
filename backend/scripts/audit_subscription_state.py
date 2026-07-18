"""Read-only audit of OpeningFit subscription and webhook state.

Run from the repository root:
  python backend/scripts/audit_subscription_state.py --dry-run
  python backend/scripts/audit_subscription_state.py

The command never prints credentials or full Stripe/user identifiers. Repair is
deliberately not implemented; ``--repair`` exists only to fail explicitly.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable, Optional


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from dotenv import load_dotenv
from supabase import create_client


def safe_ref(value: Any, *, user: bool = False) -> Optional[str]:
    clean = str(value or "").strip()
    if not clean:
        return None
    if user:
        return f"sha256:{hashlib.sha256(clean.encode('utf-8')).hexdigest()[:12]}"
    return f"...{clean[-8:]}" if len(clean) > 8 else "[short-id]"


def parse_time(value: Any) -> Optional[datetime]:
    try:
        parsed = datetime.fromisoformat(str(value or "").replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def public_entitlement(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "user_ref": safe_ref(row.get("user_id"), user=True),
        "entitlement_ref": safe_ref(row.get("id") or row.get("user_id")),
        "subscription_ref": safe_ref(row.get("stripe_subscription_id")),
        "access_type": row.get("access_type"),
        "status": row.get("status"),
    }


def public_event(row: dict[str, Any]) -> dict[str, Any]:
    raw_error = str(row.get("last_error") or "").strip()
    safe_error = raw_error if re.fullmatch(r"[A-Za-z][A-Za-z0-9_.]{0,80}", raw_error) else ("[redacted-error]" if raw_error else None)
    return {
        "event_ref": safe_ref(row.get("event_id")),
        "event_type": row.get("event_type"),
        "status": row.get("status"),
        "attempt_count": row.get("attempt_count"),
        "updated_at": row.get("updated_at"),
        "last_error": safe_error,
    }


def build_audit_findings(
    entitlements: Iterable[dict[str, Any]],
    webhook_events: Iterable[dict[str, Any]],
    stripe_subscriptions: Optional[Iterable[dict[str, Any]]] = None,
    *,
    now: Optional[datetime] = None,
    stuck_minutes: int = 5,
) -> dict[str, Any]:
    current = now or datetime.now(timezone.utc)
    entitlements = list(entitlements)
    events = list(webhook_events)
    subscription_rows = list(stripe_subscriptions) if stripe_subscriptions is not None else None
    stuck_before = current - timedelta(minutes=max(1, stuck_minutes))

    event_counts = Counter(str(row.get("event_id") or "") for row in events if row.get("event_id"))
    user_active_counts = Counter(
        str(row.get("user_id") or "")
        for row in entitlements
        if str(row.get("status") or "").lower() in {"active", "trialing", "past_due", "canceled"}
    )
    entitlement_subscription_ids = {
        str(row.get("stripe_subscription_id"))
        for row in entitlements
        if row.get("stripe_subscription_id")
    }

    unprocessed = [row for row in events if str(row.get("status") or "").lower() == "processing"]
    failed = [row for row in events if str(row.get("status") or "").lower() == "failed"]
    stuck = [row for row in unprocessed if not parse_time(row.get("updated_at")) or parse_time(row.get("updated_at")) <= stuck_before]
    duplicates = [event_id for event_id, count in event_counts.items() if count > 1]
    subscriptions_without_entitlements = [] if subscription_rows is None else [
        row for row in subscription_rows if str(row.get("id") or "") not in entitlement_subscription_ids
    ]
    missing_subscription_id = [
        row for row in entitlements
        if row.get("access_type") in {"monthly_subscription", "annual_subscription"}
        and str(row.get("status") or "").lower() in {"active", "trialing", "past_due", "canceled"}
        and not row.get("stripe_subscription_id")
    ]
    multiple_active = [user_id for user_id, count in user_active_counts.items() if user_id and count > 1]
    downgraded_lifetime = [
        row for row in entitlements
        if row.get("is_grandfathered_lifetime") is True
        and (
            row.get("access_type") != "lifetime"
            or row.get("status") != "active"
            or row.get("expires_at") is not None
            or row.get("current_period_end") is not None
            or row.get("cancel_at_period_end") is True
        )
    ]
    canceled_inconsistent = [
        row for row in entitlements
        if row.get("access_type") in {"monthly_subscription", "annual_subscription"}
        and (str(row.get("status") or "").lower() == "canceled" or row.get("cancel_at_period_end") is True)
        and (
            not row.get("current_period_end")
            or (
                str(row.get("status") or "").lower() == "canceled"
                and row.get("expires_at") != row.get("current_period_end")
            )
        )
    ]

    return {
        "summary": {
            "entitlements_checked": len(entitlements),
            "webhook_events_checked": len(events),
            "stripe_subscriptions_checked": None if subscription_rows is None else len(subscription_rows),
            "finding_count": len(unprocessed) + len(failed) + len(stuck) + len(duplicates)
            + len(subscriptions_without_entitlements) + len(missing_subscription_id)
            + len(multiple_active) + len(downgraded_lifetime) + len(canceled_inconsistent),
        },
        "unprocessed_webhook_events": [public_event(row) for row in unprocessed],
        "failed_webhook_events": [public_event(row) for row in failed],
        "stuck_webhook_events": [public_event(row) for row in stuck],
        "duplicate_event_refs": [safe_ref(value) for value in duplicates],
        "subscriptions_without_entitlements": [
            {"subscription_ref": safe_ref(row.get("id")), "status": row.get("status")}
            for row in subscriptions_without_entitlements
        ],
        "subscription_entitlements_without_subscription_ids": [public_entitlement(row) for row in missing_subscription_id],
        "multiple_active_entitlement_user_refs": [safe_ref(value, user=True) for value in multiple_active],
        "downgraded_lifetime_entitlements": [public_entitlement(row) for row in downgraded_lifetime],
        "canceled_access_end_inconsistencies": [public_entitlement(row) for row in canceled_inconsistent],
    }


def load_rows(client, table: str, columns: str) -> list[dict[str, Any]]:
    result = client.table(table).select(columns).execute()
    return list(result.data or [])


def load_stripe_subscriptions(secret_key: str) -> list[dict[str, Any]]:
    if not secret_key:
        return []
    import stripe

    stripe.api_key = secret_key
    return [dict(item) for item in stripe.Subscription.list(status="all", limit=100).auto_paging_iter()]


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Read-only OpeningFit subscription audit")
    parser.add_argument("--dry-run", action="store_true", help="Validate audit configuration without external reads")
    parser.add_argument("--without-stripe", action="store_true", help="Skip the Stripe subscription cross-check")
    parser.add_argument("--repair", action="store_true", help="Reserved guard; repair is not implemented")
    parser.add_argument("--stuck-minutes", type=int, default=5)
    args = parser.parse_args(argv)

    if args.repair:
        print(json.dumps({"status": "refused", "reason": "repair_not_implemented"}))
        return 2

    load_dotenv(ROOT / ".env")
    load_dotenv(ROOT / ".env.local", override=False)
    supabase_url = str(os.getenv("SUPABASE_URL") or "").strip()
    service_key = str(os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    stripe_key = str(os.getenv("STRIPE_SECRET_KEY") or "").strip()

    if args.dry_run:
        print(json.dumps({
            "status": "dry_run",
            "supabase": "configured" if supabase_url and service_key else "not_configured",
            "stripe_cross_check": "skipped" if args.without_stripe else ("configured" if stripe_key else "not_configured"),
            "read_only": True,
        }, sort_keys=True))
        return 0

    if not supabase_url or not service_key:
        print(json.dumps({"status": "blocked", "missing": [
            name for name, present in (("SUPABASE_URL", supabase_url), ("SUPABASE_SERVICE_ROLE_KEY", service_key)) if not present
        ]}, sort_keys=True))
        return 2
    if not args.without_stripe and not stripe_key:
        print(json.dumps({"status": "blocked", "missing": ["STRIPE_SECRET_KEY"]}))
        return 2

    try:
        client = create_client(supabase_url, service_key)
        entitlements = load_rows(
            client,
            "premium_entitlements",
            "user_id,status,access_type,is_grandfathered_lifetime,stripe_subscription_id,expires_at,current_period_end,cancel_at_period_end",
        )
        events = load_rows(
            client,
            "stripe_webhook_events",
            "event_id,event_type,status,attempt_count,updated_at,last_error",
        )
        subscriptions = None if args.without_stripe else load_stripe_subscriptions(stripe_key)
    except Exception as exc:
        print(json.dumps({"status": "failed", "error_type": exc.__class__.__name__, "retryable": True}, sort_keys=True))
        return 2
    findings = build_audit_findings(entitlements, events, subscriptions, stuck_minutes=args.stuck_minutes)
    print(json.dumps(findings, indent=2, sort_keys=True))
    return 1 if findings["summary"]["finding_count"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
