# ADR-003: JWTs are validated statefully, not statelessly

**Status:** Accepted
**Date:** 2026-05-02
**Supersedes / amends:** none

## Context

NKS issues two RS256-signed JWTs:

1. **Access JWT** — 15-minute TTL, sent as `Authorization: Bearer` on every API
   request. Claims: `sub` (user guuid), `sid` (session guuid), `jti`, roles,
   `aud='nks-app'`, `iss='nks-auth'`.
2. **Offline JWT** — 3-day TTL, mobile-only, used for offline UI gating and
   to verify "I am authenticated" without a network round-trip.

The architecture exposes the RSA public key via `GET /api/v1/auth/mobile-jwks`
in JWKS format. This is used by mobile clients to verify the offline JWT.

## Decision

**Access JWTs are validated through `AuthGuard`, which performs a DB lookup on
`user_session` and rejects rows with `refresh_token_revoked_at IS NOT NULL`.**

There is no `jti_blocklist` table. There is no stateless validation path for
access JWTs anywhere in the NKS codebase.

## Consequences

### What is enforced

- A revoked session is rejected immediately on the next request, not after the
  JWT expires. The `findSessionAuthContext` query filters revoked rows in its
  `WHERE` clause; no separate blocklist needed.
- Logout, account block, account lock, and refresh-token theft detection all
  set `refresh_token_revoked_at`. AuthGuard sees this on the next call.

### What is intentionally NOT supported

- **Stateless JWT validation by any service that does not also hit AuthGuard.**
  If service X verifies a JWT using only its signature and `exp` claim (the
  classic JWKS pattern), that service has no revocation path: a stolen JWT
  remains valid for its full 15-minute TTL after the underlying session is
  revoked.

### Why this is acceptable today

- NKS is a single backend. Every authenticated request hits AuthGuard.
- The mobile offline JWT (different token, 3-day TTL) has its own revocation
  mechanism: `revoked_devices` table, checked on every sync push.
- The JWKS endpoint serves the **offline JWT** verification use case, not
  stateless access-JWT validation.

## Tripwire — when this ADR must be revisited

You **must** restore the JTI blocklist before:

- Adding a microservice that validates access JWTs without proxying through
  AuthGuard.
- Putting a CDN, edge worker, or API gateway in front of NKS that performs
  JWT verification.
- Sharing the JWKS endpoint with a third-party that consumes access JWTs.
- Lengthening the access-JWT TTL beyond ~5 minutes (the gap window matters
  more as the TTL grows).

### Restoration guide

The JTI blocklist was implemented and removed once. Reference the historical
implementation in `git log --all --oneline -- '**/jti-blocklist*'` (migration
`0007_drop_jti_blocklist.sql` shows the schema being dropped). Restoring requires:

1. Schema: `jti_blocklist` table with `jti uuid PRIMARY KEY`,
   `expires_at timestamptz`, indexed on `expires_at` for cleanup.
2. JOIN in `findSessionAuthContext`: left join on
   `jti_blocklist.jti = user_session.jti AND expires_at > NOW()`, return
   `revokedJti` flag.
3. Validator: `SessionValidatorService` rejects with
   `AUTH_TOKEN_INVALID` when `revokedJti` is non-null.
4. Revocation: `SessionRevocationRepository.revokeSession` and
   `revokeAllForUser` insert the session's `jti` with
   `expires_at = now + ACCESS_TOKEN_TTL_MS`.
5. Cleanup: `SessionCleanupService` deletes rows where
   `expires_at < NOW()`.

## Why an ADR instead of "just add the blocklist defensively"

Adding the blocklist costs:

- A table + index + cleanup cron
- A JOIN on the hottest auth-context query (every authenticated request)
- A second revocation path in `revokeSession` that must be kept in sync with
  the primary `refresh_token_revoked_at` write

For a gap that **no code path can currently reach**, this is YAGNI. The ADR
preserves the design rationale so the next engineer who considers adding
stateless validation finds the cost-benefit analysis already done.
