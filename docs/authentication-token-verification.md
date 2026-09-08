# Authentication token verification

OpeningFit accepts Supabase end-user access tokens only after cryptographic verification.

- RS256 and ES256 tokens are verified locally against the fixed production project's Supabase Auth issuer and JWKS endpoint.
- The protected header algorithm must match an allowlisted JWK type and algorithm. A non-empty `kid` is required.
- Signature, issuer, `authenticated` audience, `authenticated` role, expiry, and a canonical UUID subject are mandatory.
- Unsigned tokens, unexpected algorithms, algorithm/key mismatches, service-role tokens, and malformed claims are rejected.
- JWKS requests use a short timeout and a thread-safe, cache-control-aware in-memory cache. A cached known key remains usable during a temporary JWKS outage; an unknown key causes one bounded refresh.
- Legacy HS256 tokens are never verified locally because that would require distributing the project JWT secret. They retain Supabase Auth's remote `get_user` validation.

Local verification removes a live Auth request from normal asymmetric-token requests. Its security trade-off is that a signed access token remains accepted until its expiration even if its session or user is revoked in the meantime. Keep access-token lifetimes appropriately short. Operations that require immediate revocation knowledge need a separately designed online check.

The application logs only a generated request ID, header-presence boolean, failure category, upstream status when available, and exception class. Tokens, claims, user identifiers, email addresses, keys, and configuration values must never be logged.
