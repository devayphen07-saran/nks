# Authentication & Dynamic Routing Flow - Backend Implementation

## 🎯 Overview

The system has two separate paths after login based on user role:

```
┌─────────────────────────────────────────────────────────────────┐
│                      LOGIN ENDPOINT                              │
│                   POST /auth/login                               │
├─────────────────────────────────────────────────────────────────┤
│  Returns: {                                                       │
│    user: { id, name, email, ... },                              │
│    access: {                                                      │
│      isSuperAdmin: boolean,  ← KEY: Determines routing path     │
│      activeStoreId: null,                                        │
│      roles: [ ... ]                                              │
│    },                                                             │
│    token: "..."                                                   │
│  }                                                                │
└──────────────┬──────────────────┬──────────────────────────────┘
               │                  │
      isSuperAdmin = true  isSuperAdmin = false
               │                  │
               ▼                  ▼
        ┌─────────────┐    ┌──────────────────┐
        │ ADMIN PATH  │    │   USER PATH      │
        └─────────────┘    └──────────────────┘
              │                    │
              │                    ├─ Redirect to /select-store
              │                    │
              │                    ├─ Call GET /stores
              │                    │  └─ Returns user's stores
              │                    │     (owned + invited)
              │                    │
              │                    └─ User selects a store
              │                       └─ Call POST /auth/store/select
              │                          └─ activeStoreId = selected
              │                             └─ Call GET /store/:id/routes-permissions
              │                                └─ Store routes in Redux
              │
              └─ Call GET /admin/routes-permissions
                 └─ Store admin routes in Redux
```

---

## 📋 Backend Endpoints Required

### 1. Login (Already Exists - Verify)
```
POST /auth/login
Body: { email, password }

Response: {
  requestId: string,
  traceId: string,
  data: {
    user: {
      id: number,
      name: string,
      email: string,
      emailVerified: boolean,
      phoneNumber?: string,
    },
    access: {
      isSuperAdmin: boolean,  ← KEY FIELD
      activeStoreId: null,     ← NULL initially
      roles: [
        {
          roleCode: "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "STAFF",
          storeId: number | null,
          storeName?: string,
          isPrimary?: boolean,
        }
      ]
    },
    token: string,
    refreshToken: string,
    expiresAt: string (ISO timestamp),
  }
}
```

**Required Changes**:
- Ensure `isSuperAdmin` is returned in login response
- Ensure `activeStoreId` is `null` on first login (not selected yet)

---

### 2. GET Admin Routes & Permissions (NEW)
```
GET /admin/routes-permissions
Headers: Authorization: Bearer {token}

Response: {
  requestId: string,
  traceId: string,
  data: {
    routes: [
      {
        id: number,
        routePath: string,      // e.g. "/admin/dashboard"
        routeName: string,      // e.g. "Admin Dashboard"
        iconName?: string,      // e.g. "LayoutDashboard"
        description?: string,
        sortOrder: number,
        isPublic: boolean,
        routeType: "screen" | "sidebar" | "modal",
        parentRouteFk?: number,
      }
    ],
    permissions: [
      {
        id: number,
        code: string,           // e.g. "users.view"
        name: string,           // e.g. "View Users"
        resource: string,       // e.g. "users"
        action: string,         // e.g. "view"
        description?: string,
      }
    ]
  }
}
```

**Implementation Location**: New controller method in AuthController or RolesController

**Logic**:
1. Verify user is SUPER_ADMIN via AuthGuard + RBACGuard
2. Query routes table WHERE is_system = true (or similar)
3. Query permissions table WHERE is_system = true
4. Return combined routes + permissions

---

### 3. GET Stores (Already Exists - Verify)
```
GET /store/my-stores
Headers: Authorization: Bearer {token}

Response: {
  requestId: string,
  traceId: string,
  data: [
    {
      id: number,
      storeName: string,
      storeCode: string,
      storeStatus: string,
      kyc_level: number,
      isVerified: boolean,
      timezone: string,
      logoUrl?: string,
      userRole: "OWNER" | "ADMIN",
      isPrimary: boolean,
    }
  ]
}
```

Also implement:
```
GET /store/invited
Headers: Authorization: Bearer {token}

Response: {
  ...same structure as my-stores...
  But: userRole = "MANAGER" | "STAFF"
}
```

**Required**: These endpoints should return role info for display

---

### 4. Store Selection (Already Exists - Verify)
```
POST /auth/store/select
Headers: Authorization: Bearer {token}
Body: {
  storeId: number
}

Response: {
  requestId: string,
  traceId: string,
  data: {
    user: { ... },
    access: {
      isSuperAdmin: false,
      activeStoreId: selected_store_id,  ← UPDATED
      roles: [
        {
          roleCode: "MANAGER",
          storeId: selected_store_id,
          storeName: "Store Name",
          isPrimary: true,
        }
      ]
    },
    token: string,
    ...
  }
}
```

**Required Changes**:
- Must validate user has access to selected store
- Must update `activeStoreId` in session
- Must return updated access context with new roles

---

### 5. GET Store Routes & Permissions (NEW)
```
GET /store/:storeId/routes-permissions
Headers: Authorization: Bearer {token}

Response: {
  requestId: string,
  traceId: string,
  data: {
    storeId: number,
    storeName: string,
    routes: [
      {
        id: number,
        routePath: string,
        routeName: string,
        iconName?: string,
        sortOrder: number,
        routeType: "screen" | "sidebar" | "modal",
        parentRouteFk?: number,
      }
    ],
    permissions: [
      {
        code: string,
        name: string,
        resource: string,
        action: string,
      }
    ],
    userRole: "MANAGER" | "STAFF" | "OWNER" | "ADMIN",
    userPermissions: [
      "customers.view",
      "orders.view",
      "invoices.create",
      ...
    ]
  }
}
```

**Implementation Location**: New endpoint in StoreController

**Logic**:
1. Verify user has access to store (via store_user_mapping)
2. Query routes WHERE appCode = null OR appCode = store_specific
3. Filter routes by user's role/permissions
4. Query permissions for user in this store context
5. Return routes + user's actual permissions

---

## 🔄 Database Queries

### 1. Check if User is SUPER_ADMIN

```typescript
async function isSuperAdmin(userId: number): Promise<boolean> {
  const superAdminRole = await db
    .select()
    .from(schema.roles)
    .where(
      and(
        eq(schema.roles.code, 'SUPER_ADMIN'),
        isNull(schema.roles.storeFk) // Global role
      )
    )
    .limit(1);

  if (!superAdminRole.length) return false;

  const userRole = await db
    .select()
    .from(schema.userRoleMapping)
    .where(
      and(
        eq(schema.userRoleMapping.userFk, userId),
        eq(schema.userRoleMapping.roleFk, superAdminRole[0].id)
      )
    )
    .limit(1);

  return userRole.length > 0;
}
```

### 2. Get User's Stores (Personal)

```typescript
async function getUserStores(userId: number) {
  return await db
    .select({
      id: schema.store.id,
      storeName: schema.store.storeName,
      storeCode: schema.store.storeCode,
      storeStatus: schema.store.storeStatus,
      kyc_level: schema.store.kycLevel,
      isVerified: schema.store.isVerified,
      timezone: schema.store.timezone,
      logoUrl: schema.store.logoUrl,
      userRole: sql`'OWNER'`, // or query role from user_role_mapping
      isPrimary: schema.storeUserMapping.isPrimary,
    })
    .from(schema.store)
    .innerJoin(
      schema.storeUserMapping,
      eq(schema.store.id, schema.storeUserMapping.storeFk)
    )
    .where(
      and(
        eq(schema.storeUserMapping.userFk, userId),
        eq(schema.storeUserMapping.isPrimary, true),
        isNull(schema.store.deletedAt)
      )
    );
}
```

### 3. Get Admin Routes

```typescript
async function getAdminRoutes() {
  return await db
    .select()
    .from(schema.routes)
    .where(
      and(
        eq(schema.routes.isSystem, true),
        isNull(schema.routes.deletedAt)
      )
    )
    .orderBy(schema.routes.sortOrder);
}
```

### 4. Get Store Routes Filtered by User Role

```typescript
async function getStoreRoutes(storeId: number, userId: number) {
  // 1. Get user's role in this store
  const userRoleInStore = await db
    .select({
      roleCode: schema.roles.code,
      roleId: schema.roles.id,
    })
    .from(schema.userRoleMapping)
    .innerJoin(
      schema.roles,
      eq(schema.userRoleMapping.roleFk, schema.roles.id)
    )
    .where(
      and(
        eq(schema.userRoleMapping.userFk, userId),
        eq(schema.userRoleMapping.storeFk, storeId)
      )
    )
    .limit(1);

  if (!userRoleInStore.length) {
    throw new Error('User does not have access to this store');
  }

  // 2. Get routes accessible to this role
  const routes = await db
    .select()
    .from(schema.routes)
    .where(
      and(
        isNull(schema.routes.deletedAt),
        or(
          eq(schema.routes.appCode, null), // Global routes
          eq(schema.routes.appCode, `store_${storeId}`) // Store-specific
        )
      )
    )
    .orderBy(schema.routes.sortOrder);

  // 3. Filter by role-based permissions (via role_route_mapping)
  const accessibleRoutes = await filterRoutesByRole(
    routes,
    userRoleInStore[0].roleId
  );

  return accessibleRoutes;
}
```

### 5. Get User's Permissions in Store

```typescript
async function getUserPermissionsInStore(
  userId: number,
  storeId: number
): Promise<string[]> {
  // Get user's roles in this store
  const roles = await db
    .select({
      roleId: schema.roles.id,
      roleCode: schema.roles.code,
    })
    .from(schema.userRoleMapping)
    .innerJoin(
      schema.roles,
      eq(schema.userRoleMapping.roleFk, schema.roles.id)
    )
    .where(
      and(
        eq(schema.userRoleMapping.userFk, userId),
        eq(schema.userRoleMapping.storeFk, storeId)
      )
    );

  if (!roles.length) return [];

  // Get permissions for these roles
  const permissions = await db
    .select({
      code: schema.permissions.code,
    })
    .from(schema.rolePermissionMapping)
    .innerJoin(
      schema.permissions,
      eq(schema.rolePermissionMapping.permissionFk, schema.permissions.id)
    )
    .where(
      inArray(
        schema.rolePermissionMapping.roleFk,
        roles.map(r => r.roleId)
      )
    );

  return permissions.map(p => p.code);
}
```

---

## 🔐 Authorization Guards

### Add to Each Endpoint:

**For `/admin/routes-permissions`**:
```typescript
@UseGuards(AuthGuard, RBACGuard)
@Roles('SUPER_ADMIN')
async getAdminRoutesPermissions() { ... }
```

**For `/store/:id/routes-permissions`**:
```typescript
@UseGuards(AuthGuard)
async getStoreRoutesPermissions(
  @Param('id') storeId: number,
  @CurrentUser('userId') userId: number
) {
  // Verify user has access to store
  const hasAccess = await this.storeService.userHasAccess(userId, storeId);
  if (!hasAccess) throw new ForbiddenException();

  // ... rest of logic
}
```

---

## 📊 Data Flow Sequence

### Super Admin Flow:
```
1. POST /auth/login
   → isSuperAdmin = true
   → activeStoreId = null

2. Frontend redirects to /admin

3. Frontend calls GET /admin/routes-permissions
   → Returns all admin routes + permissions

4. Frontend stores in Redux and renders admin menu
```

### Regular User Flow:
```
1. POST /auth/login
   → isSuperAdmin = false
   → activeStoreId = null

2. Frontend redirects to /select-store

3. Frontend calls GET /store/my-stores (optional, get owned stores)

4. User selects a store
   → Frontend calls POST /auth/store/select { storeId }
   → activeStoreId = selected_store_id
   → Returns updated roles/permissions for that store

5. Frontend calls GET /store/:id/routes-permissions
   → Returns store-specific routes + user's permissions

6. Frontend stores in Redux and renders user menu

7. User can switch stores:
   → Call POST /auth/store/select { newStoreId } again
   → Clear Redux store routes/permissions
   → Call GET /store/:newId/routes-permissions
   → Store new routes/permissions
```

---

## ✅ Implementation Checklist

### Phase 1: Verify/Update Existing
- [ ] **Login endpoint**
  - [ ] Returns `isSuperAdmin` in access
  - [ ] Returns `activeStoreId = null` on first login
  - [ ] Returns user's initial roles

- [ ] **Get Session endpoint** (`GET /auth/get-session`)
  - [ ] Returns current `activeStoreId`
  - [ ] Returns current user's permissions
  - [ ] Refreshes on every call

- [ ] **Store endpoints**
  - [ ] `GET /store/my-stores` - exists?
  - [ ] `GET /store/invited` - exists?
  - [ ] `POST /auth/store/select` - exists?

### Phase 2: Implement New Endpoints
- [ ] **GET `/admin/routes-permissions`**
  - [ ] Service method to fetch all admin routes
  - [ ] Service method to fetch all admin permissions
  - [ ] Guard: `@Roles('SUPER_ADMIN')`
  - [ ] Return combined routes + permissions
  - [ ] Unit tests

- [ ] **GET `/store/:id/routes-permissions`**
  - [ ] Service method to verify user access to store
  - [ ] Service method to fetch store-specific routes
  - [ ] Service method to get user's permissions in store
  - [ ] Filter routes by role/permissions
  - [ ] Return store routes + user permissions
  - [ ] Unit tests

### Phase 3: Database Queries
- [ ] Create repository methods for:
  - [ ] `isSuperAdmin(userId)`
  - [ ] `getUserStores(userId)`
  - [ ] `getStoreRoutes(storeId, userId)`
  - [ ] `getUserPermissionsInStore(userId, storeId)`
  - [ ] `verifyUserStoreAccess(userId, storeId)`

### Phase 4: DTOs
- [ ] Create `RouteResponseDto` (for route objects)
- [ ] Create `PermissionResponseDto` (for permission objects)
- [ ] Create `AdminRoutesPermissionsResponseDto`
- [ ] Create `StoreRoutesPermissionsResponseDto`

---

## 🚀 Service Layer Architecture

```typescript
// auth.service.ts
class AuthService {
  async login(dto: LoginDto) {
    // ... existing login logic
    const isSuperAdmin = await this.rolesService.isSuperAdmin(user.id);
    return {
      user,
      access: {
        isSuperAdmin,
        activeStoreId: null, // Not selected yet
        roles: [ ... ]
      },
      token,
    };
  }

  async storeSelect(userId: number, storeId: number) {
    // Verify access
    const hasAccess = await this.storeService.userHasAccess(userId, storeId);
    if (!hasAccess) throw new ForbiddenException();

    // Get updated roles for this store
    const roles = await this.rolesService.getUserRolesInStore(userId, storeId);

    // Update session/database if needed
    // ...

    return {
      user,
      access: {
        isSuperAdmin: false,
        activeStoreId: storeId,
        roles: roles
      }
    };
  }
}

// routes.service.ts (NEW)
class RoutesService {
  async getAdminRoutes() {
    return await this.routesRepository.getSystemRoutes();
  }

  async getStoreRoutes(storeId: number, userId: number) {
    const routes = await this.routesRepository.getStoreRoutes(storeId);
    const userRole = await this.rolesService.getUserRoleInStore(userId, storeId);
    return this.filterRoutesByRole(routes, userRole);
  }

  async getStoreRoutesPermissions(storeId: number, userId: number) {
    const routes = await this.getStoreRoutes(storeId, userId);
    const permissions = await this.rolesService.getUserPermissionsInStore(userId, storeId);

    return {
      storeId,
      storeName: (await this.storeRepository.getStore(storeId)).storeName,
      routes,
      permissions,
      userPermissions: permissions.map(p => p.code)
    };
  }
}
```

---

## 📝 Notes

1. **Routes Table**: May need to add `appCode` field to distinguish admin routes from store-specific routes
2. **Soft Deletes**: Always check `deletedAt IS NULL` in queries
3. **Indexes**: Use existing indexes on `user_fk`, `store_fk`, `role_fk`, `permission_fk`
4. **Caching**: Consider caching admin routes (they rarely change)
5. **Permissions**: Use the existing permission system for route access control

