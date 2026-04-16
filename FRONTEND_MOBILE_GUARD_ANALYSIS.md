# Frontend/Mobile Guard Analysis & Backend Comparison

## Executive Summary

The **backend has a sophisticated RBAC (Role-Based Access Control) system with entity-level permissions**, but the **frontend/mobile implementation is basic and incomplete**. There's a significant gap between what the backend guards validate and what the frontend enforces.

- **Backend Guards**: 4 guards (Auth, RBAC, Role, EntityPermission) with entity-level permission checking
- **Frontend Guards**: 3 basic component wrappers (Auth, Tenant, Admin) with only role/authentication checks
- **Critical Gap**: Entity permissions are never fetched or cached in frontend
- **Permission Snapshot Endpoints**: Defined in API but never called
- **Offline Permissions**: Mobile only caches roles, not granular entity permissions
- **Effort to Align**: 10-15 hours across web and mobile codebases

---

## 1. BACKEND GUARD ARCHITECTURE

### 1.1 Backend Guards (4 Specialized Guards)

**Location**: `/Users/saran/ayphen/projects/nks/apps/nks-backend/src/common/guards/`

#### Guard 1: AuthGuard (auth.guard.ts)
```typescript
Purpose: Validate and load user session

What it does:
- Extracts session token from cookies or Authorization header
- Validates token against database
- Loads user data, roles, and store associations
- Populates request.user and request.session
- Throws UnauthorizedException on invalid token

Applied to: All protected routes (via @UseGuards(AuthGuard))

Returns to route handler:
{
  user: { id, guuid, name, email, phoneNumber, isSuperAdmin },
  session: { sessionId, sessionToken, refreshToken, jwtToken },
  roles: [
    { roleCode: 'CASHIER', storeId: 1, storeName: 'Store A', isPrimary: true },
    { roleCode: 'MANAGER', storeId: 1, storeName: 'Store A', isPrimary: false },
  ],
  activeStoreId: 1
}
```

#### Guard 2: RBACGuard (rbac.guard.ts) - **MOST IMPORTANT**
```typescript
Purpose: Enforce role-based and entity-level permission access control

Uses decorators:
@Roles('SUPER_ADMIN', 'MANAGER')  // Required role codes
@RequireEntityPermission({ entity: 'INVOICE', action: 'create' })  // Entity permission

Logic flow:
1. Check if user.isSuperAdmin = true → GRANT (bypass everything)
2. Check if user.activeStoreId is set → set permission scope
3. Get required roles from @Roles() decorator
4. If role required, check user.roles includes that role in activeStoreId
5. If entity permission required, query UserEntityPermissionRepository
   - Get all permissions for user in activeStoreId
   - Check deny flag first (deny === true → DENY)
   - Then check action flag (canCreate, canEdit, canDelete, etc.)
6. Grant or Deny based on results

Applied to: Mutation endpoints (POST, PUT, DELETE)

Key concept - Deny Override:
- If deny === true for an entity, user CANNOT perform action
- Even if general grant is true
- This prevents accidental access grants via permissions hierarchy

Example from code:
const permission = userPermissions.find(p => p.entityCode === 'INVOICE');
if (permission?.deny) throw new ForbiddenException();
if (!permission?.canCreate) throw new ForbiddenException();
```

#### Guard 3: RoleGuard (role.guard.ts)
```typescript
Purpose: Lightweight role-only check (when entity permissions not needed)

Usage: For routes that only need role validation
- @Roles('MANAGER', 'ADMIN')
- No entity-level granularity

Applied to: GET endpoints, simple resource access

Logic:
1. Check if user.isSuperAdmin = true → GRANT
2. Check if user.roles array includes required role in activeStoreId
3. Grant or Deny
```

#### Guard 4: EntityPermissionGuard (entity-permission.guard.ts)
```typescript
Purpose: Standalone entity permission check

Usage: For complex permission scenarios
- @RequireEntityPermission({ entity: 'INVOICE', action: 'approve' })

Applied to: Critical workflows, administrative actions

Same logic as RBACGuard but focused only on entity permissions
```

### 1.2 Permission Data Structure in Backend

**UserRole (from AuthResponse)**:
```typescript
{
  roleCode: 'CASHIER' | 'MANAGER' | 'SUPER_ADMIN' | etc.,
  storeId: number,
  storeName: string,
  isPrimary: boolean,
  assignedAt: Date
}
```

**EntityPermission (from RoleEntityPermissionRepository)**:
```typescript
{
  entityCode: 'INVOICE' | 'CUSTOMER' | 'PRODUCT' | etc.,
  actionCode: 'create' | 'read' | 'update' | 'delete' | 'approve',
  canRead: boolean,
  canCreate: boolean,
  canEdit: boolean,
  canDelete: boolean,
  canApprove: boolean,
  deny: boolean,  // IMPORTANT: Deny overrides all grants
  grantedAt: Date
}
```

---

## 2. FRONTEND GUARD IMPLEMENTATIONS

### 2.1 Web Frontend Guards

**Location**: `/Users/saran/ayphen/projects/nks/libs-web/web-utils/src/guards/`

#### Guard 1: app-guard.tsx
```typescript
Purpose: Check if user is authenticated

Current Implementation:
export const AppGuard = ({ children }: Props) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) return <Spinner />;
  if (!isAuthenticated) return <Navigate to="/login" />;
  
  return children;
};

What it checks:
- Just checks isAuthenticated boolean flag
- Does NOT validate token
- Does NOT check if session is still valid server-side

Issues:
- User might be logged in locally but session revoked server-side
- No server-side session validation
```

#### Guard 2: tenant-guard.tsx
```typescript
Purpose: Check if user has selected an active store

Current Implementation:
export const TenantGuard = ({ children }: Props) => {
  const { user } = useAuth();
  const activeStoreId = user?.access?.activeStoreId;
  
  if (!activeStoreId) return <Navigate to="/select-store" />;
  
  return children;
};

What it checks:
- Only checks if activeStoreId exists in state
- Does NOT validate it matches user's stores
- Does NOT validate it in API calls

Issues:
- Frontend assumes activeStoreId is valid
- Backend's RBACGuard will use this for entity permission scope
- If mismatch, permission checks might fail or succeed incorrectly
```

#### Guard 3: admin-guard.tsx
```typescript
Purpose: Check if user is SUPER_ADMIN

Current Implementation:
export const AdminGuard = ({ children }: Props) => {
  const { user } = useAuth();
  const isAdmin = user?.access?.isSuperAdmin === true;
  
  if (!isAdmin) return <Navigate to="/unauthorized" />;
  
  return children;
};

What it checks:
- Only checks isSuperAdmin flag from auth response
- Does NOT check other admin roles (e.g., MANAGER with entity permissions)
- Does NOT apply bypass logic to all routes

Issues:
- Too restrictive (MANAGER might also admin some entities)
- Doesn't match backend's "isSuperAdmin bypasses RBACGuard" pattern
- Backend allows MANAGER to access resources based on entity permissions
- Frontend blocks unless explicitly SUPER_ADMIN
```

---

## 3. CRITICAL GAPS: WHAT FRONTEND IS MISSING

### Gap 1: Entity Permissions Are Never Fetched or Cached ❌ CRITICAL

**Backend Provides**:
```typescript
// In api-data.ts
GET_PERMISSIONS_SNAPSHOT: "auth/permissions-snapshot"  // Full permissions
GET_PERMISSIONS_DELTA: "auth/permissions-delta"  // Incremental updates
```

**Frontend Definition** (exists but unused):
```typescript
// In apps/nks-web/lib/thunks/auth-thunk.ts
export const getPermissionsSnapshot = GET_PERMISSIONS_SNAPSHOT.generateAsyncThunk(...)
export const getPermissionsDelta = GET_PERMISSIONS_DELTA.generateAsyncThunk(...)
```

**Frontend Usage**: **NEVER CALLED**
- AuthProvider only calls `getMe()` on login
- Permission snapshot is never fetched
- Permission delta is never fetched
- Permission data is never stored in Redux
- Guards never check permissions

**Impact**:
- Frontend doesn't know what actions user can perform
- Backend will return 403 for actions user can't do
- Frontend has no way to hide/disable unauthorized buttons
- User experience is poor (attempt action → fail → confusion)

**What Should Happen**:
```
User Login
  ↓
AuthProvider.getMe() ✅ [Currently happens]
  ↓
AuthProvider.getPermissionsSnapshot() ❌ [Should happen but doesn't]
  ↓
Redux state has user + roles + permissions
  ↓
Guards can check permissions
  ↓
UI can disable unauthorized buttons
```

### Gap 2: No Entity Permission Checking in Guards ❌ CRITICAL

**Backend**:
```typescript
@UseGuards(RBACGuard)
@Roles('CASHIER', 'MANAGER')
@RequireEntityPermission({ entity: 'INVOICE', action: 'create' })
createInvoice() { ... }

// Backend checks:
// 1. User authenticated? Yes
// 2. User has CASHIER or MANAGER? Yes
// 3. User in activeStoreId? Yes
// 4. User has canCreate permission for INVOICE in that store? → Query DB
```

**Frontend**:
```typescript
// Guards available:
<AdminGuard>  // Only checks isSuperAdmin
<TenantGuard>  // Only checks activeStoreId exists
<AppGuard>  // Only checks authenticated

// What frontend should check:
// 1. User authenticated? ✅
// 2. User has required role? ❌ Not checked
// 3. User in activeStoreId? ✅
// 4. User has entity permission? ❌ Not checked
```

**Impact**:
- Frontend can't prevent unauthorized button clicks
- User attempts action → API fails with 403
- Poor UX compared to showing "unauthorized" immediately

### Gap 3: No Permission Revocation Detection ❌ CRITICAL

**Scenario**:
1. Admin removes user's "can create invoice" permission
2. User still has old permission cached in frontend
3. User clicks "Create Invoice" button
4. API returns 403
5. Frontend doesn't know permissions changed
6. Frontend doesn't refresh permissions
7. User retries, still gets 403, confused

**Backend**: No websocket/push mechanism to notify of revocation

**Frontend**: Should handle 403 by refreshing permissions

**What Should Happen**:
```typescript
axios interceptor:
  response 403?
    → Check if it's permission-related (via error code)
    → Call getPermissionsSnapshot() again
    → Update Redux state
    → Retry request
```

### Gap 4: Mobile Offline Permissions Only Store Roles ❌ INCOMPLETE

**Backend Offline Session Expected**:
```typescript
{
  roles: ['CASHIER', 'MANAGER'],
  permissions: {
    'INVOICE': { canCreate: true, canEdit: true, canDelete: false, deny: false },
    'CUSTOMER': { canCreate: false, canEdit: false, canDelete: false, deny: false },
  },
  signature: "HMAC(roles + permissions + userId + storeId)"
}
```

**Mobile Offline Session Current**:
```typescript
// offlineToken/offlineSessionSignature contains only:
{
  roles: ['CASHIER', 'MANAGER'],
  // NO entity permissions
  signature: "HMAC(roles + userId)" // Doesn't include permissions
}
```

**Impact**:
- Mobile offline write-guard only checks `roles.includes(requiredRole)`
- Doesn't check `permissions[entity].canCreate`
- User might queue offline INVOICE CREATE that will fail when going online
- Backend's RBACGuard will reject it

---

## 4. ARCHITECTURE COMPARISON TABLE

| Feature | Backend Guard | Frontend Web | Frontend Mobile | Status |
|---|---|---|---|---|
| **Authentication** | AuthGuard validates token | AppGuard checks flag | Token interceptor | ✅ Aligned |
| **Role Validation** | RBACGuard + @Roles() | Only AdminGuard SUPER_ADMIN | write-guard checks roles | ⚠️ Incomplete |
| **Entity Permissions** | RBACGuard queries DB | **NONE** | **NONE** | ❌ CRITICAL |
| **Super Admin Bypass** | First check in RBACGuard | AdminGuard only | None | ⚠️ Incomplete |
| **Active Store Scope** | Used for entity permission queries | TenantGuard validates exists | Offline session includes | ⚠️ Partial |
| **Permission Caching** | Per-request from DB | **Not cached at all** | **Not cached at all** | ❌ MISSING |
| **Permission Versioning** | Not implemented | Not tracked | Not tracked | ❌ MISSING |
| **Revocation Detection** | N/A | 403 ignored after 401 | 403 triggers refresh | ⚠️ Inconsistent |
| **Offline Signature** | N/A | N/A | Roles only | ⚠️ Incomplete |

---

## 5. HTTP INTERCEPTOR ANALYSIS

### 5.1 Web Interceptors (axios-interceptors.ts)

**Location**: `/Users/saran/ayphen/projects/nks/libs-web/web-utils/src/axios-interceptors.ts`

**Request Interceptor**:
```typescript
// Token handling:
// ❌ Does NOT add Bearer token
// ✅ Relies on httpOnly cookie (withCredentials: true)
// ✅ Correct approach for httpOnly cookies

if (config.withCredentials === undefined) {
  config.withCredentials = true;
}
```

**Response Interceptor** (401 handling):
```typescript
// Current logic:
if (error.response?.status === 401) {
  // Get refresh token from localStorage
  const refreshToken = getRefreshToken();
  
  // Call refresh endpoint
  const response = await axios.post('/auth/refresh-token', {
    refreshToken
  });
  
  // Update JWT cookie for middleware
  if (response.jwtToken) setJwtCookie(response.jwtToken);
  
  // Retry original request
  return axios(originalRequest);
}
```

**Issues**:
- ❌ Does NOT re-fetch permission snapshot after refresh
- ❌ Does NOT invalidate cached permissions
- ❌ If permissions changed, frontend still has old data

**Response Interceptor** (403 handling):
```typescript
// Current logic:
if (error.response?.status === 403) {
  // Mark error
  error.isForbidden = true;
  
  // Throw error (let component handle it)
  throw error;
}
```

**Issues**:
- ❌ Does NOT check if it's a permission error vs. resource not found
- ❌ Does NOT try to refresh permissions
- ❌ Does NOT retry request after refresh
- ❌ Frontend has no mechanism to recover

**What Should Happen**:
```typescript
if (error.response?.status === 403) {
  // Check if it's permission-related
  const errorCode = error.response.data?.errorCode;
  if (isPermissionError(errorCode)) {
    // Refresh permissions from server
    const permissions = await dispatch(getPermissionsSnapshot());
    
    // Update Redux state
    dispatch(setPermissions(permissions));
    
    // Retry original request
    return axios(originalRequest);
  }
}
```

### 5.2 Mobile Interceptors (axios-interceptors.ts)

**Location**: `/Users/saran/ayphen/projects/nks/apps/nks-mobile/lib/network/axios-interceptors.ts`

**Request Interceptor**:
```typescript
// ✅ Synchronously adds token from tokenManager
const token = tokenManager.get();
if (token) {
  config.headers.Authorization = `Bearer ${token}`;
}
```

**Response Interceptor** (401 handling):
```typescript
if (error.response?.status === 401) {
  // Clear expired token
  tokenManager.clear();
  
  // Notify Redux that token expired
  dispatch(tokenManager.notifyExpired());
  
  // User will be logged out
}
```

**Response Interceptor** (403 handling):
```typescript
if (error.response?.status === 403) {
  // Call notifyRefresh callback
  tokenManager.notifyRefresh();
  
  // Expects: store has callback registered to re-fetch session
}
```

**Issues**:
- ❌ 403 handling delegates to a callback system
- ❌ No explicit permission refresh
- ❌ Relies on app to register callback (fragile)
- ❌ Offline session doesn't have entity permissions

---

## 6. AUTH RESPONSE STRUCTURE

### What Backend Returns on Login

```typescript
{
  user: {
    id: number,
    guuid: string,
    name: string,
    email: string,
    phoneNumber: string,
    emailVerified: boolean,
    phoneNumberVerified: boolean,
  },
  session: {
    sessionId: string,
    sessionToken: string,    // HttpOnly cookie also set
    refreshToken: string,    // Stored in localStorage/SecureStore
    jwtToken: string,        // For middleware routing
  },
  access: {
    activeStoreId: number | null,  // Currently selected store
    roles: UserRoleEntry[],  // [{roleCode, storeId, storeName, isPrimary, assignedAt}]
    isSuperAdmin: boolean,
  },
  offlineToken?: string,           // Mobile only
  offlineSessionSignature?: string, // Mobile only
}
```

### What Frontend Should Store

```typescript
// Redux auth state should have:
{
  user: {...},
  session: {...},
  access: {
    activeStoreId,
    roles,
    isSuperAdmin,
  },
  permissions: {
    version: number,  // For delta sync
    data: {
      [entityCode]: {
        canCreate, canRead, canEdit, canDelete, canApprove,
        deny,
        grantedAt
      }
    },
    lastFetchedAt: Date,  // For cache invalidation
  },
  offlineSession: {...},  // Mobile only
}
```

### What Frontend Currently Stores

```typescript
// localStorage (web) or SecureStore (mobile):
{
  user: {...},
  accessToken: token,    // Actually in httpOnly cookie, this is redundant
  refreshToken: token,   // Correct
  // ❌ NO permissions at all
}
```

---

## 7. PERMISSION SNAPSHOT ENDPOINTS (NOT BEING CALLED)

### Endpoint 1: GET /auth/permissions-snapshot

**Backend**:
```typescript
@Get('permissions-snapshot')
@UseGuards(AuthGuard)
async getPermissionsSnapshot(): Promise<ApiResponse<PermissionsSnapshot>> {
  // Returns full set of user's entity permissions in activeStoreId
  return {
    version: 123,  // For delta sync
    permissions: [
      {
        entityCode: 'INVOICE',
        canCreate: true,
        canEdit: true,
        canDelete: false,
        canApprove: false,
        deny: false,
      },
      // ... more entities
    ]
  };
}
```

**Frontend Should Call**:
```typescript
// auth-provider.tsx
useEffect(() => {
  if (isAuthenticated) {
    // On login or permission change
    dispatch(getPermissionsSnapshot())
      .then(result => {
        // Store in Redux: state.auth.permissions
        dispatch(setPermissions(result));
      });
  }
}, [isAuthenticated]);
```

**Frontend Currently**: **NEVER CALLED** ❌

### Endpoint 2: GET /auth/permissions-delta

**Backend**:
```typescript
@Get('permissions-delta')
@UseGuards(AuthGuard)
@Query('version') version: number
async getPermissionsDelta(version: number): Promise<ApiResponse<PermissionsDelta>> {
  // Returns only permissions changed since version
  return {
    version: 124,
    added: [...],    // New permissions
    removed: [...],  // Revoked permissions
    modified: [...], // Changed permissions
  };
}
```

**Use Case**: Mobile should call this periodically (every 10 minutes) to detect revocation

**Frontend Currently**: **NEVER CALLED** ❌

---

## 8. DETAILED RECOMMENDATIONS

### Phase 1: Implement Permission Fetching & Caching [4-5 hours]

#### Step 1.1: Create Permission Redux Slice

**File**: `/apps/nks-web/lib/store/slices/permissions.slice.ts`

```typescript
interface PermissionsState {
  data: Record<string, EntityPermission>;
  version: number;
  lastFetchedAt: Date | null;
  isLoading: boolean;
  error: string | null;
}

// Actions:
- setPermissions(payload: { data, version })
- clearPermissions()
- setPermissionsLoading(isLoading)
- setPermissionsError(error)
```

#### Step 1.2: Add Permission Fetching to AuthProvider

**File**: `/libs-web/web-utils/src/auth-provider.tsx`

```typescript
export const AuthProvider = ({ children }: Props) => {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useAuth();

  // On login, fetch permissions
  useEffect(() => {
    if (isAuthenticated && user?.access?.activeStoreId) {
      fetchAndCachePermissions();
    }
  }, [isAuthenticated, user?.access?.activeStoreId]);

  async function fetchAndCachePermissions() {
    try {
      const result = await dispatch(getPermissionsSnapshot());
      if (result?.payload) {
        dispatch(setPermissions(result.payload));
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    }
  }
};
```

#### Step 1.3: Create usePermissions Hook

**File**: `/libs-web/web-utils/src/hooks/usePermissions.ts`

```typescript
export function usePermissions() {
  const permissions = useSelector(state => state.auth.permissions.data);
  
  return {
    can: (entity: string, action: 'create' | 'read' | 'edit' | 'delete' | 'approve') => {
      const perm = permissions[entity];
      if (!perm) return false;
      if (perm.deny) return false;
      
      const actionMap: Record<string, keyof EntityPermission> = {
        'create': 'canCreate',
        'read': 'canRead',
        'edit': 'canEdit',
        'delete': 'canDelete',
        'approve': 'canApprove',
      };
      
      return perm[actionMap[action]] ?? false;
    },
    
    canAny: (entity: string) => {
      const perm = permissions[entity];
      return perm && !perm.deny;
    },
  };
}
```

#### Step 1.4: Update 403 Handling in Interceptor

**File**: `/libs-web/web-utils/src/axios-interceptors.ts`

```typescript
if (error.response?.status === 403) {
  const errorCode = error.response.data?.errorCode;
  
  // Check if permission-related
  if (isPermissionErrorCode(errorCode)) {
    // Refresh permissions
    const result = await dispatch(getPermissionsSnapshot());
    if (result?.payload) {
      dispatch(setPermissions(result.payload));
      
      // Retry original request
      return axios(originalRequest);
    }
  }
  
  throw error;
}

function isPermissionErrorCode(code: string): boolean {
  return code?.includes('FORBIDDEN') || code?.includes('PERMISSION');
}
```

**Effort**: 4-5 hours for web + mobile

---

### Phase 2: Create Permission-Aware Guards [3-4 hours]

#### Step 2.1: Create Permission Guard Component

**File**: `/libs-web/web-utils/src/guards/permission-guard.tsx`

```typescript
interface PermissionGuardProps {
  entity: string;
  action: 'create' | 'read' | 'edit' | 'delete' | 'approve';
  fallback?: ReactNode;
  children: ReactNode;
}

export const PermissionGuard = ({
  entity,
  action,
  fallback = <Navigate to="/unauthorized" />,
  children,
}: PermissionGuardProps) => {
  const { can } = usePermissions();
  
  if (!can(entity, action)) {
    return fallback;
  }
  
  return children;
};

// Usage:
<PermissionGuard entity="INVOICE" action="create">
  <CreateInvoiceForm />
</PermissionGuard>
```

#### Step 2.2: Create Enhanced Role Guard

**File**: `/libs-web/web-utils/src/guards/role-guard.tsx` (update existing)

```typescript
interface RoleGuardProps {
  roles: string[];  // Role codes required
  fallback?: ReactNode;
  children: ReactNode;
}

export const RoleGuard = ({
  roles,
  fallback = <Navigate to="/unauthorized" />,
  children,
}: RoleGuardProps) => {
  const { user } = useAuth();
  
  // Check if super admin (bypass)
  if (user?.access?.isSuperAdmin) {
    return children;
  }
  
  // Check if has required role in active store
  const hasRole = roles.some(roleCode =>
    user?.access?.roles?.some(r =>
      r.roleCode === roleCode &&
      r.storeId === user.access.activeStoreId
    )
  );
  
  if (!hasRole) {
    return fallback;
  }
  
  return children;
};
```

#### Step 2.3: Create Combined Guard

**File**: `/libs-web/web-utils/src/guards/access-guard.tsx` (new)

```typescript
interface AccessGuardProps {
  roles?: string[];  // Optional: required role codes
  entity?: string;   // Optional: entity code for permission check
  action?: 'create' | 'read' | 'edit' | 'delete' | 'approve';  // Optional
  fallback?: ReactNode;
  children: ReactNode;
}

export const AccessGuard = ({
  roles,
  entity,
  action,
  fallback = <Navigate to="/unauthorized" />,
  children,
}: AccessGuardProps) => {
  const { user } = useAuth();
  const { can } = usePermissions();
  
  // Super admin bypass
  if (user?.access?.isSuperAdmin) {
    return children;
  }
  
  // Check role if required
  if (roles) {
    const hasRole = roles.some(roleCode =>
      user?.access?.roles?.some(r =>
        r.roleCode === roleCode &&
        r.storeId === user.access.activeStoreId
      )
    );
    if (!hasRole) return fallback;
  }
  
  // Check entity permission if required
  if (entity && action) {
    if (!can(entity, action)) return fallback;
  }
  
  return children;
};
```

**Effort**: 3-4 hours

---

### Phase 3: Mobile Offline Permissions [2-3 hours]

#### Step 3.1: Update Offline Session Structure

**File**: `/apps/nks-mobile/lib/offline-session.ts`

```typescript
// Current:
interface OfflineSession {
  userId: number;
  storeId: number;
  roles: string[];
  signature?: string;
}

// Updated to:
interface OfflineSession {
  userId: number;
  storeId: number;
  roles: string[];
  permissions: {
    [entityCode: string]: {
      canCreate: boolean;
      canRead: boolean;
      canEdit: boolean;
      canDelete: boolean;
      canApprove: boolean;
      deny: boolean;
    };
  };
  signature?: string; // Now signs roles + permissions
}
```

#### Step 3.2: Update Write Guard

**File**: `/apps/nks-mobile/lib/write-guard.ts`

```typescript
// Current: Only checks role
async function assertWriteAllowed(requiredRoles: string[]) {
  const session = await getOfflineSession();
  const hasRole = requiredRoles.some(r => session.roles.includes(r));
  if (!hasRole) throw new Error('Insufficient role');
}

// Updated to check permissions too:
async function assertWriteAllowed(
  requiredRoles: string[],
  entity: string,
  action: 'create' | 'edit' | 'delete'
) {
  const session = await getOfflineSession();
  
  // Check role
  const hasRole = requiredRoles.some(r => session.roles.includes(r));
  if (!hasRole) throw new Error('Insufficient role');
  
  // Check entity permission
  const permission = session.permissions[entity];
  if (!permission || permission.deny) {
    throw new Error(`No permission for ${action} ${entity}`);
  }
  
  const actionMap = {
    'create': 'canCreate',
    'edit': 'canEdit',
    'delete': 'canDelete',
  };
  
  if (!permission[actionMap[action]]) {
    throw new Error(`Cannot ${action} ${entity}`);
  }
}
```

#### Step 3.3: Update Offline Session Creation

**File**: `/apps/nks-mobile/lib/network/axios-interceptors.ts`

```typescript
// When getting auth response, also fetch permissions:
async function handleAuthResponse(authData) {
  // Store user/session
  await storeAuthData(authData);
  
  // Fetch and store offline session
  const permissionsSnapshot = await getPermissionsSnapshot();
  
  // Create offline session with permissions
  const offlineSession: OfflineSession = {
    userId: authData.user.id,
    storeId: authData.access.activeStoreId,
    roles: authData.access.roles.map(r => r.roleCode),
    permissions: permissionsSnapshot.data,
    signature: generateHmac({
      userId: authData.user.id,
      storeId: authData.access.activeStoreId,
      roles: authData.access.roles.map(r => r.roleCode),
      permissions: permissionsSnapshot.data,
    }),
  };
  
  await storeOfflineSession(offlineSession);
}
```

**Effort**: 2-3 hours

---

### Phase 4: Admin Guard Enhancement [1-2 hours]

#### Step 4.1: Update AdminGuard Logic

**File**: `/libs-web/web-utils/src/guards/admin-guard.tsx`

```typescript
// Current: Only SUPER_ADMIN
const isAdmin = user?.access?.isSuperAdmin === true;

// Enhanced to support MANAGER and ADMIN roles with entity permissions:
const isAdmin = 
  user?.access?.isSuperAdmin === true ||
  hasAdminRole(user?.access?.roles);

function hasAdminRole(roles: UserRoleEntry[] | undefined): boolean {
  if (!roles) return false;
  return roles.some(r =>
    ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(r.roleCode)
  );
}

// But this is still incomplete - should check entity permissions for MANAGER
```

**Better Approach**: Use AccessGuard instead

```typescript
// Instead of AdminGuard, use:
<AccessGuard
  roles={['SUPER_ADMIN', 'MANAGER']}
  entity="STORE"
  action="edit"
>
  <AdminPanel />
</AccessGuard>
```

**Effort**: 1-2 hours (mostly deprecating AdminGuard)

---

## 9. SUMMARY OF CHANGES NEEDED

### Web Frontend

| File | Change | Effort |
|------|--------|--------|
| `store/slices/permissions.slice.ts` | CREATE new Redux slice | 1 hr |
| `auth-provider.tsx` | Add permission fetching | 1.5 hrs |
| `hooks/usePermissions.ts` | CREATE permission checking hook | 1 hr |
| `axios-interceptors.ts` | Add 403 permission refresh | 1 hr |
| `guards/permission-guard.tsx` | CREATE new guard | 1 hr |
| `guards/role-guard.tsx` | UPDATE with role checking | 1 hr |
| `guards/access-guard.tsx` | CREATE combined guard | 1.5 hrs |
| `guards/admin-guard.tsx` | UPDATE to use roles correctly | 0.5 hr |
| Tests | Update guard tests | 2 hrs |

**Total Web Effort**: 10-11 hours

### Mobile Frontend

| File | Change | Effort |
|------|--------|--------|
| `offline-session.ts` | UPDATE with permissions | 1 hr |
| `write-guard.ts` | ADD permission checks | 1 hr |
| `axios-interceptors.ts` | UPDATE offline session creation | 1 hr |
| `auth-store.ts` | UPDATE to fetch permissions | 0.5 hrs |
| Tests | Update permission tests | 1 hr |

**Total Mobile Effort**: 4.5 hours

### Total Effort: 14-15 hours

---

## 10. IMPLEMENTATION ORDER

1. **Phase 1A: Permission Redux Slice** (1 hr)
   - Create empty `permissions.slice.ts`
   - Connect to store

2. **Phase 1B: AuthProvider Permission Fetching** (2 hrs)
   - Add `useEffect` to fetch permissions on login
   - Connect to Redux slice

3. **Phase 2A: usePermissions Hook** (1 hr)
   - Create hook
   - Test with components

4. **Phase 2B: Permission Guards** (3 hrs)
   - Create `PermissionGuard` component
   - Update `RoleGuard`
   - Create `AccessGuard`

5. **Phase 3: 403 Interceptor Handling** (1.5 hrs)
   - Update web interceptor
   - Update mobile interceptor

6. **Phase 4: Mobile Offline Permissions** (3 hrs)
   - Update offline session structure
   - Update write-guard
   - Update auth response handling

7. **Phase 5: Testing & Integration** (3 hrs)
   - Unit tests for guards
   - Integration tests for flows
   - End-to-end tests

---

## 11. CHECKLIST FOR ALIGNMENT

After implementing changes, verify:

- [ ] Permission snapshot endpoint is called on login
- [ ] Permissions are stored in Redux state
- [ ] Permission hooks work correctly
- [ ] Permission guards prevent unauthorized navigation
- [ ] 403 errors trigger permission refresh
- [ ] Offline mobile session includes entity permissions
- [ ] Write-guard checks permissions offline
- [ ] Super admin bypass logic works everywhere
- [ ] Active store validation in all routes
- [ ] Mobile permission delta updates work
- [ ] All endpoint decorators match frontend checks
- [ ] Error codes match between backend and frontend

---

## 12. RISK & MITIGATION

### Risk 1: Complex Permission Data Structure
**Mitigation**: Start with basic read/create/edit/delete actions, expand later

### Risk 2: Performance (Fetching Permissions on Every Login)
**Mitigation**: Cache in localStorage, use delta endpoint for updates

### Risk 3: Stale Permissions Offline
**Mitigation**: Clear offline session on any online permission change

### Risk 4: Breaking Changes for Existing Routes
**Mitigation**: Make permission checks optional with prop, deprecate AdminGuard gradually

---

## Document Version

- **Version**: 1.0
- **Created**: 2026-04-16
- **Status**: Analysis Complete - Ready for Implementation
- **Effort**: 14-15 hours total
- **Priority**: HIGH - Guards are security-critical
