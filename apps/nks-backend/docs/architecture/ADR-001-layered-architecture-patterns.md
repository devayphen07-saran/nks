# ADR-001: Layered Architecture & Separation of Concerns

**Date:** 2026-04-09
**Status:** ACCEPTED
**Supersedes:** None
**Related:** Architecture audit session, Issues #1-5 architectural violations

---

## Context

The NKS backend uses a layered architecture with distinct responsibilities:
- **Database Layer**: Drizzle ORM schema definitions
- **Repository Layer**: Data access and persistence
- **Service Layer**: Business logic and orchestration
- **Mapper Layer**: Data transformation
- **Controller Layer**: HTTP endpoints
- **Configuration Layer**: External library setup

However, over time, concerns became blurred:
- Repositories threw exceptions instead of returning nullable values
- Services called `db.transaction()` directly
- Business logic scattered across config files and mappers
- Circular service dependencies emerged
- Hidden helpers obscured exception-throwing behavior

This ADR establishes clear patterns to maintain clean layered architecture.

---

## Decision

We adopt the following layered architecture principles:

### 1. Repository Pattern

**Definition:** Repositories abstract data access. They are the ONLY layer that directly calls the database.

**Rules:**

#### Finder Methods (Return Data)
- **MUST** return `T | null` (never throw)
- **MUST NOT** throw exceptions
- Examples: `findById()`, `findByEmail()`, `findByPhone()`

```typescript
// ✅ CORRECT
async findById(id: number): Promise<DbUser | null> {
  const [user] = await this.db.select().from(schema.users)
    .where(eq(schema.users.id, id)).limit(1);
  return user ?? null;
}

// ❌ WRONG
async findById(id: number): Promise<DbUser> {
  const [user] = await this.db.select().from(schema.users)
    .where(eq(schema.users.id, id)).limit(1);
  if (!user) throw new NotFoundException('User not found');
  return user;
}
```

#### Modifier Methods (Create/Update/Delete)
- **CAN** throw exceptions for validation failures
- **MUST** inline exception logic (no hidden throwing helpers)
- **MUST** document what exceptions can be thrown
- Examples: `create()`, `update()`, `delete()`

```typescript
// ✅ CORRECT - Visible exception logic
async create(data: NewUser): Promise<DbUser | null> {
  const [user] = await this.db.insert(schema.users)
    .values(data).returning();
  return user ?? null;
}

// ✅ CORRECT - Visible validation throws
async upsertPermission(roleId: number, entityCode: string, perm: any): Promise<void> {
  const entityTypeId = await this.resolveEntityTypeId(entityCode);
  if (!entityTypeId) {
    throw new NotFoundException(`Entity type '${entityCode}' not found`);
  }
  // ... update logic
}

// ❌ WRONG - Hidden throwing helper
async upsertPermission(roleId: number, entityCode: string, perm: any): Promise<void> {
  const entityTypeId = await this.resolveEntityTypeIdOrThrow(entityCode);
  // ... update logic
}

// ❌ WRONG - Throwing helper
private async resolveEntityTypeIdOrThrow(code: string): Promise<number> {
  const id = await this.resolveEntityTypeId(code);
  if (!id) throw new NotFoundException(...);
  return id;
}
```

#### Transaction Methods
- **MUST** wrap atomic operations in `db.transaction()`
- **MUST** return the created/updated entity or null
- Examples: `createUserWithInitialRole()`, `updateProfileWithEmailPhone()`

```typescript
// ✅ CORRECT - Transaction in repository
async createUserWithInitialRole(
  userData: NewUser,
  authProviderData: {...},
  onRoleAssignment: (tx, userId) => Promise<void>,
): Promise<DbUser | null> {
  return await this.db.transaction(async (tx) => {
    const [user] = await tx.insert(schema.users).values(userData).returning();
    if (!user) return null;
    // ... more operations in tx
    await onRoleAssignment(tx, user.id);
    return user;
  });
}

// ❌ WRONG - Transaction in service
async register(dto: RegisterDto): Promise<AuthResponse> {
  const user = await this.db.transaction(async (tx) => {
    // ... create user and role in tx
  });
}
```

**Benefits:**
- Clear contract: finder methods always return nullable
- Service layer knows what can throw and what can't
- Hidden exceptions are eliminated
- Testable: can mock repository methods knowing return types

---

### 2. Service Layer

**Definition:** Services contain all business logic and orchestrate between repositories and external dependencies.

**Rules:**

#### Business Logic
- **MUST** live in services, not in config or mappers
- Examples: role assignment, permission checks, OTP verification coordination
- **MUST** check nullable repository results and decide action

```typescript
// ✅ CORRECT - Business logic in service
async register(dto: RegisterDto): Promise<AuthResponse> {
  const user = await this.authUsersRepository.createUserWithInitialRole(
    userData,
    authProviderData,
    async (tx, userId) => await this.assignInitialRoleInTransaction(userId, tx),
  );

  if (!user) {
    throw new ConflictException('Email already in use');
  }
  // ... continue auth flow
}

// ❌ WRONG - Business logic in config
export const getAuth = (db: Database) => {
  return betterAuth({
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            const superAdminRole = await db.select()...
            if (!superAdminRole) await db.insert(...);
          }
        }
      }
    }
  });
};
```

#### Exception Handling
- **MUST** check repository results and throw service-level exceptions
- **SHOULD** NOT catch exceptions from repositories (let them propagate)
- **MUST** throw domain-specific exceptions (not generic errors)

```typescript
// ✅ CORRECT
async findOrCreateUserByPhone(phone: string): Promise<User> {
  let user = await this.authUsersRepository.findByPhone(phone);

  if (!user) {
    user = await this.authUsersRepository.create({
      phoneNumber: phone,
      // ...
    });

    if (!user) {
      throw new Error('Failed to create user');
    }
  }

  return user;
}

// ❌ WRONG - Repository throws
async findOrCreateUserByPhone(phone: string): Promise<User> {
  // Repository.findByPhone throws NotFoundException if not found
  const user = await this.authUsersRepository.findByPhone(phone);
  return user;
}
```

#### Service Dependencies
- **MUST** form acyclic dependency graph
- **CAN** call other services one direction (A → B, never B → A)
- **MUST** use orchestrator pattern for bidirectional flows

```typescript
// ✅ CORRECT - One direction
class AuthService {
  constructor(
    private readonly otpService: OtpService,
    // OtpService only calls OtpService methods, no reverse call
  ) {}

  async sendOtp(phone: string): Promise<void> {
    await this.otpService.sendOtp({ phone });
  }
}

// ✅ CORRECT - Orchestrator breaks cycle
class OtpAuthOrchestrator {
  constructor(
    private readonly otpService: OtpService,
    private readonly authService: AuthService,
  ) {}

  async verifyOtpAndBuildAuthResponse(dto): Promise<AuthResponse> {
    const result = await this.otpService.verifyOtp(dto);
    const session = await this.authService.createSessionForUser(result.userId);
    return this.authService.buildAuthResponse(result.user, session);
  }
}

// ❌ WRONG - Circular
class OtpService {
  constructor(private readonly authService: AuthService) {}

  async verifyOtp(dto): Promise<AuthResponse> {
    const user = await this.authService.findOrCreateUserByPhone(phone);
    // Can't also have AuthService calling OtpService
  }
}

class AuthService {
  constructor(private readonly otpService: OtpService) {}

  async sendOtp(phone: string): Promise<void> {
    await this.otpService.sendOtp({ phone }); // CYCLE!
  }
}
```

---

### 3. Mapper Layer

**Definition:** Mappers transform data between layers. They are pure functions with no side effects.

**Rules:**

- **MUST NOT** generate data (UUIDs, timestamps, secrets)
- **MUST NOT** make database queries
- **MUST NOT** call external services
- **MUST** receive all needed data as parameters
- **MUST** perform only type conversion and field mapping

```typescript
// ✅ CORRECT - Pure transformation
static toAuthResponseEnvelope(
  authResult: AuthResult,
  permissions: PermissionContext,
  requestId: string,
  traceId: string,
  tokenPair?: TokenPair,
  defaultStore?: { guuid: string } | null,
  sessionId?: string,    // Passed as parameter
  issuedAt?: string,     // Passed as parameter
  expiresAt?: string | Date,
  refreshExpiresAt?: string | Date,
): AuthResponseEnvelope {
  if (!sessionId) throw new BadRequestException('sessionId is required');
  if (!issuedAt) throw new BadRequestException('issuedAt is required');

  return {
    user: { ...authResult.user },
    session: {
      sessionId,
      issuedAt,
      expiresAt: new Date(expiresAt),
      refreshExpiresAt: new Date(refreshExpiresAt),
    },
    // ... rest of envelope
  };
}

// ❌ WRONG - Generates data
static toAuthResponseEnvelope(
  authResult: AuthResult,
  permissions: PermissionContext,
  // ... params
): AuthResponseEnvelope {
  const sessionId = crypto.randomUUID();  // ❌ WRONG
  const issuedAt = new Date().toISOString();  // ❌ WRONG
  const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);  // ❌ WRONG

  return {
    // ...
  };
}
```

**Why:**
- Mappers are low-level utilities, not controllers of behavior
- Data generation should happen in services (where business decisions live)
- Makes testing easier: mapper output is predictable given same input
- Improves reusability: same mapper works in different contexts

---

### 4. Transaction Management

**Definition:** Database transactions ensure atomic operations that either fully succeed or fully fail.

**Rules:**

- **MUST** wrap atomic operations in `db.transaction()`
- **SHOULD** live in repositories, not services
- **MUST** be used for operations that have dependencies:
  - Create user + assign role
  - Update multiple related records
  - Insert parent + child records

```typescript
// ✅ CORRECT - Transaction in repository
async createUserWithInitialRole(userData, authData, onRoleAssignment): Promise<DbUser | null> {
  return await this.db.transaction(async (tx) => {
    const [user] = await tx.insert(schema.users).values(userData).returning();
    if (!user) return null;

    await tx.insert(schema.userAuthProvider).values({
      userId: user.id,
      ...authData,
    });

    await onRoleAssignment(tx, user.id);

    return user;
  });
}

// ❌ WRONG - Transaction in service
async register(dto: RegisterDto): Promise<AuthResponse> {
  const user = await this.db.transaction(async (tx) => {
    // Create user
    // Create auth provider
    // Assign role
  });
}
```

**Transaction Scope:**
- Keep transactions as small as possible
- Don't call external services inside transactions (slows down DB)
- Don't do complex validation inside transactions

```typescript
// ✅ CORRECT - Keep transaction small
async register(dto: RegisterDto): Promise<AuthResponse> {
  // Validate outside transaction
  EmailValidator.validate(dto.email);
  const passwordHash = await this.passwordService.hash(dto.password);

  // Only DB operations in transaction
  const user = await this.authUsersRepository.createUserWithInitialRole(
    userData,
    { password: passwordHash, ... },
    async (tx, userId) => await this.assignInitialRoleInTransaction(userId, tx),
  );

  if (!user) throw new ConflictException('Email already in use');

  // Create session outside transaction
  const session = await this.createSessionForUser(user.id, deviceInfo);

  // Send OTP outside transaction (can fail without rolling back)
  await this.otpService.sendEmailOtp(dto.email);

  return this.buildAuthResponse(user, session);
}
```

---

### 5. Configuration Layer

**Definition:** Configuration files set up external libraries (BetterAuth, database, etc.).

**Rules:**

- **MUST** be minimal and focused on setup
- **MUST NOT** contain business logic
- **MUST** delegate to services for dynamic behavior
- **MUST** document architectural decisions made in config

```typescript
// ✅ CORRECT - Minimal config
export const getAuth = (db: Database) => {
  return betterAuth({
    useNumberId: true,
    baseURL: process.env.BETTER_AUTH_BASE_URL,
    secret: process.env.BETTER_AUTH_SECRET,

    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            // NOTE: SUPER_ADMIN assignment logic has been moved to AuthService.assignFirstUserAsSuperAdminIfNeeded()
            // This ensures business logic is in the service layer, not in config.
          },
        },
      },
    },

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
    // ... rest of config
  });
};

// ❌ WRONG - Business logic in config
export const getAuth = (db: Database) => {
  return betterAuth({
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            // Check if SUPER_ADMIN exists - BUSINESS LOGIC
            const [existingSuperAdmin] = await db.select()
              .from(userRoleMapping)
              .where(eq(userRoleMapping.roleFk, 1));

            if (!existingSuperAdmin) {
              // Assign SUPER_ADMIN - BUSINESS LOGIC
              await db.insert(userRoleMapping).values({
                userFk: user.id,
                roleFk: 1,
              });
            }
          },
        },
      },
    },
  });
};
```

---

### 6. Dependency Injection & Module Structure

**Definition:** Services and repositories are managed by NestJS dependency injection.

**Rules:**

- **MUST** use `@Injectable()` decorator on services and repositories
- **MUST** inject dependencies via constructor
- **MUST** declare all exports in module `exports` array
- **MUST** import required modules (RolesModule, RoutesModule, etc.)

```typescript
// ✅ CORRECT
@Global()
@Module({
  imports: [RolesModule, RoutesModule],
  controllers: [AuthController, OtpController],
  providers: [
    AuthService,
    OtpService,
    OtpAuthOrchestrator,  // NEW: orchestrator breaks circular dependency
    PasswordService,
    PermissionsService,
    // ... repositories
  ],
  exports: [
    AuthService,
    OtpService,
    // ... services and repositories that other modules need
  ],
})
export class AuthModule {}

// ✅ CORRECT - Service with proper DI
@Injectable()
export class AuthService {
  constructor(
    private readonly authUsersRepository: AuthUsersRepository,
    private readonly sessionsRepository: SessionsRepository,
    private readonly otpService: OtpService,  // OK: one direction only
    private readonly rolesRepository: RolesRepository,
    private readonly passwordService: PasswordService,
  ) {}
}

// ✅ CORRECT - Repository with proper DI
@Injectable()
export class AuthUsersRepository {
  constructor(@InjectDb() private readonly db: Database) {}
}
```

---

## Rationale

### Why Nullable Returns in Repositories?

- **Separation of Concerns:** Repository returns data state; Service decides action
- **Flexibility:** Same repository method used in different contexts (some may not require throwing)
- **Testability:** Easier to mock and test service exception handling
- **Clarity:** Caller knows method won't throw, can check return value

### Why No Business Logic in Config?

- **Testability:** Config is hard to test, business logic needs test coverage
- **Auditability:** Service layer changes create audit logs; config changes don't
- **Reusability:** Business logic in service can be called from multiple places
- **Visibility:** Business logic should be visible in code, not hidden in config hooks

### Why Orchestrator Pattern?

- **Breaks Cycles:** Eliminates circular service dependencies
- **Single Responsibility:** Each service has clear, focused responsibility
- **Testability:** Orchestrator can be mocked; services tested independently
- **Readability:** Control flow clearly shows in orchestrator, not scattered across two services

### Why Transactions in Repositories?

- **Atomicity:** Repository owns the data consistency contract
- **Encapsulation:** Implementation details (what needs to be atomic) hidden from service
- **Reusability:** Different services may need same atomic operation
- **Simplicity:** Service layer doesn't need to know about transactions

---

## Acceptance Criteria

Architecture follows these patterns when:

1. ✅ All finder methods return `T | null`
2. ✅ No hidden throwing helpers (exceptions inline, visible)
3. ✅ No `db.transaction()` calls in service layer
4. ✅ Business logic only in services
5. ✅ Mappers are pure functions (no data generation)
6. ✅ No circular service dependencies
7. ✅ Configuration minimal and delegating
8. ✅ All exceptions documented in JSDoc

---

## Known Exceptions / Technical Debt

### 1. `AuthService.profileComplete()` - Direct Transaction

**Location:** `src/modules/auth/services/auth.service.ts:831`

**Reason:** Complex multi-entity update with email/phone conflict handling. Would require significant refactoring to extract to repository.

**Planned Fix:** Extract to `AuthUsersRepository.updateProfileWithOptionalEmailPhone()` in future session.

**Test Coverage:** Architecture test documents this case in `architecture.spec.ts`

---

## Related Issues & Fixes

- **Issue #1:** Repository exceptions → ✅ Fixed in `auth-users.repository.ts`
- **Issue #2:** Business logic in config → ✅ Fixed in `better-auth.ts`
- **Issue #3:** Service direct transactions → ✅ Fixed via `createUserWithInitialRole()`
- **Issue #4:** Circular OTP↔Auth → ✅ Fixed via `OtpAuthOrchestrator`
- **Issue #5:** Hidden throwing helpers → ✅ Fixed in `role-entity-permission.repository.ts`

---

## References

- **Architecture Audit:** `ARCHITECTURE_AUDIT_COMPREHENSIVE.md`
- **Architecture Tests:** `src/common/tests/architecture.spec.ts`
- **Related ADRs:** None yet

---

## Appendix: Quick Reference

### Method Return Type Decision Tree

```
Does this method FIND data (search, get, fetch)?
├─ YES → Return T | null (NEVER throw)
└─ NO → Is it a CREATE/UPDATE/DELETE?
    ├─ YES → Can throw, return created/updated entity
    └─ NO → Is it a UTILITY/HELPER?
        └─ YES → Design decision case-by-case
```

### Where Does Each Concern Live?

| Concern | Location | Notes |
|---------|----------|-------|
| Data generation (UUID, dates) | Service | Before calling mapper |
| Data validation | Both | Repo for DB constraints, Service for business rules |
| Exception throwing | Service | Repo can throw for constraints, Service for business logic |
| Database transactions | Repository | Services call repo methods with callbacks |
| Business logic | Service | Never in config or mapper |
| Data transformation | Mapper | Pure functions only |
| Library setup | Config | Minimal and delegating |

---

## Document Control

- **Version:** 1.0
- **Last Updated:** 2026-04-09
- **Author:** Architecture Review Session
- **Approval Status:** ACCEPTED
- **Next Review:** When new architectural patterns needed or violations found
