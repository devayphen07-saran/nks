# Pattern 5: Service Interfaces & Authorization Specification

**Document Version:** 1.0  
**Last Updated:** 2026-04-29  
**Status:** Production-Ready

## Overview

This document specifies the Ayphen Pattern 5 implementation for NKS backend: **Service Interfaces & Authorization**. It defines the authorization contracts, JSDoc documentation requirements, and interface patterns for all service classes.

---

## 1. Service Authorization Categories

Services fall into 5 categories based on authorization model:

### 1.1 Permission-Based Services (RBAC)
**Permission checks enforced via @RequirePermission/@RequireEntityPermission decorators at controller level.**

**Pattern:**
```typescript
/**
 * [ServiceName]
 *
 * Manages [resource] lifecycle.
 * All methods require platform/entity-level [PERMISSION.ACTION] permissions
 * (checked by @RequirePermission/@RequireEntityPermission decorator at controller level).
 *
 * Authorization Contract:
 *   - create[Resource](): Requires [PERMISSION].CREATE
 *   - update[Resource](): Requires [PERMISSION].EDIT
 *   - delete[Resource](): Requires [PERMISSION].DELETE
 *
 * Business Rule Validation:
 *   - [Specific rules, e.g., system resources are immutable]
 *
 * Audit Trail:
 *   - All operations tracked via AuditCommandService
 *   - userId/createdBy/modifiedBy/deletedBy identify operation performer
 */
@Injectable()
export class YourService {
  // Implementation
}
```

**Examples:**
- `lookups-command.service.ts` — LOOKUP.CREATE/EDIT/DELETE
- `status-command.service.ts` — STATUS.CREATE/EDIT/DELETE
- `roles.service.ts` — ROLE.CREATE/EDIT/DELETE via @RequireEntityPermission

**Key Properties:**
- Permission ceiling enforced (caller cannot grant permissions they don't have)
- Controller-level decorators validate before service method runs
- Service documents what permission is expected

---

### 1.2 Permission-Ceiling Enforced Services
**Special case: Service validates caller's permission ceiling to prevent privilege escalation.**

**Pattern:**
```typescript
/**
 * [ServiceName]
 *
 * Manages [resource] with permission ceiling enforcement.
 *
 * Authorization Contract:
 *   - method(): Enforces permission ceiling (caller cannot grant permissions they don't have)
 *   - Permission ceiling check MUST run BEFORE repository changes are persisted
 *   - callerPerms parameter must be validated at controller level (RBACGuard context)
 *   - If callerPerms not provided, privilege escalation is possible
 *
 * Critical Security Property:
 *   - RolesValidator.assertPermissionCeiling() called before DB writes
 */
@Injectable()
export class YourService {
  async methodWithCeiling(
    roleId: number,
    userId: number,
    entityEntries: [string, Record<string, boolean>][],
    permEntries: PermissionEntry[],
    callerPerms: RoleEntityPermissions, // ← Validated at controller
    tx?: DbTransaction,
  ): Promise<void> {
    // ← Ceiling check FIRST
    RolesValidator.assertPermissionCeiling(entityEntries, callerPerms);
    // ← Then DB writes
    await this.repository.bulkUpsert(roleId, permEntries, userId, tx);
  }
}
```

**Examples:**
- `role-permission.service.ts` — Permission ceiling enforcement

**Key Properties:**
- Prevents privilege escalation via role manipulation
- Caller permissions must be validated at controller/guard level
- Ceiling check must run before any repository writes

---

### 1.3 User-Scoped Services
**Authorization enforced via user ownership validation — user can only access/modify their own resources.**

**Pattern:**
```typescript
/**
 * [ServiceName]
 *
 * Manages user-scoped [resource].
 *
 * Authorization Contract:
 *   - method(userId, data, modifiedBy): modifiedBy must equal userId
 *   - Users can ONLY modify their own resources (validateOwnResource)
 *   - No permission checks needed — user-scoped, not permission-based access
 *
 * Business Rule Validation:
 *   - [Specific rules for the resource]
 *
 * Audit Trail:
 *   - All operations tracked via createdBy/modifiedBy/deletedBy
 */
@Injectable()
export class YourService {
  async update(userId: number, data: Partial<Data>, modifiedBy: number) {
    AuthorizationValidator.validateOwnResource(userId, modifiedBy); // ← User owns resource
    return this.repository.update(userId, data, modifiedBy);
  }
}
```

**Examples:**
- `user-preferences.service.ts` — Users modify only own preferences

**Key Properties:**
- No permission ceiling checks (not role-based)
- User ownership validated via validateOwnResource()
- Self-only modifications enforced at service layer

---

### 1.4 Post-Authentication Services
**Authorization delegated to caller — service assumes authentication has already occurred.**

**Pattern:**
```typescript
/**
 * [ServiceName]
 *
 * Handles [operation] for authenticated users.
 *
 * Authorization Contract:
 *   - Called ONLY by authenticated users (userId is already validated)
 *   - No permission checks needed in this service
 *   - Caller (auth controller/orchestrator) is responsible for validation
 *   - userId parameter identifies the authenticated user
 *
 * Business Rule Validation:
 *   - [Specific rules for the operation]
 *
 * Design Rationale:
 *   - Service runs during authentication flow when SessionUser context doesn't exist yet
 *   - Permission checks come AFTER session creation, not before
 */
@Injectable()
export class YourService {
  async method(userId: number, data: Data): Promise<Result> {
    // No permission checks — caller authenticated the user
    return this.repository.update(userId, data);
  }
}
```

**Examples:**
- `onboarding.service.ts` — Credential completion after OTP/email auth
- `session-command.service.ts` — Session creation after authentication
- `auth-flow-orchestrator.service.ts` — Token generation after auth

**Key Properties:**
- Called during login/registration flows
- SessionUser context doesn't exist yet
- Validates business rules, not permissions
- Audit logging via userId parameter

---

### 1.5 Signature-Based Services
**Authorization via cryptographic signatures (not permission ceiling).**

**Pattern:**
```typescript
/**
 * [ServiceName]
 *
 * Validates [operation] via signature verification (not permission-based).
 *
 * Authorization Contract (Signature-Based):
 *   - Operations validated via cryptographic HMAC/JWT signatures
 *   - Mobile client computes signature; server verifies via timing-safe comparison
 *   - Device revocation tracked separately for cross-context security
 *   - No permission ceiling checks (offline operations pre-authorized by signature)
 *
 * Key Design Decision:
 *   - Signature proves mobile client had valid session when operation was created
 *   - Device revocation ensures compromised devices cannot replay old signatures
 *   - Graceful degradation for older clients (optional signatures)
 */
@Injectable()
export class YourService {
  verifySignature(op: Operation, signingKey: string): boolean {
    // Timing-safe comparison — prevents timing attacks
    const computed = this.computeSignature(op, signingKey);
    return crypto.timingSafeEqual(computed, op.signature);
  }
}
```

**Examples:**
- `sync-validation.service.ts` — Offline sync signature verification

**Key Properties:**
- Used for offline-first operations
- Signatures prove authorization at time of operation
- Device revocation prevents replay attacks
- No permission checks (pre-authorized by offline session)

---

## 2. JSDoc Authorization Contract Specification

Every command/mutation service must include JSDoc with these sections:

### 2.1 Required Sections
```typescript
/**
 * [ServiceName]
 *
 * [Brief description of what the service manages]
 *
 * Authorization Contract:
 *   - [method1]: [How authorization is enforced]
 *   - [method2]: [How authorization is enforced]
 *   - [method3]: [How authorization is enforced]
 *
 * Business Rule Validation:
 *   - [Rule 1]
 *   - [Rule 2]
 *   - [Rule 3]
 *
 * Audit Trail:
 *   - [How operations are logged]
 *   - [What parameters identify the actor]
 *   - [What systems are involved (AuditCommandService, etc)]
 */
```

### 2.2 Optional Sections (add if applicable)
- **Critical Security Property:** For services with privilege escalation risks
- **Transactionality:** For services that wrap operations in transactions
- **Design Rationale:** For unusual authorization patterns
- **Store Scoping:** For store-scoped operations (STORE vs PLATFORM)

### 2.3 Examples

#### Example 1: Permission-Based Command Service
```typescript
/**
 * StatusCommandService
 *
 * Manages status lifecycle (create, update, delete).
 * All methods require platform-level STATUS.CREATE/EDIT/DELETE permissions
 * (checked by @RequirePermission decorator at controller level).
 *
 * Authorization Contract:
 *   - Caller must have STATUS.CREATE permission to call createStatus()
 *   - Caller must have STATUS.EDIT permission to call updateStatus()
 *   - Caller must have STATUS.DELETE permission to call deleteStatus()
 *
 * Business Rule Validation:
 *   - System statuses (isSystem=true) are immutable — cannot be modified or deleted
 *   - Prevents accidental modification of critical system states
 *
 * Audit Trail:
 *   - All operations tracked via AuditCommandService
 *   - userId/createdBy/modifiedBy/deletedBy parameters identify who performed the operation
 */
```

#### Example 2: Permission-Ceiling Service
```typescript
/**
 * RolePermissionService
 *
 * Role permission management with ceiling enforcement.
 *
 * Authorization Contract:
 *   - updateRolePermissions() enforces permission ceiling:
 *     * Caller cannot grant permissions they don't have (ceiling check)
 *     * Validates against callerPerms parameter (passed from controller)
 *     * Prevents privilege escalation via role manipulation
 *
 * Critical Security Property:
 *   - Permission ceiling check (RolesValidator.assertPermissionCeiling) MUST run
 *     before any repository changes are persisted
 *   - If callerPerms is not provided/validated at controller level, privilege
 *     escalation is possible — ALWAYS pass validated callerPerms from RBACGuard context
 */
```

#### Example 3: User-Scoped Service
```typescript
/**
 * UserPreferencesService
 *
 * Manages user preference lifecycle (create, read, update, delete).
 *
 * Authorization Contract:
 *   - getOrCreate(userId, createdBy): createdBy must equal userId (can only create own preferences)
 *   - update(userId, data, modifiedBy): modifiedBy must equal userId (can only modify own preferences)
 *   - delete(userId, deletedBy): deletedBy must equal userId (can only delete own preferences)
 *
 * Business Rule Validation:
 *   - Users can ONLY modify their own preferences (validateOwnResource)
 *   - No permission checks needed — user-scoped, not permission-based access
 *   - Prevents users from modifying other users' preferences
 */
```

#### Example 4: Post-Authentication Service
```typescript
/**
 * OnboardingService
 *
 * Credential-completion flows for newly authenticated users.
 *
 * Authorization Contract:
 *   - Called ONLY by authenticated users (userId must be their own session user ID)
 *   - No permission checks needed — user can only complete their own onboarding
 *   - Caller (auth controller) is responsible for validating userId matches session
 */
```

---

## 3. Authorization Validation Patterns

### 3.1 Permission Ceiling Validation
```typescript
// RolePermissionService pattern
async updateRolePermissions(
  roleId: number,
  userId: number,
  entityEntries: [string, Record<string, boolean>][],
  permEntries: PermissionEntry[],
  callerPerms: RoleEntityPermissions,
  tx?: DbTransaction,
): Promise<void> {
  // ← Ceiling check BEFORE any DB writes
  RolesValidator.assertPermissionCeiling(entityEntries, callerPerms);
  
  // ← Then perform mutations
  if (tx) {
    await this.rolePermissionsRepository.bulkUpsert(roleId, permEntries, userId, tx);
  } else {
    await this.txService.run(async (innerTx) => {
      await this.rolePermissionsRepository.bulkUpsert(roleId, permEntries, userId, innerTx);
    });
    this.postCommitEffects(roleId, userId, permEntries);
  }
}
```

### 3.2 User Ownership Validation
```typescript
// UserPreferencesService pattern
async update(userId: number, data: Partial<UserPreferences>, modifiedBy: number) {
  // ← Validate user owns resource
  AuthorizationValidator.validateOwnResource(userId, modifiedBy);
  
  // ← Then mutate
  return this.userPreferencesRepository.update(userId, data, modifiedBy);
}
```

### 3.3 Signature Verification
```typescript
// SyncValidationService pattern
verifyOperationSignature(op: SyncOperation & { signature?: string }, signingKey: string): boolean {
  if (!op.signature) {
    // Graceful degradation for older clients
    return true;
  }
  
  const canonical = `${op.op}:${op.table}:${canonicalJson(op.opData)}`;
  const expected = crypto
    .createHash('sha256')
    .update(`${signingKey}:${canonical}`)
    .digest('hex');
  
  // ← Timing-safe comparison prevents timing attacks
  const sigBuf = Buffer.from(op.signature, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  return crypto.timingSafeEqual(sigBuf, expBuf);
}
```

---

## 4. Audit Logging Patterns

All mutation services must track operations via audit logging:

### 4.1 AuditCommandService (Event-Based)
```typescript
// Pattern: Log each operation immediately
this.auditCommand.logStatusCreated(createdBy, status.guuid, status.code);
this.auditCommand.logRoleUpdated(userId, role.id, role.code, changedFields);
this.auditCommand.logEntityStatusAssigned(userId, entityCode, statusCode);
```

### 4.2 Repository-Level Audit Fields
```typescript
// Pattern: Pass userId to repository for createdBy/modifiedBy/deletedBy tracking
await this.repository.create(data, createdBy);
await this.repository.update(id, data, modifiedBy);
await this.repository.softDelete(id, deletedBy);
```

### 4.3 Async Changelog (Non-Blocking)
```typescript
// Pattern: Fire-and-forget changelog with error logging
this.permissionsChangelog.recordChange(roleId, entityCode, 'MODIFIED', perms).catch((e) =>
  this.logger.error(`Changelog failed: ${e instanceof Error ? e.message : String(e)}`),
);
```

---

## 5. Transaction & Post-Commit Effects Pattern

Services modifying state should follow this pattern:

```typescript
async updateResource(
  resourceId: number,
  userId: number,
  data: UpdateData,
  tx?: DbTransaction,
): Promise<void> {
  // Permission/validation checks first
  RolesValidator.assertPermissionCeiling(entries, callerPerms);
  
  // Mutations wrapped in transaction (create own if not provided)
  if (tx) {
    await this.repository.update(resourceId, data, userId, tx);
  } else {
    await this.txService.run(
      async (innerTx) => {
        await this.repository.update(resourceId, data, userId, innerTx);
      },
      { name: 'UpdateResource' },
    );
    // Post-commit effects run after transaction commits
    this.postCommitEffects(resourceId, userId, data);
  }
}

private postCommitEffects(resourceId: number, userId: number, data: UpdateData): void {
  // Cache invalidation
  this.permissionEvaluator.invalidateForRole(resourceId);
  
  // Audit logging
  this.auditCommand.logResourceUpdated(userId, resourceId, data);
  
  // Async changelog (non-blocking)
  this.changelog.recordChange(resourceId, 'MODIFIED', data).catch((e) =>
    this.logger.error(`Changelog failed: ${e instanceof Error ? e.message : String(e)}`),
  );
}
```

---

## 6. Store-Scoped vs Platform-Level Operations

### 6.1 Store-Scoped (Entity-Level Permissions)
```typescript
// Example: RolesService — roles are scoped to a store
async createRole(userId: number, dto: CreateRoleDto, activeStoreId: number | null): Promise<RoleResponseDto> {
  // Validate caller is in the target store
  RolesValidator.assertStoreMatch(activeStoreId, storeFk);
  
  // Role creation is store-scoped, uses @RequireEntityPermission at controller
}
```

### 6.2 Platform-Level (Platform Permissions)
```typescript
// Example: StatusCommandService — statuses are platform-level
async createStatus(dto: CreateStatusDto, createdBy: number): Promise<StatusResponse> {
  // No store context needed — uses @RequirePermission for platform-level STATUS.CREATE
}
```

### 6.3 User-Scoped (No Store Context)
```typescript
// Example: UserPreferencesService — preferences are user-global
async update(userId: number, data: Partial<UserPreferences>, modifiedBy: number) {
  // No store/permission context — only user ownership matters
  AuthorizationValidator.validateOwnResource(userId, modifiedBy);
}
```

---

## 7. Service Interface Checklist

When implementing a new mutation service:

- [ ] **Authorization Contract Documented:** JSDoc with Authorization Contract section
- [ ] **Permission Validation:** If permission-based, controller decorator in place (@RequirePermission/@RequireEntityPermission)
- [ ] **Ceiling Check (if applicable):** RolesValidator.assertPermissionCeiling() called before DB writes
- [ ] **User Validation (if applicable):** AuthorizationValidator.validateOwnResource() called before modifications
- [ ] **Signature Verification (if applicable):** Timing-safe signature comparison for offline operations
- [ ] **Audit Logging:** AuditCommandService or repository-level createdBy/modifiedBy/deletedBy
- [ ] **Transactionality:** Mutations wrapped in txService.run() or tx parameter
- [ ] **Post-Commit Effects:** Cache invalidation + async changelog after transaction commits
- [ ] **Business Rule Validation:** Validators called before mutations (immutability checks, etc)
- [ ] **Error Handling:** Appropriate AppException subclasses thrown (ForbiddenException, UnauthorizedException, etc)
- [ ] **Unused Imports Removed:** Logger, unused dependencies cleaned up

---

## 8. Production Services Reference

**Status:** Pattern 5 fully implemented across NKS backend

### Documented Services (13):
1. `role-permission.service.ts` — Permission ceiling enforcement ✅
2. `status-command.service.ts` — Platform-level STATUS permissions ✅
3. `user-preferences.service.ts` — User-scoped access ✅
4. `lookups-command.service.ts` — Platform-level LOOKUP permissions ✅
5. `entity-status-command.service.ts` — Public endpoint (no auth) ✅
6. `roles.service.ts` — Entity-level ROLE permissions ✅
7. `stores.service.ts` — Membership-scoped access ✅
8. `auth-flow-orchestrator.service.ts` — Post-auth orchestration ✅
9. `status.service.ts` — Query+Command (STATUS permissions) ✅
10. `onboarding.service.ts` — Post-auth credential completion ✅
11. `session-command.service.ts` — User-scoped session management ✅
12. `sync-validation.service.ts` — Signature-based validation ✅
13. `permission-evaluator.service.ts` — Permission evaluation with caching ✅

### Auth/Session Services (11):
Correctly designed as post-authentication — no permission checks needed.
Document their authorization delegation pattern.

### Query Services (20+):
Read-only, no authorization documentation needed (no mutations).

---

## 9. Migration Path for Undocumented Services

For services currently lacking authorization contracts:

1. **Identify Category:** Permission-based? User-scoped? Post-auth? Signature-based?
2. **Add JSDoc:** Use appropriate template from Section 2.3
3. **Verify Validation:** Confirm permission/ownership/signature checks are in place
4. **Audit Logging:** Ensure createdBy/modifiedBy/deletedBy tracked
5. **Review Controller:** Verify @RequirePermission/@RequireEntityPermission decorators if needed

---

## 10. Design Principles

1. **Explicit over Implicit:** Authorization contracts documented in code, not inferred
2. **Defense in Depth:** Multiple layers (decorator + service + repository)
3. **Fail Secure:** Permission checks before mutations, not after
4. **Audit Everything:** All state changes tracked via createdBy/modifiedBy/deletedBy
5. **Post-Auth Services:** No permission ceiling checks, only business rule validation
6. **User Ownership:** Validated via validateOwnResource(), not permission ceiling
7. **Signature Verification:** Timing-safe comparison to prevent timing attacks
8. **Graceful Degradation:** Signature optional for backward compatibility

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-29 | Initial specification — 13 services documented, 5 patterns defined |

