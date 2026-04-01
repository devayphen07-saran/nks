# API Implementation Tasks - Priority Checklist

**Status:** Ready for implementation
**Total New Endpoints:** 23 (Phase 1 - Core Infrastructure)
**Estimated Effort:** 3-4 days

---

## 🎯 PHASE 1: CORE INFRASTRUCTURE APIs (23 Endpoints)

### Priority 1️⃣: USER PREFERENCES API (5 Endpoints)

**Module:** `features/user-preferences`
**Service:** `UserPreferencesService` (already created ✅)
**Controller:** `UserPreferencesController` (needs creation)

#### Tasks

- [ ] **Create `user-preferences.controller.ts`**

  ```typescript
  @Controller("users")
  @ApiTags("User Preferences")
  @ApiBearerAuth()
  export class UserPreferencesController {
    constructor(
      private readonly userPreferencesService: UserPreferencesService,
    ) {}

    // Implementation needed
  }
  ```

- [ ] **Endpoint: GET /users/me/preferences**
  - Method: Get current user's preferences
  - Service: `userPreferencesService.get(userId)`
  - Response: UserPreferencesResponseDto
  - Guard: AuthGuard

- [ ] **Endpoint: PATCH /users/me/preferences**
  - Method: Update multiple preferences at once
  - Service: `userPreferencesService.update(userId, dto, userId)`
  - Params: theme, language, timezone, notificationsEnabled
  - Response: Updated UserPreferencesResponseDto
  - Guard: AuthGuard

- [ ] **Endpoint: PATCH /users/me/preferences/theme**
  - Method: Update theme only
  - Service: `userPreferencesService.setTheme(userId, theme, userId)`
  - Params: theme (light/dark)
  - Response: Updated theme value
  - Guard: AuthGuard

- [ ] **Endpoint: PATCH /users/me/preferences/language**
  - Method: Update language only
  - Service: `userPreferencesService.setLanguage(userId, language, userId)`
  - Params: language (en, hi, etc)
  - Response: Updated language value
  - Guard: AuthGuard

- [ ] **Endpoint: PATCH /users/me/preferences/timezone**
  - Method: Update timezone only
  - Service: `userPreferencesService.setTimezone(userId, timezone, userId)`
  - Params: timezone (Asia/Kolkata, etc)
  - Response: Updated timezone value
  - Guard: AuthGuard

- [ ] **Create DTOs**
  - `UpdateUserPreferencesDto`
  - `UpdateThemeDto`
  - `UpdateLanguageDto`
  - `UpdateTimezoneDto`
  - `UserPreferencesResponseDto`

- [ ] **Update module exports**
  - Add `UserPreferencesController` to `user.module.ts`
  - Export `UserPreferencesService` if needed

---

### Priority 2️⃣: SYSTEM CONFIGURATION API (6 Endpoints)

**Module:** `features/system-config`
**Service:** `SystemConfigService` (already created ✅)
**Controller:** `SystemConfigController` (needs creation)

#### Tasks

- [ ] **Create `system-config.controller.ts`**

  ```typescript
  @Controller("admin/config")
  @ApiTags("System Configuration")
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RBACGuard)
  @Roles("SUPER_ADMIN")
  export class SystemConfigController {
    constructor(private readonly systemConfigService: SystemConfigService) {}

    // Implementation needed
  }
  ```

- [ ] **Endpoint: GET /admin/config**
  - Method: List all configurations (paginated)
  - Query: page=1, limit=20
  - Service: Query all from database
  - Response: Paginated list
  - Guard: AuthGuard + RBACGuard (SUPER_ADMIN)

- [ ] **Endpoint: GET /admin/config/:key**
  - Method: Get specific configuration
  - Param: key (string)
  - Service: `systemConfigService.get(key)`
  - Response: SystemConfigResponseDto
  - Guard: AuthGuard + RBACGuard (SUPER_ADMIN)

- [ ] **Endpoint: POST /admin/config**
  - Method: Create new configuration
  - Body: CreateSystemConfigDto (key, value, description, isSecret)
  - Service: `systemConfigService.set(...)`
  - Response: Created SystemConfigResponseDto
  - Guard: AuthGuard + RBACGuard (SUPER_ADMIN)
  - Validation: Key must be unique

- [ ] **Endpoint: PATCH /admin/config/:key**
  - Method: Update configuration
  - Param: key
  - Body: UpdateSystemConfigDto (value, description, isSecret)
  - Service: `systemConfigService.set(...)` (upsert logic)
  - Response: Updated SystemConfigResponseDto
  - Guard: AuthGuard + RBACGuard (SUPER_ADMIN)

- [ ] **Endpoint: DELETE /admin/config/:key**
  - Method: Soft-delete configuration
  - Param: key
  - Service: `systemConfigService.delete(key, userId)`
  - Response: Success message
  - Guard: AuthGuard + RBACGuard (SUPER_ADMIN)

- [ ] **Endpoint: GET /admin/config/keys/list** (optional)
  - Method: List available config keys
  - Service: Return list of all keys (cached)
  - Response: Array of key names
  - Guard: AuthGuard + RBACGuard (SUPER_ADMIN)

- [ ] **Create DTOs**
  - `CreateSystemConfigDto`
  - `UpdateSystemConfigDto`
  - `SystemConfigResponseDto`
  - `SystemConfigListDto` (paginated response)

- [ ] **Create module**
  - `system-config.module.ts`
  - Add to main app.module.ts

- [ ] **Add to RolePermission system**
  - Create permission: `config:read`
  - Create permission: `config:write`
  - Create permission: `config:delete`

---

### Priority 3️⃣: LOGIN AUDIT API (4 Endpoints)

**Module:** `features/auth`
**Service:** `LoginAuditService` (already created ✅)
**Controller:** `LoginAuditController` (needs creation)

#### Tasks

- [ ] **Create `login-audit.controller.ts`**

  ```typescript
  @Controller()
  @ApiTags("Login Audit")
  @ApiBearerAuth()
  export class LoginAuditController {
    constructor(private readonly loginAuditService: LoginAuditService) {}

    // Implementation needed
  }
  ```

- [ ] **Endpoint: GET /admin/login-audit**
  - Route: `admin/login-audit`
  - Method: List all login audits (paginated)
  - Query: page=1, limit=50, status=SUCCESS, userId, startDate, endDate
  - Service: Query database with filters
  - Response: Paginated list
  - Guard: AuthGuard + RBACGuard (SUPER_ADMIN)

- [ ] **Endpoint: GET /auth/login-history**
  - Route: `/login-history`
  - Method: Get current user's login history
  - Query: limit=10
  - Service: `loginAuditService.getLoginHistory(userId, limit)`
  - Response: List of login records
  - Guard: AuthGuard (own user only)

- [ ] **Endpoint: GET /users/:userId/login-history**
  - Route: `users/:userId/login-history`
  - Method: Get specific user's login history
  - Param: userId
  - Query: limit=10
  - Service: `loginAuditService.getLoginHistory(userId, limit)`
  - Response: List of login records
  - Guard: AuthGuard + RBACGuard (self or SUPER_ADMIN)

- [ ] **Endpoint: GET /admin/login-audit/suspicious**
  - Route: `admin/login-audit/suspicious`
  - Method: Get suspicious login activities
  - Query: minuteWindow=60, failureThreshold=5, page=1, limit=50
  - Service: `loginAuditService.getSuspiciousActivity(...)`
  - Response: List of suspicious activities
  - Guard: AuthGuard + RBACGuard (SUPER_ADMIN)

- [ ] **Integrate with AuthService**
  - Call `loginAuditService.logSuccess(...)` on successful login
  - Call `loginAuditService.logFailure(...)` on failed login
  - Call `loginAuditService.logBlocked(...)` on blocked login

- [ ] **Create DTOs**
  - `LoginAuditResponseDto`
  - `LoginHistoryDto`
  - `SuspiciousActivityDto`
  - `LoginAuditFilterDto`

- [ ] **Add to auth.module.ts**
  - Import `LoginAuditService`
  - Add `LoginAuditController`

---

### Priority 4️⃣: FILES API (8 Endpoints)

**Module:** `features/files`
**Service:** `FilesService` (already created ✅)
**Controller:** `FilesController` (needs creation)

#### Tasks

- [ ] **Create `files.controller.ts`**

  ```typescript
  @Controller("files")
  @ApiTags("Files")
  @ApiBearerAuth()
  export class FilesController {
    constructor(private readonly filesService: FilesService) {}

    // Implementation needed
  }
  ```

- [ ] **Endpoint: POST /files/upload**
  - Method: Upload file (generic)
  - Body: Multipart form (file)
  - Query: entityType, entityId
  - Service: `filesService.uploadAndStore(...)`
  - Response: FileResponseDto
  - Guard: AuthGuard
  - Use: `@UseInterceptors(FileInterceptor('file'))`

- [ ] **Endpoint: POST /files/:entityType/:entityId/upload**
  - Method: Upload file for specific entity
  - Param: entityType, entityId
  - Body: Multipart form (file)
  - Service: `filesService.uploadAndStore(...)`
  - Response: FileResponseDto
  - Guard: AuthGuard (check ownership)

- [ ] **Endpoint: GET /files/:entityType/:entityId**
  - Method: Get files for entity
  - Param: entityType, entityId
  - Service: `filesService.getByEntity(entityType, entityId)`
  - Response: Array of FileResponseDto
  - Guard: AuthGuard (check ownership or public)

- [ ] **Endpoint: GET /files/:fileId**
  - Method: Get file metadata
  - Param: fileId
  - Service: `filesService.getById(fileId)`
  - Response: FileResponseDto
  - Guard: AuthGuard (check ownership)

- [ ] **Endpoint: GET /files/:fileId/download**
  - Method: Download file (redirect to S3)
  - Param: fileId
  - Service: Get file and generate S3 presigned URL
  - Response: 301 Redirect to S3 URL
  - Guard: AuthGuard (check ownership)

- [ ] **Endpoint: DELETE /files/:fileId**
  - Method: Soft-delete file
  - Param: fileId
  - Service: `filesService.delete(fileId, userId)`
  - Response: Success message
  - Guard: AuthGuard (owner or admin)

- [ ] **Endpoint: PATCH /files/:fileId**
  - Method: Update file metadata
  - Param: fileId
  - Body: UpdateFileDto (fileName, etc)
  - Service: Update metadata only (not file content)
  - Response: Updated FileResponseDto
  - Guard: AuthGuard (owner or admin)

- [ ] **Endpoint: GET /files/entity/:entityType/:entityId/count** (optional)
  - Method: Get file count for entity
  - Param: entityType, entityId
  - Service: Count files
  - Response: { count: number }
  - Guard: AuthGuard

- [ ] **Integrate S3Service**
  - Need to create `S3Service` for upload/download
  - Or use existing storage service

- [ ] **Create DTOs**
  - `UploadFileDto`
  - `UpdateFileDto`
  - `FileResponseDto`
  - `FileListDto`

- [ ] **Add multipart file handling**
  - Import `FileInterceptor` from `@nestjs/platform-express`
  - Add file size validation
  - Add MIME type validation

- [ ] **Create files.module.ts**
  - Add to main app.module.ts

---

## 📝 FILES TO CREATE

### Controllers (4)

```
✅ apps/nks-backend/src/features/user-preferences/user-preferences.controller.ts
✅ apps/nks-backend/src/features/system-config/system-config.controller.ts
✅ apps/nks-backend/src/features/auth/controllers/login-audit.controller.ts
✅ apps/nks-backend/src/features/files/files.controller.ts
```

### DTOs (Multiple per controller)

```
✅ apps/nks-backend/src/features/user-preferences/dto/*
✅ apps/nks-backend/src/features/system-config/dto/*
✅ apps/nks-backend/src/features/auth/dto/login-audit.dto.ts
✅ apps/nks-backend/src/features/files/dto/*
```

### Modules (2 new)

```
✅ apps/nks-backend/src/features/system-config/system-config.module.ts
✅ apps/nks-backend/src/features/files/files.module.ts
(user-preferences & login-audit can be added to existing modules)
```

### Update Existing Files

```
✅ apps/nks-backend/src/modules/auth/auth.module.ts — Add LoginAuditController
✅ apps/nks-backend/src/modules/users/users.module.ts — Add UserPreferencesController
✅ apps/nks-backend/src/app.module.ts — Add new modules
✅ apps/nks-backend/src/modules/auth/services/auth.service.ts — Integrate LoginAuditService
```

---

## 🔐 RBAC PERMISSIONS TO CREATE

| Permission           | Module        | Description                      |
| -------------------- | ------------- | -------------------------------- |
| `config:read`        | System Config | Read configuration values        |
| `config:write`       | System Config | Create/update configuration      |
| `config:delete`      | System Config | Delete configuration             |
| `login-audit:read`   | Auth          | View login audit logs            |
| `login-audit:admin`  | Auth          | View admin login audit dashboard |
| `files:upload`       | Files         | Upload files                     |
| `files:delete`       | Files         | Delete files                     |
| `preferences:update` | User          | Update own preferences           |

**Add to:**

```
apps/nks-backend/src/core/database/migrations/0008_permissions_for_new_apis.sql
```

---

## ✅ VERIFICATION CHECKLIST

After implementing each endpoint:

- [ ] Endpoint returns correct HTTP status code
- [ ] Authorization guards working (AuthGuard, RBACGuard)
- [ ] Request validation working (DTOs, class-validator)
- [ ] Response format matches OpenAPI spec
- [ ] Swagger/OpenAPI documentation updated
- [ ] Error handling for edge cases
- [ ] Audit logging for sensitive operations
- [ ] TypeScript compilation passes
- [ ] Unit tests written
- [ ] Integration tests written

---

## 📊 IMPLEMENTATION ORDER

1. **Start with:** User Preferences (simplest, fewest dependencies)
2. **Then:** Files (most useful, moderate complexity)
3. **Then:** Login Audit (integrate with existing auth)
4. **Finally:** System Config (impacts many services)

---

## 🚀 NEXT PHASE: Phase 2 (After Phase 1 Complete)

When Phase 1 is done, implement Phase 2 (7 endpoints):

- POST `/auth/change-password`
- POST `/auth/reset-password`
- GET `/auth/validate-token`
- GET `/auth/me/sessions`
- DELETE `/auth/me/sessions/:sessionId`
- GET `/users` (admin list)
- DELETE `/users/:userId` (admin delete)

---

**Estimated Timeline:**

- User Preferences: 1 day
- Files: 1.5 days
- Login Audit: 0.5 days
- System Config: 1 day
- **Total Phase 1: 4 days**

**Status:** Ready to start implementation
**First Task:** Create UserPreferencesController
