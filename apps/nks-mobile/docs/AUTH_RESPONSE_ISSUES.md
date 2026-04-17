# Auth Response Issues — POST /auth/otp/verify

**Date:** April 2026  
**Status:** Needs Fix  
**Scope:** `AuthResponseEnvelope` structure, token claims, mobile field access, offline session integrity

---

## Summary Table

| # | Issue | Severity | File to Fix |
|---|-------|----------|-------------|
| 1 | Offline session stores all roles (not store-filtered) | 🔴 CRITICAL | `persist-login.ts` |
| 2 | Token placement inconsistent (jwtToken nested vs offlineToken at root) | 🟠 HIGH | Backend + `persist-login.ts` |
| 3 | `sessionToken` described as web-only but mobile uses it as Bearer | 🟠 HIGH | Documentation + DTOs |
| 4 | `offlineToken.stores[]` has no role per store | 🟠 HIGH | Backend token.service.ts |
| 5 | `offlineToken` / `offlineSessionSignature` optional with no fallback | 🟡 MEDIUM | `persist-login.ts` |
| 6 | No `deviceId` binding in `offlineToken` claims | 🟡 MEDIUM | Backend token.service.ts |
| 7 | `jwtToken` roles are store-agnostic | 🟢 LOW | Backend token.service.ts |
| 8 | `user.id` typed as `string`, `storeId` typed as `number` | 🟢 LOW | Shared DTOs |
| 9 | `MANAGER`, `CASHIER`, `DELIVERY` missing from role description | 🟢 LOW | Documentation |

---

## Issue 1 — 🔴 CRITICAL: Offline Session Stores All Roles Across All Stores

**File:** `apps/nks-mobile/store/persist-login.ts`

### What happens

When the user logs in, the offline session is created from the full `access.roles` array — which contains roles from **all stores** the user belongs to:

```ts
// persist-login.ts line ~107 — CURRENT (WRONG)
roles: authResponse.access.roles.map((r) => r.roleCode)
// Result for a multi-store user:
// → ["STORE_OWNER", "STAFF"]
// STORE_OWNER = Store B, STAFF = Store A
// But offline session is scoped to Store A only!
```

The write-guard then checks:

```ts
// write-guard.ts
session.roles.includes(requiredRole)
// session.roles = ["STORE_OWNER", "STAFF"]
// requiredRole = "STORE_OWNER"
// → true — GRANTED, even though user is only STAFF in Store A
```

### Why it is a problem

A user who is `STORE_OWNER` at Store B but only `STAFF` at Store A will be granted `STORE_OWNER`-level write permissions at Store A while offline. This is privilege escalation via multi-store role bleed.

### Fix

Filter roles by `activeStoreId` before mapping into the offline session:

```ts
// persist-login.ts — FIXED
const activeStoreId = authResponse.access.activeStoreId;

roles: authResponse.access.roles
  .filter(r => r.storeId === activeStoreId || r.storeId === null)
  .map(r => r.roleCode)

// Result for Store A (id = 1):
// → ["STAFF"]   ← correct, STORE_OWNER from Store B excluded
```

`r.storeId === null` keeps SUPER_ADMIN and CUSTOMER roles that are not store-scoped.

---

## Issue 2 — 🟠 HIGH: Token Placement Is Inconsistent

**Files:** Backend auth controller + `apps/nks-mobile/store/persist-login.ts`

### What happens

The three auth tokens live at different levels of the response envelope:

```
response.session.jwtToken          ← nested inside session object
response.offlineToken              ← at root of envelope
response.offlineSessionSignature   ← at root of envelope
response.session.refreshToken      ← back inside session
```

### Why it is a problem

- Mobile code accesses tokens from two different levels, making it easy to miss a field
- Adding a new token in future requires checking which level it belongs to
- Confusing for new developers reading the response shape

### Current access pattern in mobile

```ts
authResponse.session.jwtToken          // level 2
authResponse.session.refreshToken      // level 2
authResponse.offlineToken              // level 1
authResponse.offlineSessionSignature   // level 1
```

### Fix

Move all tokens to the same level. Two options:

**Option A — Dedicated `tokens` block (recommended):**

```ts
interface AuthResponseEnvelope {
  user: { ... };
  session: {
    sessionId: string;
    sessionToken: string;
    expiresAt: string;
    defaultStore: { guuid: string; id: number } | null;
  };
  access: { activeStoreId, roles };
  tokens: {
    accessToken: string;               // renamed from jwtToken
    refreshToken: string;              // moved out of session
    refreshExpiresAt: string;
    offlineToken?: string;
    offlineSessionSignature?: string;
  };
}
```

**Option B — All flat at envelope root:**

```ts
interface AuthResponseEnvelope {
  user: { ... };
  session: { sessionId, sessionToken, expiresAt, defaultStore };
  access: { ... };
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: string;
  offlineToken?: string;
  offlineSessionSignature?: string;
}
```

---

## Issue 3 — 🟠 HIGH: `sessionToken` Described as Web-Only but Mobile Uses It

**Files:** Backend DTO comments + shared types documentation

### What happens

The auth response comment says:

```ts
session: {
  sessionToken: string;  // BetterAuth opaque token (httpOnly cookie for web)
}
```

But the mobile code uses it as the API Bearer token on every request:

```ts
// persist-login.ts lines 70, 74
tokenManager.set(sessionToken)

// axios-interceptors.ts
Authorization: `Bearer ${tokenManager.get()}`
// ← sessionToken is what gets set in tokenManager
```

### Why it is a problem

- Wrong mental model leads future developers to think mobile should use `jwtToken` instead
- `jwtToken` and `sessionToken` serve different purposes but the documentation does not say so
- Could cause a developer to remove `sessionToken` from the mobile response thinking it's web-only, breaking all API calls

### What each token actually does

| Token | Web | Mobile |
|-------|-----|--------|
| `sessionToken` | `Set-Cookie: session=...; httpOnly` | `Authorization: Bearer {sessionToken}` |
| `jwtToken` | Not used | Stored for offline JWT validation via JWKS |

### Fix

Update the DTO comment and shared type documentation:

```ts
session: {
  sessionToken: string;
  /**
   * BetterAuth opaque session token.
   * Web:    Sent as httpOnly Set-Cookie header. Not returned in JSON body.
   * Mobile: Returned in JSON body. Used as Authorization: Bearer on all API requests.
   * NOT a JWT. No expiry claims inside. Validated server-side via DB lookup.
   */
}
```

---

## Issue 4 — 🟠 HIGH: `offlineToken.stores[]` Has No Role Per Store

**File:** Backend `token.service.ts` — `generateOfflineToken()`

### What happens

The `offlineToken` JWT contains:

```json
"stores": [
  { "id": 1, "name": "NKS Store Bangalore" },
  { "id": 2, "name": "NKS Store Chennai" }
]
```

There is no `role` field per store entry.

### Why it is a problem

When a user switches active store while offline, the write-guard reads the role from `offlineSession.roles` (which is set at login time from the original active store). If the user switches to a different store offline, there is no way to look up the correct role for the new store from the offline token.

**Scenario:**
1. User logs in at Store A (STAFF) → offline session created with roles = ["STAFF"]
2. User goes offline
3. User switches to Store B (where they are STORE_OWNER)
4. Write-guard checks offlineSession.roles = ["STAFF"] → DENIED (wrong, should be STORE_OWNER)

### Fix

Add `role` to each store entry in the offlineToken claims:

```ts
// Backend token.service.ts — generateOfflineToken()
stores: userRoles.map(r => ({
  id: r.storeId,
  name: r.storeName,
  role: r.roleCode        // ← add this
}))
```

Result:
```json
"stores": [
  { "id": 1, "name": "NKS Store Bangalore", "role": "STAFF" },
  { "id": 2, "name": "NKS Store Chennai",   "role": "STORE_OWNER" }
]
```

Update write-guard to use per-store role when active store changes:

```ts
// write-guard.ts — when validating offline write
const offlinePayload = await JWTManager.decodeOfflineToken();
const storeEntry = offlinePayload.stores.find(s => s.id === activeStoreId);
const roleInStore = storeEntry?.role;

if (!roleInStore || roleInStore !== requiredRole) {
  throw new WriteNotAllowedError('Insufficient role for this store');
}
```

---

## Issue 5 — 🟡 MEDIUM: `offlineToken` Optional with No Capability Flag or Fallback

**File:** `apps/nks-mobile/store/persist-login.ts` + shared types

### What happens

Both offline fields are marked optional:

```ts
offlineToken?: string;
offlineSessionSignature?: string;
```

If the backend omits these fields (e.g., during a feature flag rollout or a backend error), `persist-login.ts` silently skips offline session creation. The user appears to be logged in but offline POS is broken with no user feedback.

### Why it is a problem

- Silent degradation is hard to debug in the field
- No way for mobile to tell the user "offline mode is unavailable"
- QA cannot distinguish "offline not configured" from "offline broken"

### Fix

Add an explicit capability flag to the response:

```ts
interface AuthResponseEnvelope {
  ...
  offlineCapable: boolean;           // ← always present
  offlineToken?: string;             // ← present when offlineCapable = true
  offlineSessionSignature?: string;  // ← present when offlineCapable = true
}
```

In `persist-login.ts`, check the flag and surface a warning:

```ts
if (authResponse.offlineCapable) {
  if (!authResponse.offlineToken || !authResponse.offlineSessionSignature) {
    logger.error('offlineCapable=true but offline tokens missing — offline POS will not work');
    // show toast or log to Sentry
  } else {
    await createOfflineSession(authResponse);
  }
}
```

---

## Issue 6 — 🟡 MEDIUM: No `deviceId` Binding in `offlineToken` Claims

**File:** Backend `token.service.ts` — `generateOfflineToken()`

### What happens

Current `offlineToken` claims:

```json
{
  "sub": "user-guuid",
  "roles": ["STORE_OWNER"],
  "stores": [...],
  "activeStoreId": 1,
  "jti": "uuid",
  "iss": "nks-auth",
  "aud": "nks-app",
  "exp": 1234827090,
  "kid": "sha256-thumbprint"
}
```

`deviceId` is not in the claims.

### Why it is a problem

If the offline token is extracted from SecureStore on a jailbroken device, it can be used on any other device. The token has no claim that binds it to the original device. The backend sync validates device revocation, but only when the device reconnects — the stolen token could be used for up to 3 days of offline writes on a different device.

### Fix

Include the device fingerprint in the offline token at generation time:

```ts
// Backend token.service.ts
generateOfflineToken(user, roles, stores, activeStoreId, deviceId: string) {
  return this.jwtService.sign({
    sub: user.guuid,
    deviceId: deviceId,    // ← bind to requesting device
    roles: roles.map(r => r.roleCode),
    stores: stores,
    activeStoreId: activeStoreId,
    ...
  }, { expiresIn: '3d', algorithm: 'RS256' });
}
```

Also add `deviceId` to the `offlineSessionSignature` payload:

```ts
// Current signature payload
JSON.stringify({ userId, storeId, roles, offlineValidUntil })

// Fixed signature payload
JSON.stringify({ userId, storeId, roles, offlineValidUntil, deviceId })
```

Mobile's write-guard can then verify the token's `deviceId` matches the current device fingerprint before allowing writes:

```ts
// write-guard.ts
const offlinePayload = await JWTManager.decodeOfflineToken();
const currentDeviceId = await DeviceManager.getFingerprint();

if (offlinePayload.deviceId !== currentDeviceId) {
  throw new WriteNotAllowedError('Offline token device mismatch');
}
```

---

## Issue 7 — 🟢 LOW: `jwtToken` Roles Are Store-Agnostic

**File:** Backend `token.service.ts` — `generateAccessToken()`

### What happens

```json
{
  "roles": ["STORE_OWNER", "STAFF"]
}
```

No store ID is attached to each role in the JWT claims.

### Why it is a problem

The RBAC guard cannot use the JWT alone to validate per-store permissions — it must query the DB to resolve which store each role applies to. This makes the JWT non-self-contained for RBAC, requiring a DB round-trip on every request.

This is acceptable for now (the guard reads `activeStoreId` from the session in DB), but it is worth documenting so it is not misused client-side.

### Fix (optional, for future self-contained JWT RBAC)

```json
{
  "roles": [
    { "code": "STORE_OWNER", "storeId": 1 },
    { "code": "STAFF",       "storeId": 2 }
  ]
}
```

This would allow the backend RBAC guard to validate per-store roles from JWT claims alone without a DB lookup. Not required now but reduces DB load at scale.

---

## Issue 8 — 🟢 LOW: `user.id` Typed as `string`, `storeId` Typed as `number`

**File:** Shared DTOs / `libs-common/shared-types`

### What happens

```ts
user: {
  id: string;    // "123" ← numeric value stored as string
}

access: {
  roles: Array<{
    storeId: number;   // 123 ← actual number
  }>
}
```

Mobile does a silent conversion:

```ts
// persist-login.ts
userId: parseInt(authResponse.user.id, 10)
```

### Why it is a problem

- `parseInt` can silently return `NaN` if the value is malformed
- Mixing `string` and `number` for IDs across the same response is inconsistent
- Future developers may pass `user.id` directly where a `number` is expected

### Fix

Pick one type and use it everywhere. Recommended: use `number` for all numeric IDs:

```ts
user: {
  id: number;      // ← change to number
  guuid: string;   // keep guuid as string (it is a UUID)
}
```

If the backend ORM returns it as string, cast once at the serialization layer, not scattered across the mobile codebase.

---

## Issue 9 — 🟢 LOW: Role Description Missing `MANAGER`, `CASHIER`, `DELIVERY`

**File:** Backend DTO comments + `AuthResponseEnvelope` documentation

### What happens

The `jwtToken` description shows:

```
roles: ["STORE_OWNER", "STAFF", ...]
```

But the full `UserRoleEntry` interface has:

```ts
roleCode: "SUPER_ADMIN" | "STORE_OWNER" | "STAFF" | "MANAGER" | "CASHIER" | "DELIVERY" | "CUSTOMER"
```

`MANAGER`, `CASHIER`, and `DELIVERY` are missing from the JWT description and examples.

### Why it is a problem

Developers reading the JWT spec will not know these role codes are valid. Write-guards or RBAC checks hard-coded to check only `["STORE_OWNER", "STAFF"]` will fail for `CASHIER` and `MANAGER` users.

### Fix

Update all documentation, DTO comments, and examples to include the full role list:

```ts
// jwtToken claims
roles: (
  | "SUPER_ADMIN"
  | "STORE_OWNER"
  | "MANAGER"
  | "CASHIER"
  | "STAFF"
  | "DELIVERY"
  | "CUSTOMER"
)[]
```

---

## Corrected `AuthResponseEnvelope`

```ts
interface AuthResponseEnvelope {
  user: {
    id: number;              // ← number, not string
    guuid: string;
    name: string | null;
    email: string | null;
    phoneNumber: string | null;
  };

  session: {
    sessionId: string;
    sessionToken: string;
    /**
     * Web:    set as httpOnly cookie, not in JSON body
     * Mobile: returned in JSON body, used as Authorization: Bearer on all API requests
     */
    expiresAt: string;
    defaultStore: { guuid: string; id: number } | null;  // ← add id
  };

  access: {
    activeStoreId: number | null;
    roles: Array<{
      roleCode: "SUPER_ADMIN" | "STORE_OWNER" | "MANAGER" | "CASHIER" | "STAFF" | "DELIVERY" | "CUSTOMER";
      storeId: number | null;
      storeName: string | null;
      isPrimary: boolean;
      assignedAt: string;
      expiresAt: string | null;
    }>;
  };

  // All tokens at the same level
  refreshToken: string;
  refreshExpiresAt: string;
  accessToken: string;             // renamed from jwtToken, RS256 15-min
  offlineCapable: boolean;         // explicit flag — always present
  offlineToken?: string;           // RS256 3-day — present when offlineCapable = true
  offlineSessionSignature?: string; // HMAC-SHA256 — present when offlineCapable = true
}
```

### Corrected `offlineToken` Claims

```json
{
  "sub": "user-guuid",
  "deviceId": "sha256-device-fingerprint",
  "roles": ["STORE_OWNER"],
  "stores": [
    { "id": 1, "name": "Store A", "role": "STORE_OWNER" },
    { "id": 2, "name": "Store B", "role": "STAFF" }
  ],
  "activeStoreId": 1,
  "jti": "random-uuid",
  "iss": "nks-auth",
  "aud": "nks-app",
  "iat": 1745000000,
  "exp": 1745259200,
  "kid": "sha256-rsa-thumbprint"
}
```

### Corrected `offlineSessionSignature` Payload

```json
{
  "userId": 123,
  "storeId": 1,
  "deviceId": "sha256-device-fingerprint",
  "roles": ["STORE_OWNER"],
  "offlineValidUntil": 1745259200000
}
```

---

## Fix Priority Order

```
WEEK 1 — Before any offline POS testing:
  □ Issue 1: Filter roles by activeStoreId in persist-login.ts              (30 min)
  □ Issue 4: Add role per store in offlineToken.stores[]                    (1 hour)
  □ Issue 6: Add deviceId to offlineToken claims + offlineSessionSignature  (1 hour)

SPRINT 1 — Before production:
  □ Issue 2: Move all tokens to same level in response envelope             (2 hours)
  □ Issue 5: Add offlineCapable flag + surface error when tokens missing    (1 hour)
  □ Issue 3: Fix sessionToken documentation in DTOs                         (30 min)

SPRINT 2 — Quality hardening:
  □ Issue 8: Change user.id from string to number in shared DTOs            (1 hour)
  □ Issue 9: Update role documentation to include all 7 role codes          (30 min)
  □ Issue 7: Add store binding to jwtToken roles (optional optimization)    (2 hours)
```

---

*Document generated from live codebase analysis — April 2026*
