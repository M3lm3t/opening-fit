"""Safe runtime configuration helpers for OpeningFit deployments."""

from __future__ import annotations

import os
import re
from typing import Any, Mapping, Optional
from urllib.parse import urlparse


PRODUCTION_ORIGINS = (
    "https://openingfit.com",
    "https://www.openingfit.com",
)
DEVELOPMENT_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
)
TRUE_VALUES = {"1", "true", "yes", "on"}
FALSE_VALUES = {"0", "false", "no", "off"}


def runtime_environment(env: Optional[Mapping[str, str]] = None) -> str:
    source = env if env is not None else os.environ
    return str(source.get("APP_ENV") or source.get("ENVIRONMENT") or "development").strip().lower()


def is_production_environment(env: Optional[Mapping[str, str]] = None) -> bool:
    return runtime_environment(env) in {"production", "prod", "live"}


def parse_boolean(value: Any, default: bool = False) -> bool:
    normalized = str(value or "").strip().lower()
    if not normalized:
        return default
    if normalized in TRUE_VALUES:
        return True
    if normalized in FALSE_VALUES:
        return False
    return default


def subscriptions_enabled(env: Optional[Mapping[str, str]] = None) -> bool:
    source = env if env is not None else os.environ
    raw = source.get("OPENINGFIT_SUBSCRIPTIONS_ENABLED")
    if raw is None or not str(raw).strip():
        return not is_production_environment(source)
    return parse_boolean(raw)


def normalize_origin(value: Any) -> str:
    raw = str(value or "").strip().rstrip("/")
    if not raw or "*" in raw:
        return ""
    try:
        parsed = urlparse(raw)
    except ValueError:
        return ""
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return ""
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        return ""
    if parsed.path not in {"", "/"}:
        return ""
    return f"{parsed.scheme}://{parsed.netloc}"


def configured_cors_origins(env: Optional[Mapping[str, str]] = None) -> list[str]:
    source = env if env is not None else os.environ
    candidates = str(source.get("CORS_ALLOWED_ORIGINS") or "").split(",")
    candidates.extend([source.get("FRONTEND_URL", ""), source.get("FRONTEND_URL_WWW", "")])
    origins: list[str] = []
    for candidate in candidates:
        origin = normalize_origin(candidate)
        if origin and origin not in origins:
            origins.append(origin)
    return origins


def build_allowed_origins(env: Optional[Mapping[str, str]] = None) -> list[str]:
    source = env if env is not None else os.environ
    configured = configured_cors_origins(source)
    if is_production_environment(source):
        return configured
    return list(dict.fromkeys([*DEVELOPMENT_ORIGINS, *PRODUCTION_ORIGINS, *configured]))


def _is_https_url(value: Any, *, allow_path: bool = True) -> bool:
    raw = str(value or "").strip()
    try:
        parsed = urlparse(raw)
    except ValueError:
        return False
    if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
        return False
    if parsed.query or parsed.fragment:
        return False
    return allow_path or parsed.path in {"", "/"}


def _looks_like_test_value(value: Any) -> bool:
    normalized = str(value or "").strip().lower()
    return (
        normalized in {"test", "placeholder", "example", "dummy", "changeme"}
        or normalized.startswith(("sk_test_", "price_test", "coupon_test", "test_"))
        or any(marker in normalized for marker in ("placeholder", "example", "dummy", "changeme"))
    )


def validate_runtime_configuration(env: Optional[Mapping[str, str]] = None) -> list[str]:
    source = env if env is not None else os.environ
    if not is_production_environment(source):
        return []

    errors: list[str] = []
    supabase_url = str(source.get("SUPABASE_URL") or "").strip()
    service_key = str(source.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    stripe_key = str(source.get("STRIPE_SECRET_KEY") or "").strip()
    webhook_secret = str(source.get("STRIPE_WEBHOOK_SECRET") or "").strip()
    monthly_price = str(source.get("STRIPE_OPENINGFIT_PLUS_MONTHLY_PRICE_ID") or "").strip()
    annual_price = str(source.get("STRIPE_OPENINGFIT_PLUS_ANNUAL_PRICE_ID") or "").strip()
    frontend_url = str(source.get("FRONTEND_URL") or "").strip()
    portal_return_url = str(source.get("STRIPE_CUSTOMER_PORTAL_RETURN_URL") or "").strip()
    cors_origins = configured_cors_origins(source)

    if not _is_https_url(supabase_url, allow_path=False):
        errors.append("SUPABASE_URL")
    if not service_key or _looks_like_test_value(service_key):
        errors.append("SUPABASE_SERVICE_ROLE_KEY")
    if not stripe_key.startswith("sk_live_") or _looks_like_test_value(stripe_key):
        errors.append("STRIPE_SECRET_KEY")
    if not webhook_secret.startswith("whsec_") or _looks_like_test_value(webhook_secret):
        errors.append("STRIPE_WEBHOOK_SECRET")
    if not monthly_price.startswith("price_") or _looks_like_test_value(monthly_price):
        errors.append("STRIPE_OPENINGFIT_PLUS_MONTHLY_PRICE_ID")
    if not annual_price.startswith("price_") or _looks_like_test_value(annual_price):
        errors.append("STRIPE_OPENINGFIT_PLUS_ANNUAL_PRICE_ID")
    if not _is_https_url(frontend_url, allow_path=False) or normalize_origin(frontend_url) not in PRODUCTION_ORIGINS:
        errors.append("FRONTEND_URL")
    portal_origin = ""
    if _is_https_url(portal_return_url):
        parsed_portal = urlparse(portal_return_url)
        portal_origin = normalize_origin(f"{parsed_portal.scheme}://{parsed_portal.netloc}")
    if not portal_origin or portal_origin not in PRODUCTION_ORIGINS or portal_origin not in cors_origins:
        errors.append("STRIPE_CUSTOMER_PORTAL_RETURN_URL")
    if not str(source.get("CORS_ALLOWED_ORIGINS") or "").strip() or not set(PRODUCTION_ORIGINS).issubset(cors_origins):
        errors.append("CORS_ALLOWED_ORIGINS")

    launch_flag = str(source.get("OPENINGFIT_SUBSCRIPTIONS_ENABLED") or "").strip().lower()
    if launch_flag not in TRUE_VALUES | FALSE_VALUES:
        errors.append("OPENINGFIT_SUBSCRIPTIONS_ENABLED")

    founding_flag = str(source.get("OPENINGFIT_FOUNDING_ANNUAL_OFFER_ENABLED") or "false").strip().lower()
    if founding_flag not in TRUE_VALUES | FALSE_VALUES:
        errors.append("OPENINGFIT_FOUNDING_ANNUAL_OFFER_ENABLED")
    elif founding_flag in TRUE_VALUES:
        coupon = str(source.get("STRIPE_OPENINGFIT_FOUNDING_ANNUAL_COUPON_ID") or "").strip()
        if not coupon or _looks_like_test_value(coupon):
            errors.append("STRIPE_OPENINGFIT_FOUNDING_ANNUAL_COUPON_ID")

    return list(dict.fromkeys(errors))


def assert_valid_startup_configuration(env: Optional[Mapping[str, str]] = None) -> None:
    errors = validate_runtime_configuration(env)
    if errors:
        raise RuntimeError("Invalid production configuration: " + ", ".join(errors))


def readiness_payload(env: Optional[Mapping[str, str]] = None) -> dict[str, str]:
    source = env if env is not None else os.environ
    errors = validate_runtime_configuration(source)
    database_ready = bool(source.get("SUPABASE_URL") and source.get("SUPABASE_SERVICE_ROLE_KEY"))
    stripe_ready = bool(source.get("STRIPE_SECRET_KEY"))
    webhook_ready = bool(source.get("STRIPE_WEBHOOK_SECRET"))
    pricing_ready = bool(
        source.get("STRIPE_OPENINGFIT_PLUS_MONTHLY_PRICE_ID")
        and source.get("STRIPE_OPENINGFIT_PLUS_ANNUAL_PRICE_ID")
    )
    portal_ready = bool(source.get("STRIPE_CUSTOMER_PORTAL_RETURN_URL")) or not is_production_environment(source)
    cors_ready = bool(build_allowed_origins(source)) and (
        not is_production_environment(source)
        or set(PRODUCTION_ORIGINS).issubset(build_allowed_origins(source))
    )
    ready = not errors and all((database_ready, stripe_ready, webhook_ready, pricing_ready, portal_ready, cors_ready))
    return {
        "status": "ready" if ready else "not_ready",
        "database": "configured" if database_ready else "not_configured",
        "stripe": "configured" if stripe_ready else "not_configured",
        "webhook": "configured" if webhook_ready else "not_configured",
        "pricing": "configured" if pricing_ready else "not_configured",
        "portal": "configured" if portal_ready else "not_configured",
        "cors": "configured" if cors_ready else "not_configured",
        "subscriptions": "enabled" if subscriptions_enabled(source) else "disabled",
        "environment": runtime_environment(source),
    }
