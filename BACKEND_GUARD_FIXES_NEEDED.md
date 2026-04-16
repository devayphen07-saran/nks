# Backend Guard Fixes Required - Frontend Expectations Analysis

## Executive Summary

The **frontend/mobile codebase reveals what the backend SHOULD do** with its guards. By analyzing how frontend expects guards to work, we found **5 CRITICAL issues** and **3 MEDIUM issues** in the backend guard implementation.

- **Critical Issues**: 5 (missing endpoints, missing guards, validation gaps)
- **Medium Issues**: 3 (error codes, guard inconsistency, store validation)
- **Total Effort to Fix**: 8-10 hours
- **Security Impact**: HIGH (permission bypass, unauthorized access possible)

---

## 1. CRITICAL ISSUES

### CRITICAL #1: Missing Permission Snapshot Endpoints ❌ BLOCKING

**What Frontend Needs**:

```typescript
// Frontend API defined in libs-common/api-manager/src/lib/auth/api-data.ts
export const GET_PERMISSIONS_SNAPSHOT = new APIData(
  "auth/permissions-snapshot", // ❌ ENDPOINT NOT IN BACKEND
  APIMethod.GET,
);

export const GET_PERMISSIONS_DELTA = new APIData(
  "auth/permissions-delta", // ❌ ENDPOINT NOT IN BACKEND
  APIMethod.GET,
);
```

**Why Frontend Needs It**:

- Mobile app needs to download full permissions for offline-first sync
- Web app needs to know what user can do without making API call
- Without this, frontend can't show/hide UI elements based on permissions
- Users get 403 errors instead of seeing "unauthorized"

**Expected Response**:

```typescript
GET /auth/permissions-snapshot
Headers: Authorization: Bearer <token>

Response:
{
  data: {
    version: "v1.0",
    snapshot: {
      "INVOICE": {
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: false,
        canExport: true
      },
      "PRODUCT": {
        canView: true,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canExport: false
      },
      "CUSTOMER": { ... },
      ...
    }
  },
  message: "Permissions snapshot retrieved"
}
```

**Expected Delta Response**:

```typescript
GET /auth/permissions-delta?version=v1.0
Headers: Authorization: Bearer <token>

Response:
{
  data: {
    version: "v1.1",
    added: [
      { entity: "REPORT", canView: true, canCreate: true, ... }
    ],
    removed: [
      { entity: "ADMIN_PANEL", ... }
    ],
    modified: [
      { entity: "INVOICE", canCreate: false, ... }  // Changed from true
    ]
  },
  message: "Permissions delta retrieved"
}
```

**Current Backend**:

- No endpoints in `auth.controller.ts`
- No service methods for permissions snapshot
- No versioning system for permissions

**Fix Required**:

**Step 1: Update RolesService** (`modules/roles/roles.service.ts`):

```typescript
async getPermissionsSnapshot(userId: number, storeId: number) {
  // Get all entity permissions for user in store
  const roles = await this.db.query.userRoleMapping.findMany({
    where: and(
      eq(userRoleMapping.userFk, userId),
      eq(userRoleMapping.storeFk, storeId),
      eq(userRoleMapping.isActive, true)
    ),
  });

  // Get all role entity permissions
  const permissions = await this.db.query.roleEntityPermission.findMany({
    where: inArray(
      roleEntityPermission.roleFk,
      roles.map(r => r.roleFk)
    ),
  });

  // Build snapshot
  const snapshot = {};
  permissions.forEach(p => {
    if (!snapshot[p.entityCode]) {
      snapshot[p.entityCode] = {
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canExport: false,
      };
    }

    if (p.deny) {
      // Deny overrides, set all to false
      snapshot[p.entityCode] = {
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canExport: false,
      };
    } else {
      // Grant permissions
      snapshot[p.entityCode].canView = snapshot[p.entityCode].canView || p.canRead;
      snapshot[p.entityCode].canCreate = snapshot[p.entityCode].canCreate || p.canCreate;
      snapshot[p.entityCode].canEdit = snapshot[p.entityCode].canEdit || p.canEdit;
      snapshot[p.entityCode].canDelete = snapshot[p.entityCode].canDelete || p.canDelete;
      snapshot[p.entityCode].canExport = snapshot[p.entityCode].canExport || p.canExport || false;
    }
  });

  return {
    version: new Date().toISOString(),
    snapshot,
  };
}

async getPermissionsDelta(userId: number, storeId: number, sinceVersion: string) {
  // Get current snapshot
  const current = await this.getPermissionsSnapshot(userId, storeId);

  // In real implementation, would query version history from DB
  // For now, return full snapshot as delta
  // TODO: Implement proper versioning in UserPermissionVersion table

  return {
    version: current.version,
    added: [],
    removed: [],
    modified: Object.entries(current.snapshot).map(([entity, perms]) => ({
      entity,
      ...perms,
    })),
  };
}
```

**Step 2: Add endpoints to AuthController** (`modules/auth/auth.controller.ts`):

```typescript
@Controller("auth")
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class AuthController {
  // ... existing endpoints ...

  @Get("permissions-snapshot")
  @ApiOperation({
    summary: "Get full permissions snapshot for offline-first sync",
    description:
      "Returns all entity permissions for the authenticated user in their active store. Used by mobile for offline caching and frontend for permission-aware UI.",
  })
  @ApiResponse({ status: 200, description: "Permissions snapshot retrieved" })
  async getPermissionsSnapshot(
    @CurrentUser() user: SessionUser,
  ): Promise<ApiResponse<PermissionsSnapshot>> {
    if (!user.activeStoreId) {
      throw new ForbiddenException({
        errorCode: ErrorCodes.NO_ACTIVE_STORE,
        message: "No active store selected",
      });
    }

    const snapshot = await this.rolesService.getPermissionsSnapshot(
      user.userId,
      user.activeStoreId,
    );

    return ApiResponse.ok(snapshot);
  }

  @Get("permissions-delta")
  @ApiOperation({
    summary: "Get incremental permission changes since version",
    description:
      "Returns only permissions that changed since the provided version for efficient mobile sync.",
  })
  @ApiQuery({
    name: "version",
    type: String,
    description: "Last known permission version",
  })
  @ApiResponse({ status: 200, description: "Permissions delta retrieved" })
  async getPermissionsDelta(
    @Query("version") version: string,
    @CurrentUser() user: SessionUser,
  ): Promise<ApiResponse<PermissionsDelta>> {
    if (!user.activeStoreId) {
      throw new ForbiddenException({
        errorCode: ErrorCodes.NO_ACTIVE_STORE,
        message: "No active store selected",
      });
    }

    const delta = await this.rolesService.getPermissionsDelta(
      user.userId,
      user.activeStoreId,
      version,
    );

    return ApiResponse.ok(delta);
  }
}
```

**Effort**: 3-4 hours
**Security Impact**: CRITICAL - Mobile offline sync won't work without this

---

### CRITICAL #2: Codes Endpoint Missing RBACGuard ❌ SECURITY ISSUE

**Current Implementation** (`modules/codes/codes.controller.ts` lines 51-74):

```typescript
@Controller("codes")
export class CodesController {
  @Get(":categoryCode")
  @Public()
  async getValues(
    @Param("categoryCode") categoryCode: string,
  ): Promise<ApiResponse<CodeValuesListResponse>> {
    // ✅ Correct: Public endpoint
    return this.service.getCodeValues(categoryCode);
  }

  @Put("values/:id")
  @UseGuards(AuthGuard) // ❌ WRONG: Missing RBACGuard!
  @ApiBearerAuth()
  async updateValue(
    @Param("id") id: string,
    @Body() dto: UpdateCodeValueDto,
  ): Promise<ApiResponse<CodeValueResponseDto>> {
    // SECURITY ISSUE: Any authenticated user can edit codes!
    // Should be restricted to SUPER_ADMIN only
  }

  @Delete("values/:id")
  @UseGuards(AuthGuard) // ❌ WRONG: Missing RBACGuard!
  @ApiBearerAuth()
  async deleteValue(@Param("id") id: string): Promise<void> {
    // SECURITY ISSUE: Any authenticated user can delete codes!
    // Should be restricted to SUPER_ADMIN only
  }
}
```

**What Frontend Expects**:

- Code values (salutations, designations, etc.) are system configuration
- Only SUPER_ADMIN should be able to edit/delete
- Frontend has no UI for code editing unless user is SUPER_ADMIN

**Fix Required**:

```typescript
@Controller("codes")
export class CodesController {
  @Get(":categoryCode")
  @Public() // ✅ Keep public for reading
  @ApiOperation({ summary: "Get code values for a category (public)" })
  async getValues(
    @Param("categoryCode") categoryCode: string,
  ): Promise<ApiResponse<CodeValuesListResponse>> {
    return this.service.getCodeValues(categoryCode);
  }

  @Put("values/:id")
  @UseGuards(AuthGuard, RBACGuard) // ✅ ADD RBAC Guard
  @Roles("SUPER_ADMIN") // ✅ ADD Role requirement
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Edit a code value (SUPER_ADMIN only)" })
  @ApiResponse({ status: 200, description: "Code value updated" })
  @ApiResponse({ status: 403, description: "Insufficient permissions" })
  async updateValue(
    @Param("id", ParseIntPipe) id: number, // ✅ Also add ParseIntPipe
    @Body() dto: UpdateCodeValueDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<CodeValueResponseDto>> {
    const data = await this.service.updateValue(id, dto, req.user.userId);
    return ApiResponse.ok(data);
  }

  @Delete("values/:id")
  @UseGuards(AuthGuard, RBACGuard) // ✅ ADD RBAC Guard
  @Roles("SUPER_ADMIN") // ✅ ADD Role requirement
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete a code value (SUPER_ADMIN only)" })
  @ApiResponse({ status: 204, description: "Code value deleted" })
  @ApiResponse({ status: 403, description: "Insufficient permissions" })
  async deleteValue(
    @Param("id", ParseIntPipe) id: number, // ✅ Also add ParseIntPipe
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.service.deleteValue(id, req.user.userId);
  }
}
```

**Effort**: 1 hour
**Security Impact**: HIGH - Permission bypass (any user can edit system codes)

---

### CRITICAL #3: Missing Offline Token Generation ❌ INCOMPLETE

**What Frontend Needs**:

```typescript
// Frontend stores from auth response
const authResponse = {
  user: {...},
  session: {...},
  access: {...},
  offlineToken: "eyJhbGc...",           // ❌ NOT GENERATED BY BACKEND
  offlineSessionSignature: "abc123...", // ❌ NOT GENERATED BY BACKEND
};

// Mobile uses for offline writes
const offlineWrite = {
  jwtToken: authResponse.offlineToken,
  sessionSignature: authResponse.offlineSessionSignature,
  action: 'create_invoice',
  payload: {...}
};
```

**Current Backend** (`auth.service.ts`):

```typescript
// Line 156-165: Auth response returns offlineToken but it's not generated
const response: AuthResponseDto = {
  user: userDto,
  session: {
    sessionId: session.sessionId,
    sessionToken: session.sessionToken,
    refreshToken: refreshToken,
    jwtToken: jwtToken,
  },
  access: {
    activeStoreId: activeStore?.id || null,
    roles: formattedRoles,
  },
  offlineToken: undefined, // ❌ Never set!
  offlineSessionSignature: undefined, // ❌ Never set!
};
```

**Expected Implementation**:

```typescript
// In auth.service.ts
async generateOfflineSession(
  userId: number,
  storeId: number,
  roleIds: number[]
): Promise<{ offlineToken: string; signature: string }> {
  // Create JWT for offline use (3-day expiry)
  const payload = {
    userId,
    storeId,
    roles: roleIds,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60, // 3 days
  };

  const offlineToken = this.jwtService.sign(payload, {
    secret: this.configService.get('OFFLINE_JWT_SECRET'),
    algorithm: 'HS256',
  });

  // Create HMAC signature for tamper detection
  const signaturePayload = JSON.stringify({
    userId,
    storeId,
    roles: roleIds,
  });

  const signature = createHmac('sha256', this.configService.get('OFFLINE_HMAC_SECRET'))
    .update(signaturePayload)
    .digest('hex');

  return {
    offlineToken,
    signature,
  };
}
```

**Then in login response**:

```typescript
const { offlineToken, signature } = await this.generateOfflineSession(
  user.id,
  activeStore?.id,
  roles.map(r => r.roleId)
);

const response: AuthResponseDto = {
  user: userDto,
  session: {...},
  access: {...},
  offlineToken,              // ✅ NOW SET
  offlineSessionSignature: signature,  // ✅ NOW SET
};
```

**Effort**: 2-3 hours
**Security Impact**: CRITICAL - Mobile offline mode won't work

---

### CRITICAL #4: Routes Endpoint Doesn't Validate Store Access ❌ AUTHORIZATION BYPASS

**Current Implementation** (`modules/routes/routes.controller.ts` lines 45-57):

```typescript
@Get('store/:storeGuuid')
@ApiOperation({ summary: 'Get store routes for authenticated user' })
async getStoreRoutes(
  @Param('storeGuuid') storeGuuid: string,
  @CurrentUser() user: SessionUser,
): Promise<ApiResponse<StoreRoutesResponseDto>> {
  // ❌ NO VALIDATION that user belongs to this store!
  // User could request routes for ANY store and see permissions for that store

  const result = await this.routesService.getStoreRoutesByGuuid(
    user.userId,
    storeGuuid,
  );

  return ApiResponse.ok(result);
}
```

**Attack Scenario**:

1. User 'alice' works in Store A only
2. Alice calls `GET /routes/store/<Store-B-GUID>`
3. Backend returns Store B's routes + permissions
4. Alice now knows what roles/permissions exist in Store B
5. Alice could use this info to socially engineer access or identify privilege escalation

**Fix Required**:

```typescript
@Get('store/:storeGuuid')
@ApiOperation({ summary: 'Get store routes for authenticated user' })
@ApiResponse({ status: 403, description: 'No access to this store' })
async getStoreRoutes(
  @Param('storeGuuid') storeGuuid: string,
  @CurrentUser() user: SessionUser,
): Promise<ApiResponse<StoreRoutesResponseDto>> {
  // ✅ Validate user has access to store
  const result = await this.routesService.getStoreRoutesByGuuid(
    user.userId,
    storeGuuid,
  );

  return ApiResponse.ok(result);
}
```

**In routes.service.ts**:

```typescript
async getStoreRoutesByGuuid(userId: number, storeGuuid: string) {
  // Find the store
  const store = await this.db
    .select()
    .from(schema.store)
    .where(eq(schema.store.guuid, storeGuuid))
    .limit(1);

  if (!store || store.length === 0) {
    throw new NotFoundException({
      errorCode: ErrorCodes.STORE_NOT_FOUND,
      message: 'Store not found',
    });
  }

  // ✅ NEW: Verify user has ANY role in this store
  const userStoreRoles = await this.db
    .select()
    .from(userRoleMapping)
    .where(
      and(
        eq(userRoleMapping.userFk, userId),
        eq(userRoleMapping.storeFk, store[0].id),
        eq(userRoleMapping.isActive, true)
      )
    );

  if (!userStoreRoles || userStoreRoles.length === 0) {
    throw new ForbiddenException({
      errorCode: ErrorCodes.NO_ACCESS_TO_STORE,
      message: 'You do not have access to this store',
    });
  }

  // Get routes for this store (existing logic)
  const routes = await this.getStoreRoutes(store[0].id);
  return { routes };
}
```

**Effort**: 1-2 hours
**Security Impact**: HIGH - Information disclosure (user can probe other stores)

---

### CRITICAL #5: No Validation for activeStoreId in Entity Permission Checks ❌ SCOPE BYPASS

**Issue**:
RBACGuard uses `user.activeStoreId` to scope entity permissions, but:

1. What if user doesn't have activeStoreId set?
2. What if user tries to perform action in a store they don't belong to?

**Current Implementation** (`common/guards/rbac.guard.ts` lines 84-93):

```typescript
// Get the store ID from the user's session
const storeId = user.activeStoreId;

// If entity permission is required and no store, block access
if (requireEntityPermission && !storeId) {
  throw new ForbiddenException({
    errorCode: ErrorCodes.NO_ACTIVE_STORE,
    message: "No active store selected. Cannot check entity permissions.",
  });
}
```

**Issue**: What if `activeStoreId` is NULL even though it shouldn't be?

**Better Implementation**:

```typescript
// RBACGuard should validate activeStoreId more thoroughly
if (requireEntityPermission && !storeId) {
  throw new ForbiddenException({
    errorCode: ErrorCodes.NO_ACTIVE_STORE,
    message: "No active store selected",
  });
}

// ✅ NEW: Also verify user actually has a role in activeStoreId
if (requireEntityPermission && storeId) {
  const hasRoleInStore = user.roles.some((r) => r.storeId === storeId);

  if (!hasRoleInStore) {
    throw new ForbiddenException({
      errorCode: ErrorCodes.NO_ACCESS_TO_STORE,
      message: "No access to active store",
    });
  }
}
```

**Effort**: 1 hour
**Security Impact**: MEDIUM - Prevents scope confusion attacks

---

## 2. MEDIUM SEVERITY ISSUES

### MEDIUM #1: Error Code Mismatch ⚠️

**Frontend Expects** (from `apps/nks-mobile/shared/types/errors.ts`):

```typescript
ErrorCode.SESSION_EXPIRED = "SESSION_EXPIRED";
```

**Backend Provides** (from `error-codes.constants.ts`):

```typescript
AUTH_SESSION_EXPIRED: "AUTH_SESSION_EXPIRED";
```

**Frontend Error Handling** (would not match):

```typescript
if (error.errorCode === ErrorCode.SESSION_EXPIRED) {
  // Redirect to login
}
// But backend sends AUTH_SESSION_EXPIRED, so this never executes!
```

**Fix**: Align error codes

| Scenario           | Frontend Expects           | Backend Currently          | Fix To                                                             |
| ------------------ | -------------------------- | -------------------------- | ------------------------------------------------------------------ |
| Session expired    | `SESSION_EXPIRED`          | `AUTH_SESSION_EXPIRED`     | `AUTH_SESSION_EXPIRED` (backend is more specific, update frontend) |
| Missing role       | `INSUFFICIENT_PERMISSIONS` | `INSUFFICIENT_PERMISSIONS` | ✅ Aligned                                                         |
| No store           | `NO_ACTIVE_STORE`          | `NO_ACTIVE_STORE`          | ✅ Aligned                                                         |
| No access to store | `INSUFFICIENT_PERMISSIONS` | No specific code           | Add `NO_ACCESS_TO_STORE`                                           |

**Fix**:

1. Update frontend error mapper to expect `AUTH_SESSION_EXPIRED`
2. Or rename backend error to `SESSION_EXPIRED`

**Effort**: 1 hour
**Impact**: Error handling works correctly

---

### MEDIUM #2: Inconsistent Guard Application Pattern ⚠️

**Current Issues**:

**Inconsistent Pattern 1** (codes.controller.ts):

```typescript
@Controller('codes')
export class CodesController {  // ❌ No guards at class level
  @Get(':categoryCode')
  @Public()
  async getValues(...) { }

  @Put('values/:id')
  @UseGuards(AuthGuard)  // ❌ Method-level guards
  async updateValue(...) { }
}
```

**Inconsistent Pattern 2** (sync.controller.ts):

```typescript
@Controller('sync')
@UseGuards(AuthGuard)  // ✅ Class-level guard
export class SyncController {
  @Get('changes')
  // Inherits AuthGuard
  async getChanges(...) { }

  @Post('push')
  @UseGuards(AuthGuard, RBACGuard)  // ❌ Redundant AuthGuard at method level
  @Roles('CASHIER', 'MANAGER', 'STORE_OWNER')
  async syncPush(...) { }
}
```

**Best Practice**: Apply guards at class level when 80%+ of endpoints need them

**Fix**: Standardize all controllers

```typescript
// Pattern 1: Most endpoints protected
@Controller('codes')
@UseGuards(AuthGuard)  // ✅ Class-level for 80% of endpoints
export class CodesController {
  @Get(':categoryCode')
  @Public()  // ✅ Override class guards
  async getValues(...) { }

  @UseGuards(RBACGuard)  // ✅ Only RBAC at method level
  @Roles('SUPER_ADMIN')
  @Put('values/:id')
  async updateValue(...) { }
}
```

**Effort**: 2-3 hours (review all controllers)
**Impact**: Code consistency, easier maintenance

---

### MEDIUM #3: Missing Store Validation on Entity Mutation Endpoints ⚠️

**Issue**: Some endpoints that modify entities don't validate `activeStoreId`

**Example** (sync.controller.ts):

```typescript
@Post('push')
@UseGuards(AuthGuard, RBACGuard)
@Roles('CASHIER', 'MANAGER', 'STORE_OWNER')
async syncPush(
  @Body() dto: SyncPushDto,
  @Req() req: AuthenticatedRequest,
): Promise<ApiResponse<SyncPushResponseDto>> {
  // What if user has no activeStoreId set?
  // What if they try to push to a different store than their active store?

  const result = await this.service.syncPush(dto, req.user);
  return ApiResponse.ok(result);
}
```

**Better**: Add explicit store validation

```typescript
async syncPush(
  @Body() dto: SyncPushDto,
  @CurrentUser() user: SessionUser,
): Promise<ApiResponse<SyncPushResponseDto>> {
  // ✅ Explicit store validation
  if (!user.activeStoreId) {
    throw new ForbiddenException({
      errorCode: ErrorCodes.NO_ACTIVE_STORE,
      message: 'No active store selected',
    });
  }

  // ✅ Ensure sync is for active store
  if (dto.storeId && dto.storeId !== user.activeStoreId) {
    throw new ForbiddenException({
      errorCode: ErrorCodes.STORE_MISMATCH,
      message: 'Cannot sync to a different store',
    });
  }

  const result = await this.service.syncPush(dto, user);
  return ApiResponse.ok(result);
}
```

**Effort**: 1-2 hours
**Impact**: Prevents store scope confusion

---

## 3. COMPREHENSIVE FIX CHECKLIST

### Critical Fixes (Required for functionality/security)

- [ ] **CRITICAL #1**: Implement permission snapshot endpoints (3-4 hrs)
  - [ ] Add `getPermissionsSnapshot()` to RolesService
  - [ ] Add `getPermissionsDelta()` to RolesService
  - [ ] Add `GET /auth/permissions-snapshot` endpoint
  - [ ] Add `GET /auth/permissions-delta` endpoint
  - [ ] Add DTOs for request/response

- [ ] **CRITICAL #2**: Add RBACGuard to codes endpoints (1 hr)
  - [ ] Add `@UseGuards(AuthGuard, RBACGuard)` to PUT /values/:id
  - [ ] Add `@Roles('SUPER_ADMIN')` to PUT /values/:id
  - [ ] Add `@UseGuards(AuthGuard, RBACGuard)` to DELETE /values/:id
  - [ ] Add `@Roles('SUPER_ADMIN')` to DELETE /values/:id
  - [ ] Add `@ParseIntPipe` to id parameter
  - [ ] Add `@HttpCode(HttpStatus.NO_CONTENT)` to DELETE endpoint

- [ ] **CRITICAL #3**: Implement offline token generation (2-3 hrs)
  - [ ] Create `generateOfflineSession()` method
  - [ ] Generate HMAC signatures for offline validation
  - [ ] Return in auth response on login
  - [ ] Return in auth response on token refresh

- [ ] **CRITICAL #4**: Add store access validation to routes endpoint (1-2 hrs)
  - [ ] Add check in `getStoreRoutesByGuuid()` service method
  - [ ] Verify user has role in requested store
  - [ ] Throw 403 if no access

- [ ] **CRITICAL #5**: Add activeStoreId validation in RBACGuard (1 hr)
  - [ ] Verify activeStoreId is set for entity permission checks
  - [ ] Verify user has role in activeStoreId

### Medium Fixes (Code quality/consistency)

- [ ] **MEDIUM #1**: Align error codes (1 hr)
  - [ ] Review all ErrorCode mappings
  - [ ] Ensure frontend/backend error codes match
  - [ ] Add missing error codes (NO_ACCESS_TO_STORE, STORE_MISMATCH, etc.)

- [ ] **MEDIUM #2**: Standardize guard application (2-3 hrs)
  - [ ] Apply guards at class level when appropriate
  - [ ] Remove redundant guard applications
  - [ ] Update all controllers to consistent pattern

- [ ] **MEDIUM #3**: Add store validation to mutation endpoints (1-2 hrs)
  - [ ] Add activeStoreId checks to sync endpoints
  - [ ] Add activeStoreId checks to other entity mutations
  - [ ] Validate store ownership/membership

---

## 4. IMPLEMENTATION ORDER

### Phase 1: Security Fixes [2-3 hours]

**Do these first - they close security holes**

1. Add RBACGuard to codes endpoints (1 hr)
2. Add store access validation to routes (1-2 hrs)

**Rationale**: These prevent unauthorized access to sensitive operations

### Phase 2: Functionality [4-5 hours]

**Do these second - required for features to work**

1. Implement permission snapshot endpoints (3-4 hrs)
2. Generate offline tokens (2-3 hrs)

**Rationale**: Frontend can't work without these; mobile can't go offline

### Phase 3: Robustness [3-4 hours]

**Do these third - quality improvements**

1. Add activeStoreId validation to RBACGuard (1 hr)
2. Add store validation to mutation endpoints (1-2 hrs)
3. Standardize guard application pattern (2-3 hrs)
4. Align error codes (1 hr)

**Rationale**: Prevents edge cases and inconsistencies

---

## 5. DETAILED CODE EXAMPLES

### Example 1: Codes Controller - Complete Fix

**Before**:

```typescript
@Controller("codes")
export class CodesController {
  @Get(":categoryCode")
  @Public()
  async getValues(
    @Param("categoryCode") categoryCode: string,
  ): Promise<ApiResponse<CodeValuesListResponse>> {
    return this.service.getCodeValues(categoryCode);
  }

  @Put("values/:id")
  @UseGuards(AuthGuard)
  async updateValue(
    @Param("id") id: string,
    @Body() dto: UpdateCodeValueDto,
  ): Promise<ApiResponse<CodeValueResponseDto>> {
    // ANY authenticated user can update!
    const data = await this.service.updateValue(parseInt(id), dto);
    return ApiResponse.ok(data);
  }

  @Delete("values/:id")
  @UseGuards(AuthGuard)
  async deleteValue(@Param("id") id: string): Promise<void> {
    // ANY authenticated user can delete!
    await this.service.deleteValue(parseInt(id));
  }
}
```

**After**:

```typescript
@Controller("codes")
@UseGuards(AuthGuard) // ✅ Class-level for consistency
@ApiBearerAuth()
export class CodesController {
  constructor(private readonly service: CodesService) {}

  @Get(":categoryCode")
  @Public() // ✅ Override class guards
  @ApiOperation({ summary: "Get code values (public)" })
  @ApiParam({ name: "categoryCode", type: String })
  async getValues(
    @Param("categoryCode") categoryCode: string,
  ): Promise<ApiResponse<CodeValuesListResponse>> {
    const data = await this.service.getCodeValues(categoryCode);
    return ApiResponse.ok(data);
  }

  @Put("values/:id")
  @UseGuards(RBACGuard) // ✅ Add RBAC check
  @Roles("SUPER_ADMIN") // ✅ Restrict to SUPER_ADMIN
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update code value (SUPER_ADMIN only)" })
  @ApiParam({ name: "id", type: Number })
  @ApiResponse({ status: 200, description: "Code value updated" })
  @ApiResponse({ status: 403, description: "Insufficient permissions" })
  async updateValue(
    @Param("id", ParseIntPipe) id: number, // ✅ Add ParseIntPipe
    @Body() dto: UpdateCodeValueDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<CodeValueResponseDto>> {
    const data = await this.service.updateValue(id, dto, req.user.userId);
    return ApiResponse.ok(data, "Code value updated");
  }

  @Delete("values/:id")
  @UseGuards(RBACGuard) // ✅ Add RBAC check
  @Roles("SUPER_ADMIN") // ✅ Restrict to SUPER_ADMIN
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete code value (SUPER_ADMIN only)" })
  @ApiParam({ name: "id", type: Number })
  @ApiResponse({ status: 204, description: "Code value deleted" })
  @ApiResponse({ status: 403, description: "Insufficient permissions" })
  async deleteValue(
    @Param("id", ParseIntPipe) id: number, // ✅ Add ParseIntPipe
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.service.deleteValue(id, req.user.userId);
  }
}
```

---

### Example 2: Auth Controller - Add Permission Endpoints

**Add to existing auth.controller.ts**:

```typescript
@Controller("auth")
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class AuthController {
  // ... existing endpoints (login, logout, refresh, etc.) ...

  @Get("permissions-snapshot")
  @ApiOperation({
    summary: "Get full permissions snapshot for offline sync",
    description:
      "Returns all entity permissions for the authenticated user in their active store. Used by mobile apps for offline-first caching and by web apps to know what actions the user can perform.",
  })
  @ApiResponse({
    status: 200,
    description: "Permissions snapshot retrieved",
    schema: {
      example: {
        data: {
          version: "2026-04-16T10:30:00Z",
          snapshot: {
            INVOICE: {
              canView: true,
              canCreate: true,
              canEdit: true,
              canDelete: false,
              canExport: true,
            },
            PRODUCT: {
              canView: true,
              canCreate: false,
              canEdit: false,
              canDelete: false,
              canExport: false,
            },
          },
        },
        message: "Permissions snapshot retrieved",
      },
    },
  })
  @ApiResponse({ status: 403, description: "No active store selected" })
  async getPermissionsSnapshot(
    @CurrentUser() user: SessionUser,
  ): Promise<ApiResponse<PermissionsSnapshot>> {
    // Validate active store
    if (!user.activeStoreId) {
      throw new ForbiddenException({
        errorCode: ErrorCodes.NO_ACTIVE_STORE,
        message: "No active store selected",
      });
    }

    // Get permissions snapshot
    const snapshot = await this.rolesService.getPermissionsSnapshot(
      user.userId,
      user.activeStoreId,
    );

    return ApiResponse.ok(snapshot, "Permissions snapshot retrieved");
  }

  @Get("permissions-delta")
  @ApiOperation({
    summary: "Get incremental permission changes since version",
    description:
      "Returns only permissions that added, removed, or modified since the provided version. Used for efficient mobile sync.",
  })
  @ApiQuery({
    name: "version",
    type: String,
    description:
      "Last known permission version (ISO timestamp or version string)",
    example: "2026-04-16T10:30:00Z",
  })
  @ApiResponse({
    status: 200,
    description: "Permissions delta retrieved",
    schema: {
      example: {
        data: {
          version: "2026-04-16T11:00:00Z",
          added: [
            {
              entityCode: "REPORT",
              canView: true,
              canCreate: true,
              canEdit: true,
              canDelete: false,
              canExport: true,
            },
          ],
          removed: [{ entityCode: "DEPRECATED_FEATURE" }],
          modified: [
            {
              entityCode: "INVOICE",
              canDelete: true, // Changed from false to true
            },
          ],
        },
        message: "Permissions delta retrieved",
      },
    },
  })
  @ApiResponse({ status: 403, description: "No active store selected" })
  async getPermissionsDelta(
    @Query("version") version: string,
    @CurrentUser() user: SessionUser,
  ): Promise<ApiResponse<PermissionsDelta>> {
    // Validate active store
    if (!user.activeStoreId) {
      throw new ForbiddenException({
        errorCode: ErrorCodes.NO_ACTIVE_STORE,
        message: "No active store selected",
      });
    }

    // Get permission delta
    const delta = await this.rolesService.getPermissionsDelta(
      user.userId,
      user.activeStoreId,
      version,
    );

    return ApiResponse.ok(delta, "Permissions delta retrieved");
  }
}
```

---

### Example 3: Routes Service - Add Store Validation

**Update routes.service.ts**:

```typescript
async getStoreRoutesByGuuid(userId: number, storeGuuid: string) {
  // Find the store
  const store = await this.db
    .select()
    .from(schema.store)
    .where(eq(schema.store.guuid, storeGuuid))
    .limit(1);

  if (!store || store.length === 0) {
    throw new NotFoundException({
      errorCode: ErrorCodes.STORE_NOT_FOUND,
      message: 'Store not found',
    });
  }

  // ✅ NEW: Verify user has access to this store
  // Check if user has ANY role in this store
  const userStoreRoles = await this.db
    .select()
    .from(userRoleMapping)
    .where(
      and(
        eq(userRoleMapping.userFk, userId),
        eq(userRoleMapping.storeFk, store[0].id),
        eq(userRoleMapping.isActive, true),
      ),
    )
    .limit(1);

  if (!userStoreRoles || userStoreRoles.length === 0) {
    throw new ForbiddenException({
      errorCode: ErrorCodes.NO_ACCESS_TO_STORE,
      message: 'You do not have access to this store',
    });
  }

  // ✅ NEW: Get user's roles in this store for permission filtering
  const userRoles = userStoreRoles.map(r => r.roleCode);

  // Get routes for this store (existing logic, but now user-scoped)
  const routes = await this.getStoreRoutes(store[0].id, userRoles);

  return { routes };
}
```

---

## 6. TESTING CHECKLIST

After implementing fixes, test:

- [ ] **Permission Snapshot** Tests
  - [ ] Call `/auth/permissions-snapshot` with valid user
  - [ ] Verify response has correct entity permissions
  - [ ] Test with user in multiple stores (only active store returned)
  - [ ] Test with user having no permissions
  - [ ] Test with user having denied permissions

- [ ] **Codes Endpoint** Tests
  - [ ] SUPER_ADMIN can PUT/DELETE code values ✅
  - [ ] Non-SUPER_ADMIN gets 403 on PUT code value ❌
  - [ ] Non-SUPER_ADMIN gets 403 on DELETE code value ❌
  - [ ] Public GET endpoints still work without auth ✅
  - [ ] ParseIntPipe validates id is numeric ✅

- [ ] **Routes Endpoint** Tests
  - [ ] User can GET /routes/store/<their-store> ✅
  - [ ] User gets 403 on GET /routes/store/<other-store> ❌
  - [ ] SUPER_ADMIN can access any store ✅

- [ ] **Offline Token** Tests
  - [ ] Token generated on login
  - [ ] Token has 3-day expiry
  - [ ] Signature is valid HMAC
  - [ ] Mobile can decrypt/use token

- [ ] **Store Validation** Tests
  - [ ] Mutation endpoint requires activeStoreId ✅
  - [ ] Mutation endpoint blocks if store context invalid ❌
  - [ ] Sync validates store context ✅

---

## 7. RISK & MITIGATION

### Risk 1: Breaking Changes

**Mitigation**: These are security fixes - breaking bad code is acceptable. Notify API consumers.

### Risk 2: Performance (Permission Queries)

**Mitigation**: Cache permission snapshots with 5-minute TTL or query optimization

### Risk 3: Offline Token Key Rotation

**Mitigation**: Store key rotation dates, accept tokens signed with previous key for 24-48 hours

---

## 8. SUMMARY TABLE

| Issue                                | Severity | Effort | Impact                 | Status  |
| ------------------------------------ | -------- | ------ | ---------------------- | ------- |
| Missing permission endpoints         | CRITICAL | 3-4h   | Cannot do offline sync | ❌ TODO |
| Codes endpoint missing RBAC          | CRITICAL | 1h     | Authorization bypass   | ❌ TODO |
| Missing offline token generation     | CRITICAL | 2-3h   | Mobile offline broken  | ❌ TODO |
| Routes doesn't validate store access | CRITICAL | 1-2h   | Information disclosure | ❌ TODO |
| No activeStoreId validation in RBAC  | CRITICAL | 1h     | Scope confusion        | ❌ TODO |
| Error code mismatch                  | MEDIUM   | 1h     | Error handling fails   | ⚠️ TODO |
| Inconsistent guard patterns          | MEDIUM   | 2-3h   | Code quality           | ⚠️ TODO |
| Missing store validation             | MEDIUM   | 1-2h   | Scope issues           | ⚠️ TODO |

**Total Effort**: 12-18 hours
**Total Critical Issues**: 5
**Security Impact**: HIGH

---

## Document Version

- **Version**: 1.0
- **Created**: 2026-04-16
- **Status**: Analysis Complete - Ready for Implementation
- **Next Step**: Implement Critical fixes in Phase 1 & 2
