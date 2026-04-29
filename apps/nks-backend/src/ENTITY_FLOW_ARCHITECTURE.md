# NKS Backend: Entity Flow Architecture

**Purpose:** End-to-end walkthrough of how an entity flows through the NKS backend — from HTTP request to database response. Uses **Role** as the running example (covers all layers); **Status** as a simpler contrast.

---

## TL;DR — The 30-Second Mental Model

```
HTTP Request
  ↓ Middleware (helmet, cookies, request-id, csrf)
  ↓ AuthGuard         ← validates session, populates req.user (SessionUser)
  ↓ RateLimitingGuard ← per-IP/per-user limits
  ↓ RBACGuard         ← checks @RequireEntityPermission, evaluates against permission tree
  ↓ AppValidationPipe ← trims strings + Zod schema
  ↓ Controller method ← @CurrentUser() user, @Body() dto
  ↓ Service           ← orchestrates: Validators → Repository → Audit event → Mapper
  ↓ Repository        ← Drizzle ORM, BaseRepository helpers, optional transaction
  ↓ Database          ← roles table with baseEntity() + auditFields()
  ↑ Mapper            ← Drizzle row → wire-format DTO
  ↑ Interceptors      ← SessionRotationInterceptor → ResponseInterceptor (wraps in ApiResponse)
  ↑ GlobalExceptionFilter (on errors only)
HTTP Response
```

**Five core principles:**
1. **Default-deny auth** — Global AuthGuard, opt-out via `@Public()`
2. **Cross-tenant defense in depth** — Guard validates store context; service re-validates resource scope
3. **Fire-and-forget audit** — Audit emitted synchronously, persisted asynchronously off the hot path
4. **Typed error codes** — `errPayload(ErrorCode.X)` carries machine-readable code + i18n-friendly message
5. **Pure mappers** — Drizzle row → DTO is a pure static function (no async, no DB, no `this`)

---

## 1. Bootstrap & Module Wiring

### main.ts
1. **Environment validation** (synchronous, fails fast)
2. **NestFactory** with `bufferLogs: true` (pino captures startup logs)
3. **Helmet** — CSP, HSTS, X-Frame-Options
4. **Trust proxy** — accurate IP behind reverse proxy
5. **Global prefix** `/api/v1`
6. **CORS**
7. **CookieParser** (must be first — signed cookies)
8. **RequestIdMiddleware** (generates/preserves `X-Request-ID`)

### app.module.ts — Module Graph

```
AppModule
├── ConfigModule (global)
├── DatabaseModule (global, provides NodePgDatabase via @InjectDb())
├── AuditModule (@Global)
├── AuthModule → RolesModule → StoresModule
├── RolesModule → StoresModule
└── ReferenceDataModules (status, lookups, location)
```

**Critical constraints:** RolesModule and StoresModule never import AuthModule (circular dependency protection). AuthModule never imports SyncModule.

### Global Providers (execution order matters)

| # | Provider | Type | Purpose |
|---|----------|------|---------|
| 1 | AppValidationPipe | APP_PIPE | Trim + Zod |
| 2 | AuthGuard | APP_GUARD | Default-deny auth |
| 3 | RateLimitingGuard | APP_GUARD | Rate limits |
| 4 | ResponseInterceptor | APP_INTERCEPTOR | Wraps in ApiResponse<T> |
| 5 | SessionRotationInterceptor | APP_INTERCEPTOR | Post-handler cookie rotation |
| 6 | LoggingInterceptor | APP_INTERCEPTOR | Timing, deprecation headers |
| 7 | TimeoutInterceptor | APP_INTERCEPTOR | Request timeouts |
| 8 | GlobalExceptionFilter | APP_FILTER | Unified error envelope |

---

## 2. HTTP Request Lifecycle (Inbound)

### AuthGuard — `common/guards/auth.guard.ts`

1. **Public check** — `@Public()` decorator → bypass
2. **Token extraction** — cookie (`nks_session`) or `Authorization: Bearer`
3. **Session validation** — DB lookup, expiry, JTI blocklist, CSRF (if cookie + mutation)
4. **User context loading** — Loads user + roles → builds **SessionUser**:
   ```typescript
   { userId, email, name, roles[], isSuperAdmin, activeStoreId }
   ```
5. **Account status** — blocked/inactive check
6. **Attach to request:**
   - `req.user = sessionUser`
   - `req.session = { id, expiresAt }`
   - `req.authType = 'cookie' | 'bearer'`
   - `req.sessionContext` (cookie auth only — signals SessionRotationInterceptor)

### RBACGuard — `common/guards/rbac.guard.ts`

1. **Read `@RequireEntityPermission` metadata** — `{ action, scope?, entityCode?, routeParam? }`
2. **Resolve entity code** (3-tier priority):
   - Method-level `entityCode` → method-level `routeParam` → class-level `@EntityResource`
3. **Validate code** against DB-loaded entity registry (rejects typos)
4. **STORE scope** (default):
   - Assert `user.activeStoreId` is set
   - **Single query** — `findActiveWithOwnership(userId, storeId)` — checks store active + (ownership OR role membership) in one round-trip (eliminates TOCTOU)
5. **PLATFORM scope** — skips store check, evaluates against platform roles
6. **Evaluate permission** — delegates to PermissionEvaluatorService (cached, see §5)

### Decorators That Drive Behavior

| Decorator | Purpose |
|-----------|---------|
| `@Public()` | Skip AuthGuard |
| `@RequireEntityPermission({action, scope})` | RBAC enforcement |
| `@EntityResource(EntityCodes.X)` | Class-level entity code fallback |
| `@CurrentUser()` | Inject `req.user` |
| `@RotateCsrf()` | Force CSRF rotation post-handler |
| `@ResponseMessage('...')` | Custom success message |
| `@RawResponse()` | Skip ApiResponse wrapping (streams, files) |
| `@NoEntityPermissionRequired()` | Document why no RBAC check (membership enforced elsewhere) |

### AppValidationPipe

1. **TrimStringsPipe** — strips whitespace; preserves sensitive fields (passwords, OTPs, tokens)
2. **ZodValidationPipe** — validates against Zod schema. On error → `ZodValidationException` → caught by GlobalExceptionFilter → 400 with field-level errors

---

## 3. Service Layer (Orchestration)

### RolesService.createRole — `contexts/iam/roles/roles.service.ts`

```typescript
async createRole(userId: number, dto: CreateRoleDto, activeStoreId: number | null): Promise<RoleResponseDto> {
  // 1. Validate target store
  const storeFk = await this.rolesRepository.findStoreIdByGuuid(dto.storeGuuid);
  RolesValidator.assertStoreFound(storeFk);
  RolesValidator.assertStoreMatch(activeStoreId, storeFk);  // ← Cross-tenant defense

  // 2. Validate business rules
  const isReserved = await this.rolesRepository.isSystemRoleCode(dto.code);
  RolesValidator.assertCodeNotReserved(isReserved);

  // 3. Create
  const role = await this.rolesRepository.create({
    roleName: dto.name, code: dto.code, description: dto.description ?? null,
    sortOrder: dto.sortOrder ?? null, isSystem: false, storeFk,
  }, userId);

  // 4. Audit (fire-and-forget)
  this.auditCommand.logRoleCreated(userId, role.id, role.code, storeFk);

  // 5. Map to wire format
  return RoleMapper.buildRoleDto(role);
}
```

### RolesValidator — Static Assertion Class

Pulls business rules out of the service so the service is pure orchestration.

```typescript
static assertStoreMatch(activeStoreId: number | null, targetStoreId: number): void {
  if (activeStoreId !== targetStoreId) {
    throw new BadRequestException(errPayload(ErrorCode.ROLE_STORE_MISMATCH));
  }
}

static assertPermissionCeiling(entries, callerPerms): void {
  // Caller cannot grant permissions they don't have themselves
  // Non-delegatable entities: ROLE, AUDIT_LOG, USER (full elevation requires super-admin)
}
```

### TransactionService.run() — Atomic Multi-Table Writes

```typescript
const updated = await this.txService.run(async (tx) => {
  const r = await this.rolesRepository.update(role.id, metaData, userId, tx);
  if (hasPermChanges) {
    await this.rolePermission.updateRolePermissions(..., tx);
  }
  return r;
}, { name: 'UpdateRoleWithPermissions' });
```

- Callback receives `tx: DbTransaction`
- Pass `tx` to repository methods that accept it (optional parameter)
- Drizzle auto-rollback on throw
- Optional `timeout` sets `SET LOCAL statement_timeout` (defends against lock holding)

### Mapper — Pure Transformation

```typescript
export class RoleMapper {
  static buildRoleDto(role: Role): RoleResponseDto {
    return {
      guuid: role.guuid,
      roleName: role.roleName,
      code: role.code,
      description: role.description,
      sortOrder: role.sortOrder,
      isSystem: role.isSystem,
      // NOTE: omits createdBy/createdAt/etc — internal audit fields, not API surface
    };
  }
}
```

**Rules:** static methods, no `this`, no async, no DB. Dates → ISO strings. Sensitive fields excluded (e.g., `token` in PublicSession).

---

## 4. Database Layer

### Schema — `core/database/schema/rbac/roles/roles.table.ts`

```typescript
export const roles = pgTable('roles', {
  ...baseEntity(),     // id, guuid, isActive, createdAt, updatedAt, deletedAt, sortOrder, isHidden, isSystem
  code: varchar('code', { length: 30 }).notNull(),
  roleName: varchar('role_name', { length: 50 }).notNull(),
  description: varchar('description', { length: 250 }),
  storeFk: bigint('store_fk', { mode: 'number' }).references(() => store.id, { onDelete: 'restrict' }),
  isSystem: boolean('is_system').notNull().default(false),
  isEditable: boolean('is_editable').notNull().default(true),
  ...auditFields(() => users.id),  // createdBy, modifiedBy, deletedBy
});
```

Four entity variants in `base.entity.ts`:
- `coreEntity()` — id, guuid, isActive, createdAt, updatedAt, deletedAt
- `baseEntity()` — coreEntity + sortOrder, isHidden, isSystem
- `appendOnlyEntity()` — id, createdAt only (audit logs)
- `betterAuthEntity()` — id, guuid, createdAt, updatedAt (no soft-delete; BetterAuth manages)

### BaseRepository — Reusable Helpers

```typescript
protected getCreationFields(userId: number) {
  return { createdBy: userId, createdAt: new Date() };
}

protected getModificationFields(userId: number) {
  return { modifiedBy: userId, updatedAt: new Date() };
}

protected getDeletionFields(userId: number) {
  return { deletedBy: userId, deletedAt: new Date(), isActive: false };
}

protected conn(tx?: DbTransaction) {
  return tx ?? this.db;  // Use tx if in transaction, else db
}

/**
 * Pagination pattern — last-page inference.
 *
 * Pattern intent:
 *   Save a COUNT(*) query when we can prove from the data query alone that
 *   we are on the final (possibly partial) page.
 *
 * Algorithm:
 *   offset := (page - 1) * pageSize
 *   rows  := await dataQuery        // already filtered + paginated
 *
 *   if rows.length < pageSize:
 *     // Last page — guaranteed by the data query itself. No count needed.
 *     // total is exact: every prior page returned `pageSize` rows, and this
 *     // page returned `rows.length`. Holds for ANY page, with ANY WHERE filter.
 *     return { rows, total: offset + rows.length }
 *
 *   // Full page — could be more after this. Pay the count query once.
 *   countRows := await countFn()    // SELECT COUNT(*) ... same WHERE
 *   return { rows, total: countRows[0]?.total ?? 0 }
 *
 * Correctness conditions:
 *   - `dataQuery` and `countFn` MUST share the same WHERE clause (filter parity).
 *   - `rows` MUST come from the same transaction snapshot as `countFn` would
 *     (read committed is fine for our use; both run within the same request).
 *
 * What this is NOT:
 *   - Not a "first-page only" optimization. Works on every page.
 *   - Not an estimate — `total` is exact in both branches.
 */
protected async paginate<T>(
  dataPromise: Promise<T[]>,
  countFactory: () => Promise<{ total: number }[]>,
  page: number,
  pageSize: number,
): Promise<{ rows: T[]; total: number }> {
  const rows = await dataPromise;
  const offset = (page - 1) * pageSize;
  if (rows.length < pageSize) {
    return { rows, total: offset + rows.length };
  }
  const countRows = await countFactory();
  return { rows, total: countRows[0]?.total ?? 0 };
}
```

### Projection Discipline

**List view** (lightweight, omit large/sensitive fields):
```typescript
.select({ id, guuid, code, roleName })  // Only what list needs
```

**Detail view** (full record):
```typescript
.select()  // All columns
```

---

## 5. Cross-Cutting Concerns

### Audit (Async, Off Hot Path)

```
RolesService.createRole
  → auditCommand.logRoleCreated(userId, roleId, code, storeFk)
    → emits AuditEvents.LOG with payload
      → AuditEventListener (@OnEvent, async: true)
        → INSERT INTO audit_log (user_fk, action, entity_type, entity_id, meta, ...)
```

Critical failures emit `[AUDIT-CRITICAL-LOSS]` alert separately for compliance monitoring.

### Permission Cache — `permission-evaluator.service.ts`

```typescript
class PermissionCache {
  // Key: `${sortedRoleIds}:${entityCode}:${action}`
  // TTL: 5 min (lazy eviction on read)
  // Secondary index: roleId → Set<key> for O(k) invalidation
  
  invalidateForRole(roleId: number): void {
    // Called when role permissions change
  }
}
```

**Multi-pod caveat:** per-process; cross-pod invalidation via TTL only (≤5 min staleness).

### Session Rotation (Cookie Auth Only)

`AuthGuard` decides → `req.sessionContext` populated → `SessionRotationInterceptor` reads after handler → DB rotation + Set-Cookie header.

Bearer auth: client-driven (POST /auth/refresh-token).

---

## 6. Response Path (Outbound)

### ResponseInterceptor (TransformInterceptor)

```typescript
intercept(context, next) {
  if (raw)              return next.handle();           // @RawResponse → skip
  if (statusCode === 204) return undefined;             // No body
  
  if (data instanceof PaginatedResult) {
    return new ApiResponse({ status: 'success', statusCode, data: data.data, meta: data.meta, requestId });
  }
  return new ApiResponse({ status: 'success', statusCode, message, data, requestId });
}
```

### Wire Format

**Single object:**
```json
{
  "message": "Role created successfully",
  "data": { "guuid": "...", "roleName": "Manager", "code": "MANAGER", ... },
  "meta": { "timestamp": "...", "requestId": "abc-123" }
}
```

**Paginated:**
```json
{
  "data": [ { ... }, ... ],
  "pagination": { "page": 1, "pageSize": 10, "total": 45, "totalPages": 5, "hasMore": true },
  "meta": { "timestamp": "...", "requestId": "..." }
}
```

### GlobalExceptionFilter — Priority

1. **AppException** — typed domain exception (carries errorCode + statusCode)
2. **ZodValidationException** — extracts field errors → 400
3. **HttpException** — standard NestJS
4. **PostgreSQL errors:**
   - 23505 (unique violation) → 409 Conflict
   - 23503 (FK violation) → 400 Bad Request
   - 23502 (NOT NULL violation) → 400 Bad Request
5. **Unknown** → 500 (safe fallback)

---

## 7. Error Handling

### Exception Hierarchy

```
AppException (base, carries errorCode + statusCode)
├── BadRequestException (400)
├── UnauthorizedException (401)
├── ForbiddenException (403)
├── NotFoundException (404)
├── ConflictException (409)
└── InternalServerException (500)
```

### Error Code Pattern

```typescript
// constants
export enum ErrorCode {
  ROLE_NOT_FOUND = 'ROLE_NOT_FOUND',
  ROLE_STORE_MISMATCH = 'ROLE_STORE_MISMATCH',
  // ...
}

// helper
export function errPayload(code: ErrorCode) {
  return { errorCode: code };
}

// usage in validator
throw new BadRequestException(errPayload(ErrorCode.ROLE_STORE_MISMATCH));
```

---

## 8. Sequence Diagram — POST /roles

```
Client → POST /api/v1/roles { storeGuuid, name, code, ... }
  │
  ▼
[Middleware] helmet + cookieParser + requestId + csrf
  │
  ▼
[AuthGuard]
  ├─ @Public? no
  ├─ Extract token (cookie nks_session)
  ├─ DB: validate session (expiry, JTI, CSRF)
  ├─ Build SessionUser { userId=7, activeStoreId=1, roles=[{roleId:5, storeFk:1}] }
  └─ req.user populated
  │
  ▼
[RateLimitingGuard] within limits ✓
  │
  ▼
[RBACGuard]
  ├─ @RequireEntityPermission({ action: 'create' })
  ├─ @EntityResource(ROLE) → entityCode = 'ROLE'
  ├─ DB: validate entity code in registry ✓
  ├─ STORE scope → activeStoreId=1 ✓
  ├─ DB single query: findActiveWithOwnership(7, 1) → store active + has role ✓
  └─ PermissionEvaluator.evaluate({roles, storeId:1}, {ROLE, create}) → cache miss → DB → true ✓
  │
  ▼
[AppValidationPipe]
  ├─ TrimStringsPipe → name: "Manager", code: "manager"
  └─ ZodValidationPipe → code.toUpperCase() = "MANAGER"
  │
  ▼
[Controller] createRole(dto, user)
  │
  ▼
[RolesService.createRole]
  ├─ findStoreIdByGuuid → storeFk=1
  ├─ assertStoreMatch(1, 1) ✓                      ← cross-tenant defense
  ├─ isSystemRoleCode('MANAGER') → false ✓
  ├─ assertCodeNotReserved(false) ✓
  ├─ rolesRepository.create({...}, userId=7)
  │   └─ INSERT INTO roles (...) RETURNING * → role { id:42, guuid, ... }
  ├─ auditCommand.logRoleCreated(7, 42, 'MANAGER', 1)
  │   └─ emit AuditEvents.LOG (fire-and-forget)
  │       └─ AuditEventListener → INSERT INTO audit_log (...)  [async]
  └─ RoleMapper.buildRoleDto(role) → RoleResponseDto
  │
  ▼
[SessionRotationInterceptor] (rotation due → DB update + Set-Cookie)
  │
  ▼
[ResponseInterceptor]
  └─ wrap in ApiResponse { status: 'success', data, message, requestId }
  │
  ▼
HTTP 201 Created
Set-Cookie: nks_session=<newToken>; HttpOnly; Secure
X-Request-ID: abc-123
{
  "message": "Role created successfully",
  "data": { "guuid": "...", "roleName": "Manager", "code": "MANAGER", ... },
  "meta": { "timestamp": "...", "requestId": "abc-123" }
}
```

---

## 9. Status Flow Comparison (Simpler — PLATFORM scoped)

| Aspect | Role | Status |
|--------|------|--------|
| Decorator | `@RequireEntityPermission({action: 'create'})` | `@RequireEntityPermission({action: 'create', scope: 'PLATFORM'})` |
| Scope | STORE (activeStoreId required) | PLATFORM (no store context) |
| Class | `@EntityResource(ROLE)` | `@EntityResource(STATUS)` |
| Cross-tenant defense | `assertRoleStoreAccess` | N/A (platform-scoped) |
| Public read endpoint | No | Yes (`GET /statuses` is `@Public()`) |

For platform-scoped resources, RBACGuard skips the store-context check and evaluates against the user's platform roles directly.

---

## 10. Key Files Reference

### Bootstrap
- `src/main.ts`
- `src/app.module.ts`

### Infrastructure
- `src/core/database/base.repository.ts`
- `src/core/database/transaction.service.ts`
- `src/core/database/inject-db.decorator.ts`
- `src/core/database/schema/base.entity.ts`

### Common (cross-cutting)
- `src/common/guards/auth.guard.ts`
- `src/common/guards/rbac.guard.ts`
- `src/common/guards/rate-limiting.guard.ts`
- `src/common/decorators/{require-entity-permission, entity-resource, current-user, public, response-message, raw-response}.decorator.ts`
- `src/common/interceptors/response.interceptor.ts`
- `src/common/interceptors/session-rotation.interceptor.ts`
- `src/common/filters/global-exception.filter.ts`
- `src/common/pipes/app-validation.pipe.ts`
- `src/common/utils/{api-response, paginated-result}.ts`
- `src/common/constants/error-codes.constants.ts`

### Domain (Roles)
- `src/contexts/iam/roles/roles.controller.ts`
- `src/contexts/iam/roles/roles.service.ts`
- `src/contexts/iam/roles/role-permission.service.ts`
- `src/contexts/iam/roles/permission-evaluator.service.ts`
- `src/contexts/iam/roles/validators/roles.validator.ts`
- `src/contexts/iam/roles/repositories/roles.repository.ts`
- `src/contexts/iam/roles/mapper/role.mapper.ts`

### Domain (Audit)
- `src/contexts/compliance/audit/audit-command.service.ts`
- `src/contexts/compliance/audit/audit-event.listener.ts`
- `src/contexts/compliance/audit/repositories/audit.repository.ts`

### Domain (Status — PLATFORM example)
- `src/contexts/reference-data/status/status.controller.ts` (`@Public` reads)
- `src/contexts/reference-data/status/admin-status.controller.ts` (`@RequireEntityPermission scope: PLATFORM`)
- `src/contexts/reference-data/status/status-command.service.ts`
- `src/contexts/reference-data/status/status.service.ts`

---

## Summary of Architectural Patterns Active

| Layer | Pattern |
|-------|---------|
| HTTP | Default-deny auth, decorator-driven RBAC, request-id correlation |
| Validation | Trim → Zod → Service-level Validators (typed exceptions) |
| Service | Orchestration only — no business logic in repositories |
| Repository | BaseRepository helpers, explicit projections, optional tx parameter |
| Schema | baseEntity + auditFields composition |
| Audit | Fire-and-forget event → async DB write |
| Cache | TTL + secondary-index invalidation (in-process) |
| Response | ApiResponse<T> envelope, PaginatedResult instanceof check |
| Errors | Typed AppException + errorCode enum + GlobalExceptionFilter |

This document is a snapshot as of 2026-04-29. For changes, update alongside the relevant code.
