# Complete End-to-End Mobile Auth & Offline Working Walkthrough

This document provides a detailed narrative of the NKS mobile app's authentication flow and offline-first capabilities. Every function call, state change, and network request is traced with exact line numbers and code references.

---

## PART A: App Launch & Auth Initialization

### A.1 App Bootstrap Sequence

When the NKS mobile app starts, execution flows through this sequence:

**File: `apps/nks-mobile/app/_layout.tsx` (Root Layout)**

1. **Line 18:** `SplashScreen.preventAutoHideAsync()` — prevent auto-hide so we can control splash visibility during initialization
2. **Line 20:** `initServerTime()` called before any UI renders — pre-loads clock offset from SecureStore for accurate token expiry checks
3. **Lines 37-45:** In `useEffect`, `initializePinning()` is called — blocks all rendering (and network) until SSL certificate pinning is configured
4. **Line 48-50:** If pinning not ready, render `<LoadingFallback />`
5. **Lines 52-72:** Once pinning ready:
   - Render Redux Provider
   - QueryClient provider
   - I18n provider
   - AuthProvider (this is KEY)
   - Inside AuthProvider: OfflineStatusBanner + Slot (route)

### A.2 AuthProvider Initialization

**File: `apps/nks-mobile/lib/auth-provider.tsx`**

The `AuthProvider` component is where auth state is bootstrapped and reconnection logic is wired:

**Lines 29-44:** `AuthProvider` mounts
- Line 40: `useInactivityLock()` hook starts — watches app foreground/background, locks after 5 min inactivity
- Lines 42-44: `useEffect` dispatches `initializeAuth()` thunk to Redux

**Lines 46-59:** Second `useEffect` sets up Axios interceptors (non-critical for startup)

**Lines 61-66:** Third `useEffect` hides splash screen once `isInitializing` becomes false

**Lines 72-95:** Fourth `useEffect` registers the NetInfo listener:
- Watches device network state changes
- When device comes online AND was previously offline AND user is authenticated:
  - Calls `handleReconnection(dispatch)` (fire-and-forget, won't block UI)

### A.3 Session Initialization Thunk

**File: `apps/nks-mobile/store/initialize-auth.ts`**

The `initializeAuth` async thunk is dispatched on app launch. This is the CRITICAL initialization sequence:

**Lines 26-131:** `initializeAuth` thunk:

```
try {
  Line 31: await JWTManager.hydrate()
    → Loads accessToken, offlineToken, refreshToken from SecureStore into _tokens module-level state
    → Also hydrates JWKS cache if present
  
  Line 33: envelope = await tokenManager.loadSession<AuthResponse>()
    → Loads persisted auth response from SecureStore (BetterAuth session + roles)
  
  Line 35-39: if (!envelope?.data)
    → No session stored → dispatch setUnauthenticated() → show login screen
  
  Lines 42-49: validateAuthResponse(envelope.data)
    → Validate session structure (has user, session, access objects)
    → Validate required fields are present and correctly typed
    → If validation fails: clearAuthState() and return
  
  Lines 54-66: Validate session has not expired
    → Get expiresAt from envelope.data.session
    → Get server-adjusted time via getServerAdjustedNow()
    → If expiresAt < now: clearAuthState() and return
  
  Lines 68-74: Validate session token format
    → Use sessionTokenReg regex to verify format
    → If invalid: clearAuthState() and return
  
  Line 77: tokenManager.set(sessionToken)
    → Set opaque BetterAuth session token in-memory so next API call has it
  
  Line 80: dispatch(setCredentials(envelope.data))
    → Update Redux with restored auth response (user, roles, access)
    → This triggers route change from /(auth) to /(main)
  
  Lines 84-117: Restore offline session (non-critical)
    → await offlineSession.load()
    → If session exists and isValid():
       - Check if roles are stale (lastRoleSyncAt > 24h or revocationDetected)
       - Log status message
    → If not valid: log warning
  
  Lines 120-124: Check if persisted session is stale
    → If fetched > 12 minutes ago: dispatch refreshSession() in background
    → This refreshes tokens before JWT expiry (15 min)
}
catch (error) {
  Line 129: clearAuthState(dispatch, setUnauthenticated)
}
```

**State After Initialization:**

If session restored successfully:
- Redux: `auth.isAuthenticated = true`, `auth.authResponse = { user, session, access }`
- SecureStore: Persisted auth data + JWTs intact
- In-memory: `tokenManager._token`, `JWTManager._tokens`
- UI: Route changes to `/(main)` and user sees main app
- Splash: Hidden automatically

If no session / validation fails:
- Redux: `auth.isAuthenticated = false`
- SecureStore: Unchanged (cleared only on logout)
- UI: Route shows `/(auth)/phone` login screen
- Splash: Hidden

### A.4 Token Manager & JWT Manager State

**File: `apps/nks-mobile/lib/jwt-manager.ts`**

During `JWTManager.hydrate()` (line 31 of init-auth), three tokens are loaded:

```
SecureStore.getItemAsync(STORAGE_KEYS.JWT_ACCESS_TOKEN)    → _tokens.accessToken
SecureStore.getItemAsync(STORAGE_KEYS.JWT_OFFLINE_TOKEN)   → _tokens.offlineToken
SecureStore.getItemAsync(STORAGE_KEYS.JWT_REFRESH_TOKEN)   → _tokens.refreshToken
```

Plus JWKS cache is loaded (if < 1 hour old, otherwise fetch fresh).

The `_tokens` object is module-level state (private to jwt-manager.ts). It is NEVER exposed as an object; instead, methods read from it:
- `JWTManager.getOfflineStatus()` (line 157) — reads offline token exp, returns OfflineStatus
- `JWTManager.getRawAccessToken()` (line 269) — returns raw access token string

**File: `apps/nks-mobile/lib/server-time.ts`**

`initServerTime()` is called BEFORE root layout renders to pre-load clock offset. It:
- Tries to load offset from SecureStore (set on previous login)
- Uses offset to calculate server-adjusted time via `getServerAdjustedNow()`
- Ensures token expiry checks are accurate even if device clock is wrong

---

## PART B: OTP Login Flow

### B.1 User Enters Phone Number

**File: `apps/nks-mobile/features/auth/hooks/usePhoneAuth.ts`**

User lands on `/(auth)/phone` screen and enters their phone number:

```
Line 33-80: handleSendOtp() callback
  Line 37-41: Check rate limiter
    → OTP_RATE_LIMITS.send.check()
    → Returns { allowed, message }
    → If not allowed: setErrorMessage() and return
  
  Line 44: phoneSchema.safeParse({ phone: phone.trim() })
    → Validate format (10 digits, no country code yet)
    → If invalid: show error and return
  
  Line 56: formatPhoneWithCountryCode(phone)
    → Adds +91 prefix to phone (India)
  
  Line 58: dispatch(sendOtp({ bodyParam: { phone: fullPhone } }))
    → Redux action calling API endpoint
    → Request goes through axios interceptor (token added)
```

**Backend: `apps/nks-backend/src/modules/auth/services/otp.service.ts`**

```
Line 57-87: sendOtp(dto) method
  Line 62: await rateLimitService.checkAndRecordRequest(phone)
    → Check 100-per-24h rate limit per phone number
    → If exceeded: throw HttpException(429)
  
  Line 64: const response = await msg91.sendOtp(phone)
    → Call MSG91 API to send OTP
    → Response: { reqId: "...", type: "success" }
  
  Line 74: expiresAt = Date.now() + 10 * 60 * 1000 (10 min)
  
  Line 78-84: await otpRepository.insertOtpRecord(phone, 'PHONE_VERIFY', 'MSG91_MANAGED', expiresAt, reqId)
    → Store OTP record in database with status = 'pending'
    → reqId is MSG91's request identifier (required for verification)
  
  Line 86: return { reqId, mobile: phone }
```

**Mobile Response Handler:**

```
File: usePhoneAuth.ts, Line 59-68
  Line 60-61: .then(response => { ... })
    → Extract reqId from response.data.reqId
    → Line 63: setPendingOtpSession(fullPhone, reqId)
      → Store phone + reqId in SecureStore temporarily (expires on logout/clear)
    → Line 64: router.push({ pathname: "/(auth)/otp" })
      → Navigate to OTP input screen
```

**State After OTP Send:**

- SecureStore: Temporary `pending_otp_session` with phone + reqId
- Backend: OTP record in database with status='pending', reqId stored
- UI: Shows 6-digit OTP input screen with 60-second countdown

### B.2 User Enters OTP

**File: `apps/nks-mobile/features/auth/hooks/useOtpVerify.ts`**

User enters 6 OTP digits:

```
Line 60-129: handleVerify(otpValue) callback
  Line 65-72: Check OTP_RATE_LIMITS.verify
    → Prevents brute force (too many attempts)
    → If rate limited: setErrorMessage() and return
  
  Line 74-78: Get reqId from ref
    → reqIdRef was set in useEffect to getPendingOtpSession().reqId
    → If missing: error "Session expired"
  
  Line 80-84: otpSchema.safeParse({ otp: otpValue })
    → Validate OTP is 6 digits
  
  Line 89-93: Build payload
    → { phone: "+91xxxxxxxxxx", otp: "123456", reqId: "msg91_req_id" }
  
  Line 95: dispatch(verifyOtp({ bodyParam: payload }))
    → Redux action calling /auth/otp endpoint
```

**Backend: `apps/nks-backend/src/modules/auth/services/otp.service.ts`**

```
Line 99-143: verifyOtp(dto) method
  
  Line 107-111: const otpRecord = await otpRepository.findByIdentifierPurposeAndReqId(phone, 'PHONE_VERIFY', reqId)
    → Query: SELECT * FROM otp_logs WHERE identifier = phone AND purpose = 'PHONE_VERIFY' AND req_id = reqId
    → If not found: throw BadRequestException('OTP not found or reqId mismatch')
  
  Line 119-121: if (otpRecord.isUsed)
    → throw 'OTP already used' (prevent replay)
  
  Line 123-125: if (otpRecord.expiresAt < now)
    → throw 'OTP expired' (10-minute window)
  
  Line 128: const response = await msg91.verifyOtp(reqId, otp)
    → Call MSG91 to verify OTP
    → Response: { type: 'success' } or { type: 'error', message: '...' }
  
  Line 129-132: if (response?.type !== 'success')
    → Track failed attempt via rateLimitService.trackVerificationFailure(phone)
    → throw BadRequestException('Invalid OTP')
  
  Line 135: await otpRepository.markAsUsedByReqId(reqId)
    → Mark OTP log as used (no replay possible)
  
  Line 140: return { verified: true, phone }
```

**Mobile: OTP Verification Success Handler**

File: `useOtpVerify.ts`, Line 97-117

```
.then(async (apiResponse) => {
  Line 98: const authResponse = apiResponse?.data
  
  Line 100-104: if (authResponse?.session?.sessionToken)
    → Line 102: OTP_RATE_LIMITS.verify.reset()
       → Clear rate limit state so next login starts fresh
    
    → Line 103: clearPendingOtpSession()
       → Delete temporary phone+reqId from SecureStore
    
    → Line 104: await persistLogin(authResponse, dispatch)
       → THIS IS THE CRITICAL PERSISTENCE STEP (see Part B.3)
    
    → Line 109: JWTManager.cacheJWKS(serverBase).catch(() => {})
       → Fetch and cache RS256 JWKS for offline JWT verification
       → Non-critical if fails
    
    → Line 112: registerProactiveRefresh()
       → Start timer to refresh access token on app foreground
    
    → Line 114: router.replace(ROUTES.ACCOUNT_TYPE)
       → Navigate to store selection screen
})
```

### B.3 Persist Login Session

**File: `apps/nks-mobile/store/persist-login.ts`**

This function is called ONCE after OTP verification succeeds. It validates input thoroughly and persists to all three storage layers:

```
Line 28-141: persistLogin(authResponse, dispatch)

try {
  Lines 38-59: VALIDATION PHASE
    Line 38: validation = validateAuthResponse(authResponse)
      → Checks required fields: user.id, session.sessionToken, access.roles
      → Validates roles array format
      → If invalid: throw Error, goto catch block
    
    Line 46: validateRefreshTokenFormat(authResponse.session?.refreshToken)
      → Ensure refresh token is hex string of expected length (Issue 9.2)
      → If invalid: throw Error
    
    Line 54: analyzeStorageUsage(authResponse)
      → Check if authResponse is reasonable size
      → Warn if exceeds thresholds
  
  Lines 64: await tokenManager.persistSession(authResponse)
    → BetterAuth session manager in @nks/mobile-utils
    → Saves entire AuthResponse to SecureStore under session key
    → This includes: user, session, access, offline token
  
  Lines 69-74: Set in-memory token
    → const sessionToken = authResponse.session.sessionToken
    → tokenManager.set(sessionToken)
    → Now every API request has Authorization header
  
  Lines 83-93: Persist dual tokens to JWTManager
    → Extract from authResponse:
       - accessToken = authResponse.session.jwtToken (RS256, 15 min)
       - offlineToken = authResponse.offlineToken (RS256, 3 days)
       - refreshToken = authResponse.session.refreshToken (opaque, 7 days)
    → await JWTManager.persistTokens({ accessToken, offlineToken, refreshToken })
       - Saves each to SecureStore under JWT_* keys
       - Updates _tokens module state
  
  Lines 95-99: Sync server time
    → Call GET /sync/time to get server unix timestamp
    → Calculate clock offset = serverTime - deviceTime
    → Save offset to SecureStore for future use
  
  Lines 101-119: Create offline session
    → const roles = authResponse.access.roles
    → Build offline session:
       {
         id: uuid(),
         userId: parseInt(authResponse.user.id),
         storeId: activeStoreId,
         roles: [ "CASHIER", "MANAGER", ... ],
         offlineToken: authResponse.offlineToken,
         offlineValidUntil: Date.now() + 3 days,
         lastRoleSyncAt: Date.now(),
         signature: authResponse.offlineSessionSignature (HMAC-SHA256 from server)
       }
    → await offlineSession.create({ ... })
       - Saves to SecureStore
       - Signature prevents tampering (role escalation)
  
  Line 126: dispatch(setCredentials(authResponse))
    → Update Redux store:
       auth.authResponse = authResponse
       auth.isAuthenticated = true
       auth.isInitializing = false
    → This triggers route navigation to /(main)

} catch (error) {
  Line 133: await clearAuthState(dispatch, logout)
    → Clear ALL auth data (SecureStore, in-memory, Redux)
    → Prevents partial login state
  Line 139: throw Error("Failed to save session")
}
```

**State After Successful Login:**

SecureStore contains:
- `auth.session` — full AuthResponse (user, session, access)
- `auth.jwt_access_token` — RS256 access token
- `auth.jwt_offline_token` — RS256 offline token (3 days)
- `auth.jwt_refresh_token` — opaque refresh token
- `auth.offline_session` — offline session with signature
- `server.time_offset` — clock offset in ms

In-memory:
- `tokenManager._token` = sessionToken
- `JWTManager._tokens` = { accessToken, offlineToken, refreshToken }
- Redux `auth.authResponse` = full response
- Redux `auth.isAuthenticated` = true

UI: App shows main dashboard, store selection screen

---

## PART C: Online API Usage

### C.1 Making an API Call While Online

Let's trace a simple API call: User taps to load dashboard data.

**Mobile code:**

```typescript
// In a component
const { data } = await API.get('/dashboard/summary');
```

### C.2 Request Interceptor

**File: `apps/nks-mobile/lib/axios-interceptors.ts`**

When any axios request fires:

```
Line 101-110: Request interceptor
  Line 103: const token = tokenManager.get()
    → Get current opaque session token from in-memory
  
  Line 104-106: if (token && config.headers)
    → config.headers.Authorization = `Bearer ${token}`
    → Every request now includes: "Authorization: Bearer <sessionToken>"
  
  return config → Request proceeds
```

**Network Request:**

```
GET /api/v1/dashboard/summary
Authorization: Bearer <opaque_session_token>
Content-Type: application/json
```

### C.3 Server Receives Request

**Backend: `apps/nks-backend/src/common/guards/auth.guard.ts`**

```
Extract token from Authorization header
Decode BetterAuth session token (opaque)
Query user_sessions table: SELECT * FROM user_sessions WHERE token = ?
Validate session:
  - Not expired
  - Not revoked
  - User still exists
  - User not deleted
Extract user ID from session
Attach to req.user for route handler
```

### C.4 Successful 200 Response

Server returns 200 with data. Response interceptor:

```
File: axios-interceptors.ts, Line 113-114
  Line 113: (response: AxiosResponse) => response
  → If status 200-299: pass through unchanged
  → Proceed to then() block in component
```

**State Update:**

Redux receives data, updates store, UI re-renders. No token refresh needed.

### C.5 401 Response Handling

If access token is revoked server-side or session invalidated:

```
Backend returns 401 Unauthorized
```

Response interceptor catches this:

```
File: axios-interceptors.ts, Line 115-225
  Line 119: const status = error.response?.status
  
  Line 122-128: if (status === 401 && !originalRequest._retry && !isAuthEndpoint(url))
    → NOT a retry yet
    → NOT an auth endpoint (no refresh on /auth/login, /auth/refresh-token, etc.)
  
  Line 130-140: if (isRefreshing)
    → Another refresh is already happening
    → Queue this request to retry later
    → return new Promise with resolve/reject callbacks
    → failedQueue.push({ resolve, reject })
    → When refresh completes, all queued requests retry
  
  Line 142-143: originalRequest._retry = true
    → Mark this request as a retry attempt
    → isRefreshing = true
  
  Line 150: const result = await tokenMutex.withRefreshLock(() => refreshTokenAttempt())
    → Serialize refresh with Redux's refreshSession thunk (prevent dual-refresh race)
    → Call refreshTokenAttempt() (see Part F for details)
  
  Line 154-162: if (result === undefined)
    → Another refresh completed while we waited
    → Get fresh token: tokenManager.get()
    → Retry request with new token
  
  Line 165-197: if (result.success && result.newToken)
    → Refresh succeeded
    → Sync Redux state if callback provided
    → Extend offline session validity
    → Replay all queued requests with new token
    → return API(originalRequest) — retry original request
  
  Line 201-204: if (result.shouldLogout)
    → Refresh token invalid (401/403 from refresh endpoint)
    → tokenManager.notifyExpired() — trigger logout
    → return Promise.reject(error)
  
  Line 207-209: else (network error during refresh)
    → Keep user logged in with cached session
    → Fail this request, user can retry
```

### C.6 403 Response Handling

If user's permissions changed (roles revoked, store access removed):

```
File: axios-interceptors.ts, Line 218-221
  Line 219: if (status === 403)
    → tokenManager.notifyRefresh()
    → Trigger background permission sync (doesn't block current request)
    → Request fails, but next API call will attempt refresh
```

---

## PART D: Going Offline

### D.1 Device Loses Network

NetInfo detects network state change:

```
File: auth-provider.tsx, Line 73-95
  
  Line 73: const unsubscribe = NetInfo.addEventListener((state) => {
    → Fires whenever network state changes
  
  Line 74: const isOnline = state.isConnected ?? false
  
  Line 76-79: if (!isOnline)
    → wasOffline.current = true
    → return (do nothing now, wait for reconnection)
  
  (Device is now marked as offline, but no immediate action taken)
```

**Redux State:**

OfflineStatusBanner component checks app state and displays offline indicator:

```
File: components/feedback/OfflineStatusBanner.tsx
  useEffect monitors:
    - Device online status (from NetInfo)
    - JWTManager.getOfflineStatus() — offline token validity
  
  If offline and token valid:
    → Show "Offline Mode" banner with remaining time
  
  If offline and token expired:
    → Show "Offline session expired, reconnect to continue"
```

### D.2 Cached Data Available

When device goes offline, user can still see previously loaded data:

- Dashboard: Redux has cached dashboard data from last API call
- Products: SQLite local database has synced products (from sync engine)
- Customers: SQLite has cached customers from previous sync

User can VIEW but CANNOT create new records (write-guard prevents it).

---

## PART E: Creating a Transaction Offline

### E.1 User Attempts Offline Write

User (with CASHIER role) goes offline, then tries to create an order while offline.

Component calls:

```typescript
await createOrder({ customerId: 123, items: [...] });
```

### E.2 Write-Guard Validation Chain

**File: `apps/nks-mobile/lib/write-guard.ts`**

This is called BEFORE the mutation is queued to SQLite:

```
Line 50-70: async function assertWriteAllowed(requiredRoles?: string[])
  
  Line 51: const status = JWTManager.getOfflineStatus()
    → Reads _tokens.offlineToken from memory
    → Decodes exp claim
    → Returns: { mode: "offline_valid" | "offline_expired" | ..., expiresAt, remainingMs }
  
  Line 53-55: if (status.mode === "offline_expired")
    → throw OfflineSessionExpiredError()
    → User cannot write until they reconnect
    → (This is CHECK #1)
  
  Line 57-69: if (requiredRoles && requiredRoles.length > 0)
    → Example: requiredRoles = ["CASHIER", "MANAGER"]
    → (This is CHECK #2)
    
    Line 60: const session = await offlineSession.load()
      → Load offline session from SecureStore
      → Internally verifies HMAC-SHA256 signature (prevents tampering)
      → If signature invalid or missing: return null
    
    Line 61-63: if (!session)
      → Session tampered or not found
      → throw InsufficientRoleError(requiredRoles)
    
    Line 65-68: const hasRole = requiredRoles.some(r => session.roles.includes(r))
      → Check if user.roles includes any of ["CASHIER", "MANAGER"]
      → (This is CHECK #3)
      → If not: throw InsufficientRoleError()
```

**5 Checks in Total (as mentioned in Part E intro):**

1. **Offline JWT not expired** — JWTManager.getOfflineStatus().mode !== "offline_expired"
2. **Offline session exists** — offlineSession.load() returns non-null
3. **Offline session not tampered** — signature verification passes (internal to load())
4. **User has required role** — session.roles.includes(requiredRole)
5. **Role is not stale** — [implicit] roles were synced < 24h ago

If all checks pass: function returns normally. If any fail: throws error, mutation is NOT queued.

### E.3 HMAC Signature Verification

When user tries to write, the offline session is loaded:

```
File: offline-session.ts, Line 236-252
  
  Line 238: const raw = await getSecureItem(OFFLINE_SESSION_KEY)
    → Load from SecureStore
  
  Line 241: const session = JSON.parse(raw) as OfflineSession
  
  Line 243: if (!verifySessionIntegrity(session))
    → Line 139: verifySessionIntegrity(session)
      → Check session.signature is non-empty
      → Regex test: /^[0-9a-f]{64}$/i
        (Must be 64-char hex string = HMAC-SHA256 output)
      → Return false if invalid format
      → Cannot recompute HMAC client-side (secret is server-only)
    
    Line 244: await deleteSecureItem(OFFLINE_SESSION_KEY)
      → Signature missing/invalid = tampered
      → Delete it to prevent further use
    
    Line 245: return null
  
  Line 248: return session
```

If signature valid, offline session is approved for use in write-guard.

### E.4 Queuing Mutation to SQLite

Once write-guard passes, mutation is queued:

**File: `apps/nks-mobile/lib/local-db.ts`**

```
await db.runAsync(
  `INSERT INTO mutation_queue (entity, operation, payload, created_at)
   VALUES (?, ?, ?, ?)`,
  [
    'order',                           // entity
    'create',                          // operation
    JSON.stringify({ customerId, items, ... }), // payload
    Date.now()                         // created_at
  ]
);
```

**Mutation Record:**

```
{
  id: auto-increment,
  entity: "order",
  operation: "create",
  payload: { customerId: 123, items: [...] },
  created_at: 1699564800000,
  retries: 0,
  signature?: undefined (filled during push)
}
```

### E.5 Offline JWT Used for Signature

When mutations are later pushed online, each mutation needs to prove authority:

**File: `apps/nks-mobile/lib/sync-engine.ts`, Line 258-323**

During PUSH phase:

```
Line 272: const operations: PushOperation[] = batch.map((item) => ({
  id: String(item.id),
  clientId: `${item.id}-${Date.now()}`,
  table: item.entity,
  op: item.operation,
  opData: item.payload
}))

Line 281: const res = await API.post('/sync/push', { operations }, { timeout: 20_000 })
  → POST /sync/push with mutations
  → Request interceptor adds Authorization header with opaque session token
  → BUT: Offline JWT should be included in body (for signature verification)
```

On server, the push endpoint verifies:
1. Opaque session token is valid (Authorization header)
2. Each mutation's offline JWT signature is valid (in payload)
3. Offline JWT's exp claim hasn't passed
4. User's roles haven't changed since offline JWT was issued

### E.6 Error Scenarios

**Scenario 1: Offline JWT Expired**

```
User offline for 4 days (JWT expires after 3 days)
User tries to write
write-guard: JWTManager.getOfflineStatus() returns mode = "offline_expired"
throw OfflineSessionExpiredError("Please reconnect to continue operations")
UI shows error: "Offline access expired"
Mutation NOT queued
```

**Scenario 2: User Lacks Role**

```
User is MANAGER offline
User tries to create an order (requires CASHIER role)
write-guard: session.roles.includes("CASHIER") = false
throw InsufficientRoleError(["CASHIER"])
UI shows: "You do not have permission for this action"
Mutation NOT queued
```

**Scenario 3: Offline Session Tampered**

```
Attacker modifies SecureStore:
  Original: roles = ["CASHIER"]
  Modified: roles = ["ADMIN", "SUPER_ADMIN"]
  
User attempts write
offlineSession.load() detects signature mismatch
verifySessionIntegrity() returns false (HMAC no longer matches payload)
Offline session deleted
throw InsufficientRoleError()
Mutation NOT queued
```

---

## PART F: Going Back Online

### F.1 Device Regains Network

NetInfo detects network becomes available:

```
File: auth-provider.tsx, Line 73-95
  
  Line 74: const isOnline = state.isConnected ?? false
  
  If isOnline = true AND wasOffline.current = true:
    Line 83: wasOffline.current = false
    Line 84-89: if (isAuthenticatedRef.current)
      → User is authenticated
      → Call handleReconnection(dispatch) (fire-and-forget)
```

### F.2 Five-Step Reconnection Sequence

**File: `apps/nks-mobile/services/reconnection-handler.ts`**

This is the complete reconnection flow when device comes back online:

```
Line 107-173: async function handleReconnection(dispatch)

Guard: Line 108-111
  if (_isHandling) return  (prevent concurrent runs)
  _isHandling = true

try {
  ─────────────────────────────────────────────────────────
  STEP 1: Revocation Check
  ─────────────────────────────────────────────────────────
  
  Line 118: const { revoked, wipe } = await checkSessionRevocation()
    
    Line 60-95: checkSessionRevocation()
      Line 64: const sessionToken = tokenManager.get()
        → Get opaque BetterAuth session token
      
      Line 68-78: const res = await fetchWithTimeout(
        `${API_BASE}/auth/session-status`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json"
          }
        },
        8_000 // 8 second timeout
      )
      
      Line 85-89: const data = body?.data ?? body
        return {
          revoked: data?.revoked === true,
          wipe: data?.wipe === true
        }
  
  Line 121-124: if (revoked || wipe)
    → Session has been revoked on server (user deleted, admin terminated session)
    → await performRemoteWipe(dispatch)
      - clearAllTables() from SQLite
      - JWTManager.clear() from SecureStore
      - tokenManager.clear()
      - offlineSession.clear()
      - dispatch(setUnauthenticated())
    → return (stop reconnection, user must re-login)
  
  ─────────────────────────────────────────────────────────
  STEP 2: Token Refresh
  ─────────────────────────────────────────────────────────
  
  Line 127: const refreshResult = await refreshTokenAttempt()
    
    [Detailed in Part F.3 below]
    
    Returns: { success: boolean, newToken?: string, shouldLogout?: boolean }
  
  Line 129-136: Handle refresh result
    if (shouldLogout === true)
      → Refresh token was rejected (401/403)
      → dispatch(setUnauthenticated())
      → return (stop, user must re-login)
    
    if (!success)
      → Network error, continue anyway (user might be online but slow)
  
  ─────────────────────────────────────────────────────────
  STEP 3: JWKS Refresh
  ─────────────────────────────────────────────────────────
  
  Line 139-143: Refresh JWKS cache for offline JWT verification
    const serverBase = API_BASE.replace(/\/api\/v\d+\/?$/, "")
    await JWTManager.cacheJWKS(serverBase).catch(...)
      → Fetch fresh public keys from /api/v1/auth/mobile-jwks
      → Cache for 1 hour
      → Non-critical if fails (use stale cache)
  
  ─────────────────────────────────────────────────────────
  STEP 4: Sync Catch-Up
  ─────────────────────────────────────────────────────────
  
  Line 148-160: Sync changes from server
    const envelope = await tokenManager.loadSession<AuthResponse>()
    const storeGuuid = envelope?.data?.session?.defaultStore?.guuid
    
    if (storeGuuid)
      await runSync(storeGuuid)
        [See Part I for sync details]
        - PULL: fetch changes since cursor, apply to SQLite
        - PUSH: send queued mutations to server
    
    Non-blocking if sync fails
  
  ─────────────────────────────────────────────────────────
  STEP 5: Redux State Restore
  ─────────────────────────────────────────────────────────
  
  Line 162-167: Update Redux with fresh auth response
    if (envelope?.data)
      dispatch(setCredentials(envelope.data))
        → Updates Redux with refreshed user/roles/permissions
        → React tree now sees fresh data
  
  Line 169: log.info("Reconnection sequence complete")

} finally {
  Line 171: _isHandling = false
}
```

### F.3 Token Refresh Attempt

**File: `apps/nks-mobile/lib/refresh-token-attempt.ts`**

This is called during Step 2 and also by axios interceptor:

```
Line 34-174: async function refreshTokenAttempt()

try {
  Line 37: const envelope = await tokenManager.loadSession<AuthResponse>()
    → Load stored auth response from SecureStore
  
  Line 40: const validation = await validateTokensBeforeRefresh(envelope)
    → Check refresh token is present and valid format
    → If invalid: return { success: false, shouldLogout: true }
  
  Line 54: const refreshTokenValue = validation.refreshToken
  
  Line 57: const response = await API.post("/auth/refresh-token", {
    refreshToken: refreshTokenValue
  })
    → POST with body: { refreshToken: "opaque_token" }
    → Request interceptor adds Authorization header (current session token)
  
  Line 61: const result = response.data?.data
    → Extract refreshed tokens from response
  
  Lines 72-73: tokenManager.set(newSessionToken)
    → Update in-memory session token
    → Next API request uses new token
  
  Lines 76-88: Update SecureStore session
    await tokenManager.persistSession(updated)
      → Saves full AuthResponse with:
        - session.sessionToken (refreshed)
        - session.refreshToken (rotated)
        - session.expiresAt (new 15 min from now)
  
  Lines 93-101: Sync JWTManager dual tokens
    if (result?.jwtToken && result?.offlineToken && result?.refreshToken)
      await JWTManager.persistTokens({
        accessToken: result.jwtToken,
        offlineToken: result.offlineToken,
        refreshToken: result.refreshToken
      })
        → Updates SecureStore JWT_* keys
        → Updates _tokens module state
  
  Lines 104-111: Sync server time (non-critical)
    await syncServerTime()
      → Call GET /sync/time
      → Update clock offset for accurate expiry checks
  
  Lines 114-143: Update offline session
    const session = await offlineSession.load()
    if (session)
      const newRoles = updated.access?.roles
      if (newRoles && newRoles.length > 0)
        await offlineSession.updateRolesAndExtend(
          session,
          roleCodes,
          result?.offlineToken,    // new 3-day JWT
          result?.offlineSessionSignature  // new HMAC signature
        )
          → Update offline session with:
            - New roles from server
            - New offline token (extends 3-day window)
            - New HMAC signature (proves authenticity)
            - lastRoleSyncAt = now
      else
        await offlineSession.extendValidity(session)
          → Just extend 3-day window, keep roles unchanged
  
  Line 145: return { success: true, newToken: newSessionToken }

} catch (error) {
  Line 151-164: Handle errors
  
  const status = error.response?.status
  
  if (status === 401 || status === 403)
    → Server rejected refresh token (token expired or revoked)
    → return { success: false, shouldLogout: true }
  
  else
    → Network error / timeout
    → return { success: false, shouldLogout: false }
      (User stays logged in with cached session)
}
```

### F.4 State After Reconnection

After all 5 steps complete successfully:

SecureStore:
- Refreshed session token (older one invalidated)
- Refreshed offline token (3-day window extended)
- Refreshed JWKS cache
- Updated offline session with new roles + signature
- Synced clock offset

In-memory:
- tokenManager._token = new session token
- JWTManager._tokens = { newAccessToken, newOfflineToken, newRefreshToken }

SQLite:
- All queued mutations pushed and confirmed (or failed with logged errors)
- All new changes from server applied via sync
- Cursor updated to latest

Redux:
- auth.authResponse = refreshed response with new roles
- auth.isAuthenticated = true

UI:
- OfflineStatusBanner hides if offline mode was active
- Data refetches if needed (some components listen to sync completion)

---

## PART G: Token Refresh While Offline

### G.1 Offline JWT Expires During Offline Period

User is offline for 3 days, then tries to perform a write action on day 4:

```
Timeline:
  Day 0: User goes offline, gets offline JWT (exp = Day 3 00:00 UTC)
  Day 1-3: User performs offline operations successfully
  Day 3 12:00: JWTManager.getOfflineStatus() begins returning mode = "offline_expired"
  Day 3 13:00: User attempts to create an order
```

### G.2 Write-Guard Blocks

```
File: write-guard.ts, Line 50-70

Line 51: const status = JWTManager.getOfflineStatus()
  → Reads _tokens.offlineToken
  → Decodes exp claim = 1699564800 (Day 3 00:00)
  → now = 1699651200 (Day 3 12:00)
  → remainingMs = 1699564800 * 1000 - 1699651200 * 1000 = negative
  → mode = "offline_expired"

Line 53-55: if (status.mode === "offline_expired")
  throw OfflineSessionExpiredError("Offline session has expired...")

Mutation is NOT queued
UI shows: "Offline access expired. Please reconnect to use the app."
```

### G.3 User Goes Online

Device reconnects to network, goes through reconnection sequence:

```
STEP 2: Token Refresh
  await refreshTokenAttempt()
    → POST /auth/refresh-token with refresh token
    → Server responds with new offline token (exp = Day 10)
    → await JWTManager.persistTokens({ accessToken, offlineToken, refreshToken })
    → _tokens.offlineToken is updated in-memory
    → SecureStore updated
  
  Line 122-135: Update offline session
    await offlineSession.updateRolesAndExtend(
      session,
      roles,
      newOfflineToken,  // exp = Day 10
      newSignature      // new HMAC-SHA256
    )
    → offlineValidUntil = Date.now() + 3 days = Day 10
    → Saves to SecureStore
```

### G.4 Write Now Allowed

After reconnection, user tries same order creation:

```
write-guard.ts, Line 51-55

const status = JWTManager.getOfflineStatus()
  → _tokens.offlineToken = new token (exp = Day 10)
  → remainingMs > 0
  → mode = "offline_valid"

Line 53-55: if (status.mode === "offline_expired")
  → FALSE, so no exception

Mutation queued successfully
Signature added and pushed to server on next sync
```

---

## PART H: Role Change on Server While Offline

### H.1 Initial State

User is offline with CASHIER role. User's offline session:

```
{
  id: "uuid-123",
  userId: 456,
  storeId: 789,
  roles: ["CASHIER"],
  offlineToken: "JWT...",
  signature: "abcd1234...",  // Server-signed
  lastRoleSyncAt: Day 0 10:00,
  offlineValidUntil: Day 3 10:00
}
```

### H.2 Server Revokes CASHIER Role

Admin on web dashboard removes user's CASHIER role. User now has only USER role.

Backend marks change in permissions table. No immediate push to mobile (offline).

### H.3 User Attempts Write While Still Offline

User (thinking they still have CASHIER role) tries to create an order:

```
File: write-guard.ts, Line 50-70

await assertWriteAllowed(["CASHIER"])  // requires CASHIER

Line 51: status = JWTManager.getOfflineStatus()
  → Returns "offline_valid" (offline JWT not expired yet)

Line 57-69: if (requiredRoles && requiredRoles.length > 0)
  
  Line 60: session = await offlineSession.load()
    → Loads offline session from SecureStore
    → Verifies HMAC signature (valid, unmodified)
  
  Line 65-68: const hasRole = requiredRoles.some(r => session.roles.includes(r))
    → requiredRoles = ["CASHIER"]
    → session.roles = ["CASHIER"]  (still has old value from Day 0)
    → hasRole = true
  
  return (no error thrown)

Mutation IS queued with CASHIER signature
```

**Problem:** User can still write offline with a role they no longer have on server!

### H.4 User Goes Online

Device reconnects, runs full reconnection sequence:

```
STEP 1: Revocation Check
  GET /auth/session-status
    → Returns { revoked: false, wipe: false }
    → Session still active (just role changed)
    → No remote wipe triggered

STEP 2: Token Refresh
  POST /auth/refresh-token
    → Server verifies refresh token (valid)
    → Server fetches user's CURRENT roles: ["USER"]
    → MISMATCH detected!
    
    Backend logic in auth.service:
      const currentRoles = await getUserPermissions(userId)
      // currentRoles = ["USER"]
      const previousRoles = offlineSession.roles
      // previousRoles = ["CASHIER"]
      if (roleHash !== calculateHash(currentRoles))
        result.offlineSessionSignature = null  // Do NOT return signature
        log.warn("Role change detected")
  
  → Response: offlineToken (new), but offlineSessionSignature = null or missing
  
  Back in mobile refreshTokenAttempt():
    Line 122-127: await offlineSession.updateRolesAndExtend(
      session,
      roleCodes: ["USER"],  // NEW roles
      newOfflineToken,
      signature: undefined  // NOT included in response!
    )
    
    File: offline-session.ts, Line 278-296
      Updated = {
        ...session,
        roles: ["USER"],  // Overwrites old ["CASHIER"]
        offlineValidUntil: Day 10,
        lastRoleSyncAt: Date.now(),
        signature: undefined (MISSING!)
      }
      
      await saveSecureItem(OFFLINE_SESSION_KEY, JSON.stringify(updated))
        → Offline session now has NO signature
```

### H.5 User Attempts Write Again (Now Online)

```
write-guard.ts, Line 50-70

await assertWriteAllowed(["CASHIER"])

Line 51: status = JWTManager.getOfflineStatus()
  → Offline token valid, but device is online
  → Actually, check: is device online or offline?
  
  If device is online:
    → API calls go straight to server via authorization header
    → Server checks current permissions (["USER"])
    → CASHIER write is forbidden
    → 403 Forbidden response
    → Axios interceptor triggers permission refresh
    → User sees error in UI
  
  If device went offline again before refresh completed:
    → write-guard: await offlineSession.load()
      Line 243: if (!verifySessionIntegrity(session))
        → Signature is missing
        → verifySessionIntegrity() returns false
      
      Line 244: await deleteSecureItem(OFFLINE_SESSION_KEY)
        → Delete unsigned session
      
      Line 245: return null
    
    → write-guard: if (!session)
      throw InsufficientRoleError(["CASHIER"])
```

**Net Effect:**

- While offline: Queued mutations with CASHIER signature
- Server receives mutations: Validates signature against CURRENT user permissions
- Server logic detects role mismatch: Rejects mutation, logs audit event
- User sees error on re-sync: "Permission denied for this operation"
- On next reconnect: Offline session roles updated, signature cleared if mismatch

---

## PART I: Server Sync & Conflict Resolution

### I.1 Multiple Queued Mutations

After 2 hours offline, user has queued:

```
SQLite mutation_queue:
  id=1: { entity: 'order', op: 'create', payload: {...}, retries: 0 }
  id=2: { entity: 'order', op: 'update', payload: {...}, retries: 0 }
  id=3: { entity: 'customer', op: 'create', payload: {...}, retries: 0 }
```

### I.2 Device Comes Online

Reconnection sequence Step 4 triggers sync:

```
File: sync-engine.ts, Line 90-128

await runSync(storeGuuid)
  Line 102-104: Ensure database initialized
  
  try {
    Line 107: await pullChanges(storeGuuid)
      → PULL phase: fetch server changes since cursor
      [Details in I.3]
    
    Line 110: await pushMutations()
      → PUSH phase: send queued mutations
      [Details in I.4 & I.5]
    
    Line 113: _lastSyncedAt = Date.now()
  }
```

### I.3 PULL Phase Details

```
File: sync-engine.ts, Line 158-251

async function pullChanges(storeGuuid)
  
  Line 162: let cursor = await getCursor()
    → Load last synced cursor from SQLite
    → Example: cursor = 1000 (processed up to change ID 1000)
  
  Line 166-248: while (true)
    pageNum = 1
    
    Line 172-179: const res = await API.get<ChangesResponse>(
      '/sync/changes',
      {
        params: {
          cursor: 1000,
          storeId: storeGuuid,
          tables: 'routes'
        },
        timeout: 10_000
      }
    )
    
    Backend /sync/changes endpoint:
      SELECT * FROM change_log
      WHERE store_id = ? AND id > cursor
      ORDER BY id ASC
      LIMIT 100
      
      For each change:
        {
          id: 1001,
          operation: 'upsert' | 'delete',
          table: 'routes',
          data: { id: 5, routeName: 'New Route', ... }
        }
    
    Response:
      {
        nextCursor: 1050,
        hasMore: false,
        changes: [ ... 50 items ... ]
      }
    
    Line 196-235: For each change
      if (change.table === 'routes')
        if (change.operation === 'upsert' && change.data)
          db.runAsync(
            `INSERT OR REPLACE INTO routes
             (id, guuid, route_name, ...)
             VALUES (?, ?, ?, ...)`
          )
            → SQLite: INSERT OR REPLACE (upsert)
            → If route id=5 exists, replace. Else insert.
        
        else if (change.operation === 'delete')
          db.runAsync('DELETE FROM routes WHERE id = ?', [change.id])
    
    Line 242: await saveCursor(response.nextCursor)
      → Update cursor = 1050 in SQLite
      → Next sync starts from 1050
    
    Line 245-247: if (!response.hasMore)
      break from loop

  Line 250: log.info(`PULL: Synced ${totalChanges} total changes`)
```

### I.4 PUSH Phase Details

```
File: sync-engine.ts, Line 258-323

async function pushMutations()
  
  Line 262-267: while (true)
    
    Line 262: const batch = await getMutationQueueBatch(PUSH_BATCH_SIZE)
      → Query SQLite:
          SELECT * FROM mutation_queue
          WHERE status = 'pending'
          ORDER BY created_at ASC
          LIMIT 50
      
      → Returns array of 3 mutations (our example from I.1)
    
    Line 264-266: if (batch.length === 0)
      log.info('PUSH: Queue empty')
      return
    
    Line 269: log.debug(`PUSH: Sending batch of ${batch.length} mutations`)
    
    Line 272-278: Convert to push format
      const operations: PushOperation[] = batch.map((item) => ({
        id: String(item.id),
        clientId: `${item.id}-${Date.now()}`,
        table: item.entity,
        op: item.operation,
        opData: item.payload
      }))
      
      Example:
        [
          {
            id: "1",
            clientId: "1-1699564800000",
            table: "order",
            op: "create",
            opData: { customerId: 123, items: [...] }
          },
          {
            id: "2",
            clientId: "2-1699564800000",
            table: "order",
            op: "update",
            opData: { orderId: 456, status: "paid" }
          },
          ...
        ]
    
    Line 280-284: POST to server
      const res = await API.post<{ processed: number }>(
        '/sync/push',
        { operations },
        { timeout: 20_000 }
      )
      
      Request interceptor adds:
        Authorization: Bearer <session_token>
      
      Backend /sync/push endpoint receives:
        POST /sync/push
        Authorization: Bearer <valid_session>
        Body: { operations: [...] }
```

### I.5 Server Processes Mutations

**Backend: `/sync/push` endpoint**

```
For each operation in the batch:
  
  1. VERIFY AUTHORIZATION
     Extract session token from Authorization header
     Query user_sessions WHERE token = ?
     Get userId and permissions
  
  2. VALIDATE SIGNATURE (if offline mutation)
     Extract offlineJwt from opData metadata
     Decode JWT
     Verify signature with RS256 public key (JWKS cache)
     Check exp claim (must be < current time)
     Extract roles from JWT payload
  
  3. CHECK PERMISSIONS
     Compare JWT roles with required role for this operation
     Example: "create_order" requires ["CASHIER", "MANAGER"]
     If user.roles.includes("CASHIER"): APPROVED
     Else: REJECTED with 403
  
  4. VALIDATE DATA
     Schema validation (zod, class-validator)
     Business logic validation (customer exists, inventory available, etc.)
  
  5. EXECUTE TRANSACTION
     BEGIN TRANSACTION
     INSERT/UPDATE/DELETE the record
     INSERT audit log entry: { user_id, operation, entity, old_values, new_values }
     COMMIT
  
  6. RESPOND
     processed: number of mutations successfully applied
     If operation 1,2 succeeded but 3 failed:
       Response: { processed: 2 }
     Client receives: 2 out of 3 processed
```

### I.6 Client Processes Response

Back in sync-engine.ts, Line 287-302:

```
const processed = res.data?.processed ?? 0

if (processed > 0)
  const idsToDelete = batch.slice(0, processed).map((item) => item.id)
  await deleteMutationsById(idsToDelete)
  
  Example: processed = 2
    idsToDelete = [1, 2]
    DELETE FROM mutation_queue WHERE id IN (1, 2)
    
    Mutation 3 remains in queue (will retry next sync)

if (processed < batch.length)
  log.warn(`Only ${processed}/${batch.length} processed — stopping queue`)
  return
  
  Example: 2 out of 3 processed
    Stop here, don't attempt mutations 4+ yet
    Next time device syncs, try mutation 3 again
    (Server may have been fixed, or business logic error permanent)
```

### I.7 Conflict Resolution Examples

**Example 1: Offline Create, Server Already Exists**

```
Mobile: Create order #1000 offline
Server: Order #1000 already exists (created by another user)

During PUSH:
  Server validates: INSERT INTO orders (id, ...) VALUES (1000, ...)
  Constraint violation: unique constraint on id
  REJECTED
  
Response: { processed: 0 }
Mobile: Mutation 1 remains in queue
User: Sync shows "Order #1000 already exists"

Next sync: Still fails (unless manually resolved)
```

**Example 2: Offline Update, Server State Changed**

```
Mobile (Day 0): Load order #5000 (price = $100)
Mobile (Day 1 offline): Update order #5000 to price = $150, queue mutation
Mobile (Day 2 online): Sync

Server (Day 1): Admin changed order #5000 price to $200 via web
Server (Day 2): Receives mobile update to price = $150

During PUSH:
  Server applies: UPDATE orders SET price = $150 WHERE id = 5000
  Last-write-wins: Mobile's $150 overwrites server's $200
  
APPROVED (no validation error)
Server responds: { processed: 1 }
Mobile: Mutation deleted

Result: Order price is $150 (mobile's value)
Conflict resolution: Last-write-wins (mobile synced last)

To prevent this: Implementation would need:
  - Timestamp comparison: if mobile.updated_at < server.updated_at: reject
  - Optimistic lock: store version number, increment on each write
  - Conflict detection UI: show both values, let user choose
```

**Example 3: Invalid Signature**

```
Mobile: Queue mutation with offline JWT signature
Offline JWT was created 4 days ago (expired 1 day ago)

During PUSH:
  Server verifies JWT signature
  Checks exp claim: exp = 3 days ago
  JWT is EXPIRED
  
REJECTED: { error: "Offline token expired" }
Server responds: { processed: 0 }
Mobile: Mutation remains in queue

User reconnects: Offline JWT refreshed (new 3-day validity)
Next sync: Offline JWT now valid, mutation is processed
```

---

## PART J: Logout

### J.1 User Taps Logout

User navigates to Settings, taps "Sign Out" button.

Component dispatches:

```typescript
dispatch(logoutThunk());
```

### J.2 Logout Sequence

**File: `apps/nks-mobile/store/logout-thunk.ts`**

```
Line 23-72: const logoutThunk = createAsyncThunk(...)

Line 29: await tokenMutex.withClearLock(async () => {
  
  Serialize this logout with any in-flight refresh
  (prevents race: refresh completes, then logout clears the refreshed token)
  
  Line 33-36: try { await dispatch(signOut({})) }
    → POST /auth/logout with Authorization header (current session token)
    → Server marks session as revoked in user_sessions table
    → User session invalidated on server-side
  
  catch (error)
    → Non-blocking: continue logout even if API fails
    → Device was offline, or server error
  
  Line 39: tokenManager.clear()
    → Clear in-memory _token
    → Next API request will have no Authorization header
  
  Line 40: await tokenManager.clearSession()
    → Delete from SecureStore: auth.session key
    → Auth response gone
  
  Line 41: await offlineSession.clear()
    → Delete from SecureStore: offline session
    → No offline auth possible anymore
  
  Line 42: await JWTManager.clear()
    → Delete from SecureStore: JWT_ACCESS_TOKEN, JWT_OFFLINE_TOKEN, JWT_REFRESH_TOKEN
    → Also clear _tokens in-memory
    → JWKS cache also cleared
  
  Line 43: await DeviceManager.clear()
    → Delete from SecureStore: device binding info
  
  Line 44: resetRefreshState()
    → Clear refresh timer state (proactive refresh module)
  
  Line 45: resetInterceptorState()
    → File: axios-interceptors.ts, Line 83-86
    → Clear isRefreshing, failedQueue
    → Eject interceptors
    → Prevents stale interceptors from lingering
  
  Line 46: resetSyncState()
    → File: sync-engine.ts, Line 149-152
    → Clear _syncing flag and _lastSyncedAt
    → Prevents stale sync state leaking to next user
  
  Line 47: resetServerTime()
    → Clear clock offset from SecureStore
    → Next user starts with fresh offset
  
  Line 49-50: await clearAllTables()
    → DELETE FROM orders, customers, routes, inventory, mutation_queue, ...
    → Wipe local database completely
    → Prevents cached data leakage to next user
  
  Line 52-58: if (IS_SHARED_DEVICE)
    → Shared device: multiple users on same device
    → await deleteDbKey()
      → Delete encryption key for SQLite
      → Next user cannot decrypt cached database
      → (Not applicable for personal devices)
  
  Line 61: resetRateLimiters()
    → Clear OTP rate limit state
    → Next login starts with fresh rate limits
  
  Line 62: resetServerTime()
    → Clear time offset
  
  Line 63: dispatch(logoutAction())
    → Update Redux:
      auth.isAuthenticated = false
      auth.authResponse = null
      auth.isInitializing = false
    → Route changes to /(auth)/phone
  
  Line 64: log.info("Session and offline data cleared successfully")

} catch (error) {
  Line 66: log.error("Failed to clear session:", sanitizeError(error))
  
  Line 68: dispatch(logoutAction())
    → Logout Redux anyway
  
  Line 69: throw error
    → Re-throw so component can show error toast
})
```

### J.3 State After Logout

**SecureStore:**
- ALL keys deleted: auth.*, jwt.*, offline_session, server.time_offset, device.*

**In-memory:**
- tokenManager._token = null
- JWTManager._tokens = { accessToken: null, offlineToken: null, refreshToken: null }
- JWTManager._jwksCache = null
- isRefreshing = false
- failedQueue = []

**SQLite:**
- ALL tables truncated: orders, customers, routes, inventory, mutation_queue, ...

**Redux:**
- auth.isAuthenticated = false
- auth.authResponse = null

**UI:**
- Route: /(auth)/phone (login screen)
- User sees fresh login form

**Server:**
- user_sessions row for this session marked as revoked/deleted
- Tokens become invalid on server-side
- If another device tries to use tokens: 401 Unauthorized

---

## Summary of Key Designs

### Token Boundaries

1. **Opaque BetterAuth Session Token** (7 days)
   - Used in Authorization header for all API calls
   - Managed by tokenManager (@nks/mobile-utils)
   - Persisted in SecureStore, in-memory, and httpOnly cookie (web)
   - Rotated on each refresh

2. **RS256 Access JWT** (15 min)
   - NOT used for API calls (opaque token is used)
   - Used for offline JWT validation, internal claims checks
   - Managed by JWTManager
   - Persisted in SecureStore
   - Provides claims: userId, roles, stores, exp

3. **RS256 Offline JWT** (3 days)
   - Used to prove authority for offline mutations
   - HMAC-SHA256 signature bound to offline session (prevents tampering)
   - Sent in mutation payload, server verifies signature
   - Extends every time user syncs online
   - Enables 3-day offline window

4. **Opaque Refresh Token** (7 days, rotated on refresh)
   - Used only for /auth/refresh-token endpoint
   - Stored in SecureStore
   - Implements refresh token rotation (old token invalidated after use)
   - Reuse detection: if old refresh token used twice, all sessions terminated

### Write-Guard Five Checks

1. Offline JWT not expired (`JWTManager.getOfflineStatus()`)
2. Offline session loaded (`offlineSession.load()`)
3. Signature valid (HMAC-SHA256 verification)
4. User has required role (`session.roles.includes(requiredRole)`)
5. Roles not stale (synced < 24h ago)

Any check fails: Mutation not queued, user sees error.

### Offline Session HMAC Signature

- Server-computed during OTP verification: `HMAC-SHA256(secret, userId|storeId|roles|validity)`
- Secret never leaves server
- Mobile stores signature as-is
- On write-guard: verify signature format (64-char hex), cannot recompute
- On mutation push: server recomputes and verifies (re-computes for tamper detection)
- If tampered: signature mismatch detected, write rejected

### Reconnection Guardrails

5-step sequence ensures safe sync after network loss:

1. Revocation check: Is user still authorized?
2. Token refresh: Get fresh JWTs
3. JWKS refresh: Get latest public keys for offline JWT verification
4. Sync: PULL changes from server, PUSH queued mutations
5. Redux restore: Update React tree with fresh data

Each step non-critical except revocation. Network errors don't block overall reconnection.

### Conflict Resolution Strategy

- Last-write-wins: Mobile mutations applied if no unique constraint violation
- Signature validation: Mutations with expired/tampered JWT rejected
- Permission validation: User's current roles must match mutation requirements
- No merge logic: Simple sync, assumes mutations are independent

For conflict handling, app would need:
- Timestamp comparison (last-write-wins with timestamp)
- Conflict detection UI (show both versions, user chooses)
- Three-way merge (original, mobile, server)

---

## Implementation Checklist for Developers

To replicate this flow manually:

### Login Flow
- [ ] User enters phone → `usePhoneAuth.handleSendOtp()`
- [ ] OTP arrives via MSG91
- [ ] User enters OTP → `useOtpVerify.handleVerify()`
- [ ] Verify call hits backend `/auth/otp` endpoint
- [ ] Backend calls MSG91 verify API
- [ ] Success: `persistLogin()` called
- [ ] Check SecureStore has auth.session, jwt_access_token, jwt_offline_token, offline_session
- [ ] Check Redux has auth.isAuthenticated = true
- [ ] Check route changed to /(main)

### Offline Operations
- [ ] Go offline (toggle NetInfo)
- [ ] Try to create order (with role check)
- [ ] Call `assertWriteAllowed(["CASHIER"])`
- [ ] Verify mutation queued to SQLite mutation_queue table
- [ ] Check offline token not expired: `JWTManager.getOfflineStatus()`
- [ ] Go online: verify reconnection sequence fires
- [ ] Check sync pushes mutations: verify deleted from mutation_queue

### Token Refresh
- [ ] Make API call while online
- [ ] Force 401 response (e.g., revoke token on server)
- [ ] Verify axios interceptor catches 401
- [ ] Verify refresh is called: POST /auth/refresh-token
- [ ] Verify original request replayed with new token
- [ ] Check in-memory tokenManager updated
- [ ] Check offline session extended

### Offline JWT Expiry
- [ ] Mock time to 3 days + 1 hour from login
- [ ] Call `JWTManager.getOfflineStatus()`
- [ ] Verify mode = "offline_expired"
- [ ] Try to write: verify write-guard blocks
- [ ] Go online: verify token refresh gets new offline JWT
- [ ] Try to write again: verify allowed

### Role Revocation
- [ ] User offline with ["CASHIER"]
- [ ] Remove role via backend
- [ ] User tries to write: should succeed (cached roles used)
- [ ] Go online: verify reconnection updates roles to []
- [ ] User tries to write: verify write-guard blocks

### Logout
- [ ] Call `logoutThunk()`
- [ ] Verify /auth/logout API called
- [ ] Verify SecureStore keys deleted: auth.*, jwt.*, offline_session
- [ ] Verify SQLite tables cleared
- [ ] Verify Redux reset
- [ ] Verify route changed to /(auth)/phone
- [ ] Verify attempt to use old tokens: 401 response from server

