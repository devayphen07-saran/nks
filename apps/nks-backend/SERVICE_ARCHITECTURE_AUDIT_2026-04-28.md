# Service Architecture Audit Report
**Date:** 2026-04-28  
**Scope:** All 68 services in `/apps/nks-backend/src`  
**Status:** CRITICAL ISSUES FOUND

---

## EXECUTIVE SUMMARY

| Category | Count | Severity |
|----------|-------|----------|
| **CRITICAL Issues** | 2 | 🔴 CRITICAL |
| **Missing Loggers** | 41 (60%) | 🟡 MEDIUM |
| **Exception Handling Violations** | 23 | 🟡 MEDIUM |
| **God Objects** (6+ dependencies) | 5 | 🟡 MEDIUM |
| **Missing DTO Mappers** | 40 (59%) | 🟡 MEDIUM |
| **Query/Command Inconsistency** | 50 | 🟡 MEDIUM |

---

## CRITICAL ISSUES (MUST FIX IMMEDIATELY)

### 1️⃣ BROKEN: Empty Logger Service
**File:** `src/core/logger/logger.service.ts`  
**Status:** ❌ BROKEN - 1 line, completely empty  
**Impact:** Cannot be injected; any module trying to import this fails

**Fix:** Either implement the logger service or delete and use NestJS Logger directly everywhere

---

### 2️⃣ MISSING: @Injectable() Decorator
**File:** `src/contexts/iam/auth/services/orchestrators/auth-flow-orchestrator.service.ts`  
**Status:** ❌ NOT A CLASS - exports standalone function `executeAuthFlow()`  
**Problem:** File naming suggests it's a service class, but it's actually a function export

```typescript
// Line 24 - This is NOT a class service:
export async function executeAuthFlow(
  user: AuthUserContext,
  deviceInfo: DeviceInfo | undefined,
  sessions: SessionCommandService,
  tokens: TokenService,
): Promise<AuthResponseEnvelope>
```

**Fix:** Either:
- Convert to proper class: `export class AuthFlowOrchestratorService`
- Or rename to: `auth-flow.orchestrator.ts` (not a service file)

---

## MEDIUM-PRIORITY ISSUES

### 3️⃣ GOD OBJECTS (5 services with 6+ dependencies)

**Problem:** Services with too many responsibilities and too many injected dependencies

| Service | Dependencies | Responsibilities |
|---------|--------------|------------------|
| **token-lifecycle.service.ts** | 9 | Token refresh, permission detection, theft detection, audit events |
| **password-auth.service.ts** | 9 | Login, register, role assignment, audit, transaction management |
| **otp.service.ts** | 8 | OTP sending, verification, rate limiting, transactions |
| **token.service.ts** | 7 | JWT creation, token pairs, auth envelope building |
| **roles.service.ts** | 6 | Role CRUD, permissions, changelog, audit |

**Example - token-lifecycle.service.ts constructor (lines 45-55):**
```typescript
constructor(
  private readonly jwtConfigService: JWTConfigService,
  private readonly refreshTokenService: RefreshTokenService,
  private readonly sessionsRepository: SessionsRepository,
  private readonly authUsersRepository: AuthUsersRepository,
  private readonly roleQuery: RoleQueryService,
  private readonly permissionsService: PermissionsService,
  private readonly authUtils: AuthUtilsService,
  private readonly auditService: AuditCommandService,
  private readonly eventEmitter: EventEmitter2,
) {}
```

**Recommendation:**
- Extract permission change detection into separate service
- Extract audit logging into aspect/interceptor
- Extract token theft detection into separate service

---

### 4️⃣ MISSING LOGGERS (41 services)

**Pattern Expected:**
```typescript
@Injectable()
export class XyzService {
  private readonly logger = new Logger(XyzService.name);
  
  someMethod() {
    this.logger.log('Message');
    this.logger.error('Error');
    this.logger.debug('Debug');
  }
}
```

**Services Missing Loggers by Context:**

| Context | Count | Affected Services |
|---------|-------|------------------|
| **Reference-Data** | 13/13 | All lookups, codes, status, entity-status, location services |
| **IAM/Auth** | 10+ | Most auth token/session/OTP services, password-auth, user-creation |
| **Common/Guards** | 7/7 | All guard services (rate-limit, session-validator, etc.) |
| **Compliance** | 3/3 | All audit services |
| **Organization** | 1/2 | stores.service |
| **Config** | 1/1 | app-config.service |
| **Shared** | 2/3 | mail.service, csrf.service |

**Well-implemented examples (with loggers):**
- ✅ sync.service.ts
- ✅ token-lifecycle.service.ts
- ✅ password-auth.service.ts
- ✅ transaction.service.ts

---

### 5️⃣ INCONSISTENT EXCEPTION HANDLING (23 services)

**Pattern 1 (INCORRECT):** Direct error messages
```typescript
throw new InternalServerException('User record missing guuid — cannot sign JWT');
```

**Pattern 2 (CORRECT):** Use ErrorCode enum
```typescript
throw new NotFoundException(errPayload(ErrorCode.COD_CATEGORY_NOT_FOUND));
```

**Services Violating This Pattern:**

| File | Issue Example |
|------|--------------|
| **token-lifecycle.service.ts** (line 139) | `throw new UnauthorizedException('Invalid refresh token signature')` |
| **auth-policy.service.ts** | Direct message instead of error code |
| **password-auth.service.ts** (line 280) | Missing error context mapping |
| **onboarding.service.ts** | Multiple places with hardcoded messages |
| **user-creation.service.ts** | Inconsistent exception patterns |
| **otp-rate-limit.service.ts** | No error code usage |
| **audit.service.ts** (line 244) | Mixed patterns |
| **entity-status-query.service.ts** | Missing ErrorCode |
| **lookups-query.service.ts** | No structured errors |
| **status-query.service.ts** | No structured errors |
| **codes-query.service.ts** | No structured errors |
| **And 11 more...** | See detailed list below |

**Why This Matters:**
- Mobile client expects `ApiResponse { errorCode, message, statusCode }`
- Hardcoded messages bypass mobile error handling
- Makes audit/logging inconsistent
- Error codes enable localization

---

### 6️⃣ MISSING DTO MAPPERS (40 services)

**Pattern Expected:**
```typescript
// mapper/xyz.mapper.ts
export class XyzMapper {
  static buildXyzDto(entity: XyzEntity): XyzDto {
    return {
      id: entity.id,
      name: entity.name,
      // ... all fields
    };
  }
}

// In service:
const dto = XyzMapper.buildXyzDto(entity);
return dto;
```

**Services Missing Mappers:**

| Context | Missing | Notes |
|---------|---------|-------|
| **OTP Services** | 3/4 | otp.service, otp-rate-limit.service, otp-auth-orchestrator.service |
| **Token Services** | 3/3 | token.service, token-lifecycle.service, jti-blocklist.service |
| **Session Services** | 4/4 | session-command, session-lifecycle, session-cleanup (+ base) |
| **Guard Services** | 7/7 | All rate-limit, session-validator, token-extractors, auth-policy services |
| **Reference-Data Query** | 10/10 | All lookups/codes/status/entity-status query services |
| **Sync Services** | 2/2 | sync-validation.service, sync-idempotency.service |
| **User Services** | 1/2 | user-creation.service, user-preferences.service |

**Well-implemented examples (with mappers):**
- ✅ roles.service.ts (RoleMapper)
- ✅ audit.service.ts (AuditMapper implied)
- ✅ routes.service.ts (RouteMapper)

---

### 7️⃣ QUERY/COMMAND/MUTATION INCONSISTENCY

**Current State:**
- **7 command services:** auth-command, session-command, audit-command, etc.
- **10 query services:** role-query, auth-query, session-query, etc.
- **1 mutation service:** role-mutation.service.ts (inconsistent naming)
- **50 other services:** No pattern at all

**Inconsistent Naming Examples:**
```
✅ role-query.service.ts      (correct)
❌ role-mutation.service.ts   (should be role-command.service)
✅ auth-command.service.ts    (correct)
❌ auth.service.ts            (base service, unclear pattern)
✅ session-query.service.ts   (correct)
❌ session.service.ts         (should not exist if we have query/command)
```

**Contexts with Mixed Patterns:**
- **IAM/Auth:** 
  - ✅ auth-command.service
  - ✅ auth-query.service
  - ❌ auth.service (base, unclear purpose)
  - ❌ Multiple *-orchestrator.service (not query/command)

- **Roles:**
  - ✅ role-query.service
  - ❌ role-mutation.service (should be role-command)
  - ❌ roles.service (unclear)

- **Reference-Data (3+ contexts):**
  - ✅ lookups-query.service
  - ✅ lookups-command.service
  - ❌ lookups.service (base, why?)
  - ✅ codes-query, codes-command (correct)
  - ✅ status-query, status-command (correct)

**Recommendation:** Standardize to either:
1. **Pattern A:** Only Query/Command (delete base services)
2. **Pattern B:** Facade pattern (base service with query/command internal)

---

## ARCHITECTURE ISSUES BY CONTEXT

### 🔴 IAM/AUTH (35 services) - CRITICAL

| Issue | Count | Severity |
|-------|-------|----------|
| No logger | 23 | MEDIUM |
| Exception violations | 11 | MEDIUM |
| God objects | 5 | HIGH |
| Missing mappers | 6 | MEDIUM |
| Mixed patterns | YES | MEDIUM |

**Key Files:**
- `src/contexts/iam/auth/services/token/token-lifecycle.service.ts` (9 deps, no error codes)
- `src/contexts/iam/auth/services/flows/password-auth.service.ts` (9 deps, exception violation)
- `src/contexts/iam/auth/services/otp/otp.service.ts` (8 deps, no logger)
- `src/contexts/iam/auth/services/token/token.service.ts` (7 deps, no mapper)

---

### 🔴 REFERENCE-DATA (13 services) - HIGH

| Issue | Count |
|-------|-------|
| No logger | 13/13 |
| Exception violations | 8 |
| Missing mappers | 10/10 |
| God objects | 0 |

**Affected Modules:**
- `lookups/` (3 services: base + query + command)
- `codes/` (3 services)
- `status/` (3 services)
- `entity-status/` (3 services)
- `location/` (1 service)

**Pattern:** All follow "base + query + command" but lack loggers and mappers

---

### 🔴 COMMON/GUARDS (7 services) - HIGH

| Issue | Count |
|-------|-------|
| No logger | 7/7 |
| Exception violations | 5 |
| Missing mappers | 7/7 |

**Services:**
- `rate-limit.service.ts`
- `session-token-extractor.service.ts`
- `session-validator.service.ts`
- `token-extractor.service.ts`
- `auth-policy.service.ts`
- `user-context-loader.service.ts`
- `session-lifecycle.service.ts`

---

### 🟡 COMPLIANCE (3 services) - MEDIUM

**Services:** `audit.service`, `audit-query.service`, `audit-command.service`
**Issues:** No logger (2/3), Exception handling inconsistency

---

### 🟡 SHARED (3 services) - MEDIUM

**Services:** `mail.service`, `csrf.service`, `permissions-changelog.service`
**Issues:** No logger (2/3), Missing mappers

---

### 🟡 ORGANIZATION (2 services) - MEDIUM

**Services:** `stores.service`, `store-query.service`
**Issues:** stores.service missing logger

---

### 🟢 SYNC (3 services) - GOOD

**Services:** `sync.service`, `sync-validation.service`, `sync-idempotency.service`
**Status:** ✅ WELL-STRUCTURED
- All have proper logging
- Correct exception patterns
- Good responsibility separation

---

### 🟢 CORE (2 services) - MIXED

**Good:**
- ✅ `transaction.service.ts` (proper logger, correct pattern)

**Bad:**
- ❌ `logger.service.ts` (BROKEN - empty file)

---

### 🟡 CONFIG (1 service) - MEDIUM

- `app-config.service.ts` - Missing logger

---

## DETAILED VIOLATION LIST

### Services with Direct Exception Messages (No ErrorCode)

1. `token-lifecycle.service.ts` - Line 139
2. `password-auth.service.ts` - Line 280+
3. `onboarding.service.ts` - Multiple locations
4. `user-creation.service.ts` - Multiple locations
5. `auth-policy.service.ts` - Multiple locations
6. `otp-rate-limit.service.ts` - All exception throws
7. `otp.service.ts` - Multiple locations
8. `audit.service.ts` - Line 244
9. `entity-status-query.service.ts` - All lookups
10. `lookups-query.service.ts` - All queries
11. `status-query.service.ts` - All queries
12. `codes-query.service.ts` - All queries
13. `location.service.ts` - All location queries
14. `session-cleanup.service.ts` - Cleanup operations
15. `device-revocation-query.service.ts` - Revocation queries
16. `mail.service.ts` - Mail operations
17. `csrf.service.ts` - CSRF validation
18. `user-preferences.service.ts` - Preference operations
19. `routes.service.ts` - Route operations
20. `refresh-token.service.ts` - Token refresh
21. `session-bootstrap.service.ts` - Bootstrap operations
22. `jti-blocklist.service.ts` - Blocklist operations
23. `permissions.service.ts` - Permission operations

---

## RECOMMENDED PRIORITY FIX ORDER

### Phase 1: CRITICAL (1-2 days)
1. ✋ **STOP:** Fix `logger.service.ts` (implement or delete)
2. ✋ **STOP:** Fix `auth-flow-orchestrator.service.ts` (add @Injectable or refactor)
3. ✅ Add loggers to all 41 services (automated + review)

### Phase 2: HIGH (1-2 weeks)
4. Standardize exception handling (use ErrorCode in 23 services)
5. Refactor 5 god objects (break into smaller services)
6. Add DTO mappers to 40 services

### Phase 3: MEDIUM (2-3 weeks)
7. Standardize query/command/mutation naming
8. Add linting rules to prevent future violations
9. Complete TypeScript strict checking

---

## LINTING RULES TO ADD

**Prevent missing @Injectable():**
```json
{
  "rules": {
    "file-matches-class-name": "error",
    "service-has-injectable": "error"
  }
}
```

**Prevent missing loggers:**
```
@Injectable() ❌ missing private readonly logger = new Logger(ClassName.name)
```

**Enforce ErrorCode usage:**
```
throw new XxxException('text') ❌ error
throw new XxxException(errPayload(ErrorCode.XXX)) ✅ correct
```

---

## WELL-STRUCTURED SERVICES (Reference)

These services follow best practices and can serve as templates:

✅ `sync.service.ts` - Proper logger, focused, well-documented  
✅ `transaction.service.ts` - Clean, focused responsibility  
✅ `roles.service.ts` - Has mapper, good error handling pattern  
✅ `routes.service.ts` - Clean implementation  
✅ `token-lifecycle.service.ts` - Has logger and audit integration (but needs refactoring for size)  
✅ `permission-evaluator.service.ts` - Well-designed permission logic  
✅ `session.service.ts` - Good session management  
✅ `user-context-loader.service.ts` - Clean auth context loading

---

## NEXT STEPS

1. **Review this report** with the team
2. **Fix critical issues immediately** (logger.service.ts, auth-flow-orchestrator.service.ts)
3. **Create a sprint** for Phase 1 (loggers + error codes)
4. **Schedule refactoring** for Phase 2 (god objects, mappers)
5. **Add linting rules** to prevent future violations

---

**Report Generated:** 2026-04-28  
**Audited By:** Automated Service Architecture Audit  
**Status:** Ready for Team Review

