# NKS Offline-First — Implementation Plan

**Reference:** [MOBILE_OFFLINE_FLOW.md](MOBILE_OFFLINE_FLOW.md) — 21 sections, 26 tracked fixes

This plan turns the architecture document into ordered implementation steps. Each step lists the exact files to create or modify, the section of MOBILE_OFFLINE_FLOW.md it implements, and what must be done before it can start.

---

## Current State (What Already Exists)

| Component | Status | Notes |
|-----------|--------|-------|
| Better Auth (basic) | ✅ Exists | `bearer()` plugin only — missing `expo()`, `jwt()`, `admin()` |
| JWTConfigService | ✅ Exists | `signOfflineToken()` exists but hardcoded 7-day TTL, no `expiresIn` param |
| JWKS endpoint | ✅ Exists | At `/.well-known/jwks.json` — needs NKS-specific `/api/v1/auth/nks-jwks` |
| `getCurrentKid()` | ❌ Missing | Kid is private property, no public getter |
| `getPublicKeyAsJwk()` | ❌ Missing | `getPublicKeyAsJWKS()` exists but returns full JWKS, not single JWK |
| AuthService `hashRoles()` | ⚠️ Unsorted | Maps directly without `.sort()` — false-positive rolesChanged |
| AuthService `enforceSessionLimit()` | ⚠️ Not atomic | Loop-based delete, race condition |
| AuthService `profileComplete()` | ⚠️ Partial | Uses transaction but doesn't thread `tx` to repository calls |
| Auth flow orchestrator | ✅ Exists | Calls `createTokenPair()` + `buildAuthResponse()` |
| SyncModule / SyncController | ❌ Missing | No sync endpoints at all |
| `idempotency_log` table | ❌ Missing | No schema definition |
| Routes table sync columns | ❌ Missing | No `version`, `name_updated_at`, `status_updated_at` |
| PowerSync token endpoint | ❌ Missing | No PowerSync integration |
| CORS for mobile | ❌ Missing | Does not allow `undefined` origin |
| Mobile: PowerSync SDK | ❌ Missing | Uses WatermelonDB currently |
| Mobile: Auth store | Redux | Needs migration to Zustand |
| Mobile: JWTManager | ❌ Missing | Token management split across multiple files |
| Mobile: write-guard | ❌ Missing | No offline write protection |
| Mobile: fetch-with-timeout | ❌ Missing | Relies on backend 25s timeout |
| Mobile: device-manager | ❌ Missing | Device utils exist but no centralized manager |
| Mobile: reconnection-handler | ❌ Missing | Basic network state in `offline-mode.ts` |
| Mobile: PowerSync connector | ❌ Missing | No PowerSync SDK installed |

---

## Implementation Order

### Phase 1: Backend Auth Fixes (No Breaking Changes)

These fixes are internal to the backend. They don't change any API contract and can be deployed independently. Apply all 10 AuthService fixes from MOBILE_OFFLINE_FLOW.md Section 5.

#### Step 1.1 — Fix `hashRoles()` sorting (Fix #2)

**Doc reference:** Section 5 → `hashRoles (Fix #2)`

**File:** `src/modules/auth/services/auth.service.ts`

**Change:** Add `.sort()` before hashing in `hashRoles()`:
```typescript
private hashRoles(roles: UserRoleEntry[]): string {
  const sorted = roles
    .map((r) => `${r.roleCode}:${r.storeId ?? 'null'}`)
    .sort();  // ← ADD THIS
  return crypto.createHash('sha256')
               .update(JSON.stringify(sorted))
               .digest('hex');
}
```

**Why first:** Zero-risk fix. Prevents false-positive `rolesChanged` detection on every token refresh for multi-role users. No API changes.

**Depends on:** Nothing.

---

#### Step 1.2 — Fix `enforceSessionLimit()` race condition (Fix #5)

**Doc reference:** Section 5 → `enforceSessionLimit (Fix #5)`

**Files:**
- `src/modules/auth/services/auth.service.ts` — simplify `enforceSessionLimit()`
- `src/modules/auth/repositories/sessions.repository.ts` — add `deleteExcessSessions()`

**Change:** Replace loop-based delete with single atomic SQL:
```typescript
// sessions.repository.ts
async deleteExcessSessions(userId: number, maxAllowed: number): Promise<void> {
  await this.db.execute(sql`
    DELETE FROM user_session
    WHERE user_fk = ${userId}
      AND id NOT IN (
        SELECT id FROM user_session
        WHERE user_fk = ${userId}
        ORDER BY created_at DESC
        LIMIT ${maxAllowed}
      )
  `);
}
```

**Depends on:** Nothing.

---

#### Step 1.3 — Fix `rotateSession()` token validation (Fix #3)

**Doc reference:** Section 5 → `rotateSession (Fix #3)`

**File:** `src/modules/auth/services/auth.service.ts`

**Change:** Validate `oldToken` belongs to `userId` before deleting:
```typescript
async rotateSession(oldToken: string, userId: number) {
  const session = await this.sessionsRepository.findByToken(oldToken);
  if (!session || session.userId !== userId) {
    throw new UnauthorizedException('Invalid session token');
  }
  await this.sessionsRepository.delete(session.id);
  return this.createSessionForUser(userId);
}
```

**Depends on:** Nothing.

---

#### Step 1.4 — Fix `refreshAccessToken()` transaction + audience (Fixes #4, #8)

**Doc reference:** Section 5 → `refreshAccessToken (Fixes #4, #8)`

**Files:**
- `src/modules/auth/services/auth.service.ts` — wrap session updates in `db.transaction()`, use `JWT_AUDIENCE` constant
- Add `const JWT_AUDIENCE = 'nks-app'` at module level

**Change:** Replace `Promise.all` with `db.transaction()` for atomicity. Extract `JWT_AUDIENCE` constant and use it in `createSessionForUser`, `createTokenPair`, `refreshAccessToken`, and `verifyClaims`.

**Depends on:** Nothing.

---

#### Step 1.5 — Fix `profileComplete()` transaction threading + password hash (Fixes #1, #17)

**Doc reference:** Section 5 → `profileComplete (Fix #1)`

**Files:**
- `src/modules/auth/services/auth.service.ts` — move `passwordService.hash()` outside transaction, thread `tx`
- `src/modules/auth/repositories/auth-users.repository.ts` — add `tx?: Db` parameter to all mutating methods
- `src/modules/auth/repositories/auth-provider.repository.ts` — add `tx?: Db` parameter

**Change:** Every repository method inside the transaction callback must accept and use `tx`. Compute password hash before the transaction opens.

**Depends on:** Nothing.

---

#### Step 1.6 — Fix session expiry comment + constant alignment (Fixes #9, #10)

**Doc reference:** Section 5 → `buildAuthResponse (Fix #9)`, Constants section

**File:** `src/modules/auth/services/auth.service.ts`

**Change:** Correct `refreshExpiresAt` to 7 days. Ensure `MAX_CONCURRENT_SESSIONS = 5` with no misleading comments.

**Depends on:** Nothing.

---

### Phase 2: Backend Token Architecture (Dual-Token + JWKS)

These changes modify the token system. Deploy after Phase 1 is stable.

#### Step 2.1 — Update `signOfflineToken()` with configurable TTL (Fix #12)

**Doc reference:** Section 4 → `JWTConfigService`

**File:** `src/config/jwt.config.ts`

**Changes:**
1. Add `expiresIn: string = '3d'` parameter to `signOfflineToken()`
2. Add `getCurrentKid(): string` public method
3. Add `getPublicKeyAsJwk(): crypto.JsonWebKey` method
4. Add `computeKidFromPublicKey()` private method
5. Add `import * as jwt from 'jsonwebtoken'` if not present (Fix #18)

```typescript
const OFFLINE_JWT_TTL_DAYS = 3;
const OFFLINE_JWT_EXPIRATION = `${OFFLINE_JWT_TTL_DAYS}d`;

signOfflineToken(payload, expiresIn: string = '3d'): string { ... }
getCurrentKid(): string { return this.currentKid; }
getPublicKeyAsJwk(): crypto.JsonWebKey { return this.publicKey.export({ format: 'jwk' }); }
```

**Depends on:** Nothing.

---

#### Step 2.2 — Add `/api/v1/auth/nks-jwks` endpoint (Fix #11)

**Doc reference:** Section 4 → `NKS JWKS endpoint`

**File:** `src/modules/auth/controllers/auth.controller.ts`

**Change:** Add new `@Get('nks-jwks') @Public()` endpoint that calls `jwtConfigService.getPublicKeyAsJwk()` and returns JWKS format with `alg: 'RS256'`.

**Depends on:** Step 2.1 (`getPublicKeyAsJwk()` and `getCurrentKid()` must exist).

---

#### Step 2.3 — Update `createTokenPair()` to 15-min TTL (Fix #7)

**Doc reference:** Section 5 → `createTokenPair (Fixes #7, #8)`

**File:** `src/modules/auth/services/auth.service.ts`

**Change:** Change access token TTL from `1 * 60 * 60 * 1000` to `15 * 60 * 1000`.

**Depends on:** Phase 1 completed (JWT_AUDIENCE constant already extracted in Step 1.4).

---

#### Step 2.4 — Update `buildAuthResponse()` to include offline token in response body

**Doc reference:** Section 5 → `buildAuthResponse (Fix #9)`, Section 8

**Files:**
- `src/modules/auth/services/auth.service.ts` — pass `OFFLINE_JWT_EXPIRATION` to `signOfflineToken()`
- `src/modules/auth/mapper/auth-mapper.ts` — include `offlineToken` in response envelope
- `src/modules/auth/dto/auth-response.dto.ts` — add `offlineToken` field to DTO

**Change:** The login response must include `tokens.offlineToken` alongside `tokens.accessToken` and `tokens.refreshToken`.

**Depends on:** Step 2.1 (`signOfflineToken` accepts TTL), Step 2.3 (correct access TTL).

---

#### Step 2.5 — Update `refreshAccessToken()` to return offline token

**Doc reference:** Section 5 → `refreshAccessToken (Fixes #4, #8)`

**File:** `src/modules/auth/services/auth.service.ts`

**Change:** After generating a new access token and refresh token, also generate a fresh offline token with `OFFLINE_JWT_EXPIRATION` and include it in the response.

**Depends on:** Steps 2.1, 2.4.

---

### Phase 3: Better Auth Plugin Configuration

#### Step 3.1 — Add Better Auth plugins (expo, jwt, admin)

**Doc reference:** Section 4 → Better Auth configuration

**Files:**
- `src/modules/auth/config/better-auth.ts` — add `expo()`, `jwt()`, `admin()` plugins
- `package.json` — add `@better-auth/expo` dependency

**Change:** Update `getAuth()` to include all four plugins. Add EdDSA JWKS config for Better Auth's internal use (separate from NKS RS256 JWKS).

**Depends on:** Nothing (can run in parallel with Phase 2).

---

#### Step 3.2 — Update CORS for mobile clients

**Doc reference:** Section 4 → `trustedOrigins`

**File:** `src/config/cors.config.ts`

**Changes:**
1. Allow `undefined` origin (mobile apps send no Origin header)
2. Add `X-Client-Type`, `X-Device-Fingerprint`, `X-Idempotency-Key` to allowed headers
3. Add `Cookie` to allowed headers explicitly

```typescript
origin: (origin, callback) => {
  if (!origin) return callback(null, true);  // mobile
  if (allowedOrigins.includes(origin)) callback(null, origin);
  else callback(new Error('CORS origin not allowed'));
},
```

**Depends on:** Nothing.

---

### Phase 4: Database Schema for Sync

#### Step 4.1 — Add `idempotency_log` table

**Doc reference:** Section 17 → Database schema

**Files:**
- `src/core/database/schema/auth/idempotency-log/idempotency-log.table.ts` — new
- `src/core/database/schema/auth/idempotency-log/index.ts` — new
- `src/core/database/schema/auth/index.ts` — add export
- Database migration — create table

**Depends on:** Nothing.

---

#### Step 4.2 — Add sync columns to syncable tables

**Doc reference:** Section 17 → Database schema

**Files:**
- Add `version`, `name_updated_at`, `status_updated_at` columns to any tables that will sync with mobile (routes, locations, etc.)
- Create SQL migration with `bump_version()` trigger function

**Note:** The `routes` table in `src/core/database/schema/rbac/routes/` is for RBAC navigation routes, not delivery routes. If delivery routes are a separate domain entity, you may need to create a new `delivery_routes` table. Verify which tables need sync columns based on your domain model.

**Depends on:** Nothing.

---

#### Step 4.3 — Configure PostgreSQL WAL for PowerSync

**Doc reference:** Section 17 → SQL migrations

**Change:** Run on your PostgreSQL instance:
```sql
ALTER SYSTEM SET wal_level = logical;
ALTER SYSTEM SET max_replication_slots = 10;
SELECT pg_reload_conf();
```

**Warning:** Changing `wal_level` requires a PostgreSQL restart. Schedule this during a maintenance window.

**Depends on:** Nothing.

---

### Phase 5: Backend Sync Endpoints

#### Step 5.1 — Create SyncModule + SyncController

**Doc reference:** Section 16 → Backend sync push handler

**Files:**
- `src/modules/sync/sync.module.ts` — new
- `src/modules/sync/sync.controller.ts` — new (POST /api/v1/sync/push)
- `src/app.module.ts` — import SyncModule

**Implementation:** The controller handles:
- Input validation (`operations` array guard, `op.op` validation)
- Per-operation transaction (idempotency check + mutation + log)
- Field-level merge conflict resolution
- Spread order security (client data first, server fields override)

All 6 sync-related fixes (#14, #21, #22, #23, #25) are built in from the start.

**Depends on:** Step 4.1 (idempotency_log table), Step 4.2 (sync columns).

---

#### Step 5.2 — Create PowerSync token endpoint

**Doc reference:** Section 16 → Backend PowerSync token endpoint

**Files:**
- `src/modules/sync/powersync-token.controller.ts` — new
- Or add to existing auth.controller.ts

**Implementation:** Signs a 5-minute RS256 JWT with PowerSync-specific audience using `jose` library.

**Depends on:** Step 2.1 (JWTConfigService key access).

---

#### Step 5.3 — Add session-status endpoint for revocation check

**Doc reference:** Section 15 → Step 1: Revocation check

**File:** `src/modules/auth/controllers/auth.controller.ts`

**Change:** Add `GET /api/v1/auth/session-status` that returns `{ revoked, wipe }` based on session state.

**Depends on:** Nothing.

---

### Phase 6: Mobile Foundation

These steps set up the mobile infrastructure before any PowerSync work.

#### Step 6.1 — Install dependencies

**Doc reference:** Section 3 (utilities), Section 10 (JWTManager)

**File:** `apps/nks-mobile/package.json`

```bash
npx expo install expo-secure-store expo-crypto expo-local-authentication expo-network
npx expo install jose jwt-decode react-native-device-info react-native-ssl-public-key-pinning
npx expo install zustand
npx expo install @powersync/react-native
npx expo install uuidv7
```

**Depends on:** Nothing.

---

#### Step 6.2 — Create shared utilities

**Doc reference:** Section 3

**Files:**
- `apps/mobile/src/lib/fetch-with-timeout.ts` — new (AbortController wrapper)
- `apps/mobile/src/lib/logger.ts` — new (plain factory, not React hook)

**Depends on:** Step 6.1.

---

#### Step 6.3 — Create DeviceManager

**Doc reference:** Section 9 → Device fingerprint manager

**File:** `apps/mobile/src/lib/device-manager.ts` — new

**Implementation:** `verifyFingerprint()`, `getFingerprint()`, `persistFingerprint()`, `generateFingerprint()` using `expo-crypto` SHA-256.

**Depends on:** Step 6.1, Step 6.2.

---

#### Step 6.4 — Create JWTManager (dual-token)

**Doc reference:** Section 10 → JWTManager

**File:** `apps/mobile/src/lib/jwt-manager.ts` — new

**Implementation:**
- `hydrate()` — reads `auth.jwt.access`, `auth.jwt.offline`, `auth.jwks.cache`, `auth.offline.meta` from SecureStore into memory
- `getOfflineStatus()` — synchronous, reads offline token's `exp` directly
- `getAccessToken(isOnline)` — returns cached or refreshes
- `verifyOfflineToken()` — offline verification via cached NKS RS256 JWKS
- `persistTokens()` — stores all 3 tokens
- `cacheJWKS()` — fetches from `/api/v1/auth/nks-jwks`
- `refreshFromServer()` — `POST /api/auth/refresh` with flat response mapping (Fix #19)

**Depends on:** Step 6.2 (fetchWithTimeout), Step 2.2 (nks-jwks endpoint exists on backend).

---

#### Step 6.5 — Create write guard

**Doc reference:** Section 13 → Write guard

**File:** `apps/mobile/src/lib/write-guard.ts` — new

**Implementation:** `assertWriteAllowed()` checks `jwtManager.getOfflineStatus().mode` and throws `OFFLINE_SESSION_EXPIRED` if expired.

**Depends on:** Step 6.4 (JWTManager).

---

#### Step 6.6 — Migrate auth store from Redux to Zustand

**Doc reference:** Section 9 → Auth store (Zustand)

**Files:**
- `apps/mobile/src/stores/auth.ts` — new Zustand store
- `apps/mobile/store/auth-slice.ts` — deprecated / removed
- `apps/mobile/store/index.ts` — remove auth from Redux store
- All components using `useSelector` for auth — update imports

**Implementation:**
- `status`: `'idle' | 'authenticated' | 'locked' | 'unauthenticated'`
- `hydrate()` — calls `jwtManager.getOfflineStatus()` and sets status
- Uses reactive selector `useAuthStore((s) => s.status)` (Fix #20)

**Depends on:** Step 6.4 (JWTManager).

---

#### Step 6.7 — Update `_layout.tsx` with hydration flow

**Doc reference:** Section 9 → App startup

**File:** `apps/mobile/app/_layout.tsx`

**Change:**
- Hold splash screen until `jwtManager.hydrate()` + `deviceManager.verifyFingerprint()` + `authStore.hydrate()` complete
- Use `useAuthStore((s) => s.status)` for `Stack.Protected` guard (Fix #20)

**Depends on:** Steps 6.3, 6.4, 6.6.

---

### Phase 7: Mobile Auth Client + Token Refresh

#### Step 7.1 — Create Better Auth Expo client

**Doc reference:** Section 6

**File:** `apps/mobile/src/lib/auth-client.ts` — new

**Implementation:** `createAuthClient` with `expoClient()` + `jwtClient()` plugins.

**Depends on:** Step 6.1, Step 3.1 (backend has expo plugin).

---

#### Step 7.2 — Register proactive JWT refresh

**Doc reference:** Section 11

**File:** `apps/mobile/src/lib/jwt-refresh.ts` — new

**Implementation:** `registerProactiveRefresh()` — listens to `AppState` changes, refreshes access token if < 3 min remain.

**Depends on:** Step 6.4 (JWTManager).

---

#### Step 7.3 — Update login flow to store dual tokens

**Doc reference:** Section 7 → Login flow

**Files:**
- `apps/mobile/features/auth/hooks/useOtpVerify.ts` — after OTP success, store `accessToken`, `offlineToken`, `refreshToken` to SecureStore
- `apps/mobile/lib/auth-provider.tsx` — call `jwtManager.cacheJWKS()` after login

**Depends on:** Steps 6.4, 7.1, Step 2.4 (backend returns offlineToken in response).

---

### Phase 8: Mobile Offline UI

#### Step 8.1 — Create offline countdown hook

**Doc reference:** Section 14

**File:** `apps/mobile/src/hooks/useOfflineStatus.ts` — new

**Implementation:** Polls `jwtManager.getOfflineStatus()` every 60s + listens to `Network.addNetworkStateListener`.

**Depends on:** Step 6.4.

---

#### Step 8.2 — Create offline status banner component

**Doc reference:** Section 14

**File:** `apps/mobile/src/components/OfflineStatusBanner.tsx` — new

**Implementation:** Renders green/amber/red/expired banners based on urgency tier.

**Depends on:** Step 8.1.

---

### Phase 9: PowerSync Integration

#### Step 9.1 — Create PowerSync connector

**Doc reference:** Section 16 → Connector

**File:** `apps/mobile/src/lib/powersync-connector.ts` — new

**Implementation:** `BetterAuthConnector` with:
- `fetchCredentials()` — calls `/api/powersync/token`
- `uploadData()` — batches ops to `/api/v1/sync/push`

**Depends on:** Steps 5.1, 5.2, 6.2, 6.3.

---

#### Step 9.2 — Create PowerSync database instance + schema

**Doc reference:** Section 13

**Files:**
- `apps/mobile/src/lib/powersync-db.ts` — new
- `apps/mobile/src/lib/powersync-schema.ts` — new

**Implementation:** Define SQLite schema matching backend Drizzle schema (routes, locations, etc.).

**Depends on:** Step 6.1 (PowerSync SDK installed).

---

#### Step 9.3 — Create reconnection handler

**Doc reference:** Section 15

**File:** `apps/mobile/src/services/reconnection-handler.ts` — new

**Implementation:** 5-step sequential flow:
1. Revocation check → remote wipe if revoked
2. Token refresh via `POST /api/auth/refresh`
3. JWKS refresh from `/api/v1/auth/nks-jwks`
4. `powerSyncDb.triggerCatchUp()` + `waitForSyncComplete()`
5. Restore auth state

Includes `performRemoteWipe()` using `powerSyncDb.disconnectAndClear()`.

**Depends on:** Steps 5.3, 6.2, 6.4, 6.6, 9.1, 9.2.

---

#### Step 9.4 — Wire reconnection to network state listener

**File:** `apps/mobile/lib/network-state.ts` — modify

**Change:** When `expo-network` fires connectivity restored, call `handleReconnection()`.

**Depends on:** Step 9.3.

---

### Phase 10: Security Hardening

#### Step 10.1 — Certificate pinning

**Doc reference:** Section 18

**File:** `apps/mobile/index.ts` — add `initializeSslPinning()` before any network calls

**Depends on:** Step 6.1.

---

#### Step 10.2 — Inactivity lock

**Doc reference:** Section 18

**File:** `apps/mobile/src/hooks/useInactivityLock.ts` — new

**Implementation:** 5-minute background timeout → biometric re-auth via `expo-local-authentication`.

**Depends on:** Step 6.1, Step 6.6 (auth store).

---

#### Step 10.3 — Biometric gate for sensitive operations

**Doc reference:** Section 18

**File:** `apps/mobile/src/lib/biometric-gate.ts` — new

**Implementation:** `withBiometricGate<T>(action, prompt)` wrapper.

**Depends on:** Step 6.1.

---

### Phase 11: Cleanup + Cron Jobs

#### Step 11.1 — Add pg_cron cleanup jobs

**Doc reference:** Section 17 → Cleanup

**Change:** Schedule daily:
```sql
DELETE FROM routes WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '90 days';
DELETE FROM idempotency_log WHERE processed_at < NOW() - INTERVAL '7 days';
```

**Depends on:** Steps 4.1, 4.2.

---

#### Step 11.2 — Remove deprecated mobile files

**Files to remove/deprecate:**
- `apps/nks-mobile/store/authSlice.ts` (replaced by Zustand)
- `apps/nks-mobile/store/initializeAuth.ts` (replaced by hydrate flow)
- `apps/nks-mobile/store/logoutThunk.ts` (replaced by Zustand action)
- `apps/nks-mobile/store/persistLogin.ts` (replaced by JWTManager)
- `apps/nks-mobile/store/refreshSession.ts` (replaced by JWTManager)

**Depends on:** All Phase 6 + 7 steps complete and tested.

---

## Phase Summary

| Phase | Steps | Scope | Depends On | Estimated Effort |
|-------|-------|-------|------------|-----------------|
| **1** | 1.1–1.6 | Backend AuthService fixes | Nothing | 1 day |
| **2** | 2.1–2.5 | Backend dual-token + JWKS | Phase 1 | 1 day |
| **3** | 3.1–3.2 | Better Auth plugins + CORS | Nothing (parallel with 2) | 0.5 day |
| **4** | 4.1–4.3 | Database schema for sync | Nothing (parallel with 2) | 0.5 day |
| **5** | 5.1–5.3 | Backend sync endpoints | Phases 2, 4 | 1.5 days |
| **6** | 6.1–6.7 | Mobile foundation | Phase 2 (for JWKS endpoint) | 2 days |
| **7** | 7.1–7.3 | Mobile auth client + login | Phases 3, 6 | 1 day |
| **8** | 8.1–8.2 | Mobile offline UI | Phase 6 | 0.5 day |
| **9** | 9.1–9.4 | PowerSync integration | Phases 5, 6 | 2 days |
| **10** | 10.1–10.3 | Security hardening | Phase 6 | 0.5 day |
| **11** | 11.1–11.2 | Cleanup + cron | All phases | 0.5 day |
| | | **Total** | | **~11 days** |

---

## Dependency Graph

```
Phase 1 (AuthService fixes)
    │
    ▼
Phase 2 (Dual-token + JWKS)──────────────────┐
    │                                          │
    ▼                                          ▼
Phase 5 (Sync endpoints)              Phase 6 (Mobile foundation)
    │                                     │
    │                              ┌──────┼──────┐
    │                              ▼      ▼      ▼
    │                          Phase 7  Phase 8  Phase 10
    │                          (Auth    (Offline (Security)
    │                          client)   UI)
    │                              │
    └──────────────┬───────────────┘
                   ▼
              Phase 9 (PowerSync)
                   │
                   ▼
              Phase 11 (Cleanup)

Parallel tracks (no dependencies):
  Phase 3 (Better Auth plugins) ─── can run alongside Phase 2
  Phase 4 (Database schema)     ─── can run alongside Phase 2
```

---

## Testing Checkpoints

After each phase, verify:

| After Phase | Test |
|-------------|------|
| **1** | Run existing backend test suite — all tests pass, no role hash false positives |
| **2** | `GET /api/v1/auth/nks-jwks` returns RS256 JWKS; login response includes `offlineToken` |
| **3** | Mobile can authenticate via Expo plugin; CORS accepts no-origin requests |
| **4** | Migration runs cleanly; `idempotency_log` table exists; sync columns present |
| **5** | `POST /api/v1/sync/push` accepts operations, deduplicates, resolves conflicts |
| **6** | Mobile app starts, hydrates auth, shows correct screen (login/home/lock) |
| **7** | OTP login stores 3 tokens + JWKS; proactive refresh works on foreground |
| **8** | Offline banner shows correct countdown; urgency tiers change at thresholds |
| **9** | Offline write → queue → reconnect → sync → server has data; bidirectional |
| **10** | Certificate pinning rejects MITM; inactivity lock triggers after 5 min background |
| **11** | Tombstones cleaned after 90 days; idempotency log cleaned after 7 days |

---

*Implementation plan derived from [MOBILE_OFFLINE_FLOW.md](MOBILE_OFFLINE_FLOW.md) — NKS · Expo SDK 53 · NestJS 10 · Better Auth 1.x · PowerSync SDK 1.x · PostgreSQL 16 · Drizzle ORM 0.30+*
