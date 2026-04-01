# Complete Authentication Flow Analysis

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Multi-Platform Auth System               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐        ┌──────────────┐                │
│  │   WEB APP    │        │  MOBILE APP  │                │
│  │ (React/Vue)  │        │ (React Native)│                │
│  └──────┬───────┘        └──────┬───────┘                │
│         │                       │                         │
│    HttpOnly Cookies       Bearer Tokens                 │
│    (SameSite=Lax)         + Secure Store                │
│    (XSS Protected)        + Offline Sync                │
│         │                       │                         │
│         └──────────┬────────────┘                         │
│                    │                                      │
│              ┌─────▼──────┐                               │
│              │ NestJS API │                               │
│              │  (Backend) │                               │
│              └─────┬──────┘                               │
│                    │                                      │
│         ┌──────────┴──────────┐                           │
│         │                     │                           │
│    ┌────▼─────────┐    ┌────▼──────────┐                │
│    │ BetterAuth   │    │ AuthGuard     │                │
│    │ Framework    │    │ (Custom)      │                │
│    │ - Sessions   │    │ - Token       │                │
│    │ - Password   │    │   Validation  │                │
│    │ - OAuth      │    │ - Role Check  │                │
│    │ - DB Adapter │    │ - Permission  │                │
│    └──────────────┘    └───────────────┘                │
│                                                          │
│              ┌─────────────────────────┐                │
│              │   PostgreSQL Database   │                │
│              │  - users                │                │
│              │  - user_session         │                │
│              │  - user_auth_provider   │                │
│              │  - user_role_mapping    │                │
│              │  - roles                │                │
│              └─────────────────────────┘                │
│                                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. USER REGISTRATION FLOW

### A. Web/Mobile Registration Entry Point

**Endpoint:** `POST /api/v1/auth/register`

**Input:**
```typescript
{
  email: string;
  password: string;        // 8+ chars, hashed with bcrypt
  name: string;
}
```

**Device Info Capture:**
```typescript
// Extracted from request headers by controller
{
  deviceId?: string;       // x-device-id header
  deviceName?: string;     // x-device-name header
  deviceType?: string;     // x-device-type: 'WEB' | 'IOS' | 'ANDROID'
  appVersion?: string;     // x-app-version header
}
```

### B. Registration Process

```
1. Validate Email
   ├─ Check if email already exists in database
   └─ Throw ConflictException if found

2. Create User (TRANSACTION)
   ├─ Generate random iamUserId (UUID)
   ├─ Create user record with:
   │  ├─ name, email
   │  ├─ emailVerified: false
   │  ├─ phoneNumberVerified: false
   │  └─ loginCount: 0
   │
   ├─ Create Email Auth Provider
   │  ├─ Provide ID: email
   │  ├─ Provider ID: 'email'
   │  ├─ Password: hashed with bcrypt (await passwordService.hash())
   │  └─ isVerified: false
   │
   └─ Assign SUPER_ADMIN Role (if first user)
      └─ Via ensureSuperAdminRole()

3. Create Session
   ├─ Call BetterAuth's internalAdapter.createSession(userId)
   ├─ BetterAuth returns: { token, expiresAt }
   ├─ Session token expires in 30 days
   ├─ BetterAuth hashes token before storing in DB
   │
   ├─ Embed Roles in Session
   │  ├─ Fetch getUserPermissions(userId)
   │  ├─ Store in userSession.userRoles as JSON
   │  ├─ Store primary role in userSession.primaryRole
   │  └─ Calculate roleHash for detecting changes
   │
   ├─ Store Device Info in Session
   │  ├─ userSession.deviceId
   │  ├─ userSession.deviceName
   │  ├─ userSession.deviceType (validated against enum)
   │  └─ userSession.appVersion
   │
   └─ Generate RS256 JWT Token
      ├─ Sign with private RSA key
      ├─ Embed claims:
      │  ├─ sub: userId
      │  ├─ email: user.email
      │  ├─ roles: [roleCode, ...]
      │  ├─ primaryRole: roleCode
      │  ├─ stores: [{id, name}, ...]
      │  ├─ activeStoreId: storeId
      │  ├─ iss: BETTER_AUTH_BASE_URL
      │  └─ aud: 'nks-app'
      └─ JWT expires in same period as session (30 days)

4. Create Token Pair (for mobile)
   ├─ accessToken: BetterAuth session token
   ├─ refreshToken: Long-lived token (stored in userRefreshToken)
   └─ Allows token refresh without full re-login

5. Return AuthResponse
   ├─ user: { id, email, name, phoneNumber, image, ... }
   ├─ session:
   │  ├─ sessionToken: BetterAuth token (for API calls)
   │  ├─ expiresAt: Date (30 days from now)
   │  ├─ accessToken: alias for sessionToken (backward compat)
   │  └─ jwtToken: RS256 JWT (for offline validation)
   ├─ refreshToken: Long-lived token
   └─ access: { isSuperAdmin, activeStoreId, roles, initialRoute }
```

### C. Web Response Handling

```typescript
// Controller receives response
const result = await this.authService.register(dto, deviceInfo);

// Sets httpOnly cookie
res.cookie('nks_session', result.session.accessToken, {
  httpOnly: true,       // ✅ XSS Protection: JS cannot access
  sameSite: 'lax',      // ✅ CSRF Protection
  secure: NODE_ENV === 'production',  // HTTPS only in production
  maxAge: 30 * 24 * 60 * 60 * 1000,   // 30 days
  path: '/',
});
```

### D. Mobile Response Handling

```typescript
// Mobile app receives response
const response = await apiClient.auth.register(email, password, name);

// Saves tokens to encrypted storage
await SecureSessionStorage.saveToken(
  response.session.sessionToken,      // ✅ Main token for API calls
  new Date(response.session.expiresAt),
  response.session.jwtToken            // ✅ JWT for offline validation
);

// Saves user data to Redux + AsyncStorage
await SecureSessionStorage.saveUserData(response.user);
```

---

## 2. LOGIN FLOW

### A. Web Login

**Endpoint:** `POST /api/v1/auth/login`

```typescript
async login(dto: LoginDto, deviceInfo?) {
  // 1. Find user by email
  const user = await db.select()
    .from(schema.users)
    .where(eq(schema.users.email, dto.email));

  // 2. Check if account is locked (brute-force protection)
  if (user.accountLockedUntil > now) {
    throw UnauthorizedException('Account locked until...');
  }

  // 3. Auto-unlock if lockout period expired
  if (user.accountLockedUntil < now) {
    await db.update(schema.users)
      .set({
        accountLockedUntil: null,
        failedLoginAttempts: 0
      });
  }

  // 4. Get email auth provider + verify password
  const provider = await db.select()
    .from(schema.userAuthProvider)
    .where(and(
      eq(schema.userAuthProvider.userId, user.id),
      eq(schema.userAuthProvider.providerId, 'email')
    ));

  const isValid = await passwordService.compare(
    dto.password,
    provider.password
  );

  // 5. Handle failed login attempt
  if (!isValid) {
    const newFailedCount = user.failedLoginAttempts + 1;
    const shouldLock = newFailedCount >= 5; // MAX_FAILED_ATTEMPTS

    await db.update(schema.users).set({
      failedLoginAttempts: newFailedCount,
      accountLockedUntil: shouldLock
        ? new Date(Date.now() + 15 * 60 * 1000)  // 15 min lockout
        : null
    });

    throw UnauthorizedException('Invalid credentials');
  }

  // 6. Successful login (TRANSACTION)
  await db.transaction(async () => {
    await db.update(schema.users).set({
      failedLoginAttempts: 0,
      accountLockedUntil: null,
      loginCount: user.loginCount + 1,    // Increment login counter
      lastLoginAt: new Date(),
      lastActiveAt: new Date(),
    });

    await ensureSuperAdminRole(user.id);  // Ensure SUPER_ADMIN exists
  });

  // 7. Create session (same as registration)
  const session = await createSessionForUser(user.id, deviceInfo);

  // 8. Create token pair
  const tokenPair = await createTokenPair(user.id);

  // 9. Return response
  return buildAuthResponse(user, session.token, session.expiresAt, tokenPair);
}
```

### B. Login Response Flow

**Web:**
```typescript
// Sets httpOnly cookie + returns response
res.cookie('nks_session', sessionToken, { httpOnly: true, ... });
return ApiResponse.ok(result);

// Browser automatically stores cookie
// Subsequent requests include cookie automatically
```

**Mobile:**
```typescript
// Saves to encrypted storage
await SecureSessionStorage.saveToken(sessionToken, expiresAt, jwtToken);

// Initializes sync service
SyncService.watchConnectivity();  // Auto-sync when online
```

---

## 3. REQUEST AUTHENTICATION

### A. How Tokens Are Sent

```
WEB:
  Cookie: nks_session=<token>    [Automatic, httpOnly, JS cannot access]

MOBILE:
  Authorization: Bearer <token>  [Explicit header]
```

### B. AuthGuard Flow

**File:** `auth.guard.ts`

```typescript
async canActivate(context: ExecutionContext): Promise<boolean> {
  const request = context.switchToHttp().getRequest();

  // ✅ Step 1: Extract token from EITHER source
  const authHeader = request.headers.authorization || '';
  const bearerToken = authHeader.replace('Bearer ', '').trim();

  // Try parsed cookies first (cookie-parser middleware)
  const nksSessionCookie = request.cookies?.nks_session
    || this.extractNksSessionCookie(request);

  const sessionToken = bearerToken || nksSessionCookie;

  if (!sessionToken) {
    throw UnauthorizedException('No token in header or cookie');
  }

  // ✅ Step 2: Validate token directly from database
  // (BetterAuth's getSession() has issues, so we do direct DB lookup)
  const [dbSession] = await db
    .select()
    .from(schema.userSession)
    .where(eq(schema.userSession.token, sessionToken));

  if (!dbSession) {
    throw UnauthorizedException('Invalid or expired session token');
  }

  // ✅ Step 3: Check if session has expired
  if (dbSession.expiresAt < new Date()) {
    throw UnauthorizedException('Session has expired');
  }

  // ✅ Step 4: Fetch user data
  const [dbUser] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, dbSession.userId));

  if (!dbUser) {
    throw UnauthorizedException('User not found for session');
  }

  // ✅ Step 5: Check if account is blocked
  if (dbUser.isBlocked) {
    // Delete all sessions for blocked user
    await db.delete(schema.userSession)
      .where(eq(schema.userSession.userId, dbUser.id));

    throw UnauthorizedException(
      `Account is blocked: ${dbUser.blockedReason}`
    );
  }

  // ✅ Step 6: Attach user to request
  (request as AuthenticatedRequest).user = {
    id: String(dbUser.id),
    userId: Number(dbUser.id),
    name: dbUser.name,
    email: dbUser.email,
    phoneNumber: dbUser.phoneNumber,
    phoneNumberVerified: dbUser.phoneNumberVerified,
    isBlocked: dbUser.isBlocked,
    // ... other fields
  };

  // ✅ Step 7: Attach session data to request
  (request as AuthenticatedRequest).session = {
    id: String(dbSession.id),
    token: dbSession.token,
    expiresAt: dbSession.expiresAt,
  };

  // ✅ Step 8: Update lastActiveAt (fire-and-forget)
  fireAndForgetWithRetry(async () => {
    await db.update(schema.users)
      .set({ lastActiveAt: new Date() })
      .where(eq(schema.users.id, dbUser.id));
  });

  return true;
}
```

---

## 4. TOKEN REFRESH FLOW

### A. Mobile Token Expiry Detection

```typescript
// In authenticatedFetch() when making API call
const token = await SecureSessionStorage.getToken();

if (response.status === 401) {
  // Token expired, attempt refresh
  const refreshed = await SyncService.refreshToken();

  if (refreshed) {
    // Retry original request with new token
    return authenticatedFetch(endpoint, options);
  } else {
    // Refresh failed, user must re-login
    throw Error('Session expired. Please login again.');
  }
}
```

### B. Token Refresh Endpoint

**Endpoint:** `POST /api/v1/auth/refresh-token`

```typescript
async refreshToken(oldToken: string): Promise<{ token, expiresAt }> {
  // 1. Validate old token via BetterAuth
  const session = await this.auth.api.getSession({
    headers: { authorization: `Bearer ${oldToken}` }
  });

  if (!session || !session.user) {
    throw UnauthorizedException('Invalid or expired token');
  }

  // 2. Check if session is expired
  if (new Date(session.session.expiresAt) < new Date()) {
    throw UnauthorizedException('Session has expired');
  }

  // 3. ✅ Detect if roles have changed (ISSUE #2 FIX)
  const storedRoleHash = session.session?.roleHash;

  if (storedRoleHash) {
    const currentRoles = await getUserPermissions(userId);
    const currentRoleHash = hashRoles(currentRoles.roles);

    if (storedRoleHash !== currentRoleHash) {
      // Roles changed! Invalidate ALL sessions
      await invalidateUserSessions(userId);
      throw UnauthorizedException(
        'Your roles have been updated. Please re-login.'
      );
    }
  }

  // 4. Create new session for same user
  return createSessionForUser(userId);
}
```

**Why separate from login?**
- Users can refresh without entering credentials again
- Mobile offline sync can refresh when coming online
- Automatic refresh happens transparently in `authenticatedFetch()`

---

## 5. OFFLINE SYNC FLOW (Mobile)

### A. Request Queueing

```typescript
// In authenticatedFetch() when offline
if (!isOnline && method !== 'GET' && !skipQueue) {
  // Queue mutations (POST/PUT/DELETE)
  await SyncService.queueRequest(method, endpoint, payload);

  // Return optimistic response
  return {
    status: 'success',
    data: { id: 'temp_' + Date.now(), ...payload },
    message: 'Queued for sync'
  };
}
```

**Queued Request Format:**
```typescript
interface QueuedRequest {
  id: string;                          // Unique ID
  method: 'POST' | 'PUT' | 'DELETE';
  endpoint: string;                    // e.g., '/api/v1/orders'
  payload?: Record<string, any>;       // Request body
  headers?: Record<string, string>;    // Custom headers
  timestamp: number;                   // When queued
  retryCount: number;                  // Retry attempts (max 5)
  lastError?: string;                  // Last error message
}
```

**Storage:** `AsyncStorage.setItem('offline.sync_queue', JSON.stringify(queue))`

### B. Auto-Sync When Online

```typescript
// In SyncService.watchConnectivity()
NetInfo.addEventListener((state) => {
  if (state.isConnected && state.isInternetReachable) {
    console.log('📡 Device online! Starting auto-sync...');
    SyncService.syncQueue();  // Auto-sync queued requests
  }
});
```

### C. Sync Process

```typescript
async syncQueue() {
  // 1. Check connectivity
  const state = await NetInfo.fetch();
  if (!state.isConnected) {
    return { success: false, synced: 0, failed: 0, remaining: 0 };
  }

  // 2. Get auth token
  const token = await SecureSessionStorage.getToken();
  if (!token) {
    return { success: false }; // User must login
  }

  // 3. Get queue from AsyncStorage
  const queue = await SyncService.getQueue();
  if (queue.length === 0) {
    return { success: true, synced: 0, failed: 0, remaining: 0 };
  }

  let synced = 0;
  let failed = 0;
  const failed_requests = [];

  // 4. Process each queued request
  for (const request of queue) {
    try {
      const response = await fetch(
        `${API_URL}${request.endpoint}`,
        {
          method: request.method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...request.headers,
          },
          body: request.method !== 'GET'
            ? JSON.stringify(request.payload)
            : undefined,
        }
      );

      // 5. Handle 401 (token expired)
      if (response.status === 401) {
        const refreshed = await SyncService.refreshToken();
        if (refreshed) {
          failed_requests.push(request);  // Retry this request
        } else {
          return { success: false };      // Force re-login
        }
      }

      // 6. Handle other errors
      else if (!response.ok) {
        failed_requests.push({
          ...request,
          retryCount: request.retryCount + 1,
          lastError: `HTTP ${response.status}`
        });
        failed++;
      } else {
        synced++;  // Success
      }
    } catch (error) {
      failed_requests.push({
        ...request,
        retryCount: request.retryCount + 1,
        lastError: String(error)
      });
      failed++;
    }
  }

  // 7. Filter out requests that exceeded max retries (5)
  const finalQueue = failed_requests.filter(
    req => req.retryCount < 5
  );

  const droppedCount = failed_requests.length - finalQueue.length;
  if (droppedCount > 0) {
    console.warn(`⚠️ Dropped ${droppedCount} requests (exceeded max retries)`);
  }

  // 8. Save updated queue
  await AsyncStorage.setItem(
    'offline.sync_queue',
    JSON.stringify(finalQueue)
  );

  const remaining = finalQueue.length;
  return { success: remaining === 0, synced, failed, remaining };
}
```

---

## 6. LOGOUT FLOW

### A. Web Logout

```typescript
async logout(token: string) {
  // 1. Validate token via BetterAuth
  const session = await this.auth.api.getSession({
    headers: { authorization: `Bearer ${token}` }
  });

  if (!session) {
    throw UnauthorizedException('Invalid session token');
  }

  // 2. Delete ALL sessions for user (clean logout)
  await db.delete(schema.userSession)
    .where(eq(schema.userSession.userId, session.user.id));

  // 3. Clear httpOnly cookie
  res.clearCookie('nks_session', { path: '/' });
}
```

### B. Mobile Logout

```typescript
const handleLogout = async () => {
  // 1. Attempt server logout (best-effort, may fail if offline)
  try {
    await apiClient.auth.logout();
  } catch (error) {
    console.warn('⚠️ Server logout failed (may be offline)');
  }

  // 2. Clear encrypted secure storage
  await SecureSessionStorage.clearToken();

  // 3. Clear offline sync queue
  await SyncService.clearQueue();

  // 4. Update Redux state
  dispatch(logoutThunk());

  // 5. Navigate to login
  router.replace('/(auth)/phone');
};
```

---

## 7. ROLE-BASED ACCESS CONTROL

### A. Role Assignment Flow

```
User Registration
    ↓
Auto-assign SUPER_ADMIN (if first user)
    ↓
User chooses context
    ├─ "Personal" → assignRoleToUser(CUSTOMER)
    └─ "Store" → accepts invite or creates store
                 ├─ If STORE_OWNER → auto-assigned
                 └─ If invited → gets assigned role
```

### B. Permission Fetching

```typescript
async getUserPermissions(userId: number) {
  // Fetch all roles for user
  const userRoles = await rolesRepository
    .findUserRolesWithCompany(userId);

  // Map to role entries with store context
  const roleEntries = userRoles.map(r => ({
    roleCode: r.roleCode,           // e.g., 'STORE_OWNER'
    roleId: r.roleId,
    storeId: r.storeId,
    storeName: r.storeName,
    companyId: r.companyId,
    isPrimary: r.isPrimary,
  }));

  // Fetch permissions for each role
  const permissions = await rolesRepository
    .findPermissionsByRoles(roleIds);

  return {
    roles: roleEntries,
    permissionCodes: permissions.map(p => p.code),
    isSuperAdmin: roleEntries.some(r => r.roleCode === 'SUPER_ADMIN'),
    activeStoreId: roleEntries[0]?.storeId,
  };
}
```

### C. Store Context Switching

```typescript
async switchStore(userId: number, storeId: number) {
  // 1. Verify user has role in this store
  const [storeRole] = await db
    .select({ roleFk: schema.userRoleMapping.roleFk })
    .from(schema.userRoleMapping)
    .where(and(
      eq(schema.userRoleMapping.userFk, userId),
      eq(schema.userRoleMapping.storeFk, storeId),
    ));

  if (!storeRole) {
    throw UnauthorizedException(
      'You do not have a role in this store'
    );
  }

  // 2. Update session with new active store
  await db.update(schema.userSession)
    .set({ activeStoreFk: storeId })
    .where(eq(schema.userSession.userId, userId));

  // 3. Return permissions scoped to this store
  return {
    access: {
      isSuperAdmin: false,
      activeStoreId: storeId,
      roles: storeRoles,
      initialRoute: '/store/dashboard',
    },
    routes: storeRoutes,
    permissions: storePermissions,
  };
}
```

### D. Mobile Role-Based UI

```typescript
// useActiveStoreRole() hook reads from Redux
const { activeRole, menuItems } = useActiveStoreRole();

// ROLE_MENU_MAP controls what each role sees
const ROLE_MENU_MAP = {
  STORE_OWNER: ['Dashboard', 'Products', 'Orders', 'Staff', 'Settings'],
  STORE_MANAGER: ['Dashboard', 'Products', 'Orders'],
  CASHIER: ['POS', 'Orders'],
  DELIVERY: ['Deliveries'],
  CUSTOMER: ['Dashboard'],
};

// Drawer renders based on activeRole
menuItems.map(item => <MenuButton key={item.route} {...item} />)
```

---

## 8. SECURITY FEATURES

### A. XSS Protection

```typescript
// ✅ Web: HttpOnly cookies
res.cookie('nks_session', token, {
  httpOnly: true,  // JS cannot access via document.cookie
  sameSite: 'lax',
  secure: NODE_ENV === 'production',
  path: '/',
});

// ❌ Tokens never in localStorage
// localStorage.setItem('token', ...);  // NEVER DO THIS

// ✅ Mobile: Encrypted secure storage
await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
// Token stored in:
// - Android: EncryptedSharedPreferences (AES-256)
// - iOS: Keychain
```

### B. CSRF Protection

```typescript
// HttpOnly cookies with SameSite=Lax
// Browser will NOT send cookie on cross-site requests

// For mutations, implement token validation:
// - CSRF token in header for web
// - Bearer token validation for mobile (implicit)
```

### C. Brute-Force Protection

```typescript
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

if (failedLoginAttempts >= 5) {
  accountLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
  // Account locked for 15 minutes
  // Auto-unlock when time expires on next login attempt
}
```

### D. Token Hashing

```typescript
// BetterAuth configuration
session: {
  hashSessionToken: true,  // ✅ Tokens hashed in DB
}

// If DB is leaked, tokens are still protected
// Only the running app has raw tokens
```

### E. JWT Signature Verification

```typescript
// Backend signs with RS256 (asymmetric)
const jwtToken = jwtConfigService.signToken({
  sub: String(userId),
  email: user.email,
  roles: userRoles.map(r => r.roleCode),
  // ...
});

// Mobile verifies signature offline
// Fetch public key from: GET /.well-known/jwks.json
// Verify signature using RS256 public key
// No network call needed for offline validation
```

### F. Role Hash Detection

```typescript
// When token is created, calculate hash of roles
const roleHash = hashRoles(userRoles);
// Store in session (in-memory, not persisted)

// On token refresh, check if roles changed
const storedHash = session.session?.roleHash;
const currentHash = hashRoles(currentRoles);

if (storedHash !== currentHash) {
  // Roles changed! Invalidate ALL sessions
  await invalidateUserSessions(userId);
  throw UnauthorizedException('Roles updated, please re-login');
}
```

---

## 9. AUTHENTICATION STATE MANAGEMENT

### A. Mobile Redux State

```typescript
// useAuth() hook provides current auth state
const authState = useAuth();

{
  isLoggedIn: boolean;
  user: StoredUser | null;
  loading: boolean;
  error: string | null;
  isOnline: boolean;
  pendingSync: number;

  // Methods
  register: (email, password, name) => Promise<void>;
  login: (email, password) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  syncNow: () => Promise<SyncResult>;
}
```

### B. Initialization on App Start

```typescript
async initializeApp() {
  // 1. Check if user is logged in
  const isLoggedIn = await SecureSessionStorage.isLoggedIn();

  // 2. Setup connectivity monitoring
  const unsubscribeNetInfo = SyncService.watchConnectivity();

  // 3. Sync any pending requests
  if (isLoggedIn) {
    const queue = await SyncService.getQueue();
    if (queue.length > 0) {
      await SyncService.syncQueue();
    }
  }

  // 4. Setup app resume sync
  setupAppResumeSync();  // Sync when user brings app to foreground

  return () => {
    unsubscribeNetInfo?.();
  };
}
```

---

## 10. TOKEN LIFETIMES

```
Session Token:
├─ Lifetime: 30 days
├─ Stored: BetterAuth database (hashed)
├─ Client Storage:
│  ├─ Web: httpOnly cookie
│  └─ Mobile: Encrypted SecureStore
├─ Validation: Direct DB lookup (AuthGuard)
└─ Refresh: POST /auth/refresh-token

Refresh Token:
├─ Lifetime: Long-lived (configurable)
├─ Stored: userRefreshToken table
├─ Purpose: Allow mobile to refresh without password
└─ Usage: OAuth flows, mobile token refresh

JWT Token:
├─ Lifetime: 30 days
├─ Stored: Mobile SecureStore
├─ Signed: RS256 (asymmetric)
├─ Public Key: GET /.well-known/jwks.json
├─ Purpose: Offline token validation
├─ Validation: Mobile can verify signature locally
└─ Use Case: JWT claims check without server call
```

---

## 11. ERROR SCENARIOS & RECOVERY

### A. Expired Token

```
Web:
1. User makes request with expired cookie
2. AuthGuard rejects (expiresAt < now)
3. Frontend catches 401
4. Redirects to login
5. User re-authenticates

Mobile (Online):
1. User makes request with expired token
2. authenticatedFetch() gets 401
3. Calls SyncService.refreshToken()
4. Token refreshed automatically
5. Retry original request transparently
6. User doesn't notice

Mobile (Offline):
1. Request queued in AsyncStorage
2. Device comes online
3. SyncQueue processes request
4. If 401: Attempt refresh
5. If refresh succeeds: Retry queued request
6. If refresh fails: Require re-login
```

### B. Role Change

```
Scenario: Admin removes user's access while logged in

Detection:
1. User makes request
2. AuthGuard validates token
3. Token is still valid
4. User is still authenticated
5. But... how is role change detected?

Current Limitation:
- Role change detected only on token refresh
- If user doesn't refresh, they keep old access
- Solution: Proactive role change notification (not yet implemented)

Better Solution:
- WebSocket: Notify clients of role changes
- Force logout on role change
- Or: Check role hash periodically (polling)
```

### C. Account Blocked

```
1. User makes request with valid token
2. AuthGuard checks isBlocked flag
3. If isBlocked === true:
   - Delete ALL sessions for user
   - Throw UnauthorizedException with reason
   - User force-logged out
   - Frontend redirects to login
```

### D. Offline Sync Failure

```
Request queued but fails to sync:

Retry Strategy:
├─ Attempt 1: Retry immediately
├─ Attempt 2: Wait 2 seconds
├─ Attempt 3: Wait 4 seconds
├─ Attempt 4: Wait 8 seconds
├─ Attempt 5: Wait 16 seconds
└─ After 5 attempts: Drop request
   (User sees: "Failed to sync X requests")

Permanent Failures:
- HTTP 400/422: Validation error (don't retry)
- HTTP 401: Refresh token, then retry once
- HTTP 403: Authorization error (don't retry)
- HTTP 500+: Server error (retry with backoff)
- Network error: Retry with exponential backoff

Max Retries: 5 per request
```

---

## 12. SUMMARY TABLE

| Feature | Web | Mobile |
|---------|-----|--------|
| **Auth Method** | HttpOnly Cookies | Bearer Token |
| **Storage** | Browser (automatic) | Encrypted SecureStore |
| **XSS Risk** | Protected (httpOnly) | Protected (SecureStore) |
| **Offline Support** | No | Yes (with queue) |
| **Token Auto-Refresh** | Manual (401) | Automatic |
| **Session Validation** | Direct DB lookup | Direct DB lookup |
| **JWT Validation** | Server-only | Client + Server |
| **Device Tracking** | Limited | Full (device info stored) |
| **Sync Queue** | N/A | AsyncStorage |
| **Auto-Sync on Online** | N/A | Yes (NetInfo) |

---

## 13. IMPLEMENTATION CHECKLIST

### Backend ✅
- [x] BetterAuth integration with custom plugins
- [x] Dual authentication (cookie + bearer)
- [x] Session token hashing (BetterAuth)
- [x] JWT RS256 signing + embedding
- [x] Role-based permissions
- [x] Device tracking
- [x] Brute-force protection (5 attempts, 15 min lockout)
- [x] Token refresh with role change detection
- [x] Account blocking
- [x] AuthGuard (direct DB lookup)

### Web ✅
- [x] HttpOnly cookie support
- [x] Automatic cookie sending
- [x] 401 error handling
- [x] Redirect to login on auth error

### Mobile ✅
- [x] SecureStore encrypted storage
- [x] Bearer token injection
- [x] Offline sync with queueing
- [x] Auto-sync on connectivity change
- [x] Token refresh on 401
- [x] Device tracking headers
- [x] JWT offline validation capability
- [x] AppState sync on resume
- [x] Exponential backoff retry

### Role-Based Access ✅
- [x] Store context switching
- [x] Role-based drawer menus
- [x] Permission filtering
- [x] Account type selection (Personal/Store)
- [x] Invite acceptance

