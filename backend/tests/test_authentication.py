import json
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from fastapi import HTTPException, Request
from fastapi.testclient import TestClient

import authentication
import main


SUBJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"


def key_pair(algorithm="RS256", kid="key-1"):
    if algorithm == "RS256":
        private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        value = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private.public_key()))
    else:
        private = ec.generate_private_key(ec.SECP256R1())
        value = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(private.public_key()))
    value.update({"kid": kid, "alg": algorithm, "use": "sig"})
    return private, value


def claims(**changes):
    value = {
        "iss": authentication.SUPABASE_AUTH_ISSUER,
        "aud": "authenticated",
        "role": "authenticated",
        "sub": SUBJECT,
        "exp": int(time.time()) + 300,
    }
    value.update(changes)
    return value


def token(private, algorithm="RS256", kid="key-1", payload=None):
    return jwt.encode(payload or claims(), private, algorithm=algorithm, headers={"kid": kid})


def cache_with(*keys, headers=None):
    return authentication.JwksCache(lambda: ({"keys": list(keys)}, headers or {"cache-control": "max-age=600"}))


@pytest.mark.parametrize("algorithm", ["RS256", "ES256"])
def test_valid_asymmetric_user_jwt(algorithm):
    private, public = key_pair(algorithm)
    assert authentication.verify_asymmetric_supabase_token(
        token(private, algorithm), cache=cache_with(public)
    ).id == SUBJECT


@pytest.mark.parametrize(
    "change",
    [
        {"exp": int(time.time()) - 30},
        {"iss": "https://different-project.supabase.co/auth/v1"},
        {"aud": "different-audience"},
        {"role": "service_role"},
        {"sub": "not-a-uuid"},
        {"sub": SUBJECT.upper()},
    ],
)
def test_expired_or_wrong_claims_are_unauthorized(change):
    private, public = key_pair()
    with pytest.raises(authentication.LocalAuthInvalid):
        authentication.verify_asymmetric_supabase_token(
            token(private, payload=claims(**change)), cache=cache_with(public)
        )


def test_malformed_invalid_signature_none_and_algorithm_confusion_are_rejected():
    private, public = key_pair()
    other_private, _ = key_pair()
    for value in (
        "not-a-jwt",
        token(other_private),
        jwt.encode(claims(), key="", algorithm="none", headers={"kid": "key-1"}),
    ):
        with pytest.raises(authentication.LocalAuthInvalid):
            authentication.verify_asymmetric_supabase_token(value, cache=cache_with(public))
    confused = jwt.encode(claims(), key=b"not-the-signing-key-at-least-32-bytes", algorithm="HS256", headers={"kid": "key-1"})
    with pytest.raises(authentication.LegacyHmacToken):
        authentication.verify_asymmetric_supabase_token(confused, cache=cache_with(public))


def test_cached_known_key_remains_usable_during_jwks_outage():
    private, public = key_pair()
    calls = 0

    def fetcher():
        nonlocal calls
        calls += 1
        if calls == 1:
            return {"keys": [public]}, {"cache-control": "max-age=0"}
        raise httpx.ReadTimeout("bounded")

    cache = authentication.JwksCache(fetcher)
    signed = token(private)
    assert authentication.verify_asymmetric_supabase_token(signed, cache=cache).id == SUBJECT
    assert authentication.verify_asymmetric_supabase_token(signed, cache=cache).id == SUBJECT
    assert calls == 2


def test_unknown_kid_refreshes_once_and_supports_rotation():
    private_a, public_a = key_pair(kid="key-a")
    private_b, public_b = key_pair(kid="key-b")
    payloads = [[public_a], [public_a, public_b]]
    calls = 0

    def fetcher():
        nonlocal calls
        value = payloads[calls]
        calls += 1
        return {"keys": value}, {"cache-control": "max-age=600"}

    cache = authentication.JwksCache(fetcher)
    assert authentication.verify_asymmetric_supabase_token(token(private_a, kid="key-a"), cache=cache).id == SUBJECT
    assert authentication.verify_asymmetric_supabase_token(token(private_b, kid="key-b"), cache=cache).id == SUBJECT
    assert calls == 2


def test_unknown_kid_with_unavailable_jwks_is_service_unavailable():
    _, public = key_pair(kid="known")
    private_unknown, _ = key_pair(kid="unknown")
    calls = 0

    def fetcher():
        nonlocal calls
        calls += 1
        if calls == 1:
            return {"keys": [public]}, {"cache-control": "max-age=600"}
        raise httpx.ReadTimeout("bounded")

    cache = authentication.JwksCache(fetcher)
    cache.key("known", "RS256")
    with pytest.raises(authentication.LocalAuthUnavailable):
        authentication.verify_asymmetric_supabase_token(token(private_unknown, kid="unknown"), cache=cache)
    assert calls == 2


def test_jwks_timeout_before_any_cache_is_service_unavailable():
    private, _ = key_pair()
    cache = authentication.JwksCache(lambda: (_ for _ in ()).throw(httpx.ReadTimeout("bounded")))
    with pytest.raises(authentication.LocalAuthUnavailable):
        authentication.verify_asymmetric_supabase_token(token(private), cache=cache)


def test_concurrent_validation_populates_cache_once():
    private, public = key_pair()
    calls = 0
    guard = threading.Lock()

    def fetcher():
        nonlocal calls
        with guard:
            calls += 1
        time.sleep(0.02)
        return {"keys": [public]}, {"cache-control": "max-age=600"}

    cache = authentication.JwksCache(fetcher)
    signed = token(private)
    with ThreadPoolExecutor(max_workers=12) as executor:
        results = list(executor.map(lambda _: authentication.verify_asymmetric_supabase_token(signed, cache=cache).id, range(24)))
    assert results == [SUBJECT] * 24
    assert calls == 1


def bearer(value):
    return Request({"type": "http", "method": "GET", "path": "/test", "headers": [(b"authorization", f"Bearer {value}".encode())]})


def test_local_401_503_and_hs256_remote_fallback_are_distinct(monkeypatch):
    monkeypatch.setattr(main, "log_supabase_diagnostic", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(main, "verify_asymmetric_supabase_token", lambda _token: (_ for _ in ()).throw(authentication.LocalAuthInvalid()))
    with pytest.raises(HTTPException) as invalid:
        main.get_auth_user(bearer("malformed"))
    assert invalid.value.status_code == 401

    monkeypatch.setattr(main, "verify_asymmetric_supabase_token", lambda _token: (_ for _ in ()).throw(authentication.LocalAuthUnavailable()))
    with pytest.raises(HTTPException) as unavailable:
        main.get_auth_user(bearer("asymmetric"))
    assert unavailable.value.status_code == 503

    monkeypatch.setattr(main, "verify_asymmetric_supabase_token", lambda _token: (_ for _ in ()).throw(authentication.LegacyHmacToken()))
    monkeypatch.setattr(main, "get_supabase_admin_client", lambda: SimpleNamespace(
        auth=SimpleNamespace(get_user=lambda _token: SimpleNamespace(user=SimpleNamespace(id=SUBJECT)))
    ))
    assert main.get_auth_user(bearer("legacy-hs256")).id == SUBJECT


def test_local_identity_serves_missions_job_polling_and_existing_route(monkeypatch):
    monkeypatch.setenv("OPENINGFIT_MISSIONS_INTERNAL_USER_ID", SUBJECT)
    monkeypatch.setenv("OPENINGFIT_MISSIONS_ROLLOUT_PERCENT", "0")
    monkeypatch.setattr(main, "missions_enabled", lambda *_args: True)
    monkeypatch.setattr(main, "missions_schema_readiness", lambda: {"ready": True, "training_ready": True})
    monkeypatch.setattr(main, "verify_asymmetric_supabase_token", lambda _token: authentication.VerifiedAuthUser(SUBJECT))
    client = TestClient(main.app)
    headers = {"Authorization": "Bearer asymmetric"}
    assert client.get("/api/features/missions/eligibility", headers=headers).json() == {"enabled": True}
    assert client.get("/api/user-state/chess.com/example", headers=headers).status_code == 410

    job_id = "22222222-2222-4222-8222-222222222222"
    monkeypatch.setattr(main, "prune_analysis_jobs", lambda: None)
    main.analysis_jobs[job_id] = {"jobId": job_id, "status": "queued", "ownerUserId": SUBJECT, "progress": {}}
    try:
        assert client.get(f"/api/analysis/jobs/{job_id}", headers=headers).status_code == 200
    finally:
        main.analysis_jobs.pop(job_id, None)


def test_local_auth_diagnostics_never_contain_token_or_claims(monkeypatch):
    captured = []
    private, _ = key_pair()
    signed = token(private)
    monkeypatch.setattr(main, "verify_asymmetric_supabase_token", lambda _token: (_ for _ in ()).throw(authentication.LocalAuthUnavailable("private")))
    monkeypatch.setattr(main, "log_supabase_diagnostic", lambda message, **details: captured.append((message, details)))
    with pytest.raises(HTTPException):
        main.get_auth_user(bearer(signed))
    rendered = repr(captured)
    assert signed not in rendered
    assert SUBJECT not in rendered
    assert set(captured[0][1]) == {"request_id", "authorization_present", "failure_category", "upstream_status", "exception_class"}
