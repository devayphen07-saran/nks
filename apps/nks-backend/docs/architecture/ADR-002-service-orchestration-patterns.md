# ADR-002: Service Orchestration Patterns

**Date:** 2026-04-09
**Status:** ACCEPTED
**Supersedes:** None
**Related:** ADR-001, Architecture audit issues #4

---

## Context

As the NKS backend evolved, different services needed to coordinate complex flows. Two patterns emerged as problematic:

1. **Circular Dependencies:** Services calling each other bidirectionally
   - OtpService → AuthService (for session creation)
   - AuthService → OtpService (for sending OTPs)
   - Made services untestable and tightly coupled

2. **Complex Control Flow:** Multiple services needed coordination
   - OTP verification requires checking if super admin exists, finding/creating user, creating session
   - Profile completion requires updating user, creating auth provider, sending verification OTP
   - No clear orchestration point

This ADR establishes patterns for coordinating multiple services without creating circular dependencies.

---

## Decision

We establish two orchestration patterns for service-to-service coordination:

### Pattern 1: Orchestrator Service (for circular dependencies)

**When to use:**
- Two services need to call each other
- One service's output is another's input
- Can't use one-directional calling

**Architecture:**

```
    AuthService
         ↑
         │
   OtpAuthOrchestrator ←── OtpService
         ↑
    Controller (OtpController)
```

**Implementation:**

```typescript
/**
 * OtpAuthOrchestrator - Breaks circular dependency between OtpService and AuthService
 */
@Injectable()
export class OtpAuthOrchestrator {
  constructor(
    private readonly otpService: OtpService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Orchestrate complete OTP verification → session creation → auth response flow
   *
   * Flow:
   * 1. Delegate to OtpService for OTP verification + user find/create
   * 2. Call AuthService to create session
   * 3. Call AuthService to build full auth response
   *
   * Result: No circular dependency, clear control flow
   */
  async verifyOtpAndBuildAuthResponse(
    dto: VerifyOtpDto,
    deviceInfo?: DeviceInfo,
  ): Promise<AuthResponseEnvelope> {
    // Step 1: Verify OTP (OtpService returns minimal result)
    const verificationResult = await this.otpService.verifyOtp(dto);

    // Step 2: Create session for verified user
    const session = await this.authService.createSessionForUser(
      verificationResult.userId,
      deviceInfo,
    );

    // Step 3: Create token pair
    const tokenPair = await this.authService.createTokenPair(
      verificationResult.guuid,
      session.token,
      session.userRoles,
      session.userEmail,
      session.sessionGuuid,
    );

    // Step 4: Build and return full auth response
    return this.authService.buildAuthResponse(
      verificationResult.user,
      session.token,
      session.expiresAt,
      tokenPair,
    );
  }
}
```

**Service Changes:**

**OtpService** - Simplified (no AuthService dependency):
```typescript
@Injectable()
export class OtpService {
  constructor(
    private readonly msg91: Msg91Service,
    private readonly otpRepository: OtpRepository,
    private readonly authUsersRepository: AuthUsersRepository,
  ) {}

  /**
   * Verify OTP + find/create user
   * Returns minimal result (not full auth response)
   * Session creation handled by orchestrator
   */
  async verifyOtp(dto: VerifyOtpDto): Promise<{
    verified: true;
    userId: number;
    phone: string;
    guuid: string;
    user: DbUser;
  }> {
    // 1. Verify with MSG91
    const response = await this.msg91.verifyOtp(dto.reqId, dto.otp);
    if (response?.type !== 'success') {
      throw new BadRequestException('Invalid OTP');
    }

    // 2. Mark as used
    await this.otpRepository.markAsUsedByIdentifierAndPurpose(
      dto.phone,
      'PHONE_VERIFY',
    );

    // 3. Find or create user (no longer calls AuthService)
    let user = await this.authUsersRepository.findByPhone(dto.phone);
    if (!user) {
      user = await this.authUsersRepository.create({
        name: `User ${dto.phone.slice(-4)}`,
        phoneNumber: dto.phone,
        phoneNumberVerified: false,
        iamUserId: crypto.randomUUID(),
      });
      if (!user) throw new BadRequestException('Failed to create user');
    }

    // Verify phone
    if (!user.phoneNumberVerified) {
      await this.authUsersRepository.verifyPhone(user.id);
      user = { ...user, phoneNumberVerified: true };
    }

    return {
      verified: true,
      userId: user.id,
      phone: dto.phone,
      guuid: user.guuid,
      user,
    };
  }
}
```

**AuthService** - No longer calls OtpService.verifyOtp():
```typescript
@Injectable()
export class AuthService {
  constructor(
    private readonly authUsersRepository: AuthUsersRepository,
    private readonly otpService: OtpService,  // Only for sending OTPs
    // ... other dependencies
  ) {}

  async sendOtp(phone: string): Promise<void> {
    // ✅ OK: One-directional call, not circular
    await this.otpService.sendOtp({ phone });
  }

  async profileComplete(userId: number, dto: ProfileCompleteDto): Promise<any> {
    // ✅ OK: One-directional call, not circular
    await this.otpService.sendEmailOtp(dto.email);
  }
}
```

**Controller:**

```typescript
@Controller('auth/otp')
export class OtpController {
  constructor(
    private readonly otpService: OtpService,
    private readonly otpAuthOrchestrator: OtpAuthOrchestrator,
  ) {}

  @Post('send')
  async sendOtp(@Body() dto: SendOtpDto): Promise<ApiResponse<any>> {
    // Direct service call OK here
    const result = await this.otpService.sendOtp(dto);
    return ApiResponse.ok(result);
  }

  @Post('verify')
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<AuthResponseEnvelope>> {
    // Use orchestrator for complex flow
    const result = await this.otpAuthOrchestrator.verifyOtpAndBuildAuthResponse(
      dto,
      AuthControllerHelpers.extractDeviceInfo(req),
    );

    // ... handle cookies, response
    return ApiResponse.ok(result);
  }
}
```

**Benefits:**
- ✅ No circular dependency (acyclic graph)
- ✅ Clear control flow (orchestrator shows the sequence)
- ✅ Services testable independently (mock orchestrator)
- ✅ Reusable services (can be called from different orchestrators)
- ✅ Single responsibility (orchestrator = coordination, services = logic)

---

### Pattern 2: Transaction Callback Pattern (for atomic multi-step operations)

**When to use:**
- Multiple database operations need to be atomic
- Service orchestrates the flow, but repository owns transaction
- Can't do all operations in one query

**Architecture:**

```
Service Layer:
├─ Validate inputs (outside transaction)
├─ Call Repository.atomicOperation()
│  └─ Repository wraps in db.transaction()
│     ├─ Insert user
│     ├─ Create auth provider
│     └─ Call onRoleAssignment callback (from service)
├─ Check null result
└─ Continue business logic
```

**Implementation:**

```typescript
// Repository method with transaction callback
@Injectable()
export class AuthUsersRepository {
  async createUserWithInitialRole(
    userData: NewUser,
    authProviderData: {
      providerId: string;
      accountId: string;
      password: string;
      isVerified: boolean;
    },
    onRoleAssignment: (
      tx: Database,
      userId: number,
    ) => Promise<void>,
  ): Promise<DbUser | null> {
    return await this.db.transaction(async (tx) => {
      // Repository owns transaction boundary
      const [user] = await tx.insert(schema.users).values(userData).returning();
      if (!user) return null;

      // Repository creates related records
      await tx.insert(schema.userAuthProvider).values({
        userId: user.id,
        ...authProviderData,
      });

      // Service-provided callback handles role assignment logic
      // Callback receives transaction context for atomic operation
      await onRoleAssignment(tx, user.id);

      return user;
    });
  }
}

// Service uses transaction method
@Injectable()
export class AuthService {
  constructor(
    private readonly authUsersRepository: AuthUsersRepository,
    private readonly rolesRepository: RolesRepository,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    // Validation outside transaction
    EmailValidator.validate(dto.email);
    const passwordHash = await this.passwordService.hash(dto.password);

    // Call repository transaction method
    // Pass callback for role assignment business logic
    const user = await this.authUsersRepository.createUserWithInitialRole(
      { iamUserId: randomUUID(), name: dto.name, email: dto.email },
      { providerId: 'email', accountId: dto.email, password: passwordHash },
      // Service provides the role assignment logic as callback
      async (tx, userId) => {
        await this.assignInitialRoleInTransaction(userId, tx);
      },
    );

    if (!user) {
      throw new ConflictException('Email already in use');
    }

    // Create session outside transaction
    const session = await this.createSessionForUser(user.id);

    return this.buildAuthResponse(user, session);
  }

  private async assignInitialRoleInTransaction(
    userId: number,
    tx: Database,
  ): Promise<void> {
    // Business logic: assign SUPER_ADMIN if first user, else USER
    const superAdminRoleId = await this.rolesRepository.findSystemRoleId(
      'SUPER_ADMIN',
      tx,
    );

    if (!superAdminRoleId) return;

    const roleCode = await this.rolesRepository.resolveInitialRoleWithinTransaction(
      tx,
      superAdminRoleId,
    );

    await this.rolesRepository.assignRoleWithinTransaction(tx, userId, roleCode);
  }
}
```

**Benefits:**
- ✅ Repository owns transaction (encapsulation)
- ✅ Service provides business logic (via callback)
- ✅ Atomic operation (all or nothing)
- ✅ Clear intent (repository method name describes operation)
- ✅ Testable (can verify callback was called with correct params)

---

### Pattern 3: Composition Over Circular Calls

**When to use:**
- Multiple services need coordination
- No clear orchestrator (more than 2 services involved)
- Need structured composition

**Example:**

```typescript
// Instead of A → B → C → A (circular)
// Compose them: A ← Orchestrator → B → C

@Injectable()
export class RegistrationOrchestrator {
  constructor(
    private readonly authService: AuthService,
    private readonly oauthService: OAuthService,
    private readonly emailService: EmailService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async registerViaOAuth(oauthToken: string): Promise<AuthResponse> {
    // 1. Validate and extract OAuth info
    const oauthInfo = await this.oauthService.validateAndGetUserInfo(oauthToken);

    // 2. Register user via auth service
    const user = await this.authService.registerViaOAuth(oauthInfo);

    // 3. Send welcome email
    await this.emailService.sendWelcomeEmail(user.email);

    // 4. Track event
    await this.analyticsService.trackUserRegistration(user.id, 'oauth');

    // 5. Return auth response
    return this.authService.buildAuthResponse(user);
  }
}
```

**Benefits:**
- ✅ No circular dependencies
- ✅ Services have clear, single responsibility
- ✅ Easy to test (mock each service)
- ✅ Easy to modify (add/remove services from orchestrator)
- ✅ Clear execution order

---

## Decision Rules

Use this decision tree:

```
Do you have services A and B?
├─ Can you make A → B only (one direction)?
│  ├─ YES → Use one-directional calling
│  │        A calls B methods, B does NOT call A
│  └─ NO  → Go to next
│
└─ Do both A and B need to call each other?
   ├─ YES → Create Orchestrator service
   │        Orchestrator ← A, Orchestrator ← B
   │        Both services stateless, orchestrator stateful
   └─ NO  → Evaluate further (likely design issue)

Are multiple services involved in a flow?
├─ YES → Create specialized Orchestrator
│        Controls flow, each service independent
└─ NO  → Two-service case, see above
```

---

## Naming Conventions

- **Orchestrator Services:** `*Orchestrator.service.ts`
  - Examples: `OtpAuthOrchestrator`, `RegistrationOrchestrator`
  - Responsibility: Coordinate between multiple services
  - Naming pattern: `<Flow>Orchestrator`

- **Regular Services:** `*.service.ts`
  - Examples: `AuthService`, `OtpService`, `PermissionsService`
  - Responsibility: Business logic for single domain
  - Naming pattern: `<Domain>Service`

- **Transaction Methods:** `*WithInitialRole()`, `*WithEmailPhone()`
  - Describe atomic operation
  - Naming pattern: `<Operation>` (use verb + noun)

---

## Testing Orchestrators

```typescript
describe('OtpAuthOrchestrator', () => {
  let orchestrator: OtpAuthOrchestrator;
  let otpService: jest.Mocked<OtpService>;
  let authService: jest.Mocked<AuthService>;

  beforeEach(() => {
    otpService = {
      verifyOtp: jest.fn(),
    } as any;

    authService = {
      createSessionForUser: jest.fn(),
      createTokenPair: jest.fn(),
      buildAuthResponse: jest.fn(),
    } as any;

    orchestrator = new OtpAuthOrchestrator(otpService, authService);
  });

  test('verifyOtpAndBuildAuthResponse calls services in correct order', async () => {
    const verifyResult = {
      verified: true,
      userId: 123,
      phone: '+91999999999',
      guuid: 'abc-def',
      user: { id: 123, name: 'Test' },
    };

    otpService.verifyOtp.mockResolvedValue(verifyResult);
    authService.createSessionForUser.mockResolvedValue({
      token: 'session-token',
      userRoles: ['USER'],
      userEmail: 'test@example.com',
      sessionGuuid: 'xyz-123',
      expiresAt: new Date(),
    });

    const authResponse = {
      user: { id: 123, email: 'test@example.com' },
      tokens: { accessToken: 'token1', refreshToken: 'token2' },
    };

    authService.buildAuthResponse.mockResolvedValue(authResponse as any);

    const result = await orchestrator.verifyOtpAndBuildAuthResponse(
      { phone: '+91999999999', otp: '123456', reqId: 'req-123' },
      { deviceType: 'MOBILE' },
    );

    // Verify calls in sequence
    expect(otpService.verifyOtp).toHaveBeenCalledWith({
      phone: '+91999999999',
      otp: '123456',
      reqId: 'req-123',
    });

    expect(authService.createSessionForUser).toHaveBeenCalledWith(
      123, // userId
      { deviceType: 'MOBILE' },
    );

    expect(authService.buildAuthResponse).toHaveBeenCalled();
    expect(result).toEqual(authResponse);
  });
});
```

---

## Migration Guide

If you have existing circular dependencies:

1. **Identify the cycle:**
   ```typescript
   // A.service.ts calls B.service.ts
   // B.service.ts calls A.service.ts
   ```

2. **Extract orchestrator:**
   ```typescript
   @Injectable()
   export class ABOrchestrator {
     constructor(
       private readonly aService: AService,
       private readonly bService: BService,
     ) {}

     async executeABFlow(input): Promise<Output> {
       const aResult = await this.aService.doSomething(input);
       const bResult = await this.bService.doSomethingElse(aResult);
       return bResult;
     }
   }
   ```

3. **Update services:**
   - Remove B import from A.service.ts
   - Remove A import from B.service.ts
   - Update both to NOT call each other

4. **Update consumers:**
   - Controller or parent service calls orchestrator instead of A/B
   - Or both A and B become private, only orchestrator is public

5. **Update module:**
   ```typescript
   @Module({
     providers: [AService, BService, ABOrchestrator], // NEW
     exports: [ABOrchestrator], // EXPORT ORCHESTRATOR, not both services
   })
   ```

---

## Known Uses

| Orchestrator | Purpose | Status |
|---|---|---|
| `OtpAuthOrchestrator` | Coordinate OTP verification + session creation | ✅ Implemented |
| (Future) `RegistrationOrchestrator` | Coordinate user registration + email sending | 📋 Planned |
| (Future) `ProfileCompletionOrchestrator` | Coordinate profile update + OTP sending | 📋 Planned |

---

## References

- **ADR-001:** Layered Architecture & Separation of Concerns
- **Architecture Tests:** `src/common/tests/architecture.spec.ts`
- **Implementation:** `src/modules/auth/services/otp-auth-orchestrator.service.ts`

---

## Appendix: Common Mistakes

### ❌ Mistake 1: Orchestrator Contains Business Logic
```typescript
// WRONG
class OtpAuthOrchestrator {
  async verifyOtpAndBuildAuthResponse(dto) {
    const verified = await this.otpService.verifyOtp(dto);

    // WRONG: Business logic in orchestrator
    if (!verified) {
      const retryCount = await this.database.getRetryCount(dto.phone);
      if (retryCount > 3) {
        // WRONG: Exception logic in orchestrator
        throw new TooManyAttemptsException();
      }
    }

    return this.authService.buildAuthResponse(verified);
  }
}

// CORRECT: Move business logic to service
class OtpAuthOrchestrator {
  async verifyOtpAndBuildAuthResponse(dto) {
    const verified = await this.otpService.verifyOtp(dto);
    return this.authService.buildAuthResponse(verified);
  }
}

class OtpService {
  async verifyOtp(dto) {
    const verified = await this.msg91.verify(dto);

    if (!verified) {
      // Business logic: check retries
      const retryCount = await this.otpRepository.getRetryCount(dto.phone);
      if (retryCount > 3) {
        throw new TooManyAttemptsException();
      }
    }

    return verified;
  }
}
```

### ❌ Mistake 2: Still Has Circular Dependency
```typescript
// WRONG: Still circular!
class OtpAuthOrchestrator {
  constructor(
    private readonly otpService: OtpService,
    private readonly authService: AuthService,
  ) {}
}

class OtpService {
  constructor(
    private readonly authService: AuthService, // ❌ Still dependent!
  ) {}
}

// CORRECT: Services have no cross-dependencies
class OtpService {
  constructor(
    private readonly otpRepository: OtpRepository,
    private readonly authUsersRepository: AuthUsersRepository,
  ) {} // ❌ No AuthService import!
}
```

### ❌ Mistake 3: Controller Calls Both Services
```typescript
// WRONG: Controller has to orchestrate
class OtpController {
  constructor(
    private readonly otpService: OtpService,
    private readonly authService: AuthService,
  ) {}

  @Post('verify')
  async verifyOtp(dto) {
    const result = await this.otpService.verifyOtp(dto);
    const session = await this.authService.createSessionForUser(result.userId);
    return this.authService.buildAuthResponse(result.user, session);
  }
}

// CORRECT: Controller calls orchestrator
class OtpController {
  constructor(private readonly orchestrator: OtpAuthOrchestrator) {}

  @Post('verify')
  async verifyOtp(dto) {
    return this.orchestrator.verifyOtpAndBuildAuthResponse(dto);
  }
}
```

---

## Document Control

- **Version:** 1.0
- **Last Updated:** 2026-04-09
- **Author:** Architecture Review Session
- **Approval Status:** ACCEPTED
