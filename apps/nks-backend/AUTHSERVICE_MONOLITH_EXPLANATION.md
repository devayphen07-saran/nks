# AuthService Monolith Problem - Detailed Explanation

**File:** `src/modules/auth/services/auth.service.ts`
**Size:** 1573 lines
**Methods:** 112+ public methods
**Dependencies:** 11 injected services
**Database Calls:** 50+ direct queries

---

## Problem Summary

AuthService is doing **WAY TOO MUCH**. It's responsible for 8+ different concerns, all crammed into a single service. This violates the **Single Responsibility Principle** and makes the codebase:

- ❌ Hard to test (need to mock 11 dependencies)
- ❌ Hard to understand (too many responsibilities)
- ❌ Hard to maintain (changes ripple through)
- ❌ Hard to extend (tight coupling)

---

## What AuthService Currently Does

Let me break down all 25+ public methods into responsibility groups:

### Group 1: User Registration & Creation (4 methods)
```typescript
async findUserByPhone(phone: string)
async findOrCreateUserByPhone(phone: string)
async register(dto: RegisterDto, deviceInfo: DeviceInfo)
async isSuperAdminSeeded()
```

### Group 2: Authentication & Login (2 methods)
```typescript
async login(dto: LoginDto, deviceInfo: DeviceInfo)
async refreshSession(refreshToken: string, deviceId?: string)
```

### Group 3: Session Management (6 methods)
```typescript
async createSessionForUser(userId: number, deviceInfo?: DeviceInfo)
async recordSuccessfulLogin(userId: number)
async logout(token: string)
async invalidateUserSessions(userId: number)
async rotateSession(sessionId: number)
async cleanupExpiredSessions()
```

### Group 4: Token Generation & Management (4 methods)
```typescript
async createTokenPair(userId: number, sessionId: number)
async refreshAccessToken(refreshToken: string, deviceId?: string)
async buildAuthResponse(userId: number, sessionId: string)
async verifyClaims(jwtToken: string)
```

### Group 5: Permissions & Claims (5 methods)
```typescript
async getUserPermissions(userId: number)
async getPermissionsSnapshot(userId: number)
async getPermissionsVersion(userId: number)
async calculatePermissionsDelta(userId: number, sinceVersion: string)
async profileComplete(userId: number, dto: ProfileCompleteDto)
```

### Group 6: Device/Session Listing & Termination (4 methods)
```typescript
async getUserSessions(userId: number)
async terminateSession(userId: number, sessionId: string)
async terminateAllSessions(userId: number)
```

### Group 7: Helper Methods (Private, but many)
```typescript
private extractPermissionCodes()
private hashRoles()
private assignInitialRole()
private mapToRoleEntries()
private enforceSessionLimit()
private arraysEqual()
```

---

## Why This Is a Problem

### 1. **Single Responsibility Principle Violation**

AuthService should be responsible for **ONE THING**: Authentication

Instead, it's responsible for:
1. ✅ Authentication (login, register)
2. ❌ **Token management** (should be TokenService)
3. ❌ **Session management** (should be SessionService)
4. ❌ **Permission handling** (should be PermissionsService)
5. ❌ **Device management** (should be DeviceService)
6. ❌ **User profile completion** (should be UserService)
7. ❌ **Database operations** (should be in repositories)
8. ❌ **Device cleanup** (should be scheduled job)

---

### 2. **Testing Nightmare**

To unit test a single AuthService method, you must:

```typescript
// ❌ CURRENT: Need to mock 11 things just to test ONE method
describe('AuthService.login()', () => {
  const mockDb = createMock<Db>();
  const mockAuth = createMock<Auth>();
  const mockRolesRepo = createMock<RolesRepository>();
  const mockPasswordService = createMock<PasswordService>();
  const mockOtpService = createMock<OtpService>();
  const mockPermissionsService = createMock<PermissionsService>();
  const mockJwtConfig = createMock<JWTConfigService>();
  const mockRoutesService = createMock<RoutesService>();

  const authService = new AuthService(
    mockDb,
    mockAuth,
    mockRolesRepo,
    mockPasswordService,
    mockOtpService,
    mockPermissionsService,
    mockJwtConfig,
    mockRoutesService,
  );

  // Now set up all 11 mocks...
  it('should login user', () => {
    // Need to mock database calls, JWT signing, role lookups, etc.
    // This test is brittle and hard to read
  });
});
```

Compare to a focused service:

```typescript
// ✅ BETTER: Only mock what TokenService depends on
describe('TokenService.createAccessToken()', () => {
  const mockJwtConfig = createMock<JWTConfigService>();

  const tokenService = new TokenService(mockJwtConfig);

  it('should create valid JWT token', () => {
    // Simple, clear test
    const token = tokenService.createAccessToken({ userId: 1 });
    expect(token).toBeDefined();
    expect(jwtDecode(token).userId).toBe(1);
  });
});
```

---

### 3. **Circular Dependency**

```typescript
// ❌ CURRENT: Circular dependency between AuthService and OtpService
export class AuthService {
  constructor(
    @Inject(forwardRef(() => OtpService))
    private readonly otpService: OtpService,  // ← Circular!
  ) {}
}

export class OtpService {
  constructor(
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,  // ← Circular!
  ) {}
}
```

This requires `forwardRef()` workaround, which:
- Makes the dependency graph hard to understand
- Increases memory footprint
- Could cause module loading issues

---

### 4. **Hard to Find & Modify Code**

When you need to change token refresh logic:

```
Current: Search for "refreshAccessToken" in 1573-line file
After: Search for "refreshAccessToken" in focused TokenService
```

When you need to add a new session field:

```
Current: Modify AuthService, SessionService, TokenService, PermissionsService
After: Modify only SessionService
```

---

### 5. **Tight Coupling to Database**

```typescript
// ❌ CURRENT: 50 database calls mixed with business logic
async login(dto: LoginDto, deviceInfo: DeviceInfo) {
  const user = await this.db.select().from(schema.users)...  // ← DB call 1
  const passwordMatch = await this.passwordService.verify(...);
  const session = await this.db.insert(schema.userSessions)... // ← DB call 2
  const permissions = await this.db.select().from(...)        // ← DB call 3
  const token = await this.createTokenPair(...);              // ← DB call 4
  // ... more DB calls mixed with logic
}
```

Should be:

```typescript
// ✅ BETTER: Business logic, delegating data access to repositories
async login(dto: LoginDto, deviceInfo: DeviceInfo) {
  const user = await this.usersRepository.findByEmail(dto.email);
  const passwordMatch = await this.passwordService.verify(...);
  const session = await this.sessionRepository.create({ userId: user.id });
  const permissions = await this.permissionsRepository.getByUserId(user.id);
  const token = await this.tokenService.createTokenPair(user.id, session.id);
}
```

---

## Solution: Break Into 5 Focused Services

### Architecture Before (Monolith)

```
AuthService (1573 lines)
├── User Registration
├── Token Management
├── Session Management
├── Permission Handling
├── Device Management
├── Profile Completion
└── Database Access (50 calls)
```

### Architecture After (Focused Services)

```
src/modules/auth/services/
├── auth.service.ts              (250 lines) ← Core auth flow
├── session.service.ts           (300 lines) ← Session CRUD
├── token.service.ts             (250 lines) ← Token creation/refresh
├── permissions.service.ts       (400 lines) ← Already exists, good!
├── password.service.ts          (200 lines) ← Already exists, good!
├── refresh-token.service.ts     (300 lines) ← Already exists, good!
└── otp.service.ts               (400 lines) ← Already exists, good!
```

---

## Detailed Refactoring Plan

### Service 1: AuthService (Core Authentication)

**Responsibility:** Login, Register, Logout

**Before:**
```typescript
export class AuthService {
  constructor(
    @InjectDb() private readonly db: Db,
    @InjectAuth() private readonly auth: Auth,
    private readonly rolesRepository: RolesRepository,
    private readonly passwordService: PasswordService,
    private readonly otpService: OtpService,
    private readonly permissionsService: PermissionsService,
    private readonly jwtConfigService: JWTConfigService,
    private readonly routesService: RoutesService,
  ) {}

  async login(dto: LoginDto, deviceInfo: DeviceInfo) {
    // 100+ lines mixing DB, business logic, token generation
  }

  async register(dto: RegisterDto, deviceInfo: DeviceInfo) {
    // 100+ lines mixing DB, business logic, role assignment
  }
}
```

**After:**
```typescript
@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,     // New
    private readonly sessionService: SessionService,       // New
    private readonly tokenService: TokenService,           // New
    private readonly passwordService: PasswordService,     // Existing
  ) {}

  async login(dto: LoginDto, deviceInfo: DeviceInfo) {
    // Step 1: Find user
    const user = await this.usersRepository.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    // Step 2: Verify password
    const passwordMatch = await this.passwordService.verify(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatch) throw new UnauthorizedException('Invalid credentials');

    // Step 3: Create session (delegated)
    const session = await this.sessionService.createSession(
      user.id,
      deviceInfo,
    );

    // Step 4: Create tokens (delegated)
    const tokenPair = await this.tokenService.createTokenPair(
      user.id,
      session.id,
    );

    return { session, tokenPair };
  }

  async register(dto: RegisterDto, deviceInfo: DeviceInfo) {
    // Step 1: Validate email doesn't exist
    const exists = await this.usersRepository.findByEmail(dto.email);
    if (exists) throw new ConflictException('Email already registered');

    // Step 2: Create user (delegated to repository)
    const user = await this.usersRepository.create({
      email: dto.email,
      passwordHash: await this.passwordService.hash(dto.password),
      name: dto.name,
    });

    // Step 3: Assign initial role (delegated)
    await this.rolesRepository.assignRoleToUser(user.id, 'USER');

    // Step 4: Create session (delegated)
    const session = await this.sessionService.createSession(
      user.id,
      deviceInfo,
    );

    // Step 5: Create tokens (delegated)
    const tokenPair = await this.tokenService.createTokenPair(
      user.id,
      session.id,
    );

    return { user, session, tokenPair };
  }

  async logout(sessionToken: string): Promise<void> {
    await this.sessionService.invalidateSession(sessionToken);
  }
}
```

**Dependencies: 4** (vs current 11)

---

### Service 2: SessionService (New)

**Responsibility:** Session CRUD, device management, termination

```typescript
@Injectable()
export class SessionService {
  constructor(
    private readonly sessionsRepository: SessionsRepository,  // New repo
  ) {}

  async createSession(
    userId: number,
    deviceInfo?: DeviceInfo,
  ): Promise<Session> {
    return this.sessionsRepository.create({
      userId,
      deviceId: deviceInfo?.deviceId,
      deviceName: deviceInfo?.deviceName,
      deviceType: deviceInfo?.deviceType,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });
  }

  async invalidateSession(sessionToken: string): Promise<void> {
    const session = await this.sessionsRepository.findByToken(sessionToken);
    if (session) {
      await this.sessionsRepository.delete(session.id);
    }
  }

  async getUserSessions(userId: number): Promise<Session[]> {
    return this.sessionsRepository.findByUserId(userId);
  }

  async terminateSession(userId: number, sessionId: string): Promise<void> {
    const session = await this.sessionsRepository.findById(sessionId);
    if (session?.userId !== userId) {
      throw new ForbiddenException('Cannot terminate other user sessions');
    }
    await this.sessionsRepository.delete(sessionId);
  }

  async terminateAllSessions(userId: number): Promise<void> {
    const sessions = await this.sessionsRepository.findByUserId(userId);
    await Promise.all(
      sessions.map(s => this.sessionsRepository.delete(s.id)),
    );
  }

  async cleanupExpiredSessions(): Promise<{ deletedCount: number }> {
    return this.sessionsRepository.deleteExpired();
  }
}
```

**Dependencies: 1**

---

### Service 3: TokenService (New)

**Responsibility:** JWT token creation, verification, rotation

```typescript
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtConfigService: JWTConfigService,
    private readonly refreshTokenService: RefreshTokenService,  // Existing
  ) {}

  async createAccessToken(claims: TokenClaims): Promise<string> {
    return this.jwtConfigService.signToken(claims, { expiresIn: '1h' });
  }

  async createRefreshToken(userId: number, sessionId: string): Promise<string> {
    return this.refreshTokenService.createToken(userId, sessionId);
  }

  async createTokenPair(
    userId: number,
    sessionId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const [accessToken, refreshToken] = await Promise.all([
      this.createAccessToken({ userId, sessionId }),
      this.createRefreshToken(userId, sessionId),
    ]);
    return { accessToken, refreshToken };
  }

  async verifyAccessToken(token: string): Promise<TokenClaims> {
    return this.jwtConfigService.verifyToken(token);
  }

  async rotateTokenPair(refreshToken: string): Promise<TokenPair> {
    const claims = await this.refreshTokenService.verifyClaims(refreshToken);
    return this.createTokenPair(claims.userId, claims.sessionId);
  }
}
```

**Dependencies: 2**

---

### Service 4: PermissionsService (Existing - Keep As Is)

Already well-structured, handles:
- Permission snapshots
- Permission deltas
- Permission versioning

---

### Module Dependency Graph After

```
AuthModule
├── AuthService
│   ├── UsersRepository
│   ├── SessionService
│   ├── TokenService
│   └── PasswordService
│
├── SessionService
│   └── SessionsRepository
│
├── TokenService
│   ├── JWTConfigService
│   └── RefreshTokenService
│
├── PermissionsService
│   ├── RolesRepository
│   ├── RoutesService
│   └── UserRepository
│
└── OtpService
    └── OtpRepository
```

**Note:** No more circular dependencies! All dependencies flow downward.

---

## Benefits of This Refactoring

### 1. **Easy to Test**
```typescript
// ✅ Test TokenService in isolation
describe('TokenService', () => {
  const tokenService = new TokenService(mockJwtConfig, mockRefreshTokenService);
  it('creates valid token', () => {
    const token = tokenService.createAccessToken({ userId: 1 });
    expect(token).toBeDefined();
  });
});

// ✅ Test SessionService in isolation
describe('SessionService', () => {
  const sessionService = new SessionService(mockSessionsRepository);
  it('creates session', async () => {
    const session = await sessionService.createSession(1);
    expect(session.userId).toBe(1);
  });
});
```

### 2. **Easy to Understand**
Each service has 1-2 clear responsibilities. New developers can:
- Find relevant code faster
- Understand flow more easily
- Make changes with confidence

### 3. **No Circular Dependencies**
Remove `forwardRef()` workaround, improve module loading.

### 4. **Reusable Components**
TokenService can be used by:
- API authentication
- Webhook verification
- Scheduled tasks
- Mobile app

SessionService can be used by:
- Device management UI
- Session termination
- Admin tools

### 5. **Easier to Extend**
Adding new feature? Just add it to the relevant focused service:
- Add passwordless login? → Enhance AuthService
- Add OAuth? → Enhance AuthService
- Add session analytics? → Enhance SessionService
- Add token blacklisting? → Enhance TokenService

---

## Migration Strategy

### Phase 1: Extract SessionService (Day 1-2)
- Create `session.service.ts`
- Create `SessionsRepository`
- Update AuthService to use SessionService
- Update tests

### Phase 2: Extract TokenService (Day 2-3)
- Create `token.service.ts`
- Update AuthService to use TokenService
- Update RefreshTokenService to use TokenService
- Update tests

### Phase 3: Update OtpService (Day 3)
- Remove OtpService → AuthService circular dependency
- Use event emitter instead (`user.registered` event → send OTP)

### Phase 4: Create UsersRepository (Day 4-5)
- Extract all user queries from AuthService
- Consolidate with existing RolesRepository
- Update all services to use repositories

### Phase 5: Testing & Cleanup (Day 5-6)
- Write integration tests
- Update integration test fixtures
- Remove dead code from old AuthService
- Update documentation

---

## Code Size Comparison

### Before
```
AuthService:          1573 lines (112 methods, 11 dependencies)
OtpService:            800 lines (25 methods, 8 dependencies)
────────────────────────────────
Total:               ~2373 lines
```

### After
```
AuthService:           250 lines (4 methods, 4 dependencies)  ✅
SessionService:        300 lines (6 methods, 1 dependency)    ✅
TokenService:          250 lines (5 methods, 2 dependencies)  ✅
PermissionsService:    400 lines (existing, unchanged)        ✅
OtpService:            400 lines (refactored, 3 dependencies) ✅
────────────────────────────────
Total:               ~1600 lines
```

**Result:** Same functionality, but **cleaner, more testable, more maintainable**

---

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Service Size** | 1573 lines | 250-400 lines |
| **Methods per Service** | 112 | 4-6 |
| **Dependencies per Service** | 11 | 1-4 |
| **Circular Deps** | Yes ❌ | No ✅ |
| **Testability** | Hard ❌ | Easy ✅ |
| **Single Responsibility** | No ❌ | Yes ✅ |
| **Code Reuse** | Poor ❌ | Good ✅ |
| **Maintenance** | Hard ❌ | Easy ✅ |

**Bottom Line:** This refactoring transforms AuthService from an unmaintainable monolith into a set of focused, testable, reusable services that follow SOLID principles.
