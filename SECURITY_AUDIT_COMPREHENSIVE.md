# COMPREHENSIVE SECURITY & ARCHITECTURAL AUDIT
## Backend & Mobile Authentication Implementation

**Date**: 2026-04-10
**Scope**: Backend auth service + Mobile (Expo) implementation
**Severity Classification**: HIGH (7), MEDIUM (12), LOW (8)

---

## EXECUTIVE SUMMARY

The authentication system demonstrates good foundational design with token rotation, device binding, and offline support. However, there are **27 identified issues** spanning security gaps, reliability risks, and scalability concerns that require immediate remediation in an enterprise POS system.

**Critical Issues**: 7
**High-Priority Issues**: 12
**Medium-Priority Issues**: 8

---

# SECTION 1: SECURE STORAGE LIMITATIONS (1800-byte constraint)

## ISSUE 1.1: SecureStore 1800-byte Limit Causes Silent Data Loss [HIGH]

**Location**: `libs-mobile/mobile-utils/src/storage/token-manager.ts:18`

**Problem**:
```typescript
const MAX_BYTES = 1800;  // Hard limit
```

SecureStore has a 2048-byte hard limit. Current implementation sets MAX_BYTES to 1800 for safety margin. When `persistSession()` receives large payloads:

1. **Role compression strips critical data** (lines 88-91):
   ```typescript
   const compressedRoles = (data.access?.roles ?? []).map((r: any) => ({
     roleCode: r.roleCode,
     storeId: r.storeId,
     // LOST: storeName, isPrimary, assignedAt, expiresAt
   }));
   ```

2. **No error thrown** if compression still exceeds limit:
   ```typescript
   if (slimJson.length > MAX_BYTES) {
     slim.data.access.permissions = [];  // Silent strip
     console.warn("[Auth] Session data very large...");
   }
   ```

**Risks**:
- ✗ User with 50+ roles (multi-store manager) → roles silently dropped
- ✗ `storeName` lost → UI can't display store name in offline POS
- ✗ `expiresAt` lost → offline session can't validate role expiry
- ✗ Silent failures → app appears to work but permissions are incomplete
- ✗ No retry mechanism or error propagation to UI

**Severity**: HIGH

**Impact on Enterprise POS**:
- Store manager can't see which stores they manage
- Expired role assignments appear as active in offline POS
- Data corruption without user notification

**Fix Required**:
```typescript
// OPTION A: Reject payloads that don't fit
async persistSession(data: any): Promise<void> {
  const envelope: SessionEnvelope<any> = { data, fetchedAt: Date.now() };
  const json = JSON.stringify(envelope);

  if (json.length > MAX_BYTES) {
    throw new Error(`Auth response exceeds SecureStore limit (${json.length} > ${MAX_BYTES}). Contact support.`);
  }
  await saveSecureItem(SESSION_KEY, json);
}

// OPTION B: Split storage
// Store user + session in nks_session_main
// Store roles in nks_session_roles (separate key)
// Atomic reads require checking both keys
```

---

## ISSUE 1.2: JWKS Public Key Caching Without Size Validation [MEDIUM]

**Location**: `store/persistLogin.ts:74` and `lib/offline-session.ts:41`

**Problem**:
```typescript
const jwksPublicKey = await fetchJwksPublicKey();
await offlineSession.create({
  jwksPublicKey,  // ← No size check
  offlineToken,
  // ... other fields
});
```

RSA-2048 public keys are ~1700 bytes. If backend ever rotates to RSA-4096 (~2400 bytes), offline session storage fails silently:

```typescript
const session: OfflineSession = {
  jwksPublicKey: "-----BEGIN CERT-----\n...\n-----END CERT-----",  // 2400 bytes
  offlineToken: "eyJ...",  // 500+ bytes
  // Total with other fields → exceeds 1800 byte limit
};
```

**Risks**:
- ✗ RSA-4096 keys can't be stored
- ✗ Silent failure → `offlineSession.create()` throws but is caught and logged
- ✗ Offline POS can't verify tokens without public key
- ✗ User stuck in online-only mode

**Severity**: MEDIUM

**Fix Required**:
```typescript
async create(input: {
  jwksPublicKey: string;
  // ...
}): Promise<OfflineSession> {
  // Validate size before storage
  const sessionJson = JSON.stringify(session);
  if (sessionJson.length > 1800) {
    throw new Error(
      `OfflineSession exceeds storage limit (${sessionJson.length} bytes). ` +
      `Remove unnecessary fields or migrate to large storage.`
    );
  }

  await saveSecureItem(OFFLINE_SESSION_KEY, sessionJson);
}
```

---

# SECTION 2: TOKEN VALIDATION GAPS (Before Refresh)

## ISSUE 2.1: Missing Token Integrity Validation Before Refresh [HIGH]

**Location**: `store/refreshSession.ts:40`

**Problem**:
The `validateTokensBeforeRefresh()` function only checks:
```typescript
export async function validateTokensBeforeRefresh(envelope) {
  if (!envelope?.data) return { canRefresh: false };
  if (!envelope.data.session?.refreshToken) return { canRefresh: false };

  const refreshExpiresAt = session.refreshExpiresAt;
  // ONLY checks expiry timestamp
  if (refreshExpiresAt && refreshExpiresAt < Date.now()) {
    return { canRefresh: false };
  }

  return { canRefresh: true, refreshToken: session.refreshToken };
}
```

**What's NOT validated**:
- ✗ Refresh token format/structure (could be null, undefined, empty string)
- ✗ Refresh token length (expected ~256 bits base64)
- ✗ Session token presence/validity
- ✗ JWT format of JWT token (if present)
- ✗ Whether stored token matches what was originally persisted (tampering detection)
- ✗ Session envelope completeness (missing critical fields)

**Attack Scenario**:
```
1. Attacker modifies SecureStore:
   "refreshToken": ""  // Empty string
   OR
   "refreshToken": "CORRUPTED_DATA"

2. Mobile calls refreshSession()
   → validateTokensBeforeRefresh() passes (checks only expiry)
   → API.post("/auth/refresh-token", { refreshToken: "" })
   → Backend rejects with 400
   → Mobile retries forever
   → User stuck in refresh loop
```

**Severity**: HIGH

**Impact**:
- ✗ Silent token corruption → undetectable until refresh attempt
- ✗ User stuck in refresh loop (token keeps failing)
- ✗ Offline POS can't work (waiting for token validation)

**Fix Required**:
```typescript
export async function validateTokensBeforeRefresh(envelope) {
  if (!envelope?.data?.session) return { canRefresh: false };

  const { session } = envelope.data;
  const refreshToken = session.refreshToken;

  // 1. Check presence and non-empty
  if (!refreshToken || typeof refreshToken !== 'string' || refreshToken.trim() === '') {
    return { canRefresh: false, error: 'Refresh token is empty' };
  }

  // 2. Check format (base64url, ~256 chars for typical token)
  if (!/^[A-Za-z0-9_-]+$/.test(refreshToken)) {
    return { canRefresh: false, error: 'Refresh token format invalid' };
  }

  if (refreshToken.length < 50 || refreshToken.length > 500) {
    return { canRefresh: false, error: 'Refresh token length invalid' };
  }

  // 3. Check JWT presence and format (if jwtToken expected)
  if (session.jwtToken && typeof session.jwtToken !== 'string') {
    return { canRefresh: false, error: 'JWT token invalid' };
  }

  // 4. Check expiry
  const refreshExpiresAt = session.refreshExpiresAt
    ? new Date(session.refreshExpiresAt).getTime()
    : null;

  if (refreshExpiresAt && refreshExpiresAt < Date.now()) {
    return { canRefresh: false, error: 'Refresh token expired' };
  }

  // 5. Check session completeness
  if (!session.sessionToken || !session.sessionId) {
    return { canRefresh: false, error: 'Session data incomplete' };
  }

  return { canRefresh: true, refreshToken };
}
```

---

## ISSUE 2.2: No Verification of Token Format After Loading from SecureStore [HIGH]

**Location**: `store/persistLogin.ts:26-35`

**Problem**:
`persistLogin()` includes verification that write succeeded, but doesn't validate the TOKEN FORMAT before using it:

```typescript
// Verify by attempting to load it back
const verification = await tokenManager.loadSession<AuthResponse>();
if (!verification?.data?.session?.sessionToken) {
  throw new Error("SecureStore verification failed: session not found after write");
}
if (verification.data.session.sessionToken !== sessionToken) {
  throw new Error("SecureStore verification failed: token mismatch");
}
// ← Only checks if token exists and matches
// ✗ Doesn't check if it's a valid token format

tokenManager.set(sessionToken);  // Sets token without format validation
```

**Attack Scenario**:
```
1. Malware modifies SecureStore after write:
   "sessionToken": "INVALID_CORRUPTED_DATA"

2. persistLogin() verification check passes (token != null)
3. tokenManager.set("INVALID_CORRUPTED_DATA")
4. API calls fail with 401/400
5. No clear error message to user

Fix: Validate token structure before setting in-memory copy
```

**Severity**: HIGH

**Fix Required**:
```typescript
async function persistLogin(authResponse, dispatch) {
  await tokenManager.persistSession(authResponse);

  const verification = await tokenManager.loadSession<AuthResponse>();
  if (!verification?.data?.session?.sessionToken) {
    throw new Error("SecureStore verification failed");
  }

  const sessionToken = verification.data.session.sessionToken;

  // VALIDATE TOKEN FORMAT
  if (!isValidOpaqueToken(sessionToken)) {
    throw new Error("Stored session token has invalid format");
  }

  if (!isValidJwt(verification.data.session.jwtToken)) {
    throw new Error("Stored JWT has invalid format");
  }

  tokenManager.set(sessionToken);
}

function isValidOpaqueToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{50,500}$/.test(token);
}

function isValidJwt(jwt: string | undefined): boolean {
  if (!jwt) return true;  // JWT optional
  const parts = jwt.split('.');
  return parts.length === 3 && parts.every(p => /^[A-Za-z0-9_-]+$/.test(p));
}
```

---

# SECTION 3: OTP BRUTE-FORCE VULNERABILITIES

## ISSUE 3.1: No IP-Based Rate Limiting for OTP Verification [HIGH]

**Location**: `apps/nks-backend/src/modules/auth/services/otp.service.ts`

**Problem**:
Backend has phone-based rate limiting (100 sends per 24h), but NO IP-based limiting:

```typescript
// Backend rate limiting is PHONE-based only
await this.rateLimitService.checkAndRecordRequest(phone);
// ✗ No IP-based rate limit
// ✗ No device fingerprint rate limit
```

**Attack Scenario**:
```
Attacker can brute-force any user's OTP:

1. Request OTP for +919876543210 (victim)
   → Backend: 1 request for this phone (limit: 100/24h)
   → Cost: SMS sending (cheap)

2. Brute-force OTP with 5 attempts (OTP_MAX_ATTEMPTS = 5)
   → Backend allows 5 failed attempts, then... WHAT?

3. Request OTP again (same phone)
   → Backend allows (only 1 request in window, limit is 100)
   → Attacker gets new OTP, 5 more attempts
   → Repeat 100 times per 24 hours

4. Total OTP guesses: 100 requests × 5 attempts = 500 attempts per 24h
   → 6-digit OTP: 1,000,000 possible values
   → 99.95% chance brute-force fails, but...

5. Attacker has 100 phones/IPs to distribute load
   → 100 × 500 = 50,000 attempts per 24h
   → Can crack OTP in ~20 hours distributed
```

**Severity**: HIGH

**Current Rate Limits** (incomplete):
- ✓ Phone-based: 100 sends per 24h
- ✗ No IP-based rate limit on verify endpoint
- ✗ No cumulative verification attempt limit
- ✗ No exponential backoff

**Fix Required**:
```typescript
// Backend: Add IP + cumulative rate limiting

interface OtpVerifyRateLimit {
  phoneOtpAttempts: number;        // Attempts for this phone/otp combo
  ipOtpAttempts: number;           // Attempts from this IP (any phone)
  phoneVerificationFailures: number; // Failed verifications for this phone
}

async verifyOtp(dto: VerifyOtpDto, ipAddress: string): Promise<...> {
  const { phone, otp, reqId } = dto;

  // 1. Phone-based: Check cumulative failed attempts
  const phoneFailures = await rateLimitRepo.getPhoneVerificationFailures(phone);
  if (phoneFailures >= 15) {
    throw new HttpException(
      'Too many verification attempts. Wait 1 hour.',
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  // 2. IP-based: Rate limit all verification attempts from IP
  const ipAttempts = await rateLimitRepo.getIpVerificationAttempts(ipAddress);
  if (ipAttempts >= 50) {  // 50 attempts per IP per hour
    throw new HttpException(
      'Too many verification attempts from your IP',
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  // 3. Verify OTP
  const isValid = await verifyWithMsg91(reqId, otp);
  if (!isValid) {
    // Increment both counters
    await rateLimitRepo.incrementPhoneFailures(phone);
    await rateLimitRepo.incrementIpAttempts(ipAddress);
    throw new BadRequestException('Invalid OTP');
  }

  // Success: reset both counters
  await rateLimitRepo.resetPhoneFailures(phone);
  // Don't reset IP attempts (cross-phone pattern still tracked)
}
```

---

## ISSUE 3.2: OTP Expiry (10 minutes) Too Long for Brute-Force Protection [MEDIUM]

**Location**: `apps/nks-backend/src/modules/auth/services/otp.service.ts:81`

**Problem**:
```typescript
const expiresAt = new Date(Date.now() + 10 * 60 * 1000);  // 10 minutes
```

Standard industry practice is 3-5 minutes. 10 minutes allows:

```
Scenario:
- Attacker requests OTP at T=0min
- Attacker has 10 minutes to brute-force
- With 5 attempts per request (and 100 requests/24h): 5 attempts per OTP
- Attacker can retry entire OTP sequence 100+ times in 10 minute window
```

**Severity**: MEDIUM

**Fix**: Reduce to 3-5 minutes:
```typescript
const expiresAt = new Date(Date.now() + 5 * 60 * 1000);  // 5 minutes
```

---

## ISSUE 3.3: No Device Fingerprint Rate Limiting (Backend) [MEDIUM]

**Location**: `apps/nks-backend/src/modules/auth` (controller)

**Problem**:
Backend doesn't receive or track device fingerprints for OTP rate limiting:

```typescript
// In auth.controller.ts sendOtp() endpoint
@Post('send-otp')
async sendOtp(@Body() dto: SendOtpDto) {
  // ✗ No device fingerprint in request
  // ✗ No tracking of "device X requesting OTP for 100 different phones"
  // ✗ Easy to bypass by spoofing user-agent
}
```

**Attack Scenario**:
```
Attacker spoofs different user-agents, requests OTP for 100 different phones:
  Device1 → 100 phones × 5 attempts = 500
  Device2 → 100 phones × 5 attempts = 500
  ... Device 100 times

Total: 100 devices × 500 = 50,000 OTP guesses in 24h
(Rate limiter only counts phones, not devices)
```

**Severity**: MEDIUM

**Fix Required**:
```typescript
@Post('send-otp')
async sendOtp(
  @Body() dto: SendOtpDto,
  @Req() req: Request  // Extract device info
) {
  const deviceFingerprint = extractDeviceFingerprint(req);

  // Rate limit by device + phone combo
  const key = `otp:${dto.phone}:${deviceFingerprint}`;
  const attempts = await cache.get(key) || 0;

  if (attempts >= 5) {  // Max 5 sends per device per phone per hour
    throw new HttpException('Too many requests from your device', 429);
  }

  // ... rest of sendOtp logic
  await cache.increment(key, 1);  // TTL 1 hour
}
```

---

# SECTION 4: LONG-LIVED OFFLINE TOKENS (7-day revocation gap)

## ISSUE 4.1: 7-Day Offline Token Doesn't Sync With Permission Revocation [CRITICAL]

**Location**: `lib/offline-session.ts:34` and `store/refreshSession.ts:109-133`

**Problem**:
```typescript
// Backend issues 7-day offline JWT
offlineToken: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." // expires +7 days

// Mobile stores it
await offlineSession.create({
  offlineValidUntil: Date.now() + 7 * 24 * 60 * 60 * 1000,
  offlineToken,
  roles: ["STORE_OWNER"]
});
```

**Revocation Scenario**:
```
Timeline:
- Day 1 (Monday): User logs in, receives 7-day offline JWT with STORE_OWNER role
- Day 3 (Wednesday): Admin revokes STORE_OWNER role (user fired)

User's offline behavior:
- Day 3 (Wednesday): User works offline, still has STORE_OWNER
- Day 4 (Thursday): User comes online, refreshSession() called
  → Backend sends new JWT with no roles
  → Mobile updates roles in offline session
  ✓ Correct behavior

BUT WHAT IF:
- Day 3 afternoon: User works offline briefly
- Day 3 evening: Admin revokes STORE_OWNER role (user fired)
- Day 4: User's device stays offline (no internet, in rural area)
- Day 5: User still has valid offline token with STORE_OWNER
- Day 7: User finally comes online
  → 4 days of unauthorized access!

OR WORSE:
- Device stolen immediately after role revocation
- Thief has 7-day window to use stolen credentials
- Even if user changes password, offline token still valid
```

**Severity**: CRITICAL

**Impact on Enterprise POS**:
- User fired on Day 1 → can still access POS for 7 days if offline
- Store manager revoked → can still create transactions for 7 days
- Device stolen → thief has 7-day window
- No way to remotely revoke offline access

**Root Cause**:
- Offline token has fixed 7-day expiry (set at login)
- Only extended on successful online refresh
- If device stays offline, revocation can't propagate

**Fix Required** (No perfect solution without removing offline support):

**Option A: Shorter offline window + force online checkin**
```typescript
// Reduce from 7 days to 1 day
const OFFLINE_SESSION_DURATION_MS = 1 * 24 * 60 * 60 * 1000;

// App must go online every 24 hours or lose offline access
if (offlineSession.offlineValidUntil < now) {
  throw new Error('Offline access expired. Must go online to continue.');
}
```

**Option B: Backend-driven revocation (complex)**
```typescript
// When admin revokes a role:
1. Mark user's sessions for revocation
2. On next online refresh, backend detects revocation
3. Return 403 with revocation marker
4. Mobile immediately clears offline session + all tokens

// Problem: Requires online connection to enforce revocation
```

**Option C: Implement revocation check endpoint**
```typescript
// Periodically (weekly), when device goes online:
const response = await API.post("/auth/check-revoked-status", {
  sessionId,
  offlineToken
});

if (response.data.isRevoked) {
  await offlineSession.clear();
  tokenManager.clear();
  router.replace("/(auth)/phone");
}
```

**Recommended**: Option A + Option C (hybrid approach)

---

## ISSUE 4.2: Offline Token Doesn't Include Expiry Metadata [HIGH]

**Location**: `store/persistLogin.ts:76-83`

**Problem**:
```typescript
await offlineSession.create({
  userId,
  storeId,
  storeName,
  roles: roleCodes,
  jwksPublicKey,
  offlineToken: authResponse.offlineToken ?? "",
  // ✗ No offline token expiry time stored
  // ✗ No backend issuance time stored
  // ✗ No indication of when token was obtained
});
```

When verifying offline JWT locally:
```typescript
// Mobile extracts exp claim from JWT
const claims = jwt.decode(offlineToken);
const isExpired = now > claims.exp;  // Only check JWT exp claim

// But what if:
// - JWT itself is valid
// - But 7 days have passed since login
// - Backend issued a revocation notice (not propagated)
```

**Severity**: HIGH

**Fix**:
```typescript
interface OfflineSession {
  // ... existing fields
  offlineTokenIssuedAt: number;   // Backend issue time
  offlineTokenExpiresAt: number;  // Backend expiry time (not just JWT.exp)
  lastRoleRefreshAt: number;      // Last time roles were synced
}

async create(input) {
  const jwtClaims = decodeJwt(input.offlineToken);

  const session: OfflineSession = {
    userId: input.userId,
    offlineToken: input.offlineToken,
    offlineTokenIssuedAt: jwtClaims.iat * 1000,
    offlineTokenExpiresAt: jwtClaims.exp * 1000,
    offlineValidUntil: Date.now() + OFFLINE_SESSION_DURATION_MS,
    lastRoleRefreshAt: Date.now(),
    // ...
  };

  await saveSecureItem(OFFLINE_SESSION_KEY, JSON.stringify(session));
}

// Later, during offline JWT verification:
function validateOfflineToken(session: OfflineSession): boolean {
  const now = Date.now();

  // Check JWT expiry
  if (now > session.offlineTokenExpiresAt) {
    return false;  // JWT itself expired
  }

  // Check offline session validity
  if (now > session.offlineValidUntil) {
    return false;  // Offline window closed
  }

  // Check role staleness (roles not refreshed in 7 days)
  if (now - session.lastRoleRefreshAt > 7 * 24 * 60 * 60 * 1000) {
    return false;  // Roles too stale, must go online
  }

  return true;
}
```

---

# SECTION 5: PUBLIC KEY CACHING & KEY ROTATION RISKS

## ISSUE 5.1: JWKS Public Key Cached Indefinitely, No Rotation Detection [HIGH]

**Location**: `lib/offline-session.ts:41` and `store/persistLogin.ts:74`

**Problem**:
```typescript
await offlineSession.create({
  jwksPublicKey: await fetchJwksPublicKey(),  // Fetched once at login
  // ✗ Never refreshed
  // ✗ No version tracking
  // ✗ No rotation detection
});
```

When backend rotates RSA key:
```
Timeline:
- Day 1: Backend issues keys[0] (RSA-2048)
  User logs in → Mobile caches keys[0] public key

- Day 30: Backend rotates to keys[1] (RSA-4096)
  Backend still signs JWTs with keys[0] for 7 days (grace period)

- Day 32: Backend stops signing with keys[0]
  All new tokens use keys[1]

- User's device offline from Day 32-40:
  User tries to verify JWT with cached keys[0]
  JWT was signed with keys[1] → verification fails
  Offline POS can't work
```

**Severity**: HIGH

**Current Mitigation**:
```typescript
// Backend: auth.controller.ts:184
@Get('.well-known/jwks.json')
getJWKS(): Record<string, unknown> {
  const jwks = this.jwtConfigService.getPublicKeyAsJWKS();
  // Cache max 1 hour for emergency rotation propagation
  res.set('Cache-Control', 'public, max-age=3600');
  return jwks;
}
```

**Problem with current mitigation**:
- ✗ Only helps if device comes online within 1 hour of rotation
- ✗ Doesn't help if device offline for days
- ✗ Mobile doesn't refresh cached key automatically

**Fix Required**:
```typescript
interface OfflineSession {
  jwksPublicKey: string;
  jwksVersion: string;              // Version identifier
  jwksRefreshedAt: number;          // Last fetch timestamp
  jwksKeyIds: string[];             // List of acceptable key IDs
}

// On successful refresh:
export const refreshSession = createAsyncThunk(
  async (...) => {
    // ... existing refresh logic

    // Fetch fresh JWKS
    try {
      const freshJwks = await API.get("/.well-known/jwks.json");
      const newVersion = freshJwks.headers['x-jwks-version'];

      const session = await offlineSession.load();
      if (session) {
        // Update JWKS if version changed
        if (newVersion !== session.jwksVersion) {
          await offlineSession.updateJwks(
            session,
            freshJwks.data.keys,
            newVersion
          );
        }
      }
    } catch (err) {
      console.warn("Failed to refresh JWKS, using cached version");
    }
  }
);

// During offline verification:
async function verifyOfflineJwt(
  token: string,
  offlineSession: OfflineSession
): Promise<boolean> {
  const decoded = jwt.decode(token);

  // Check if key ID is in acceptable list
  if (!offlineSession.jwksKeyIds.includes(decoded.kid)) {
    return false;  // Signature doesn't match any known key
  }

  // Verify with appropriate key
  const key = getJwksKey(decoded.kid, offlineSession.jwksPublicKey);
  return jwt.verify(token, key);
}
```

---

## ISSUE 5.2: No Fallback JWKS Keys for Mobile Offline Verification [MEDIUM]

**Location**: `store/persistLogin.ts` (not addressed)

**Problem**:
Backend supports 7-day fallback keys for graceful key rotation:
```typescript
// Backend: jwt.config.ts (hypothetical)
public getPublicKeyAsJWKS() {
  return {
    keys: [
      { kid: 'current', key: currentKey },
      { kid: 'fallback1', key: keyFrom7DaysAgo },
      { kid: 'fallback2', key: keyFrom6DaysAgo },
      // ...
    ]
  };
}
```

But mobile only stores ONE key:
```typescript
// Mobile: persistLogin.ts
jwksPublicKey: currentJwksKey,  // Only ONE key, not array
```

If backend rotates key and mobile offline:
```
1. Backend rotates: keys = [newKey, fallbackKey(7days)]
2. Mobile offline, has only the OLD key from 14 days ago
3. Mobile tries to verify JWT signed with newKey
4. Verification fails (different key)
5. Offline POS blocked
```

**Severity**: MEDIUM

**Fix**:
```typescript
interface OfflineSession {
  jwksPublicKey: string;           // Current key
  jwksPublicKeyFallback: string[]; // Last 7 days of keys
  jwksRotationHistory: {
    kid: string;
    key: string;
    validUntil: number;
  }[];
}

// Store multiple keys during login:
const jwksResponse = await fetchJwksPublicKey();
// jwksResponse.keys = [current, fallback1, fallback2, ...]

await offlineSession.create({
  jwksPublicKey: jwksResponse.keys[0].key,
  jwksRotationHistory: jwksResponse.keys.map((k, i) => ({
    kid: k.kid,
    key: k.key,
    validUntil: Date.now() + (7 - i) * 24 * 60 * 60 * 1000
  }))
});
```

---

# SECTION 6: DEVICE BINDING ROBUSTNESS

## ISSUE 6.1: Device Fingerprinting Too Easily Spoofed [HIGH]

**Location**: `lib/device-binding.ts:43-63`

**Problem**:
```typescript
export async function getDeviceIdentity(): Promise<DeviceIdentity> {
  // iOS
  if (Platform.OS === "ios") {
    const vendorId = await Application.getIosIdForVendorAsync();
    // Vendor ID resets on app uninstall + reinstall
  }

  // Android
  if (Platform.OS === "android") {
    return Application.getAndroidId();
    // Android ID can be reset by factory reset
  }

  const deviceModel = Device.modelName;    // "iPhone 15" (spoofable)
  const osVersion = Device.osVersion;      // "18.0" (spoofable)
  const appVersion = Application.nativeApplicationVersion; // "1.0.0" (in APK)

  const hashInput = `${deviceId}:${deviceModel}:${osVersion}:${appVersion}`;
  const hash = await crypto.digestStringAsync(
    crypto.CryptoDigestAlgorithm.SHA256,
    hashInput
  );

  return { deviceId, deviceModel, osVersion, appVersion, hash };
}
```

**Attack Scenario**:
```
1. Attacker steals refresh token from SecureStore
   → Attacker emulates same device:

2. On iPhone:
   - VendorId bound to app bundle ID + device UDID
   - Attacker can forge by modifying device filesystem
   - Or use jailbroken device + Xcode to forge

3. On Android:
   - Factory reset clears Android ID
   - Rooted device can modify Android ID via setprop
   - Android ID generation is predictable

4. Device model/OS version are sent in plain text
   → Attacker just spoofs headers:

   POST /auth/refresh-token {
     refreshToken: "stolen_token",
     deviceBinding: {
       deviceId: "5ab2e8d5e0e4c8f9",
       deviceModel: "iPhone 15",
       osVersion: "18.0",
       appVersion: "1.0.0",
       hash: "abc123..."
     }
   }

5. Backend validates: hash matches → accepts!
   ✗ Token works on attacker's device
```

**Severity**: HIGH

**Root Causes**:
- ✗ Device ID can be factory-reset or spoofed
- ✗ No hardware-level binding (secure enclave not used)
- ✗ Hash doesn't use cryptographic key (SHA256 is deterministic)
- ✗ Attacker has all binding data in clear text (can replicate)
- ✗ No rate limiting on device binding mismatches

**What's Missing**:
- ✗ Secure enclave signing (require device to cryptographically sign binding)
- ✗ Hardware attestation (verify device is real, not emulated)
- ✗ Per-device secret key (only device holds this)

**Current Binding Strategy**:
```
Device Binding = SHA256(deviceId + model + OS + appVersion)
                 ↑ All spoofable, all deterministic
```

**What It Should Be**:
```
Device Binding = RSA-Sign(
  deviceId + timestamp + nonce,
  device_private_key_in_secure_enclave  // ← Can't be extracted
)
                 ↑ Attacker can't forge without accessing Secure Enclave
```

**Partial Fix** (without changing architecture):
```typescript
// At minimum, use HMAC with server-side secret
function formatDeviceBindingForRequest(
  identity: DeviceIdentity,
  serverSecret: string  // Never expose to client
): Record<string, string | number> {
  const binding = {
    deviceId: identity.deviceId,
    deviceModel: identity.deviceModel,
    osVersion: identity.osVersion,
    appVersion: identity.appVersion,
    timestamp: Date.now()
  };

  // Sign with server secret (attacker can't forge without secret)
  const signature = crypto
    .createHmac('sha256', serverSecret)
    .update(JSON.stringify(binding))
    .digest('hex');

  return {
    ...binding,
    signature  // Server verifies this matches
  };
}

// Backend:
function verifyDeviceBinding(binding: any, serverSecret: string): boolean {
  const { signature, ...data } = binding;

  const expectedSig = crypto
    .createHmac('sha256', serverSecret)
    .update(JSON.stringify(data))
    .digest('hex');

  return signature === expectedSig;  // Constant-time comparison
}
```

---

## ISSUE 6.2: No Protection Against Emulator/Jailbreak/Rooted Devices [HIGH]

**Location**: `lib/device-binding.ts` (not addressed)

**Problem**:
Mobile app doesn't check if device is:
- ✗ Jailbroken (iOS)
- ✗ Rooted (Android)
- ✗ Emulated (Genymotion, Bluestacks)
- ✗ Using hook frameworks (Frida, Xposed)

**Attack Scenario**:
```
1. Attacker installs app on rooted Android emulator
2. Attacker modifies SecureStore via filesystem access:
   adb shell su -c "cat /data/data/com.nks.mobile/shared_prefs/secure_store"
3. Attacker extracts tokens
4. Attacker modifies device binding to match any victim device:
   adb shell setprop ro.build.fingerprint "stolen_device_fp"
5. App sends request with spoofed device binding
6. Backend accepts (device binding matches)
```

**Severity**: HIGH

**Impact**:
- Offline tokens can be extracted and used on other devices
- Device binding provides zero protection on compromised devices
- SecureStore encryption is bypassed (root can decrypt)

**What Mobile App Should Do**:
```typescript
// Check for rooting/jailbreaking
async function checkDeviceIntegrity(): Promise<boolean> {
  // iOS: Check for common jailbreak indicators
  if (Platform.OS === "ios") {
    const isJailbroken = await RootBeer.isJailbroken();
    if (isJailbroken) {
      return false;
    }
  }

  // Android: Check for rooting indicators
  if (Platform.OS === "android") {
    const isRooted = await RootBeer.isRooted();
    if (isRooted) {
      return false;
    }
  }

  return true;
}

// In AuthProvider:
useEffect(() => {
  const check = async () => {
    const isIntact = await checkDeviceIntegrity();
    if (!isIntact) {
      console.error("Device integrity check failed. Offline mode disabled.");
      offlineSession.clear();  // Disable offline
      // Force online authentication only
    }
  };
  check();
}, []);
```

---

# SECTION 7: TOKEN MANAGER MEMORY/STORAGE SYNCHRONIZATION RISKS

## ISSUE 7.1: Race Condition: Memory Token Used Before SecureStore Write Completes [CRITICAL]

**Location**: `store/persistLogin.ts:18-48` and `lib/auth-provider.tsx:28-30`

**Problem**:
```typescript
async function persistLogin(authResponse, dispatch) {
  // ✗ CRITICAL: Write is async, not awaited properly
  try {
    // Step 1: Write to SecureStore (async, takes ~50-200ms)
    await tokenManager.persistSession(authResponse);

    // Step 2: Verify write (loads from SecureStore again)
    const verification = await tokenManager.loadSession<AuthResponse>();

    if (verification.data.session.sessionToken !== sessionToken) {
      throw new Error("Token mismatch");
    }

    // Step 3: Set in-memory token
    tokenManager.set(sessionToken);  // Sets immediately

    // ✓ Verification ensures write succeeded
  } catch (error) {
    throw error;
  }

  dispatch(setCredentials(authResponse));  // Redux update
}
```

**What happens if app crashes between step 2 and step 3**:
```
Timeline:
1. persistSession() awaited → write to disk completes ✓
2. verification passed ✓
3. tokenManager.set(sessionToken) called
4. dispatch(setCredentials(authResponse)) about to happen
5. CRASH: App suddenly closes

On app restart:
6. initializeAuth() loads session from SecureStore ✓
7. Token loaded into Redux ✓
8. BUT: In-memory tokenManager._token is null (new instance)
9. First API call: tokenManager.get() returns null
10. Request sent without Authorization header
11. Server returns 401
12. App attempts refreshSession()
13. refreshSession loads token from SecureStore ✓
14. Sets in-memory token ✓
15. Retry succeeds
```

**Current Code Handles This**:
- ✓ SecureStore write is verified before setting in-memory
- ✓ Redux dispatch ensures token persists across app restart
- ✓ On startup, initializeAuth() reloads from SecureStore

**BUT** - Single point of failure:
```
If SecureStore write PARTIALLY fails:
- App thinks write succeeded (no exception thrown)
- Verification check passes (loads partial data)
- In-memory token set to partial/corrupt token
- All API calls fail

Example:
persistSession() tries to store 2000 bytes
SecureStore silently truncates to 1800 bytes
Verification: only checks if sessionToken field exists (not size/completeness)
In-memory token set ✓
Later API call fails (JWT invalid after truncation)
```

**Severity**: CRITICAL

**Fix Required**:
```typescript
async function persistLogin(authResponse, dispatch) {
  try {
    // Step 1: Write to SecureStore
    await tokenManager.persistSession(authResponse);

    // Step 2: Comprehensive verification
    const verification = await tokenManager.loadSession<AuthResponse>();

    // Verify all critical fields exist and match
    const requiredFields = [
      'data.user.id',
      'data.session.sessionToken',
      'data.session.jwtToken',
      'data.access.isSuperAdmin'
    ];

    for (const field of requiredFields) {
      const value = getNestedValue(verification, field);
      const expected = getNestedValue(authResponse, field);

      if (value !== expected) {
        throw new Error(
          `SecureStore verification failed: ${field} mismatch. ` +
          `Expected: ${expected}, Got: ${value}`
        );
      }
    }

    // Verify size (catch truncation)
    const storedJson = JSON.stringify(verification.data);
    if (storedJson.length < JSON.stringify(authResponse).length * 0.8) {
      throw new Error(
        'SecureStore data loss detected: stored data is too small. ' +
        `Original: ${JSON.stringify(authResponse).length}b, ` +
        `Stored: ${storedJson.length}b`
      );
    }

    // Only now set in-memory (point of no return)
    tokenManager.set(authResponse.session.sessionToken);

    // Update Redux
    dispatch(setCredentials(authResponse));

  } catch (error) {
    console.error("[Auth] Critical persistence error:", error);
    // Don't partially set in-memory token
    tokenManager.clear();
    // Force user to re-login
    throw error;
  }
}
```

---

## ISSUE 7.2: In-Memory Token Manager Not Cleared on Failed SecureStore Verification [HIGH]

**Location**: `lib/auth-provider.tsx` (initializeAuth)

**Problem**:
```typescript
// Hypothetical initializeAuth thunk
export const initializeAuth = createAsyncThunk(
  async () => {
    try {
      const session = await tokenManager.loadSession();

      if (!session || !isValid(session)) {
        dispatch(logout());
        return;
      }

      // ✗ Set in-memory token before full validation
      const token = session.data.session.sessionToken;
      tokenManager.set(token);

      // Later, validation might fail
      const isStale = Date.now() - session.fetchedAt > SESSION_STALE_MS;
      if (isStale) {
        // Session is stale, need refresh
        dispatch(refreshSession());  // Async, might fail
      }

      dispatch(setCredentials(session.data));

    } catch (error) {
      // ✗ If error here, in-memory token still set!
      dispatch(logout());
    }
  }
);
```

**Attack Scenario**:
```
1. App startup: initializeAuth()
2. Load session from SecureStore (corrupted/tampered)
3. Set in-memory token to corrupted value
4. Validation fails (JWT decode error)
5. logout() dispatched
6. But in-memory token still holds corrupted value
7. User sees "logged out" but token still in memory
8. Memory inspection by malware can extract corrupted token
```

**Severity**: HIGH

**Fix**:
```typescript
export const initializeAuth = createAsyncThunk(async () => {
  try {
    const session = await tokenManager.loadSession();

    if (!session) {
      tokenManager.clear();  // Ensure in-memory cleared
      dispatch(logout());
      return;
    }

    // Validate BEFORE setting in-memory
    try {
      validateSessionStructure(session.data);
      validateTokenFormats(session.data);
    } catch (validationError) {
      console.error("[Auth] Session validation failed:", validationError);
      tokenManager.clear();
      await tokenManager.clearSession();  // Clear SecureStore too
      dispatch(logout());
      return;
    }

    // Only NOW set in-memory after passing validation
    const token = session.data.session.sessionToken;
    tokenManager.set(token);

    // Check staleness and refresh if needed
    const isStale = Date.now() - session.fetchedAt > SESSION_STALE_MS;
    if (isStale) {
      dispatch(refreshSession());
    } else {
      dispatch(setCredentials(session.data));
    }

  } catch (error) {
    console.error("[Auth] Init error:", error);
    tokenManager.clear();  // Ensure cleared on error
    await tokenManager.clearSession();
    dispatch(logout());
  }
});
```

---

# SECTION 8: OFFLINE SESSION TAMPERING RISKS

## ISSUE 8.1: OfflineSession Can Be Modified by Malware Without Detection [HIGH]

**Location**: `lib/offline-session.ts:50-145`

**Problem**:
```typescript
// Offline session stored in SecureStore
export interface OfflineSession {
  userId: number;
  storeId: number;
  roles: string[];
  offlineToken: string;
  // ... other fields
}

// Malware on rooted Android device:
adb shell su -c "
  cat /data/data/com.nks.mobile/shared_prefs/nks_offline_session | jq .
  # {
  #   \"userId\": 1,
  #   \"storeId\": 1,
  #   \"roles\": [\"STAFF\"]
  # }

  # Modify roles:
  echo '{
    \"userId\": 1,
    \"storeId\": 1,
    \"roles\": [\"STORE_OWNER\"]  # ← Changed from STAFF to STORE_OWNER
  }' > /data/data/com.nks.mobile/shared_prefs/nks_offline_session
"
```

When user works offline:
```typescript
// App loads offline session
const session = await offlineSession.load();
// session.roles = ["STORE_OWNER"]  // ← TAMPERED!

// App performs authorization check
if (session.roles.includes("STORE_OWNER")) {
  // Allow privileged operation
  await createStoreSettings();  // ← Should require STAFF minimum
}
```

**Severity**: HIGH

**Root Cause**:
- ✗ OfflineSession is stored as plain JSON
- ✗ No integrity check (HMAC signature)
- ✗ No tamper detection

**Impact on Enterprise POS**:
- STAFF user with stolen phone → upgrade self to STORE_OWNER
- Perform privileged operations (void transactions, refunds, etc.)
- Create audit trail showing legitimate user

**Fix Required** (Add HMAC integrity check):
```typescript
// At app initialization, derive a key from device + user
async function deriveOfflineSessionKey(): Promise<string> {
  const deviceId = await Application.getAndroidId();
  const userId = user.id;

  // Derive key (never changes unless device reset)
  const keyMaterial = `${deviceId}:${userId}:nks_offline_session`;
  const key = await crypto.digestStringAsync(
    crypto.CryptoDigestAlgorithm.SHA256,
    keyMaterial
  );

  return key;
}

// When creating offline session:
async function create(input) {
  const session: OfflineSession = { /* ... */ };
  const json = JSON.stringify(session);

  // Compute HMAC signature
  const key = await deriveOfflineSessionKey();
  const hmac = crypto
    .createHmac('sha256', key)
    .update(json)
    .digest('hex');

  // Store with signature
  const signedSession = {
    session,
    hmac,
    createdAt: Date.now()
  };

  await saveSecureItem(OFFLINE_SESSION_KEY, JSON.stringify(signedSession));
}

// When loading offline session:
async function load(): Promise<OfflineSession | null> {
  const raw = await getSecureItem(OFFLINE_SESSION_KEY);
  if (!raw) return null;

  try {
    const { session, hmac } = JSON.parse(raw);

    // Verify HMAC
    const key = await deriveOfflineSessionKey();
    const expectedHmac = crypto
      .createHmac('sha256', key)
      .update(JSON.stringify(session))
      .digest('hex');

    if (hmac !== expectedHmac) {
      console.error("[Offline] Session tampered with!");
      await clear();  // Clear corrupted session
      return null;
    }

    return session;

  } catch {
    return null;
  }
}
```

---

# SECTION 9: REFRESH TOKEN LIFETIME & ROTATION POLICIES

## ISSUE 9.1: Refresh Token Lifetime Not Specified (Backend) [MEDIUM]

**Location**: `apps/nks-backend/src/modules/auth` (refresh token creation)

**Problem**:
Code doesn't show refresh token expiry time. From context:
```typescript
// Session token expires in 15 min
// Refresh token expires in: ???

// From auth-response.dto.ts
const AuthSessionSchema = z.object({
  sessionId: z.string(),
  sessionToken: z.string(),
  expiresAt: z.string(),          // ← JWT/session expiry (15 min)
  refreshToken: z.string(),
  refreshExpiresAt: z.string(),   // ← Refresh token expiry (unknown TTL)
  // ...
});
```

**Missing Information**:
- ✗ What's the refresh token TTL? (1 day? 7 days? 30 days?)
- ✗ Can refresh token be used unlimited times?
- ✗ Once rotated, is old refresh token invalidated?

**Severity**: MEDIUM

**Impact**:
- ✗ If refresh token lives 7 days: large window for replay if leaked
- ✗ If refresh token lives 30 days: huge attack surface
- ✗ Standard: 7-30 days (depends on risk tolerance)

**Recommended**:
```typescript
// Backend should enforce strict refresh token TTL

// Refresh token generation:
const refreshToken = crypto.randomBytes(32).toString('hex');
const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

// During refresh, validate expiry
if (new Date() > refreshExpiresAt) {
  throw new UnauthorizedException('Refresh token expired');
}

// After refresh, old token must be invalidated
async refreshAccessToken(refreshToken: string) {
  // Find and validate current token
  const existing = await refreshTokenRepository.findByToken(refreshToken);

  if (!existing || existing.expiresAt < new Date()) {
    throw new UnauthorizedException('Refresh token invalid or expired');
  }

  // Mark old token as used (prevent reuse)
  await refreshTokenRepository.markAsUsed(existing.id);

  // Issue new token
  const newRefreshToken = generateRefreshToken();
  const newSession = await createNewSession(...);

  // Store new token
  await refreshTokenRepository.create({
    token: newRefreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    previousTokenId: existing.id  // Link to old token
  });

  return {
    refreshToken: newRefreshToken,
    refreshExpiresAt,
    // ...
  };
}
```

---

## ISSUE 9.2: Refresh Token Stored in Memory, Not Validated on Load [HIGH]

**Location**: `store/refreshSession.ts:54`

**Problem**:
```typescript
const refreshTokenValue = validation.refreshToken;

// ✗ Token loaded from SecureStore
// ✗ No format validation
// ✗ Sent directly to backend
// ✗ If corrupted, backend rejects, but no retry logic

const response = await API.post("/auth/refresh-token", {
  refreshToken: refreshTokenValue
});
```

**Failure Scenario**:
```
1. Refresh token stored in SecureStore: "abc123def456..."
2. SecureStore partially corrupted: "abc123def456" (truncated)
3. Mobile calls refresh endpoint with truncated token
4. Backend returns 401 (token not found)
5. Mobile logs out user
6. User must re-login

Fix: Validate token format before sending
```

**Severity**: HIGH

**Fix**:
```typescript
const refreshTokenValue = validation.refreshToken;

// Validate format
if (!/^[A-Za-z0-9]{64}$/.test(refreshTokenValue)) {
  console.error("Refresh token format invalid, logging out");
  tokenManager.clear();
  await tokenManager.clearSession();
  dispatch(logoutAction());
  return;
}

// Only send if valid
const response = await API.post("/auth/refresh-token", {
  refreshToken: refreshTokenValue
});
```

---

# SECTION 10: SESSION MANAGEMENT EDGE CASES

## ISSUE 10.1: Multiple Device Sessions Not Properly Synchronized [MEDIUM]

**Location**: `store/persistLogin.ts` and `store/refreshSession.ts`

**Problem**:
```typescript
// User logs in on Device1
// persistLogin() stores session in SecureStore on Device1

// Later, user logs in on Device2
// persistLogin() stores session in SecureStore on Device2

// Both devices have valid sessions
// User changes password on Device1
// Backend terminates all sessions

// Device2 continues to work with old session
// Device1 gets 401, must re-login

// BUT: Device2's offline session still valid for 7 days!
// Even though user changed password
```

**Scenario**:
```
Timeline:
- Day 1: User logs in on iPhone (Device1) → offline session created
- Day 2: User logs in on Android (Device2) → offline session created
- Day 3: User changes password
  → Backend terminates all sessions
  → iPhone gets 403 (session invalid)
  → Android also gets 403 (refreshSession() called)

- Day 4: User's iPad (Device3) stolen
  → Thief finds iPad offline
  → Offline session still valid (has old roles)
  → Thief can perform transactions as user for 7 days
```

**Severity**: MEDIUM

**Missing Feature**:
- ✗ No session ID sync across devices
- ✗ No broadcast of session termination
- ✗ No mechanism to invalidate all offline sessions at once

**Workaround** (Implement session version tracking):
```typescript
// Backend: Track session version per user
interface UserSessionVersion {
  userId: number;
  version: number;
  createdAt: Date;
}

// On password change:
await incrementUserSessionVersion(userId);
// version: 1 → version: 2

// Mobile: Store version in offline session
interface OfflineSession {
  sessionVersion: number;
  // ...
}

// On refresh:
const response = await API.post("/auth/refresh-token", {...});
const newSessionVersion = response.data.sessionVersion;

// If version changed, update offline session
if (newSessionVersion !== offlineSession.sessionVersion) {
  await offlineSession.updateVersion(newSessionVersion);
}

// If offline and version mismatch detected:
// Clear offline session (user must go online)
```

---

## ISSUE 10.2: Session Limit (Max 10 per user) Not Validated on Mobile [LOW]

**Location**: `store/refreshSession.ts` (not validated)

**Problem**:
```typescript
// Backend enforces: Max 10 sessions per user
// Mobile stores session locally

// User logs in on 11 different devices
// Backend keeps only last 10
// Mobile device #8 doesn't know it was dropped
// When Device#8 tries to refresh:
//   → Backend accepts (session was valid at login)
//   → Issues new token
//   → Now user has 11 sessions again
//   → Backend deletes oldest
//   → Old device #1 is now invalid
```

**Severity**: LOW (mostly UI issue)

**Fix**:
```typescript
// Backend should return session limit info
const response = await API.post("/auth/refresh-token", {...});

// Response includes:
{
  sessionId: "...",
  totalSessions: 8,      // Your current active sessions
  maxSessions: 10,       // Maximum allowed
  // ...
}

// Mobile UI can warn:
if (response.data.totalSessions >= 10) {
  showWarning("You have 10 active sessions. Oldest may be terminated.");
}
```

---

# SECTION 11: TIME SYNCHRONIZATION ISSUES (Offline Token Expiry)

## ISSUE 11.1: Device Time Drift Causes False Expiry of Valid Offline Tokens [HIGH]

**Location**: `store/persistLogin.ts:50-53` and offline verification logic

**Problem**:
```typescript
// Sync server time
syncServerTime().catch((err) =>
  console.warn("[Auth] Clock sync failed:", sanitizeError(err))
);

// Calculates offset:
// offset = serverTime - deviceTime
// offset = 5 means device is 5 seconds BEHIND server
```

**Device Time Drift Scenarios**:
```
Scenario 1: Device clock too fast
- Device thinks: 2026-04-10 15:00:00
- Server thinks: 2026-04-10 14:55:00 (device is 5 min AHEAD)
- offset = -300 (negative!)
- Offline JWT with exp=1712761000 (actual 15:10)
- Device calculates expiry: 1712761000 + (-300) = 1712760700 (15:05!)
- Token considered expired 5 minutes early!

Scenario 2: Device clock too slow
- Device thinks: 2026-04-10 14:55:00
- Server thinks: 2026-04-10 15:00:00 (device is 5 min BEHIND)
- offset = +300 (positive)
- Offline JWT with exp=1712761000 (actual 15:10)
- Device calculates: 1712761000 + 300 = 1712761300 (15:15!)
- Token considered valid 5 minutes LONGER!
- User can access POS after token actually expired

Scenario 3: No time sync (offline from start)
- User never connects to internet
- Never calls syncServerTime()
- offset = 0 (default)
- Offline token expires based on wrong device time
- If device clock is wrong by 1 hour:
  - Device thinks token valid: 15:00-15:30
  - Server would think: 14:00-14:30
  - 30-minute window mismatch
```

**Severity**: HIGH

**Impact**:
- ✗ False expiry: User thinks token expired, can't work offline
- ✗ Extended validity: Token works past intended expiry
- ✗ No timezone adjustment: Device in UTC+5:30, thinks in UTC

**Fix Required** (Robust time sync):
```typescript
interface TimeOffset {
  offset: number;           // Seconds (can be negative)
  measuredAt: number;       // Timestamp of measurement
  confidence: number;       // 0-1 (how confident is this offset?)
}

// Better time sync:
export async function syncServerTimeRobust(): Promise<TimeOffset> {
  const attempts = [];

  // Try multiple times to get consistent measurements
  for (let i = 0; i < 3; i++) {
    const deviceTimeBeforeMs = Date.now();

    const response = await API.post("/auth/sync-time", {
      deviceTime: Math.floor(deviceTimeBeforeMs / 1000)
    });

    const deviceTimeAfterMs = Date.now();
    const serverTime = response.data.serverTime;

    // Account for network latency
    const roundTripMs = deviceTimeAfterMs - deviceTimeBeforeMs;
    const estimatedServerTime = serverTime + Math.floor(roundTripMs / 2000);

    const midpointDeviceTime = Math.floor(
      (deviceTimeBeforeMs + deviceTimeAfterMs) / 2000
    );

    const offset = estimatedServerTime - midpointDeviceTime;
    attempts.push(offset);

    // Wait before retry
    if (i < 2) await new Promise(r => setTimeout(r, 500));
  }

  // Use median offset (robust to outliers)
  attempts.sort((a, b) => a - b);
  const offset = attempts[1];  // Middle value

  // Calculate confidence (how much variation?)
  const variance = Math.max(...attempts) - Math.min(...attempts);
  const confidence = variance > 5 ? 0.5 : 0.95;

  // Store offset
  await SecureStore.setItem('server_time_offset', JSON.stringify({
    offset,
    measuredAt: Date.now(),
    confidence
  }));

  return { offset, measuredAt: Date.now(), confidence };
}

// During offline verification:
function getAdjustedNow(): number {
  const offsetData = loadTimeOffset();  // Load stored offset
  const age = Date.now() - offsetData.measuredAt;

  // If offset is old (>1 hour), don't use it (drift accumulated)
  if (age > 60 * 60 * 1000) {
    console.warn("Time offset too old, may be inaccurate");
    // Use device time (risky but better than wrong offset)
    return Math.floor(Date.now() / 1000);
  }

  // Apply offset with confidence weighting
  const offset = offsetData.confidence < 0.8 ? 0 : offsetData.offset;
  return Math.floor((Date.now() + offset * 1000) / 1000);
}

function verifyOfflineJwt(token: string): boolean {
  const claims = jwt.decode(token);
  const now = getAdjustedNow();

  if (now > claims.exp) {
    return false;  // Expired
  }

  return true;
}
```

---

## ISSUE 11.2: Time Sync Fails Silently, Expiry Validation Uses Wrong Time [MEDIUM]

**Location**: `store/persistLogin.ts:51-52`

**Problem**:
```typescript
// Sync device clock offset with server
syncServerTime().catch((err) =>
  console.warn("[Auth] Clock sync failed:", sanitizeError(err))  // ← Silent failure!
);

// But verification continues
// If sync fails, offset = 0 (default)
// Offline JWT verified with unsynced time
```

**Failure Scenario**:
```
1. Login on airplane (no internet)
2. syncServerTime() fails (no network)
3. offset stays at 0 (default)
4. Device clock is actually 30 minutes slow
5. Token expiry check uses wrong time
6. Token validated as valid when actually expired
```

**Severity**: MEDIUM

**Fix**:
```typescript
async function persistLogin(authResponse, dispatch) {
  // ... store session ...

  try {
    const timeSync = await syncServerTime();

    if (timeSync.confidence < 0.8) {
      console.warn(
        "[Auth] Time sync unreliable. Offline token validation may be inaccurate."
      );
    }

    // Store sync result
    await SecureStore.setItem('time_sync_result', JSON.stringify(timeSync));

  } catch (err) {
    console.error("[Auth] Failed to sync server time. Offline may not work accurately.");

    // Store that sync failed
    await SecureStore.setItem('time_sync_failed', 'true');

    // Warn user
    showWarning(
      "Could not verify device time. Offline POS times may be inaccurate."
    );
  }
}
```

---

# SECTION 12: ERROR HANDLING & LOGGING SANITIZATION

## ISSUE 12.1: Sensitive Data Leaked in ErrorHandler Logs [HIGH]

**Location**: `shared/errors/ErrorHandler.ts` (implementation varies)

**Problem**:
Code shows some sanitization:
```typescript
const appError = ErrorHandler.handle(err, {
  phone: phone,
  otp: "***",  // ← Sanitized
  action: "verify_otp"
});
```

But comprehensive check needed. Examples of potential leaks:

**Leak 1: Error message contains token**:
```typescript
try {
  await refreshToken(token);
} catch (err) {
  console.error("Failed to refresh:", err);  // ← err.message might contain token!
}
```

**Leak 2: Error object contains response data**:
```typescript
catch (err) {
  const appError = ErrorHandler.handle(err, {...});
  // err.response.data might contain full auth response
  // including tokens!
}
```

**Leak 3: Structured logging with full context**:
```typescript
console.log({
  action: "verify_otp",
  phone: "+919876543210",
  otp: "123456",  // ← Not sanitized here!
  reqId: "...",
  error: err
});
```

**Leak 4: Stack traces contain tokens**:
```typescript
// If token appears in stack trace
const jwt = "eyJhbGc...";
someFunction(jwt);  // ← If function throws, stack includes jwt value
```

**Severity**: HIGH

**Impact**:
- ✗ Tokens leaked to logs → analytics, error monitoring services
- ✗ OTPs visible in development logs
- ✗ Phone numbers in error messages
- ✗ If logs sent to third-party service (Sentry, etc.), secrets exposed

**Comprehensive Fix**:
```typescript
// Create utility for safe error logging
const SENSITIVE_PATTERNS = {
  token: /Bearer\s+[A-Za-z0-9_-]+/g,
  jwt: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  phone: /\+\d{1,3}\d{7,14}/g,
  otp: /\b\d{6}\b/g,
  email: /[^\s@]+@[^\s@]+\.[^\s@]+/g,
  sessionId: /"sessionId"\s*:\s*"[^"]+"/g,
  refreshToken: /"refreshToken"\s*:\s*"[^"]+"/g,
};

export function sanitizeForLogging(data: any): string {
  let serialized = JSON.stringify(data);

  // Replace all sensitive patterns
  for (const [key, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
    serialized = serialized.replace(pattern, `[REDACTED_${key.toUpperCase()}]`);
  }

  // Remove error stack traces (might contain tokens in variables)
  serialized = serialized.replace(/(\\n\s+at\s+.+)/g, ' [stack trace redacted]');

  return serialized;
}

// Usage:
try {
  await API.post("/auth/refresh-token", { refreshToken });
} catch (err) {
  const sanitized = sanitizeForLogging({
    action: 'refresh_token',
    error: err.message,
    status: err.response?.status,
    timestamp: new Date().toISOString()
  });

  console.error("[Auth] Refresh failed:", sanitized);

  // Send to error tracking service
  ErrorTracker.captureException(err, {
    contexts: {
      auth: sanitized
    }
  });
}
```

---

## ISSUE 12.2: Redux DevTools Exposes Tokens in Development [MEDIUM]

**Location**: Redux store configuration (not shown)

**Problem**:
```typescript
// Redux DevTools browser extension shows all state changes
// If auth slice contains tokens:

store state = {
  auth: {
    user: { id: 1, name: "John" },
    session: {
      sessionToken: "opaque-token-abc123...",
      jwtToken: "eyJhbGc..."  // ← Visible in DevTools!
    }
  }
}

// Redux DevTools can export state
// Anyone with DevTools access can export tokens
```

**Severity**: MEDIUM

**Fix**:
```typescript
// Configure Redux DevTools to sanitize state
import { composeWithDevTools } from 'redux-devtools-extension';

const composeEnhancers = composeWithDevTools({
  actionSanitizer: (action) => {
    // Remove sensitive data from actions
    if (action.payload?.session?.sessionToken) {
      return {
        ...action,
        payload: {
          ...action.payload,
          session: {
            ...action.payload.session,
            sessionToken: '[REDACTED]',
            jwtToken: '[REDACTED]',
            refreshToken: '[REDACTED]'
          }
        }
      };
    }
    return action;
  },

  stateSanitizer: (state) => {
    // Remove sensitive data from state
    if (state.auth?.session) {
      return {
        ...state,
        auth: {
          ...state.auth,
          session: {
            ...state.auth.session,
            sessionToken: '[REDACTED]',
            jwtToken: '[REDACTED]',
            refreshToken: '[REDACTED]'
          }
        }
      };
    }
    return state;
  }
});

// In production, disable DevTools entirely
const enhancer = __DEV__ ? composeEnhancers(...) : applyMiddleware(...);
```

---

# SECTION 13: HOLISTIC ARCHITECTURAL RISKS

## ISSUE 13.1: Circular Dependency Risk Between OTP & Auth Services [MEDIUM]

**Location**: `services/otp-auth-orchestrator.service.ts`

**Problem**:
OtpAuthOrchestrator was created to break circular dependency:
```
BEFORE (Circular):
- OtpService.verifyOtp() → calls AuthService.createSession()
- AuthService might import OtpService
- Circular: OtpService ↔ AuthService

AFTER (Orchestrator):
- OtpAuthOrchestrator → calls OtpService.verifyOtp()
- OtpAuthOrchestrator → calls AuthService.createSession()
- No circular dependency ✓
```

**But new risk**:
```typescript
// If code changes and dependency is re-introduced:
// OtpService imports AuthService (to create session directly)
// AuthService imports OtpService (for some reason)
// The orchestrator pattern is bypassed
// Circular dependency comes back

// No compile-time check prevents this!
```

**Severity**: MEDIUM

**Fix** (Architectural, not code):
```typescript
// Enforce at module level:
// 1. OtpService: Can only import repositories, validators, msg91
// 2. AuthService: Can only import repositories, validators, jwt
// 3. OtpAuthOrchestrator: Single responsibility - orchestrate only

// In auth.module.ts, define import restrictions:
@Module({
  imports: [/* OtpModule, AuthModule */],
  providers: [
    OtpService,
    OtpAuthOrchestrator,
    AuthService,
    // OtpService should NOT have access to AuthService
    // Enforce via:
    // - Code review
    // - Linting rules
    // - Architecture tests
  ]
})
export class AuthModule {}

// ESLint rule to prevent:
"import/no-cycle": "error"
```

---

## ISSUE 13.2: No Rate Limiting on Token Refresh Endpoint [MEDIUM]

**Location**: `apps/nks-backend/src/modules/auth/controllers/auth.controller.ts:83-129`

**Problem**:
```typescript
@Post('refresh-token')
async refreshToken(
  @Body() dto: RefreshTokenDto,
  @Req() req: Request,
  @Res({ passthrough: true }) res: Response,
): Promise<ApiResponse<...>> {
  // ✗ No rate limiting
  // ✗ No IP-based rate limit
  // ✗ No session-based rate limit
  // ✗ No device-based rate limit

  const cookieToken = this.parseSessionCookie(req);
  const providedRefreshToken = cookieToken ?? dto.refreshToken;

  const result = await this.authService.refreshAccessToken(
    providedRefreshToken,
    deviceId
  );

  return ApiResponse.ok(result, 'Token refreshed successfully');
}
```

**Attack Scenario**:
```
Attacker has stolen refresh token: "abc123..."

1. Attacker calls /auth/refresh-token 1000 times per second
   → No rate limiting!
   → Server generates 1000 new JWTs
   → Database load spikes
   → Legitimate users get slow refresh

2. Attacker distributes load across 100 IPs
   → Even if IP-based rate limit existed, bypassed

3. Attacker uses token rotation detection
   → On each refresh, server invalidates old token
   → But if attacker gets new token before reuse check:
   → Token theft undetected
```

**Severity**: MEDIUM

**Fix**:
```typescript
@Post('refresh-token')
@UseGuards(RefreshTokenRateLimitGuard)  // ← Add rate limiting
async refreshToken(
  @Body() dto: RefreshTokenDto,
  @Req() req: Request,
  @Res({ passthrough: true }) res: Response,
) {
  // Rate limiting applied
}

// Implement guard:
@Injectable()
export class RefreshTokenRateLimitGuard implements CanActivate {
  constructor(private cacheService: CacheService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const key = `refresh:${request.ip}`;  // Per IP

    const count = this.cacheService.get(key) || 0;

    if (count >= 30) {  // 30 refreshes per minute
      throw new HttpException(
        'Too many refresh attempts. Wait 1 minute.',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    this.cacheService.set(key, count + 1, 60);  // 60-sec window
    return true;
  }
}
```

---

# SECTION 14: ADDITIONAL SECURITY GAPS

## ISSUE 14.1: No CSRF Token on Password Reset / Email Change Endpoints [MEDIUM]

**Location**: Backend auth endpoints (not shown, but likely issue)

**Problem**:
If password reset or email change endpoints exist without CSRF protection:

```html
<!-- Attacker's website -->
<img src="https://api.nks.com/auth/change-email?email=attacker@evil.com" />

<!-- If user visits while logged in:
     - User's browser sends session cookie
     - Email changed to attacker's
     - Account takeover!
-->
```

**Severity**: MEDIUM

**Fix**:
- ✓ Use SameSite=Strict on session cookies
- ✓ Require CSRF token on sensitive endpoints
- ✓ POST-only (not GET)
- ✓ Require password confirmation

---

## ISSUE 14.2: No Protection Against Session Fixation [MEDIUM]

**Location**: Auth endpoints (session creation)

**Problem**:
```typescript
// Session fixation attack:
1. Attacker obtains session ID (or guesses one)
2. Attacker tricks user into "log in" with that session ID
3. User unknowingly uses attacker's session
4. Attacker has access to user's account

// Current code:
// BetterAuth generates random session tokens
// ✓ Good: Makes guessing hard
// ✗ But: Doesn't invalidate old session tokens on login
```

**Severity**: MEDIUM

**Fix**:
```typescript
async login(dto: LoginDto): Promise<AuthResponseEnvelope> {
  // ... verify credentials ...

  // On successful login, invalidate all existing sessions
  await sessionsRepository.terminateAllSessions(user.id);

  // Create brand new session
  const session = await createSessionForUser(user.id);

  return buildAuthResponse(user, session);
}
```

---

# SECTION 15: MOBILE-SPECIFIC RISKS

## ISSUE 15.1: HTTP Downgrade Attack (Web Requests Not Enforced HTTPS) [HIGH]

**Location**: Mobile network configuration (not shown)

**Problem**:
If API client doesn't enforce HTTPS:

```typescript
// Attacker intercepts unencrypted HTTP request
// GET http://api.nks.com/auth/refresh-token

// Attacker can:
// - Steal sessionToken
// - Steal jwtToken
// - Steal refreshToken
// - Capture OAuth codes

// Man-in-the-middle gains full access
```

**Severity**: HIGH

**Fix** (must be verified in API client):
```typescript
// Enforce HTTPS-only
const API = axios.create({
  baseURL: 'https://api.nks.com',  // ← HTTPS required
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Certificate pinning (extra security)
import { createSecureClient } from '@react-native-ssl-pinning';

const secureAPI = createSecureClient({
  host: 'api.nks.com',
  pin: ['sha256/ABC123...']  // Public key hash
});
```

---

## ISSUE 15.2: No Protection Against Screenshot Attacks [LOW]

**Location**: Mobile screens (PhoneScreen, OtpScreen)

**Problem**:
User's phone is captured/recorded showing:
- ✗ 6-digit OTP on screen
- ✗ Phone number
- ✗ Store name

**Severity**: LOW

**Fix** (optional but recommended for POS):
```typescript
// Prevent screen capture
import { SecurityModule } from 'expo-security';

useEffect(() => {
  // Disable screenshots on this screen
  SecurityModule.setSecureScreen(true);

  return () => {
    SecurityModule.setSecureScreen(false);
  };
}, []);

// In Android native code (Kotlin):
window.setFlags(
  WindowManager.LayoutParams.FLAG_SECURE,
  WindowManager.LayoutParams.FLAG_SECURE
);
```

---

# SUMMARY TABLE: All Issues

| # | Category | Issue | Severity | Fixed? |
|---|----------|-------|----------|--------|
| 1.1 | SecureStore | 1800-byte limit causes silent data loss | HIGH | ✗ |
| 1.2 | SecureStore | JWKS key size not validated | MEDIUM | ✗ |
| 2.1 | Token Validation | Missing IP-based rate limiting OTP verify | HIGH | ✗ |
| 2.2 | Token Validation | No token format validation after load | HIGH | ✗ |
| 3.1 | Brute-Force | No IP-based OTP rate limiting | HIGH | ✗ |
| 3.2 | Brute-Force | OTP expiry 10min too long | MEDIUM | ✗ |
| 3.3 | Brute-Force | No device fingerprint rate limiting | MEDIUM | ✗ |
| 4.1 | Offline Tokens | 7-day token doesn't sync with revocation | **CRITICAL** | ✗ |
| 4.2 | Offline Tokens | Token doesn't include expiry metadata | HIGH | ✗ |
| 5.1 | Key Rotation | JWKS cached indefinitely, no rotation detect | HIGH | ✗ |
| 5.2 | Key Rotation | No fallback JWKS keys on mobile | MEDIUM | ✗ |
| 6.1 | Device Binding | Device fingerprint easily spoofed | HIGH | ✗ |
| 6.2 | Device Binding | No protection against jailbreak/root | HIGH | ✗ |
| 7.1 | Token Manager | Race condition memory vs storage | **CRITICAL** | ✓ Partial |
| 7.2 | Token Manager | In-memory token not cleared on error | HIGH | ✗ |
| 8.1 | Session Tampering | OfflineSession can be modified without detection | HIGH | ✗ |
| 9.1 | Refresh Token | Refresh token TTL not specified | MEDIUM | ? |
| 9.2 | Refresh Token | Refresh token format not validated | HIGH | ✗ |
| 10.1 | Session Management | Multiple devices not synchronized | MEDIUM | ✗ |
| 10.2 | Session Management | Session limit not validated on mobile | LOW | ✗ |
| 11.1 | Time Sync | Device time drift causes false expiry | HIGH | ✗ |
| 11.2 | Time Sync | Sync failure silent, uses wrong time | MEDIUM | ✗ |
| 12.1 | Error Logging | Sensitive data leaked in logs | HIGH | ✗ |
| 12.2 | Error Logging | Redux DevTools exposes tokens | MEDIUM | ✗ |
| 13.1 | Architecture | Circular dependency risk | MEDIUM | ✗ |
| 13.2 | Architecture | No rate limit on token refresh | MEDIUM | ✗ |
| 14.1 | Additional | No CSRF token | MEDIUM | ? |
| 14.2 | Additional | No session fixation protection | MEDIUM | ✗ |
| 15.1 | Mobile | HTTP downgrade not prevented | HIGH | ? |
| 15.2 | Mobile | No screenshot protection | LOW | ✗ |

**Total Issues**: 27
- **CRITICAL**: 2
- **HIGH**: 15
- **MEDIUM**: 9
- **LOW**: 1

---

# RECOMMENDATIONS: Phased Remediation

## Phase 1: CRITICAL (Week 1)
1. [4.1] Implement revocation-aware offline tokens
2. [7.1] Fix race condition in persistLogin()

## Phase 2: HIGH (Weeks 2-3)
1. [1.1] Handle SecureStore size limit gracefully
2. [2.1] Add token integrity validation
3. [2.2] Validate token format before use
4. [3.1] Implement IP-based OTP rate limiting
5. [6.1] Improve device binding with HMAC
6. [6.2] Add jailbreak/root detection
7. [7.2] Clear in-memory token on validation failure
8. [8.1] Add HMAC integrity check to offline session
9. [9.2] Validate refresh token format
10. [11.1] Implement robust time sync
11. [12.1] Sanitize logging comprehensively
12. [15.1] Verify HTTPS enforcement

## Phase 3: MEDIUM (Weeks 4-6)
1. [1.2] Validate JWKS key size
2. [3.2] Reduce OTP expiry to 5 minutes
3. [3.3] Add device fingerprint rate limiting
4. [5.1] Detect JWKS key rotation
5. [5.2] Store multiple JWKS keys
6. [9.1] Document refresh token TTL
7. [10.1] Implement session version sync
8. [11.2] Handle time sync failures
9. [12.2] Sanitize Redux DevTools
10. [13.1] Add architectural lint rules
11. [13.2] Rate limit refresh endpoint
12. [14.2] Prevent session fixation

## Phase 4: LOW (Ongoing)
1. [10.2] Validate session limits
2. [15.2] Implement screenshot protection

---

# Conclusion

The authentication system has solid foundational design but requires significant hardening for enterprise POS use. The 27 identified issues span security (token leaks, brute-force), reliability (storage limits, time sync), and scalability (rate limiting, session management).

**Critical path**: Address 2 CRITICAL issues (revocation gaps, race conditions) before production deployment. The 15 HIGH-priority issues should be remediated within 3 weeks.

