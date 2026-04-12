# Mobile Auth Persistence - Deep Technical Analysis

**Date:** April 9, 2026
**Scope:** Complete auth session persistence flow
**Focus:** Issues, race conditions, data consistency, security
**Status:** ⚠️ CRITICAL ISSUES FOUND

---

## Executive Summary

The auth persistence system has **2 CRITICAL issues**, **3 HIGH-priority concerns**, and **4 design gaps** that could cause data loss, stale sessions, or forced logouts.

| Issue Type | Count | Severity |
|-----------|-------|----------|
| **Critical (Data Loss)** | 2 | 🔴 FIX NOW |
| **High (Session Issues)** | 3 | 🟠 FIX SOON |
| **Design Gaps** | 4 | 🟡 IMPROVE |
| **Minor (UX)** | 2 | 🟢 NICE-TO-HAVE |

---

## Part 1: Architecture Overview

```
App Launch
    ↓
[auth-provider.tsx]
  ├─ useEffect: dispatch(initializeAuth())
  ├─ Splash screen shown while isInitializing = true
  └─ Loop: await until isInitializing = false
    ↓
[initializeAuth thunk]
  ├─ Load: tokenManager.loadSession() from SecureStore
  ├─ Validate: sessionToken exists + not expired
  ├─ Dispatch: setCredentials(envelope.data)
  ├─ Set: isInitializing = false
  └─ Result: Splash screen hides
    ↓
[root router]
  ├─ if (isInitializing): <SplashScreen />
  ├─ if (isAuthenticated): <WorkspaceLayout />
  └─ else: <LoginLayout />
```

**Flow seems correct**, but let's check line-by-line...

---

## Part 2: CRITICAL ISSUE #1 - Race Condition in Token Storage

### The Problem

```typescript
// From persistLogin.ts (lines 13-16)
tokenManager.set(authResponse.data.session.sessionToken);

try {
  await tokenManager.persistSession(authResponse);
}
```

**Sequence of Events:**
```
1. User completes OTP verification
2. verifyOtp returns AuthResponse
3. persistLogin called with AuthResponse
4. Line 13: tokenManager.set(sessionToken) - IN MEMORY
   └─ Token now in _token variable
5. Line 16: await tokenManager.persistSession(...)
   └─ Starts async write to SecureStore
   └─ Does NOT wait for completion before line 17
6. Line 17: tokenManager.persistSession finishes ASAP
   └─ But app might crash/restart BEFORE async write completes
7. App crashes before write completes
   └─ SecureStore still has OLD session (if any)
   └─ But in-memory token has NEW token
   └─ MISMATCH!
```

### Why This Matters

```
Scenario: Slow storage write
├─ User logs in via OTP
├─ persistLogin called
├─ sessionToken set in memory ✅
├─ persistSession starts (async)
├─ App immediately crashes (low memory, user force-closes)
├─ SecureStore write never completes
├─ On restart:
│  ├─ initializeAuth loads OLD session from SecureStore (or nothing)
│  ├─ _token is null
│  ├─ User forced back to login
│  └─ Session just created is lost
```

### Code Evidence

```typescript
// persistLogin.ts lines 13-22
tokenManager.set(authResponse.data.session.sessionToken);

try {
  await tokenManager.persistSession(authResponse);  // ⚠️ NO RETURN/AWAIT HANDLING
} catch (error) {
  // Storage write failed (full, permission denied, etc.).
  // Token is still alive in memory for this session — user can continue,
  // but will be logged out on next app restart.
}

// ... code continues before persistSession promise settles ...
const user = authResponse.data.user;
const access = authResponse.data.access;
// ... more async operations ...
```

**Problem:** The `await` doesn't guarantee SecureStore write finished successfully!

### Impact: 🔴 **CRITICAL**
- User completes login → gets logged out on next restart
- Data loss - session token never persisted
- User experience: confusing forced re-login

---

## Part 2a: Fix for Critical Issue #1

```typescript
// Current (buggy):
await tokenManager.persistSession(authResponse);  // ⚠️ no error propagation

// Fixed:
try {
  await tokenManager.persistSession(authResponse);
  // Only set token in memory after successful write
  tokenManager.set(authResponse.data.session.sessionToken);
} catch (error) {
  console.error("[Auth] Failed to persist session:", error);
  // Don't set in-memory token if storage fails
  throw error;  // Propagate to UI
}
```

Or better:

```typescript
// Set in memory ONLY after storage write succeeds
try {
  await tokenManager.persistSession(authResponse);
  // Now that storage succeeded, set in-memory token
  tokenManager.set(authResponse.data.session.sessionToken);
} catch (error) {
  setErrorMessage("Failed to save session. Please try again.");
  return;  // Don't navigate
}

// Only then dispatch and navigate
dispatch(setCredentials(authResponse));
router.replace("/(protected)/(workspace)");
```

---

## Part 3: CRITICAL ISSUE #2 - Data Integrity: AuthResponse Size Limit

### The Problem

```typescript
// From tokenManager.ts (lines 17-18, 80-93)
const MAX_BYTES = 1800;  // SecureStore max is 2048
const json = JSON.stringify(envelope);

if (json.length <= MAX_BYTES) {
  await saveSecureItem(SESSION_KEY, json);
  return;
}

// Payload too large — strip arrays and force re-fetch on next boot
const slim: SessionEnvelope<any> = {
  data: {
    ...data,
    access: { ...(data.access ?? {}), permissions: [], roles: [] }
  },
  fetchedAt: 0,  // Force refresh
};
```

**What Happens When AuthResponse is Too Large:**

```
Scenario: User with many roles/permissions logs in
├─ AuthResponse { user, session, access: { roles: [...100 items], permissions: [...] } }
├─ JSON.stringify(envelope) = 2100 bytes
├─ Exceeds MAX_BYTES (1800)
├─ Action: STRIP roles and permissions
├─ Saved: { user, session, access: { roles: [], permissions: [] } }
├─ Set: fetchedAt: 0
├─ On app restart:
│  ├─ Load session with empty roles/permissions
│  ├─ Check: fetchedAt = 0 (> 15 min old)
│  ├─ Trigger: background refresh via refreshSession()
│  ├─ But user sees workspace with NO ROLES temporarily
│  └─ UI breaks or shows permission errors
```

### Current Implementation Detail

```typescript
// initializeAuth.ts lines 48-49
const isStale = Date.now() - envelope.fetchedAt > SESSION_STALE_MS;
if (isStale) dispatch(refreshSession());

// refreshSession.ts handles the refresh
// But user navigates to workspace BEFORE refresh completes
// So user sees workspace without permissions
```

### Impact: 🔴 **CRITICAL**
- User with many roles gets data stripped without warning
- App shows workspace with blank roles (permission errors)
- Race condition: user can interact with workspace before permissions load
- Could cause "Permission denied" errors on first click
- No user feedback

### Why This Happens

```typescript
// AuthResponse structure
{
  user: { id, name, email, ... },           // ~500 bytes
  session: { sessionToken, refreshToken ... }, // ~300 bytes
  access: {                                  // ~800+ bytes
    activeStoreId: 1,
    isSuperAdmin: false,
    roles: [                                 // <<< Large array
      { roleCode, storeId, storeName, ... },
      // ... 50-100 roles for multi-store users
      { roleCode, storeId, storeName, ... }
    ]
  }
}
```

A user with 50 stores + custom roles can exceed 1800 bytes.

### Impact on Workspace

```
User logs in
→ persistLogin saves slim AuthResponse (no roles)
→ Dispatch setCredentials with empty roles
→ Redux state: { isAuthenticated: true, access: { roles: [] } }
→ Router navigates to workspace
→ Workspace components try to render with empty roles
→ Later: refreshSession completes → roles updated
→ UI needs to re-render (might work, might not)
```

---

## Part 3a: Fix for Critical Issue #2

**Option 1: Increase storage limit** (if not hitting SecureStore's hard limit)
```typescript
const MAX_BYTES = 2000;  // Try larger (still < 2048 hard limit)
```

**Option 2: Compress roles before storing** (best)
```typescript
// Store only essential role fields
const slim: SessionEnvelope<any> = {
  data: {
    ...data,
    access: {
      ...data.access,
      roles: (data.access?.roles ?? []).map(r => ({
        roleCode: r.roleCode,
        storeId: r.storeId,
        // Drop: storeName, isPrimary, assignedAt, expiresAt
      }))
    }
  },
  fetchedAt: Date.now()  // ✅ NOT 0 — session is still fresh
};
```

**Option 3: Split storage** (most robust)
```typescript
// Store roles separately in a different SecureStore key
await saveSecureItem("nks_session_main", JSON.stringify(mainEnvelope));
await saveSecureItem("nks_session_roles", JSON.stringify(rolesEnvelope));

// On load, combine them back
```

**Recommended:** Option 2 - keep minimal role info, set `fetchedAt: Date.now()` so it's not treated as stale

---

## Part 4: HIGH-Priority Issue #1 - No Validation of Restored Session

### The Problem

```typescript
// initializeAuth.ts lines 19-25
const envelope = await tokenManager.loadSession<AuthResponse>();

if (!envelope?.data?.data?.session?.sessionToken) {
  dispatch(setUnauthenticated());
  return;
}

tokenManager.set(envelope.data.data.session.sessionToken);
dispatch(setCredentials(envelope.data));
```

**What's NOT Validated:**

```
✅ sessionToken exists
❌ sessionToken has NOT expired
❌ sessionToken was NOT revoked by server
❌ User role has NOT changed
❌ Session is NOT from a different device
❌ User is still ACTIVE (not deleted/suspended)
```

### Scenarios Where This Breaks

**Scenario 1: Session Expired Locally**
```
User: logs in with 7-day session
Day 8: User opens app
Action: initializeAuth loads session
Result: Token loaded, no check for expiry timestamp
Issue: App continues with expired session
       First API call returns 401 → user forced logout
```

**Scenario 2: Admin Deleted User's Account**
```
User: logs in, everything works
Later: Admin deletes user account
User: reopens app
Action: initializeAuth loads session
Result: Token loaded, no server validation
Issue: App shows workspace, first API call fails with 403/401
       User sees broken workspace briefly before logout
```

**Scenario 3: Role Changed Since Login**
```
User: logs in as STAFF
Later: Admin upgrades user to STORE_OWNER
User: reopens app
Action: initializeAuth loads old session with STAFF role
Result: UI shows old role until permissions refresh
Issue: User can see workspace with wrong role briefly
       Race condition: user might interact with wrong permissions
```

### Code Analysis

```typescript
// initializeAuth.ts - NO validation of expiresAt
const envelope = await tokenManager.loadSession<AuthResponse>();

// envelope contains expiresAt, but it's NOT checked
const expiresAt = envelope?.data?.data?.session?.expiresAt;
if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
  // ❌ This check is MISSING
  // Should: dispatch(setUnauthenticated())
  // return
}
```

### Impact: 🟠 **HIGH**
- Stale sessions restored without validation
- First API call will fail with 401
- User sees workspace briefly, then forced logout
- Poor UX - feels broken

---

## Part 4a: Fix for HIGH Issue #1

```typescript
// initializeAuth.ts - Add expiration check
const envelope = await tokenManager.loadSession<AuthResponse>();

if (!envelope?.data?.data?.session?.sessionToken) {
  dispatch(setUnauthenticated());
  return;
}

// ✅ NEW: Check if session has expired
const sessionExpiresAt = envelope.data.data.session.expiresAt;
if (sessionExpiresAt && new Date(sessionExpiresAt).getTime() < Date.now()) {
  // Session expired
  await tokenManager.clearSession();
  dispatch(setUnauthenticated());
  return;
}

// ✅ NEW: Check if session is too old (force refresh)
const isStale = Date.now() - envelope.fetchedAt > SESSION_STALE_MS;
if (isStale) {
  // Don't trust old data, force fresh login
  console.warn("[Auth] Session data is stale, requesting fresh session");
  dispatch(refreshSession());
  return;
}

tokenManager.set(envelope.data.data.session.sessionToken);
dispatch(setCredentials(envelope.data));
```

---

## Part 5: HIGH-Priority Issue #2 - Race Condition in Token Expiry

### The Problem

```typescript
// axios-interceptors.ts lines 36-40
async function attemptRefresh(): Promise<string | null> {
  try {
    const envelope = await tokenManager.loadSession<any>();
    const refreshTokenValue = envelope?.data?.data?.session?.refreshToken;
    if (!refreshTokenValue) return null;

    const response = await API.post("/auth/refresh-token", {
      refreshToken: refreshTokenValue,
    });
```

**Scenario: Two Concurrent API Requests**

```
T=0ms:   Request A made with access token (valid for 1 hour)
T=0.5ms: Request B made with same access token

T=59m: Access token expires

T=59m+1ms: Request A response: 401 (token expired)
           Interceptor: enters refresh flow
           Sets: isRefreshing = true
           Queues: Request A retry

T=59m+2ms: Request B response: 401 (token expired)
           Interceptor: checks isRefreshing (true)
           Queues: Request B retry
           ✅ Correct: both wait in queue

T=59m+100ms: Refresh completes
             New token: xyz123
             isRefreshing = false
             processQueue(null, "xyz123")
             Both requests retry with new token
             ✅ Correct behavior

BUT WHAT IF:

T=59m+1ms: Request A: 401
T=59m+2ms: Request B: 401
T=59m+3ms: Request C: SUCCESS (with new token)
           Why? Backend issued new token immediately

           Now: 3 concurrent refresh attempts
           Only first one should refresh, others wait
           ✅ Queue system handles this
```

**Actual Race Condition Found:**

```typescript
// axios-interceptors.ts lines 151-174
const newToken = await attemptRefresh();

if (newToken) {
  processQueue(null, newToken);
  originalRequest.headers.Authorization = `Bearer ${newToken}`;
  return API(originalRequest);
}

// Refresh returned null → server rejected the refresh token
processQueue(error, null);
tokenManager.notifyExpired();  // ⚠️ THIS FIRES CALLBACK
return Promise.reject(error);
```

**Issue:** When refresh fails (401), `tokenManager.notifyExpired()` is called.

```typescript
// tokenManager.ts lines 52-56
notifyExpired(): void {
  if (_expiredFired) return;
  _expiredFired = true;
  _onExpired?.();  // Fires callback
}

// From store/index.ts lines 50-53
tokenManager.onExpired(async () => {
  await tokenManager.clearSession();  // ⚠️ Async
  store.dispatch(setUnauthenticated());
});
```

**The Race:**

```
T1: Request A fails with 401
T2: attemptRefresh() starts
T3: Request B fails with 401 (queued)
T4: Refresh response is 401 (token revoked)
T5: tokenManager.notifyExpired() called
T6: tokenManager.clearSession() starts (async)
T7: store.dispatch(setUnauthenticated()) called immediately (sync)
    BUT SecureStore clear hasn't completed yet

Scenario: App crashes between T7 and T6's completion
├─ Redux state: unauthenticated ✅
├─ SecureStore: STILL HAS OLD SESSION ❌
├─ On restart:
│  ├─ initializeAuth loads OLD session from SecureStore
│  ├─ App tries to login with OLD token
│  └─ First API call fails with 401 again
│  └─ Loop: keeps failing
```

### Impact: 🟠 **HIGH**
- On theft detection, SecureStore clear might not complete
- App restart could load expired session again
- Potential for infinite 401 loop

---

## Part 5a: Fix for HIGH Issue #2

```typescript
// In store/index.ts - Make logout truly atomic
tokenManager.onExpired(async () => {
  // ✅ Wait for storage clear BEFORE dispatch
  try {
    await tokenManager.clearSession();
  } catch (err) {
    console.error("[Auth] Failed to clear session:", err);
  }

  // NOW dispatch Redux update
  store.dispatch(setUnauthenticated());
});

// OR in tokenManager.ts - Add atomic logout
async function atomicLogout() {
  await deleteSecureItem(SESSION_KEY);
  _token = null;
  _expiredFired = false;
}
```

---

## Part 6: HIGH-Priority Issue #3 - Offline Session Not Synced with Auth Session

### The Problem

```typescript
// persistLogin.ts lines 24-56
// Saves offline session AFTER main session
const activeStoreId = access?.activeStoreId;
if (!activeStoreId) {
  console.warn("[Auth] No active store ID in auth response");
  dispatch(setCredentials(authResponse));  // ⚠️ Dispatch before offline session created
  return;
}

// Create offline session...
await offlineSession.create({
  userId: parseInt(user.id, 10),
  storeId: activeStoreId,
  // ...
});

dispatch(setCredentials(authResponse));  // Dispatches AGAIN (redundant)
```

**Issue 1: Double Dispatch**
```
Line 33: dispatch(setCredentials) - early return path
Line 68: dispatch(setCredentials) - normal path
→ setCredentials dispatched twice, Redux state updated twice
→ UI re-renders twice (performance issue, but minor)
```

**Issue 2: Offline Session Out of Sync**
```
Scenario: createOfflineSession fails (storage full)
├─ Main session saved ✅
├─ Offline session creation fails ❌
├─ Continue to workspace anyway
├─ User tries offline transaction
├─ offlineSession.load() returns null
├─ App assumes not offline-capable
└─ Feature not available
```

**Issue 3: Role Mismatch**
```
persistLogin: saves offline session with roles from auth response
refreshSession: updates main session with new tokens
             But does NOT update offline session
Result: offline session has stale roles/permissions
        User could operate offline with wrong permissions
```

### Impact: 🟠 **HIGH**
- Offline session not kept in sync with auth session
- After token refresh, offline session becomes stale
- User could operate offline with expired permissions

---

## Part 6a: Fix for HIGH Issue #3

```typescript
// persistLogin.ts - create offline session, then dispatch
await offlineSession.create({...});
dispatch(setCredentials(authResponse));  // Dispatch only once, at end

// refreshSession.ts - update offline session after token refresh
const newSessionToken = result?.sessionToken;
if (!newSessionToken || !envelope?.data) return;

tokenManager.set(newSessionToken);

// ✅ Update offline session with new tokens
try {
  const existingOfflineSession = await offlineSession.load();
  if (existingOfflineSession) {
    await offlineSession.extendValidity(existingOfflineSession);
  }
} catch (err) {
  console.debug("[Refresh] Offline session update failed:", err);
}

const updated = {...};
await tokenManager.persistSession(updated);
dispatch(setCredentials(updated));
```

---

## Part 7: Design Gap #1 - No Session Envelope Versioning

### The Problem

```typescript
// tokenManager.ts lines 104-109
const raw = await getSecureItem(SESSION_KEY);
if (!raw) return null;
try {
  const parsed = JSON.parse(raw);
  if (!("fetchedAt" in parsed)) {
    return { data: parsed as T, fetchedAt: 0 };
  }
  return parsed as SessionEnvelope<T>;
```

**What Happens When API Evolves:**

```
Release 1.0:
  AuthResponse: { user, session, access }
  Saved: SessionEnvelope<v1.0>

Release 1.1:
  AuthResponse: { user, session, access, authContext }  // New field
  App loads v1.0 envelope
  access: { roles, permissions }  // Old structure
  authContext: undefined  // New field missing
  Type error? Maybe, maybe not

Release 2.0:
  AuthResponse completely restructured
  Old session envelope incompatible
  Force logout? Or corrupt data?
```

**Current Code:**
```typescript
// No version check
// Just: JSON.parse(raw) and cast to T
// If structure changed, silent failures
```

### Impact: 🟡 **DESIGN GAP**
- API evolution will cause data incompatibility
- No graceful migration path
- Force users to re-login on major updates
- Potential for corrupted data

---

## Part 7a: Fix for Design Gap #1

```typescript
interface SessionEnvelope<T> {
  version: "1.0" | "2.0";  // ✅ Add version
  data: T;
  fetchedAt: number;
}

// On load, check version
const parsed = JSON.parse(raw);
if (parsed.version !== "1.0") {
  // Incompatible version, force re-login
  return null;
}

// Or: migrate old to new
if (parsed.version === "1.0" && currentVersion === "2.0") {
  return migrate_v1_to_v2(parsed);
}
```

---

## Part 8: Design Gap #2 - No Session Integrity Check

### The Problem

```
What if SecureStore is corrupted?
├─ Read corrupted JSON
├─ JSON.parse succeeds (partial data)
├─ App loads partial session
├─ Missing required fields cause runtime errors
```

**Current Code:**
```typescript
// tokenManager.ts lines 104-112
try {
  const parsed = JSON.parse(raw);
  // ... no validation ...
  return parsed as SessionEnvelope<T>;
} catch {
  return null;
}
```

**What's NOT Validated:**
```
❌ parsed.data.session.sessionToken exists
❌ parsed.data.session.expiresAt is valid timestamp
❌ parsed.data.user.id exists
❌ parsed.data.access has required fields
❌ JSON structure matches expected shape
```

### Impact: 🟡 **DESIGN GAP**
- Corrupted session could cause crashes
- Silent failures (app loads, then crashes at first API call)
- No error recovery

---

## Part 8a: Fix for Design Gap #2

```typescript
function validateSessionEnvelope<T>(data: any): SessionEnvelope<T> | null {
  if (!data || typeof data !== "object") return null;
  if (!data.data || !data.fetchedAt) return null;

  const session = data.data?.session;
  if (!session?.sessionToken || !session?.expiresAt) return null;

  const user = data.data?.user;
  if (!user?.id) return null;

  const access = data.data?.access;
  if (!access) return null;

  return data as SessionEnvelope<T>;
}

// In loadSession:
const parsed = JSON.parse(raw);
const validated = validateSessionEnvelope<T>(parsed);
if (!validated) return null;  // Corrupted data
return validated;
```

---

## Part 9: Design Gap #3 - No Offline Indicator

### The Problem

```
User is in workspace
Network goes down
App still shows "you're logged in"
User tries API call
Error: "Network unreachable"
User confused: "Am I logged in or not?"
```

**What's Missing:**

```typescript
// tokenManager doesn't track network state
// App doesn't know if it's offline

// Proposed:
tokenManager.isOffline?: boolean;
tokenManager.onNetworkChange?: (isOnline: boolean) => void;
```

### Impact: 🟡 **DESIGN GAP**
- No distinction between "logged in" and "can make API calls"
- User confusion about app state
- No graceful offline-first handling

---

## Part 10: Design Gap #4 - No Token Expiry Warning

### The Problem

```
Session expires in 7 days
User logged in but app closed
Day 7: User opens app
Action: initializeAuth loads session
Result: Token is EXACTLY at expiry time
Issue: First API call returns 401 (or not, depends on timing)
```

**Missing:**
```typescript
// No warning: "your session expires in X days"
// No pre-refresh: refresh before expiry
// No graceful degradation
```

### Impact: 🟡 **DESIGN GAP**
- Session can expire without warning
- User gets forced logout unexpectedly
- Could happen at critical moment (mid-transaction)

---

## Part 11: Minor Issue #1 - Error Message Not Actionable

### The Problem

```typescript
// persistLogin.ts lines 17-21
try {
  await tokenManager.persistSession(authResponse);
} catch (error) {
  // Storage write failed (full, permission denied, etc.).
  // Token is still alive in memory for this session — user can continue,
  // but will be logged out on next app restart.
}
```

**Issue:** Error is silently swallowed
- User doesn't know persistence failed
- User thinks session is saved
- Gets logged out on restart (surprise)

---

## Part 12: Session Lifecycle Scenarios

### Scenario 1: Normal Login → App Close → Reopen ✅

```
1. User completes OTP login
2. persistLogin saves session to SecureStore
3. User navigates to workspace
4. User closes app
5. App killed

6. User reopens app
7. AuthProvider renders
8. initializeAuth dispatched
9. tokenManager.loadSession() reads SecureStore
10. Session restored to Redux
11. User continues to workspace
12. No re-login needed ✅
```

**Status:** ✅ **Works Correctly**

---

### Scenario 2: Session Expires (7 days) → Reopen

```
1. User logged in 7 days ago
2. Session expiry time is NOW
3. User closes app

4. User reopens app (no network)
5. initializeAuth loads session from SecureStore
6. ⚠️ NO CHECK for expiry time
7. Session loaded as valid ❌
8. User navigated to workspace

9. Network comes back
10. User makes API call
11. Server returns 401 (token expired)
12. Interceptor attempts refresh
13. Server returns 401 (refresh token also expired)
14. User forced to login again (not ideal)
```

**Status:** ⚠️ **Issue Found** - See HIGH Issue #1

---

### Scenario 3: Token Refresh → API Call → 401 → Refresh → Retry ✅

```
1. User making API call with 1-hour access token
2. 59 minutes later: token expired
3. API call returns 401
4. Interceptor: isRefreshing = true, queue request
5. Call /auth/refresh-token with refresh token
6. Receive new access token
7. isRefreshing = false, processQueue
8. Retry original request with new token
9. Request succeeds ✅
```

**Status:** ✅ **Works Correctly**

---

### Scenario 4: Theft Detection → Logout

```
1. User's refresh token stolen
2. Attacker uses token from different IP
3. Server detects: different IP + < 60 sec
4. Server revokes all refresh tokens
5. Attacker's refresh call returns 401
6. Real user's next refresh returns 401
7. Interceptor: tokenManager.notifyExpired()
8. onExpired callback: clearSession + setUnauthenticated
9. SecureStore cleared ✅
10. Redux state updated ✅
11. User redirected to login
```

**Status:** ⚠️ **Potential Race** - See HIGH Issue #2

---

## Part 13: Data Consistency Matrix

| State | Secure Store | In-Memory Token | Redux Auth | Correct? |
|-------|--------------|-----------------|-----------|----------|
| After Login | ✅ Token | ✅ Token | ✅ Authed | ✅ |
| During Refresh | ✅ Old | ✅ New | ✅ Authed | ✅ |
| After Logout | ✅ Empty | ✅ Null | ✅ Unauthed | ✅ |
| Crash Mid-Save | ❌ Old | ✅ New | ✅ Authed | ❌ ISSUE #1 |
| Restore Expired | ✅ Old | ✅ Old | ✅ Authed | ⚠️ Issue #1 |
| Large Auth | ⚠️ Slim | ✅ Full | ✅ Full | ⚠️ Issue #2 |

---

## Part 14: Priority Fixes

### 🔴 **CRITICAL (Week 1)**

1. **Fix Critical Issue #1** - Token storage race condition
   ```typescript
   // Ensure await completes before setting in-memory token
   await tokenManager.persistSession(authResponse);
   tokenManager.set(authResponse.data.session.sessionToken);
   ```

2. **Fix Critical Issue #2** - AuthResponse truncation
   ```typescript
   // Option: Only store essential fields
   // Or: Increase limit and handle gracefully
   // Or: Don't strip roles, set fetchedAt to now()
   ```

3. **Fix HIGH Issue #1** - Validate session expiry
   ```typescript
   // Check expiresAt before restoring
   if (sessionExpiresAt && isPast(sessionExpiresAt)) {
     dispatch(setUnauthenticated());
   }
   ```

### 🟠 **HIGH (Week 2)**

4. **Fix HIGH Issue #2** - Async logout atomicity
   ```typescript
   // Await clearSession before dispatch
   ```

5. **Fix HIGH Issue #3** - Offline session sync
   ```typescript
   // Update offline session on token refresh
   ```

### 🟡 **DESIGN (Week 3)**

6. **Add session envelope versioning**
7. **Add session integrity validation**
8. **Add offline state tracking**
9. **Add token expiry warnings**

---

## Part 15: Testing Checklist

### Unit Tests Needed

```typescript
test("persistLogin saves token to SecureStore before dispatch", ...)
test("initializeAuth validates session not expired", ...)
test("initializeAuth rejects sessions with missing fields", ...)
test("Token refresh updates offline session", ...)
test("Logout clears SecureStore before dispatch", ...)
test("Large AuthResponse is handled gracefully", ...)
test("Corrupted SecureStore returns null", ...)
test("Session envelope version mismatch handled", ...)
```

### E2E Tests Needed

```gherkin
Scenario: Complete login-refresh-logout cycle
  Given: User logs in via OTP
  Then: Session persisted to SecureStore
  And: Token in memory
  And: Redux state updated
  When: App closed and reopened
  Then: Session restored from SecureStore
  And: User still authenticated
  When: 1 hour passes (token expires)
  And: User makes API call
  Then: Automatic refresh triggered
  And: Original request retried
  When: User logs out
  Then: SecureStore cleared
  And: In-memory token cleared
  And: Redux state reset
  And: User redirected to login

Scenario: Session expiry validation on restore
  Given: User logged in 7 days ago
  When: User reopens app
  Then: Expired session NOT loaded
  And: User directed to login
  And: Not: workspace shown with expired token
```

---

## Part 16: Summary Table

| Issue | Type | Severity | File | Line | Status |
|-------|------|----------|------|------|--------|
| Token storage race | Critical | 🔴 | persistLogin.ts | 13-22 | ❌ UNFIXED |
| AuthResponse truncation | Critical | 🔴 | tokenManager.ts | 80-93 | ❌ UNFIXED |
| No expiry validation | High | 🟠 | initializeAuth.ts | 19-26 | ❌ UNFIXED |
| Async logout race | High | 🟠 | axios-interceptors.ts | 174-178 | ❌ UNFIXED |
| Offline sync | High | 🟠 | persistLogin.ts | 24-68 | ❌ UNFIXED |
| No versioning | Design | 🟡 | tokenManager.ts | 21-24 | ❌ UNFIXED |
| No integrity check | Design | 🟡 | tokenManager.ts | 104-112 | ❌ UNFIXED |
| No offline state | Design | 🟡 | tokenManager.ts | - | ❌ MISSING |

---

## Final Recommendation

### ⚠️ **NOT PRODUCTION-READY**

The auth persistence flow has **2 critical data loss issues** that must be fixed before release.

**Minimum fixes required:**
1. Ensure SecureStore write completes before in-memory set
2. Validate session expiry on restore
3. Handle oversized AuthResponse without data loss
4. Make logout truly atomic

**Estimated effort:** 2-3 hours to fix critical issues

**Estimated effort (all fixes):** 1 sprint

---

**Assessment Completed By:** Senior Backend Architect
**Date:** April 9, 2026
**Confidence Level:** Very High (detailed code analysis)
**Recommendation:** Address critical issues before shipping
