# NKS Backend Architecture Guide

This directory contains Architecture Decision Records (ADRs) that document the design principles, patterns, and decisions for the NKS backend.

---

## Quick Start

**New to this codebase?** Start here:

1. Read [ADR-001: Layered Architecture & Separation of Concerns](./ADR-001-layered-architecture-patterns.md)
   - Understand how code is organized into layers
   - Learn where each type of logic belongs
   - See concrete examples of correct vs incorrect patterns

2. Read [ADR-002: Service Orchestration Patterns](./ADR-002-service-orchestration-patterns.md)
   - Understand how to coordinate multiple services
   - Learn when to use orchestrator pattern
   - Avoid circular dependencies

3. Run the architecture tests:
   ```bash
   npm test -- architecture.spec.ts
   ```
   - Verifies your changes follow architectural principles
   - Catches common violations automatically

---

## Architecture Decision Records (ADRs)

### [ADR-001: Layered Architecture & Separation of Concerns](./ADR-001-layered-architecture-patterns.md)

**Covers:** Repository pattern, service responsibilities, mapper rules, transaction management

**Key Principles:**
- Repositories return `T | null` (never throw from finders)
- Services contain all business logic
- Mappers are pure functions (no side effects)
- Transactions live in repositories
- Configuration is minimal and delegating

**When to read:**
- You're writing a new repository method
- You're implementing new business logic
- You're creating a mapper
- You're unsure where code belongs

**Quick Reference Tables:**
- Layer responsibilities
- Method return type decision tree
- Where each concern lives

---

### [ADR-002: Service Orchestration Patterns](./ADR-002-service-orchestration-patterns.md)

**Covers:** Orchestrator service pattern, transaction callback pattern, composition patterns

**Key Patterns:**
- **Orchestrator Services:** Break circular dependencies, coordinate flows
- **Transaction Callbacks:** Atomic multi-step operations with repository ownership
- **Composition:** Multiple services, structured coordination

**When to read:**
- Services need to call each other
- You're creating a complex flow with multiple services
- You need to break a circular dependency
- You're testing service interactions

**Migration Guide:**
- How to detect circular dependencies
- How to extract orchestrator
- How to update modules and tests

---

## Code Examples

### ✅ Correct: Finder Method (Returns Nullable)

```typescript
// Repository
async findByEmail(email: string): Promise<DbUser | null> {
  const [user] = await this.db.select().from(schema.users)
    .where(eq(schema.users.email, email)).limit(1);
  return user ?? null;
}

// Service
async register(dto: RegisterDto): Promise<AuthResponse> {
  const existingUser = await this.authUsersRepository.findByEmail(dto.email);

  if (existingUser) {
    throw new ConflictException('Email already in use');
  }

  // Continue registration...
}
```

### ✅ Correct: Transaction in Repository with Callback

```typescript
// Repository owns transaction
async createUserWithInitialRole(
  userData: NewUser,
  authProviderData: {...},
  onRoleAssignment: (tx, userId) => Promise<void>,
): Promise<DbUser | null> {
  return await this.db.transaction(async (tx) => {
    const [user] = await tx.insert(schema.users).values(userData).returning();
    if (!user) return null;

    await tx.insert(schema.userAuthProvider).values({
      userId: user.id,
      ...authProviderData,
    });

    await onRoleAssignment(tx, user.id);
    return user;
  });
}

// Service uses repository method
async register(dto: RegisterDto): Promise<AuthResponse> {
  const passwordHash = await this.passwordService.hash(dto.password);

  const user = await this.authUsersRepository.createUserWithInitialRole(
    userData,
    authProviderData,
    async (tx, userId) => {
      // Service provides business logic as callback
      await this.assignInitialRoleInTransaction(userId, tx);
    },
  );

  if (!user) throw new ConflictException('Email already in use');

  // Continue...
}
```

### ✅ Correct: Pure Mapper (No Side Effects)

```typescript
static toAuthResponseEnvelope(
  authResult: AuthResult,
  permissions: PermissionContext,
  requestId: string,
  traceId: string,
  tokenPair?: TokenPair,
  defaultStore?: { guuid: string } | null,
  sessionId?: string,      // ✅ Passed as parameter
  issuedAt?: string,       // ✅ Passed as parameter
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
    // ... rest of response
  };
}
```

### ✅ Correct: Orchestrator Service (No Circular Dependency)

```typescript
@Injectable()
export class OtpAuthOrchestrator {
  constructor(
    private readonly otpService: OtpService,
    private readonly authService: AuthService,
  ) {}

  async verifyOtpAndBuildAuthResponse(
    dto: VerifyOtpDto,
    deviceInfo?: DeviceInfo,
  ): Promise<AuthResponseEnvelope> {
    // 1. Verify OTP
    const result = await this.otpService.verifyOtp(dto);

    // 2. Create session
    const session = await this.authService.createSessionForUser(
      result.userId,
      deviceInfo,
    );

    // 3. Create token pair
    const tokenPair = await this.authService.createTokenPair(
      result.guuid,
      session.token,
      session.userRoles,
      session.userEmail,
      session.sessionGuuid,
    );

    // 4. Build response
    return this.authService.buildAuthResponse(
      result.user,
      session.token,
      session.expiresAt,
      tokenPair,
    );
  }
}
```

---

### ❌ Wrong: Throwing Finder Method

```typescript
// ❌ WRONG
async findById(id: number): Promise<DbUser> {
  const [user] = await this.db.select().from(schema.users)
    .where(eq(schema.users.id, id)).limit(1);

  if (!user) {
    throw new NotFoundException('User not found'); // ❌ WRONG
  }

  return user;
}
```

### ❌ Wrong: Business Logic in Mapper

```typescript
// ❌ WRONG - Mapper generating data
static toAuthResponseEnvelope(
  authResult: AuthResult,
  permissions: PermissionContext,
  // ... params
): AuthResponseEnvelope {
  const sessionId = crypto.randomUUID();        // ❌ WRONG
  const issuedAt = new Date().toISOString();    // ❌ WRONG
  const refreshExpiresAt = new Date(           // ❌ WRONG
    Date.now() + 30 * 24 * 60 * 60 * 1000
  );

  return { sessionId, issuedAt, refreshExpiresAt, ... };
}
```

### ❌ Wrong: Business Logic in Config

```typescript
// ❌ WRONG - Business logic in config
export const getAuth = (db: Database) => {
  return betterAuth({
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            // ❌ WRONG: Business logic in config
            const [superAdminRole] = await db.select().from(roles)
              .where(eq(roles.code, 'SUPER_ADMIN'));

            if (!superAdminRole) {
              // ❌ WRONG: Decision making in config
              await db.insert(userRoleMapping).values({
                userFk: user.id,
                roleFk: superAdminRole.id,
              });
            }
          },
        },
      },
    },
  });
};
```

### ❌ Wrong: Service Calling db.transaction()

```typescript
// ❌ WRONG - Transaction logic in service
async register(dto: RegisterDto): Promise<AuthResponse> {
  const user = await this.db.transaction(async (tx) => {
    // ❌ WRONG: Service owns transaction
    const [created] = await tx.insert(schema.users).values(userData).returning();
    if (!created) throw new Error('Failed to create user');

    await tx.insert(schema.userAuthProvider).values({...});

    await tx.insert(schema.userRoleMapping).values({...});

    return created;
  });
}

// ✅ CORRECT: Repository owns transaction
const user = await this.authUsersRepository.createUserWithInitialRole(
  userData,
  authProviderData,
  async (tx, userId) => await this.assignInitialRoleInTransaction(userId, tx),
);
```

### ❌ Wrong: Circular Service Dependencies

```typescript
// ❌ WRONG - Circular dependency
class OtpService {
  constructor(private readonly authService: AuthService) {}

  async verifyOtp(dto: VerifyOtpDto): Promise<AuthResponse> {
    const user = await this.authService.findOrCreateUserByPhone(dto.phone);
    const session = await this.authService.createSessionForUser(user.id);
    // ...
  }
}

class AuthService {
  constructor(private readonly otpService: OtpService) {}

  async sendOtp(phone: string): Promise<void> {
    await this.otpService.sendOtp({ phone }); // ❌ CYCLE!
  }
}

// ✅ CORRECT: Orchestrator breaks cycle
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
```

---

## Architecture Tests

Run tests to verify your code follows architectural principles:

```bash
# Run all architecture tests
npm test -- architecture.spec.ts

# Run specific test suite
npm test -- architecture.spec.ts -t "Repository Pattern"

# Watch mode during development
npm test -- architecture.spec.ts --watch
```

### What Tests Check

1. **Repository Pattern**
   - No hidden throwing helpers
   - Finder methods don't throw
   - Exception logic is visible

2. **Separation of Concerns**
   - Config files don't contain complex logic
   - Mappers don't generate data
   - Exceptions inline, not in helpers

3. **Dependency Graph**
   - No circular service dependencies
   - Orchestrator pattern used where needed

4. **Transaction Management**
   - Services don't call `db.transaction()` directly
   - Repositories own transaction boundaries

---

## Common Patterns

### Pattern 1: Find or Create with Fallback

```typescript
async findOrCreateUser(phone: string): Promise<User> {
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
```

### Pattern 2: Validate Then Persist

```typescript
async register(dto: RegisterDto): Promise<AuthResponse> {
  // Validate OUTSIDE transaction
  EmailValidator.validate(dto.email);
  const passwordHash = await this.passwordService.hash(dto.password);

  // Check conflicts OUTSIDE transaction
  const emailExists = await this.authUsersRepository.findByEmail(dto.email);
  if (emailExists) {
    throw new ConflictException('Email already in use');
  }

  // ONLY persist in transaction
  const user = await this.authUsersRepository.createUserWithInitialRole(
    userData,
    authProviderData,
    async (tx, userId) => await this.assignInitialRoleInTransaction(userId, tx),
  );

  if (!user) {
    throw new ConflictException('Email already in use (race condition)');
  }

  // Async operations OUTSIDE transaction
  await this.sendWelcomeEmail(user.email);

  return this.buildAuthResponse(user);
}
```

### Pattern 3: Orchestrate Multiple Services

```typescript
async executeComplexFlow(input): Promise<Output> {
  // Step 1: Service A processes input
  const resultA = await this.serviceA.process(input);

  // Step 2: Service B uses result of A
  const resultB = await this.serviceB.process(resultA);

  // Step 3: Service C uses result of B
  const resultC = await this.serviceC.process(resultB);

  // Step 4: Return final result
  return resultC;
}
```

---

## Decision Making Guide

### "Where should this code live?"

| Code Type | Location | Why |
|-----------|----------|-----|
| User validation (email format) | Service | Business rule |
| Email duplication check | Service + Repository | Biz logic in service, data access in repo |
| UUID generation | Service | Before calling mapper |
| Date/timestamp | Service | Before calling mapper |
| Data type conversion | Mapper | Pure transformation |
| HTTP status mapping | Controller | Presentation concern |
| Database query | Repository | Data access boundary |
| Transaction wrapping | Repository | Atomicity concern |
| Permission checking | Service | Business logic |
| Exception handling | Service | Business decisions |
| External API calls | Service | Business orchestration |
| External library setup | Config | Library concern |

---

## Troubleshooting

### "Architecture tests fail with 'circular dependency detected'"

**Problem:** Two services call each other

**Solution:** Create an orchestrator service
- See ADR-002 for full pattern
- Remove imports from one service
- Create orchestrator that calls both
- Update controller to use orchestrator

Example: `OtpAuthOrchestrator` fixes OtpService ↔ AuthService cycle

### "Can't decide where business logic belongs"

**Ask yourself:**
- Is this a "what" (what should happen)? → Service
- Is this a "how" (how to store/retrieve)? → Repository
- Is this a "present" (how to format for display)? → Mapper
- Is this a "setup" (initializing library)? → Config

### "Mapper method is getting too complex"

**Problem:** Mapper is doing type conversions and calculations

**Solution:** Move calculations to service
- Mapper should receive pre-calculated values
- Service computes → passes to mapper
- Mapper transforms types

---

## References

### Related Files

- **Architecture Tests:** `src/common/tests/architecture.spec.ts`
- **Example Implementation:** `src/modules/auth/services/`
  - `OtpAuthOrchestrator` (orchestrator pattern)
  - `AuthService` (proper service structure)
  - `OtpService` (simple, focused service)
  - `auth-users.repository.ts` (repository pattern)
  - `auth-mapper.ts` (pure mapper)

### Further Reading

- **NestJS Architecture Best Practices**
- **Domain-Driven Design (DDD) Principles**
- **Clean Architecture by Robert C. Martin**
- **Enterprise Application Architecture Patterns**

---

## Contributing

When adding new features:

1. **Read the relevant ADR** before writing code
2. **Run architecture tests** before committing
3. **Follow the patterns** shown in examples above
4. **Add tests** for orchestrators and services
5. **Document decisions** if adding new patterns

---

## Document Control

- **Version:** 1.0
- **Last Updated:** 2026-04-09
- **Maintained By:** Architecture Review Team
- **Status:** Active

---

## Quick Links

- [ADR-001: Layered Architecture](./ADR-001-layered-architecture-patterns.md)
- [ADR-002: Service Orchestration](./ADR-002-service-orchestration-patterns.md)
- [Architecture Tests](../../../src/common/tests/architecture.spec.ts)
- [Auth Module Example](../../../src/modules/auth)
