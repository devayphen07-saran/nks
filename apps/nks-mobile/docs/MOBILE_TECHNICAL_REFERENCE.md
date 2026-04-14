# NKS Mobile App — Complete Technical Reference

**Framework**: React Native (Expo) with Expo Router
**State Management**: Redux Toolkit + React Query
**Styling**: styled-components/native with `@nks/mobile-theme`
**Auth**: OTP-based phone auth with dual JWT tokens (access + offline)
**Offline**: expo-sqlite with SQLCipher encryption, custom HTTP-based pull+push sync, offline session with HMAC signing

---

Uses `tokenMutex.withRefreshLock()`:

1. Call `refreshTokenAttempt()`
2. On success: reload session, dispatch `setCredentials()`
3. On `shouldLogout`: `clearAuthState(dispatch, logoutAction)` — clears all auth state atomically

#### `clearAuthState` (shared utility, not thunk)

Used by all error paths in `initialize-auth`, `persist-login`, and `refresh-session`:

1. `tokenManager.clear()` — clears in-memory opaque session token
2. `tokenManager.clearSession()` — wipes SecureStore session envelope
3. `offlineSession.clear()` — wipes offline POS session
4. `JWTManager.clear()` — clears all JWT tokens + JWKS cache from memory and SecureStore
5. `dispatch(action())` — updates Redux (logout or setUnauthenticated)

> `logoutThunk` does NOT use `clearAuthState` — it additionally clears `DeviceManager` and resets OTP rate limiters.

#### `persistLogin` (async function, not thunk)

Called after OTP verification:

1. Validate auth response structure + refresh token format
2. Check SecureStore size limit (1800 bytes)
3. Persist session, set in-memory token
4. In parallel: persist JWTManager tokens, sync server time, create offline session
5. Dispatch `setCredentials()`

---

## 3. Lib (Core Infrastructure)

### 3.1 jwt-manager.ts

Manages three tokens in SecureStore:

- **accessToken** (RS256, 15min) — for API calls
- **offlineToken** (RS256, 3 days) — for offline authorization
- **refreshToken** (opaque, 7 days) — exchanges for new tokens

Also manages JWKS cache (1h TTL).

**JWKS Endpoint**: `GET /api/v1/auth/mobile-jwks`

- Fetches RS256 public key set for offline token verification
- kid field in tokens is SHA-256 thumbprint of public key (not hardcoded)
- Cache refreshed every 1 hour or on key rotation detection
- **Automatic Key Rotation**: Backend rotates keys every 30 days (zero-downtime)
  - New key becomes active immediately for token signing
  - Old keys remain in JWKS for 30-day grace period
  - Mobile clients transparently validate tokens with both active and fallback keys
  - No action required from client (automatic via cache refresh)
  - Even offline clients (3-day JWT TTL) have 9+ offline windows to validate
- See [Key Rotation Runbook](../../nks-backend/docs/KEY_ROTATION_RUNBOOK.md) for operations details

**Methods**: `hydrate()`, `persistTokens()`, `getOfflineStatus()`, `cacheJWKS()`, `clear()`, `getRawAccessToken()`

### 3.2 token-mutex.ts

Prevents race conditions between refresh and logout:

- `withRefreshLock(fn)` — mutual exclusion; if clear running, throws; if another refresh running, waits
- `withClearLock(fn)` — waits for in-flight refresh, then exclusive access

### 3.3 axios-interceptors.ts

**Request**: Injects `Authorization: Bearer <token>`

**Response 401 handling**:

- Queue requests if refresh in progress
- `tokenMutex.withRefreshLock(() => refreshTokenAttempt())`
- On success: replay queued requests
- On `shouldLogout`: trigger logout via `tokenManager.notifyExpired()`

**403 handling**: triggers background permission refresh via `tokenManager.notifyRefresh()`

**Exported state reset**: `resetInterceptorState()` — sets `isRefreshing = false` and drains `failedQueue`. Called during logout to prevent stale state bleed across user sessions.

### 3.4 refresh-token-attempt.ts

Unified refresh logic (interceptor + thunk):

1. Load session, validate refresh token format
2. `POST /auth/refresh-token` with payload:
   ```json
   {
     "refreshToken": string
   }
   ```
3. On success, update all local state:
   - In-memory token via `tokenManager.set(newSessionToken)`
   - SecureStore session via `tokenManager.persistSession(updated)`
   - JWTManager tokens: `{ accessToken: result.jwtToken, offlineToken, refreshToken }`
   - Server time sync via `syncServerTime()`
   - Offline session extension via `extendOfflineSession()`
4. Returns `{ success, newToken?, error?, shouldLogout? }`

**Device binding**: The backend validates device identity by matching `deviceId` stored on the session record (set at login). No cryptographic signature is sent in the refresh payload — the backend compares the session's stored `deviceId` against the request origin.

### 3.5 offline-session.ts

Client-side trust policy for offline POS.

```ts
interface OfflineSession {
  id, userId, storeId, storeName, roles[],
  offlineValidUntil,   // extends on refresh (3 days, matches offline JWT TTL)
  lastSyncedAt, offlineToken,
  createdAt, lastRoleSyncAt,
  revocationDetectedAt?, signature?  // HMAC-SHA256
}
```

**Critical**: `offlineValidUntil` extends by `OFFLINE_SESSION_DURATION_MS` (3 days) on every token refresh, matching the offline JWT TTL:

```ts
extendValidity(session) {
  const updated = { ...session, offlineValidUntil: Date.now() + THREE_DAYS_MS };
  await saveSecureItem(OFFLINE_SESSION_KEY, JSON.stringify(updated));
  return updated;
}
```

**Integrity verification**: `load()` performs HMAC-SHA256 verification **if a `signature` field is present** on the stored session. If verification fails (tampered roles, modified expiry, etc.), the session is cleared from SecureStore and `null` is returned. Sessions without a signature field (pre-HMAC) pass through without verification. This prevents offline role escalation (e.g., STAFF → STORE_OWNER).

**Methods**: `create()`, `load()` [conditional HMAC check], `isValid()`, `isRolesStale()`, `extendValidity()`, `updateRolesAndExtend()` [re-signs after role update], `clear()`, `verify()`, `getStatus()`

### 3.6 device-binding.ts

Device identity for auth token binding:

- `getStableDeviceId()` — iOS: vendor ID, Android: Android ID
- `getDeviceIdentity()` — SHA-256 hash + HMAC-SHA256 signature
- `formatDeviceBindingForRequest()` — for API payload

### 3.7 device-manager.ts

Device fingerprint for API headers:

- `getFingerprint()` — SHA-256 of `deviceId:model:appVersion`, persisted to SecureStore
- `getHeaderValue()` — fingerprint string for `X-Device-Fingerprint` header (optional, used by backend for analytics)
- `clear()` — wipe on logout

### 3.8 write-guard.ts

`assertWriteAllowed(requiredRoles?)` — blocks offline writes if JWT expired or user lacks required role. Role check loads the offline session via `offlineSession.load()`, which performs HMAC integrity verification — tampered sessions are rejected before role evaluation.

### 3.9 db-key.ts

Database encryption key management (SecureStore-backed):

- `getOrCreateDbKey()` — Generates 32 random bytes on first launch, stores in SecureStore with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, returns existing key on subsequent launches. **Async.**
- `deleteDbKey()` — Deletes key from SecureStore. Called on logout if `IS_SHARED_DEVICE=true` (for multi-user devices like iPads).

**Key Storage**: All encryption keys live **only** in SecureStore and in-memory during DB session. Never logged or hardcoded.

### 3.10 local-db.ts

SQLite database with SQLCipher encryption, replaces PowerSync:

**Initialization**: `initializeDatabase()` — **must be called once at app startup**
- Gets or creates encryption key via `db-key.ts`
- Opens `nks_offline.db` via `expo-sqlite`
- **Validates** key format (`/^[0-9a-f]{64}$/i`) before injecting into `PRAGMA key` — throws if key is not a 64-char hex string (prevents silent SQLCipher corruption)
- Sets `PRAGMA key = '<hex_key>'` as **first operation** (before any schema)
- Runs integrity check: `PRAGMA integrity_check`
- Enables WAL mode for concurrency

**Tables**:
- `routes` — synced from `GET /sync/changes` (id, guuid, parent_route_fk, route_name, route_path, full_path, description, icon_name, route_type, route_scope, is_public, is_active, created_at, updated_at, deleted_at)
- `sync_state` — cursor storage (key, value; used to track last sync position)
- `mutation_queue` — pending mutations for push (id, operation, entity, payload, created_at, retries)

> **Note**: POS tables (products, orders, order_items, customers) to be added in next phase. Current sync scope: routes only.

**Exported Functions** (all **async**):
- `getCursor()` — returns last sync cursor (default 0)
- `saveCursor(cursorMs)` — persists cursor after successful pull
- `queueMutation(operation, entity, payload)` — adds to mutation queue before write
- `getMutationQueueBatch(limit)` — fetches oldest N pending mutations
- `deleteMutationsById(ids)` — removes from queue after successful push
- `incrementMutationRetry(id)` — increments retry count on push failure
- `clearAllTables()` — wipes all tables (called on logout + remote wipe)
- `getDatabase()` — raw database instance (advanced queries)

### 3.11 sync-engine.ts

Orchestrates pull+push sync (replaces PowerSync connector):

**Initialization**: `initializeDatabase()` called internally by `runSync()`

**Export Functions**:
- `runSync(storeGuuid)` — **async**. Full sync cycle:
  1. PULL: `GET /sync/changes?cursor=X&storeId=storeGuuid` → paginate until hasMore=false
     - For each change: if `operation='upsert'` → `INSERT OR REPLACE`; if `operation='delete'` → `DELETE`
     - After each page: `saveCursor(response.nextCursor)`
  2. PUSH: Batch mutations from queue:
     - Fetch 50 rows from `mutation_queue` ORDER BY id ASC
     - `POST /sync/push { operations }` — stops on first failure (does not skip ahead)
     - On success: delete from queue; on max retries (3): skip and continue
  - Throws on network errors or 25s timeout; returns gracefully on unauthorized storeId (empty response from backend)
  - Timeout: 25s (5s margin before backend's 30s `REQUEST_TIMEOUT_MS` — ensures a structured backend error is returned before the mobile's `AbortController` fires)
- `isSyncing()` — returns true if sync in progress
- `getLastSyncedAt()` — returns millisecond epoch of last successful sync (or null)
- `resetSyncState()` — clears `_syncing` flag and `_lastSyncedAt`. Called on logout to prevent state bleed across user sessions.

### 3.12 device-config.ts

Runtime configuration flags:

- `IS_SHARED_DEVICE: boolean` (default false) — If true, database encryption key deleted on logout to prevent multi-user key reuse on shared devices (iPads, kiosks).

### 3.13 rate-limiter.ts

**Client-side UX rate limiting** (stricter than backend to reduce unnecessary API calls):

Token bucket with time window + exponential backoff:

- `OTP_RATE_LIMITS.send` — 3/15min, 30s delay
- `OTP_RATE_LIMITS.verify` — 5/5min, 1s delay
- `OTP_RATE_LIMITS.resend` — 2/10min, 2s delay

**Backend rate limiting** (security boundary, 5/1hr per identifier):

- Server enforces 5 OTP requests per phone/email per 1-hour window
- Exponential backoff: 0, 0, 30s, 60s, 2m, 5m, 15m delays
- Identifier hash: SHA256(phone + pepper) for GDPR compliance

**Design rationale**: Client-side limits are stricter to discourage rapid retries in the UI. Backend limits are looser but still protective, allowing users to work around client-side limits if needed while maintaining security at the API boundary.

**Exported state reset**: `resetRateLimiters()` — resets all OTP token bucket counters (`send`, `verify`, `resend`). Called on logout to prevent stale counters from carrying over to the next user session.

### 3.14 biometric-gate.ts

`withBiometricGate(action, prompt)` — prompts biometric/passcode, executes action on success

### 3.15 server-time.ts

`initServerTime()` → pre-loads clock offset from SecureStore at app startup (called in `app/_layout.tsx`). Safe to call multiple times (no-op after first call).
`syncServerTime()` → `POST /auth/sync-time`, updates + persists offset to SecureStore. Called on login and every successful token refresh.
`getServerAdjustedNow()` → `Date.now() + offsetSeconds * 1000`

### 3.16 Other lib files

- **jwt-refresh.ts** — proactive refresh on app foreground (within 3min of expiry); `isTokenExpired(token, thresholdMs)` determines if refresh is needed; `resetRefreshState()` — cancels the proactive refresh timer and clears `_isRefreshing` flag (called on logout)
- **fetch-with-timeout.ts** — `fetch` with `AbortController` timeout
- **ssl-pinning.ts** — SSL public key pinning for API domain
- **storage-keys.ts** — centralized SecureStore key constants. All SecureStore keys:
  - `auth.jwt.access` — RS256 access token (15 min)
  - `auth.jwt.offline` — RS256 offline token (3 days)
  - `auth.jwt.refresh` — opaque refresh token (7 days)
  - `auth.jwks.cache` — cached RS256 public key PEM
  - `auth.jwks.cached_at` — JWKS cache timestamp
  - `auth.jwks.kid` — cached key ID
  - `nks_session` — opaque BetterAuth session token (managed by tokenManager; used for session-status checks and AuthGuard)
  - `nks_offline_session` — offline POS session (HMAC-signed JSON)
  - `nks_clock_offset` — server time offset in seconds
  - `nks_clock_sync_time` — last clock sync timestamp
  - `nks.device.fingerprint` — SHA-256 device fingerprint
  - `nks.db.encryption_key` — AES-256 SQLCipher key (hex), WHEN_UNLOCKED_THIS_DEVICE_ONLY
- **token-expiry.ts** — token expiry utilities:
  - `isTokenExpired(token, thresholdMs?)` — synchronous JWT exp check (no server-time adjustment; used by proactive refresh)
  - `validateTokenExpiry(expiresAt?)` — async, uses server-adjusted time (used for session expiry checks)
  - `validateTokensBeforeRefresh(envelope)` — validates refresh token exists and is not expired before attempting API refresh
- **token-validators.ts** — validates auth response structure, refresh token format, storage usage
- **routes.ts** — route path constants
- **logger.ts** — factory `createLogger(namespace)`. Used in all core libs and store files instead of `console.*`
- **log-sanitizer.ts** — strips sensitive data from error messages

---

## 4. Auth Flow (Step-by-Step)

### 4.1 Phone → OTP → Token Storage → Workspace

1. **PhoneScreen**: User enters 10-digit phone
2. `usePhoneAuth.handleSendOtp()`:
   - Rate limit check → validate with Zod → format `+91XXXXXXXXXX`
   - Dispatch `sendOtp()` → receive `reqId` → navigate to OTP screen
3. **OtpScreen**: User enters 6 digits (auto-verify on 6th)
4. `useOtpVerify.handleVerify()`:
   - Rate limit check → validate Zod → dispatch `verifyOtp({ phone, otp, reqId })`
   - On success: receive `AuthResponseEnvelope` from backend
   - Extract and persist tokens (field names are renamed during storage):
     ```
     response.session.jwtToken     → JWTManager accessToken  (SecureStore: auth.jwt.access)
     response.offlineToken         → JWTManager offlineToken  (SecureStore: auth.jwt.offline)
     response.session.refreshToken → JWTManager refreshToken  (SecureStore: auth.jwt.refresh)
     response.session.sessionToken → tokenManager session     (SecureStore: nks_session)
     ```
   - Call `persistLogin(response)` — handles SecureStore + in-memory + offline session creation
   - OTP screen hook calls `JWTManager.cacheJWKS()` → `registerProactiveRefresh()` → navigate to account type

### 4.2 Token Refresh

**Interceptor-triggered** (on 401): queue requests → `tokenMutex.withRefreshLock()` → `refreshTokenAttempt()` → replay queue

**Proactive** (on foreground): AppState listener → check expiry within 3min → `refreshTokenAttempt()`

**Redux-triggered** (on 403): `tokenManager.notifyRefresh()` → store subscription → `refreshSession()` thunk

### 4.3 Logout

1. `logoutThunk` acquires `tokenMutex.withClearLock()`
2. Calls `signOut()` API
3. Clears: tokenManager, SecureStore session, offline session, JWTManager, DeviceManager
4. Clears all local database tables via `clearAllTables()` (routes, sync_state, mutation_queue)
5. If `IS_SHARED_DEVICE=true`: deletes encryption key via `deleteDbKey()` (prevents key reuse by next user)
6. Resets all singleton module state to prevent bleed across user sessions:
   - `resetRefreshState()` — clears jwt-refresh proactive timer and `_isRefreshing` flag
   - `resetInterceptorState()` — sets `isRefreshing = false`, drains `failedQueue` in axios-interceptors
   - `resetSyncState()` — clears `_syncing` flag and `_lastSyncedAt` in sync-engine
   - `resetRateLimiters()` — resets all OTP bucket counters in rate-limiter
7. Dispatches `logout()` action

### 4.4 Session Restore (App Launch)

**Startup sequence** (`app/_layout.tsx`):
- `initializeDatabase()` — opens encrypted SQLite DB, creates tables (safe to call multiple times — no-op after first call)
- `initServerTime()` — pre-loads clock offset from SecureStore (fast, no network)
- `initializePinning()` — SSL pinning setup

**`initializeAuth` thunk** (dispatched by `AuthProvider`):
1. Hydrate JWTManager (tokens + JWKS cache) from SecureStore
2. Load session envelope → validate structure → check expiry (server-adjusted time) → validate token format
3. Set in-memory token via `tokenManager.set(sessionToken)`
4. Dispatch `setCredentials()` to Redux
5. Restore offline session → check HMAC integrity → check role staleness → warn if stale
6. Dispatch `refreshSession()` in background if session is stale (>12 min old)

**On any error** → `clearAuthState(dispatch, setUnauthenticated)` — clears tokenManager + SecureStore + offlineSession + JWTManager atomically.

Hide splash, layout guards handle redirect.

### 4.5 Reconnection (5-Step Sequence)

Triggered by NetInfo offline→online:

1. **Revocation check**: `GET /api/v1/auth/session-status` (no AuthGuard)
   - Sends the **opaque BetterAuth session token** via `Authorization: Bearer <tokenManager.get()>` — NOT the JWT access token
   - Backend queries `user_session.token` (exact string match) and checks expiry + blocked status
   - Returns `{ active, revoked, wipe }` — if `wipe: true`, trigger remote wipe (logout + clear offline session + database tables)
   - Rationale: JWT access token is expired after >15min offline; AuthGuard would reject. Session-status uses the opaque token to query session record directly.
2. **Token refresh**: `refreshTokenAttempt()` → logout if rejected
3. **JWKS refresh**: `JWTManager.cacheJWKS()` → verify offline token against fresh public keys
4. **Sync catch-up**: `runSync(storeGuuid)` — pulls changes, applies to local DB, pushes pending mutations. Timeout: 25s (5s margin before backend's 30s `REQUEST_TIMEOUT_MS`).
   - `storeGuuid` is read from the persisted SecureStore session envelope: `tokenManager.loadSession<AuthResponse>()` → `envelope.data.session.defaultStore.guuid`
   - This is the same envelope written by `persistLogin()` at login. It is NOT sourced from Redux (Redux state is being restored in step 5) or from the offline session (which stores a numeric `storeId`, not a guuid).
   - If `defaultStore` is null (user has no store yet), sync is skipped.
5. **Redux update**: reload session → `setCredentials()`

### 4.6 Automatic Key Rotation (Transparent)

The backend rotates JWT keys every 30 days with zero downtime:

- **New Key Generation**: Backend generates new RSA 2048-bit key, computes new KID (SHA-256 hex thumbprint of DER-encoded public key)
- **JWKS Update**: Old key archived in JWKS for 30-day grace period, new key becomes active
- **Client Behavior** (no action required):
  - On next JWKS cache refresh (1-hour TTL), client downloads updated JWKS
  - Client validates offline tokens using both active + fallback keys
  - New tokens received from backend are signed with the new key automatically
- **Offline Resilience**:
  - Offline JWT TTL: 3 days
  - JWKS grace period: 30 days = 10 offline windows
  - Even offline clients validate successfully with archived keys
- **Failure Handling**: If JWKS download fails, client continues with cached keys. Stale keys expire naturally after grace period.
- **Operations**: See [Key Rotation Runbook](../../nks-backend/docs/KEY_ROTATION_RUNBOOK.md) for backend rotation details

---

## 5. Hooks

| Hook                    | Purpose                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `useInactivityLock`     | 5min background timer → biometric gate on return → force logout on failure           |
| `useLogout`             | Dispatches `logoutThunk`, returns `{ logout, isLoggedIn }`                           |
| `useLogoutConfirmation` | Alert.alert with Cancel/Logout → calls `useLogout`                                   |
| `useOfflineStatus`      | Combines JWTManager + network state. Returns `{ mode, urgency, label, remainingMs }` |

---

## 6. Features

### 6.1 Auth

| Screen            | Hook           | Key Logic                                                                  |
| ----------------- | -------------- | -------------------------------------------------------------------------- |
| PhoneScreen       | usePhoneAuth   | Phone validation, rate limit, dispatch sendOtp, navigate to OTP            |
| OtpScreen         | useOtpVerify   | 6-digit input, countdown timer, rate limit (verify + resend), persistLogin |
| SetPasswordScreen | useSetPassword | Password validation (password API not wired yet)                           |

### 6.2 Workspace

| Screen             | Purpose                                                 |
| ------------------ | ------------------------------------------------------- |
| AccountTypeScreen  | Business vs Personal choice, accept invite link, logout |
| AcceptInviteScreen | Invite token input (API not wired)                      |
| ProfileSetupScreen | Profile form with Zod validation (API not wired)        |

### 6.3 Personal

| Screen                  | Purpose                                           |
| ----------------------- | ------------------------------------------------- |
| PersonalDashboardScreen | FlatList with search + filters, mock expense data |
| PersonalScreen          | Metrics dashboard, recent transactions            |
| ExpenseScreen           | Expense list with categories                      |
| PersonalDrawerContent   | Drawer with menu + switch to store + logout       |

### 6.4 Store

| Screen             | Purpose                                                   |
| ------------------ | --------------------------------------------------------- |
| StoreListScreen    | FlatList of stores, search + filters (All/My/Staff)       |
| StoreSetupScreen   | 3-step wizard (Basic Info → Legal/Tax → Address)          |
| StoreDrawerContent | Role-based menu via `ROLE_MENU_MAP`, active store context |

**Role Menu Config** (code → features):

- STORE_OWNER: Dashboard, Products, Orders, Staff, Settings
- MANAGER: Dashboard, Products, Orders (custom role for store staff)
- CASHIER: POS, Orders (custom role for point-of-sale operators)
- DELIVERY: Deliveries (custom role for delivery partners)
- CUSTOMER: Dashboard

**Note**: STORE_OWNER is a system role. MANAGER, CASHIER, DELIVERY are custom roles created by the STORE_OWNER and configured in the backend role_route_mapping.

### 6.5 User & Settings

| Screen            | Purpose                                                   |
| ----------------- | --------------------------------------------------------- |
| UserProfileScreen | View/edit profile with avatar, uses useUserProfileForm    |
| SettingsScreen    | Theme (Light/Dark/System), notifications, regional, legal |

---

## 7. Error System

- `AppError` — extends Error with `code` (ErrorCode enum), `statusCode`, `context`
- `ErrorHandler.handle(error, context)` — transforms Axios/Error/unknown into AppError
- Used by `useOtpVerify` and `usePhoneAuth` only

---

## 8. Data Flow Diagram

```
SecureStore (persistent)
    ↓
tokenManager (in-memory) ←→ Axios interceptors (inject Bearer)
    ↓                              ↓
JWTManager (3 tokens + JWKS)  API calls
    ↓                              ↓
offlineSession (SecureStore)  401 → refreshTokenAttempt()
    ↓                              ↓
write-guard (blocks expired)  Redux auth slice
    ↓                              ↓
local-db (SQLCipher) +        React tree re-renders
sync-engine (pull+push)
```

---

## 9. External Package Dependencies

| Package                     | Usage                                                                            |
| --------------------------- | -------------------------------------------------------------------------------- |
| `@nks/api-manager`          | API client, auth actions (sendOtp, verifyOtp, signOut), React Query hooks, types |
| `@nks/mobile-utils`         | tokenManager, SecureStore helpers, session constants                             |
| `@nks/utils`                | Regex, phone utils, OTP constants, time constants                                |
| `@nks/mobile-ui-components` | All UI primitives                                                                |
| `@nks/mobile-theme`         | Theme provider + hook                                                            |
| `@nks/mobile-i18n`          | I18n provider                                                                    |
| `@nks/shared-types`         | APIState, UserProfile, ThemeEnum                                                 |
| `@nks/state-manager`        | Store Redux slice                                                                |
| `expo-sqlite`               | Encrypted local SQLite database with SQLCipher                                  |
| `expo-crypto`               | Random bytes for encryption key generation                                      |

---

## 10. File Index

**Total**: ~100 TypeScript/TSX files

- App Routes: 23 files
- Store: 7 files (auth-slice, clear-auth-state, initialize-auth, logout-thunk, persist-login, refresh-session, index)
- Lib: 27 files (+ 4 new: db-key.ts, local-db.ts, sync-engine.ts, device-config.ts; - 2 removed: powersync-db.ts, powersync-connector.ts)
- Hooks: 4 files
- Services: 1 file (reconnection-handler)
- Features: 30+ files across auth, personal, store, workspace, user, settings
- Shared: 4 files (error system)
- Components: 5 files (feedback + selects)
