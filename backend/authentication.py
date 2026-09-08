"""Strict local verification for Supabase asymmetric access tokens."""

from __future__ import annotations

from dataclasses import dataclass
from email.utils import parsedate_to_datetime
import re
import threading
import time
from typing import Any, Callable, Mapping, Optional
from uuid import UUID

import httpx
import jwt


SUPABASE_PROJECT_REF = "frtjfvhiimgruenqcuon"
SUPABASE_AUTH_ISSUER = f"https://{SUPABASE_PROJECT_REF}.supabase.co/auth/v1"
SUPABASE_JWKS_URL = f"{SUPABASE_AUTH_ISSUER}/.well-known/jwks.json"
ALLOWED_ASYMMETRIC_ALGORITHMS = frozenset({"RS256", "ES256"})
EXPECTED_AUDIENCE = "authenticated"
EXPECTED_ROLE = "authenticated"
JWKS_TIMEOUT_SECONDS = 4.0
DEFAULT_CACHE_SECONDS = 600
MAX_CACHE_SECONDS = 3600


class LocalAuthInvalid(Exception):
    """The token is not a valid authenticated end-user access token."""


class LocalAuthUnavailable(Exception):
    """A required signing key cannot currently be obtained safely."""


class LegacyHmacToken(Exception):
    """HS256 must continue through Supabase Auth; no local secret is used."""


@dataclass(frozen=True)
class VerifiedAuthUser:
    id: str


def _cache_lifetime(headers: Mapping[str, str], now_wall: float) -> int:
    cache_control = str(headers.get("cache-control") or headers.get("Cache-Control") or "")
    match = re.search(r"(?:^|,)\s*max-age\s*=\s*(\d+)", cache_control, flags=re.IGNORECASE)
    if match:
        return max(0, min(MAX_CACHE_SECONDS, int(match.group(1))))
    expires = headers.get("expires") or headers.get("Expires")
    if expires:
        try:
            return max(0, min(MAX_CACHE_SECONDS, int(parsedate_to_datetime(str(expires)).timestamp() - now_wall)))
        except (TypeError, ValueError, OverflowError):
            pass
    return DEFAULT_CACHE_SECONDS


def _fetch_jwks() -> tuple[Mapping[str, Any], Mapping[str, str]]:
    with httpx.Client(
        timeout=httpx.Timeout(JWKS_TIMEOUT_SECONDS, connect=JWKS_TIMEOUT_SECONDS),
        follow_redirects=False,
    ) as client:
        response = client.get(SUPABASE_JWKS_URL, headers={"Accept": "application/json"})
        response.raise_for_status()
        payload = response.json()
        return payload, response.headers


class JwksCache:
    def __init__(
        self,
        fetcher: Callable[[], tuple[Mapping[str, Any], Mapping[str, str]]] = _fetch_jwks,
        *,
        monotonic: Callable[[], float] = time.monotonic,
        wall_time: Callable[[], float] = time.time,
    ):
        self._fetcher = fetcher
        self._monotonic = monotonic
        self._wall_time = wall_time
        self._lock = threading.RLock()
        self._keys: dict[str, jwt.PyJWK] = {}
        self._expires_at = 0.0
        self._generation = 0

    @staticmethod
    def _parse(payload: Mapping[str, Any]) -> dict[str, jwt.PyJWK]:
        if not isinstance(payload, Mapping) or not isinstance(payload.get("keys"), list):
            raise LocalAuthUnavailable("malformed_jwks")
        parsed: dict[str, jwt.PyJWK] = {}
        for value in payload["keys"]:
            if not isinstance(value, Mapping):
                continue
            kid = value.get("kid")
            alg = value.get("alg")
            if not isinstance(kid, str) or not kid or alg not in ALLOWED_ASYMMETRIC_ALGORITHMS:
                continue
            expected_kty = "RSA" if alg == "RS256" else "EC"
            if value.get("kty") != expected_kty:
                continue
            try:
                key = jwt.PyJWK.from_dict(dict(value), algorithm=alg)
            except Exception:
                continue
            if key.algorithm_name == alg:
                parsed[kid] = key
        if not parsed:
            raise LocalAuthUnavailable("no_usable_jwks")
        return parsed

    def key(self, kid: str, algorithm: str) -> jwt.PyJWK:
        with self._lock:
            now = self._monotonic()
            cached = self._keys.get(kid)
            if cached and cached.algorithm_name == algorithm and now < self._expires_at:
                return cached
            previous = cached if cached and cached.algorithm_name == algorithm else None
            try:
                payload, headers = self._fetcher()
                refreshed = self._parse(payload)
                self._keys = refreshed
                self._expires_at = now + _cache_lifetime(headers, self._wall_time())
                self._generation += 1
            except LocalAuthUnavailable:
                if previous:
                    return previous
                raise
            except Exception as exc:
                if previous:
                    return previous
                raise LocalAuthUnavailable(exc.__class__.__name__) from None

            key = self._keys.get(kid)
            if not key:
                raise LocalAuthInvalid("unknown_kid")
            if key.algorithm_name != algorithm:
                raise LocalAuthInvalid("algorithm_key_mismatch")
            return key

    @property
    def generation(self) -> int:
        with self._lock:
            return self._generation


_JWKS_CACHE = JwksCache()


def verify_asymmetric_supabase_token(token: str, *, cache: Optional[JwksCache] = None) -> VerifiedAuthUser:
    active_cache = cache or _JWKS_CACHE
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as exc:
        raise LocalAuthInvalid("malformed_header") from exc

    algorithm = header.get("alg")
    if algorithm == "HS256":
        raise LegacyHmacToken()
    if algorithm not in ALLOWED_ASYMMETRIC_ALGORITHMS:
        raise LocalAuthInvalid("unsupported_algorithm")
    kid = header.get("kid")
    if not isinstance(kid, str) or not kid:
        raise LocalAuthInvalid("missing_kid")

    key = active_cache.key(kid, algorithm)
    try:
        claims = jwt.decode(
            token,
            key=key.key,
            algorithms=[algorithm],
            audience=EXPECTED_AUDIENCE,
            issuer=SUPABASE_AUTH_ISSUER,
            options={"require": ["exp", "sub", "aud", "iss", "role"]},
        )
    except jwt.PyJWTError as exc:
        raise LocalAuthInvalid(exc.__class__.__name__) from None

    if claims.get("role") != EXPECTED_ROLE:
        raise LocalAuthInvalid("wrong_role")
    subject = claims.get("sub")
    if not isinstance(subject, str):
        raise LocalAuthInvalid("missing_subject")
    try:
        subject_uuid = UUID(subject)
    except (ValueError, TypeError, AttributeError):
        raise LocalAuthInvalid("invalid_subject") from None
    if str(subject_uuid) != subject:
        raise LocalAuthInvalid("noncanonical_subject")
    return VerifiedAuthUser(id=subject)


def reset_jwks_cache_for_tests() -> None:
    global _JWKS_CACHE
    _JWKS_CACHE = JwksCache()
