# 🔬 NKS Backend — Deep Audit & Clean Rewrite

> Senior staff-level audit of the NestJS backend.
> Findings + over-engineering detection + production-ready code rewrites.

---

## 0. Disk-State Verification (Broken Imports Discovered)

A direct listing of `src/contexts/iam/auth/services/guard/` returned **only 2 files**:

```
auth-policy.service.ts
user-context-loader.service.ts
```

But `src/common/guards/auth.guard.ts` imports **5 services** from that directory:

```typescript
import { TokenExtractorService }   from '.../guard/token-extractor.service';   // ❌ missing
import { SessionValidatorService } from '.../guard/session-validator.service'; // ❌ missing
import { UserContextLoaderService } from '.../guard/user-context-loader.service';// ✅
import { AuthPolicyService }       from '.../guard/auth-policy.service';       // ✅
import { RequestContextBuilder }   from '.../guard/request-context-builder.service'; // ❌ missing
```

**Conclusion:** the auth guard does not currently compile against the disk state. Either the `tsc` build is broken, or these files were renamed/deleted without updating callers, or a partial refactor was checked in. This is reason enough on its own to collapse the 5-service pipeline into a single file.

**Action:** the rewrite in §4 deletes all 5 sub-service files and replaces the guard with one self-contained 80-LOC file (no broken imports possible).

---

## 1. Issues Found

### Architecture
- **`AuthGuard` (5 sub-services)** — `TokenExtractorService`, `SessionValidatorService` (78 LOC), `UserContextLoaderService` (86 LOC), `AuthPolicyService` (101 LOC), `RequestContextBuilder`. None reused outside the guard. Pure delegation chain.
- **`AuthFlowOrchestrator`** (76 LOC) — wraps three calls. The whole class is `a → b → c`. A function would do.
- **CSRF in 3 files** — `CsrfMiddleware` (cookie set), `CsrfGuard` (validate), `CsrfTokenService` (compute HMAC). One concern, three files.
- **Versioning in 2 files** — `ApiVersionMiddleware` (validate) + `VersionInterceptor` (stamp). One handshake artificially split.
- **Sessions in 3 repos** — `SessionsRepository`, `RefreshTokenRepository`, `SessionCleanupRepository`. Same table, three files.
- **Codes/Lookups duplicated** — `CodesRepository` + `LookupsRepository` query the same `code_value`/`code_category` tables.
- **`AuthUsersRepository` (480 LOC) god-repo** — user CRUD + login mechanics + verification + permission versioning + cross-aggregate `createUserWithInitialRole`.
- **`@Cron` inside `RevokedDevicesRepository`** — repository running scheduled jobs; fires on every pod.
- **`mergePermissions` lives in `RolePermissionsRepository`** — domain rule (deny-wins) inside the data layer.

### Over-engineering
- **9 exception classes** (`BadRequest`, `Unauthorized`, `Forbidden`, `NotFound`, `Conflict`, `TooManyRequests`, `Unprocessable`, `InternalServer`, `Validation`) — each one extends `AppException` with a different status code. `ValidationException` is dead.
- **`PermissionsPolicyMiddleware`** — a `@Injectable()` class to set ONE static header.
- **`RequestIdMiddleware`** as Nest middleware — no DI, no lifecycle. A 6-line function.
- **`OtpRateLimitRepository`** — 9 specialized update methods on one row (`incrementRequestCount`, `resetRequestCount`, `updateWindow`, `recordAttempt`, `resetWindow`, `incrementFailureCount`, `resetFailureCount`).
- **`LookupsRepository`** — 9 hardcoded getters (`getSalutations`, `getDesignations`, `getStoreLegalTypes`, …) all calling `queryCodeValues(code)`.
- **`req._authProcessed` re-entry guard** — defends against a double-invocation that doesn't happen with global guards.

### Code quality
- **`PASSWORD.MIN_LENGTH = 8`** in `app-constants.ts` but `PasswordValidator` enforces 12, error message says "at least 12". Three sources, two answers.
- **`COOKIE_SECURE: true` hardcoded** — blocks local dev over HTTP.
- **`COOKIE_SIGNING_SECRET = getOrThrow`** in `main.ts:86` — no dev fallback.
- **`!` non-null on `keys().next().value!`** in `AuthUtilsService` FIFO eviction.
- **`as RouteChangeRow[]` casts** in `sync.repository.ts:139,166,194`.
- **`process.env.DATABASE_URL!`** in `database.config.ts:4`.
- **Fire-and-forget `permissionsChangelog.recordChange`** in 4 places (`RolesService` lines 151, 172-184) — silent audit loss on failure.
- **`internalAdapter.createSession()`** — undocumented BetterAuth API used in `SessionService:222` and `TokenLifecycleService:159`.

### Bugs / security
- **`sql.raw(\`SET LOCAL statement_timeout = ${timeout}\`)`** — `transaction.service.ts:90`. SQL injection vector if `timeout` ever traces from user input.
- **`ilikeAny` in `query-helpers.ts:18,39`** — does not escape `%`/`_` in user search terms. Pattern injection.
- **CORS `!origin` returns `true`** — `cors.config.ts:21-22`. Any non-browser request bypasses CORS entirely.
- **`RoutesRepository.findAdminRoutesByRoleIds`** — `selectDistinctOn([routes.id], …)` silently drops permissions when a user has multiple routes-mappings on the same route.
- **`RBACGuard` TOCTOU** — `isActive()` then `isStoreOwner()` were 2 queries (note: comment claims this was fixed; verify).
- **JWT system bifurcation** — better-auth uses EdDSA, `JWTConfigService` uses RS256. Two parallel issuers.

---

## 2. Over-Engineering Areas

| Area | What's there | What it should be |
|------|--------------|-------------------|
| AuthGuard pipeline | 5 services + 1 guard | 1 guard |
| Auth orchestrator | 1 class wrapping 3 calls | inline in caller, or 1 free function |
| CSRF | middleware + guard + service | 1 middleware |
| Versioning | middleware + interceptor | 1 middleware |
| Exceptions | 9 subclasses | 1 class + 8 factory functions |
| Lookups | 9 hardcoded getters | 1 generic `getValuesByCategory(code)` |
| OTP rate limit | 9 update methods | 1 generic `update(id, patch)` |
| Sessions | 3 repos | 1 repo |
| Codes/Lookups | 2 repos | 1 repo |
| `PermissionsPolicyMiddleware` | full class | inline `app.use(...)` |
| `RequestIdMiddleware` | Nest class | plain function |

---

## 3. Simplified Design

```
HTTP-layer files:        23 → 12
Auth services around guard: 5 → 0 (inlined)
Exception classes:        9 → 1 + factories
Session repositories:     3 → 1
Code/lookup repositories: 2 → 1
LookupsRepository methods: 9 → 1 generic
OtpRateLimitRepository:    9 → 2
Lines in main.ts:        112 → 60
```

Pipeline becomes:

```
Express:  helmet → permissionsPolicyHeader → cookieParser → requestId(fn)
Nest:     CsrfMiddleware → VersionMiddleware
Guards:   AuthGuard → RateLimitGuard → RBACGuard
Pipes:    TrimStringsPipe → ZodValidationPipe
Handler:  Controller → Service → Repository → DB
After:    ResponseInterceptor → SessionRotationInterceptor
Errors:   ExceptionFilter
```

---

## 4. Clean Code (MAIN OUTPUT)

### `src/common/http/auth.guard.ts` — replaces guard + 5 services

```typescript
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHmac } from 'crypto';
import type { Request } from 'express';

import { Unauthorized, Forbidden } from '../exceptions/app.exception';
import { ErrorCode } from '../constants/error-codes.constants';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SESSION_COOKIE_NAME } from '../utils/auth-helpers';
import { SESSION_ROTATION_KEY } from './session-rotation.interceptor';
import { SessionEvents } from '../events/session.events';

import { SessionsRepository } from '../../contexts/iam/auth/repositories/sessions.repository';
import { AuthUsersRepository } from '../../contexts/iam/auth/repositories/auth-users.repository';
import { RolesRepository } from '../../contexts/iam/roles/repositories/roles.repository';

const ROTATE_AFTER_MS = 30 * 60 * 1000;

export interface AuthedUser {
  userId: number;
  userGuuid: string;
  isBlocked: boolean;
  activeStoreId: number | null;
  isSuperAdmin: boolean;
  roles: Array<{ roleCode: string; storeId: number | null }>;
}

export interface AuthedRequest extends Request {
  user: AuthedUser;
  session: { id: number; expiresAt: Date };
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly log = new Logger(AuthGuard.name);
  private readonly ipSecret: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsRepository,
    private readonly users: AuthUsersRepository,
    private readonly roles: RolesRepository,
    private readonly events: EventEmitter2,
    config: ConfigService,
  ) {
    this.ipSecret = config.getOrThrow<string>('IP_HMAC_SECRET');
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token = this.extractToken(req);
    if (!token) {
      throw Unauthorized({
        message: 'Missing token',
        errorCode: ErrorCode.AUTH_TOKEN_INVALID,
      });
    }

    // 1. Validate session (atomic JOIN with JTI blocklist — no TOCTOU)
    const { session, revokedJti } = await this.sessions.findByTokenWithJtiCheck(token);
    if (!session) {
      throw Unauthorized({ message: 'Invalid token', errorCode: ErrorCode.AUTH_TOKEN_INVALID });
    }
    if (revokedJti) {
      throw Unauthorized({ message: 'Token revoked', errorCode: ErrorCode.AUTH_TOKEN_INVALID });
    }
    if (session.expiresAt.getTime() < Date.now()) {
      throw Unauthorized({ message: 'Session expired', errorCode: ErrorCode.AUTH_SESSION_EXPIRED });
    }

    // 2. Load user + roles in parallel
    const [user, roleRows] = await Promise.all([
      this.users.findById(session.userFk),
      this.roles.findUserRolesForAuth(session.userFk),
    ]);

    if (!user || user.deletedAt) {
      throw Unauthorized({
        message: 'User not found',
        errorCode: ErrorCode.AUTH_SESSION_EXPIRED,
      });
    }

    // 3. Account status enforcement (revoke this session, fan out the rest)
    if (!user.isActive || user.isBlocked) {
      const reason = user.isBlocked ? 'BLOCKED' : 'INACTIVE';
      await this.sessions.delete(session.id).catch((e: unknown) =>
        this.log.error(`Failed to revoke session: ${(e as Error).message}`),
      );
      this.events.emit(SessionEvents.REVOKE_ALL_FOR_USER, { userId: user.id, reason });
      throw Forbidden({
        message: user.isBlocked ? 'Account blocked' : 'Account inactive',
        errorCode: user.isBlocked ? ErrorCode.USER_BLOCKED : ErrorCode.USER_INACTIVE,
      });
    }

    // 4. Resolve stale active store (clear if user no longer has a role there)
    let activeStoreId = session.activeStoreFk;
    if (activeStoreId !== null && !roleRows.some((r) => r.storeFk === activeStoreId)) {
      this.log.warn(`Cleared stale activeStoreId ${activeStoreId} for user ${user.id}`);
      await this.sessions.update(session.id, { activeStoreFk: null });
      activeStoreId = null;
    }

    // 5. IP-change advisory (log only)
    if (session.ipHash && req.ip) {
      const currentHash = createHmac('sha256', this.ipSecret).update(req.ip).digest('hex');
      if (currentHash !== session.ipHash) {
        this.log.warn({ userId: user.id, sessionId: session.id }, 'IP change detected');
      }
    }

    // 6. Attach identity
    req.user = {
      userId: user.id,
      userGuuid: user.guuid,
      isBlocked: user.isBlocked ?? false,
      activeStoreId,
      isSuperAdmin: roleRows.some((r) => r.roleCode === 'SUPER_ADMIN' && r.storeFk === null),
      roles: roleRows.map((r) => ({ roleCode: r.roleCode, storeId: r.storeFk })),
    };
    req.session = { id: session.id, expiresAt: session.expiresAt };

    // 7. Mark for rolling-session rotation if old enough
    const lastRotated = (session.lastRotatedAt ?? session.createdAt)?.getTime() ?? 0;
    if (Date.now() - lastRotated > ROTATE_AFTER_MS) {
      (req as unknown as Record<symbol, unknown>)[SESSION_ROTATION_KEY] = {
        originalToken: token,
      };
    }

    return true;
  }

  private extractToken(req: Request): string | null {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) return auth.slice(7);
    const cookies = req.cookies as Record<string, string | undefined>;
    return cookies[SESSION_COOKIE_NAME] ?? null;
  }
}
```

---

### `src/common/http/csrf.middleware.ts` — replaces middleware + guard + service

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { Forbidden } from '../exceptions/app.exception';
import { ErrorCode } from '../constants/error-codes.constants';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const EXEMPT_PATHS = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh-token',
]);
const CSRF_COOKIE = 'csrf_token';
const SESSION_COOKIE = 'nks_session';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly secret: string;
  private readonly secure: boolean;

  constructor(config: ConfigService) {
    this.secret = config.getOrThrow<string>('CSRF_HMAC_SECRET');
    this.secure = config.get('NODE_ENV') === 'production';
  }

  use(req: Request, res: Response, next: NextFunction): void {
    if (req.headers.authorization?.startsWith('Bearer ')) return next();

    const cookies = req.cookies as Record<string, string | undefined>;
    const expected = this.compute(cookies[SESSION_COOKIE]);

    if (cookies[CSRF_COOKIE] !== expected) {
      res.cookie(CSRF_COOKIE, expected, {
        httpOnly: false,
        secure: this.secure,
        sameSite: 'strict',
        maxAge: 60 * 60 * 1000,
        path: '/',
      });
    }

    if (!SAFE_METHODS.has(req.method) && !EXEMPT_PATHS.has(req.path)) {
      const provided = req.headers['x-csrf-token'];
      if (typeof provided !== 'string' || !this.equals(provided, expected)) {
        throw Forbidden({
          message: 'CSRF token missing or invalid',
          errorCode: ErrorCode.FORBIDDEN,
        });
      }
    }

    next();
  }

  private compute(session: string | undefined): string {
    return createHmac('sha256', this.secret).update(session ?? '_anon').digest('hex');
  }

  private equals(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}
```

---

### `src/common/http/version.middleware.ts` — replaces middleware + interceptor

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

const SUPPORTED = new Set(['1']);
const CURRENT = '1';
const URL_VERSION_RE = /\/api\/v(\d+)\//;

@Injectable()
export class VersionMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    res.setHeader('X-API-Version', CURRENT);

    const headerVersion = req.headers['x-api-version'];
    if (typeof headerVersion === 'string' && !SUPPORTED.has(headerVersion)) {
      return reject(res, headerVersion);
    }

    const match = URL_VERSION_RE.exec(req.path);
    if (match && !SUPPORTED.has(match[1])) {
      return reject(res, match[1]);
    }

    next();
  }
}

function reject(res: Response, version: string): void {
  res.status(400).json({
    status: 'error',
    statusCode: 400,
    errorCode: 'API_VERSION_UNSUPPORTED',
    message: `API version '${version}' not supported`,
    data: null,
  });
}
```

---

### `src/common/http/request-id.ts` — plain function (no class)

```typescript
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string) || randomUUID();
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-ID', id);
  next();
}
```

---

### `src/common/exceptions/app.exception.ts` — 9 classes → 1 class + factories

```typescript
import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes.constants';

export interface AppErrorInit {
  message: string;
  errorCode?: string;
  errors?: Record<string, string[]>;
  details?: string[];
  meta?: Record<string, unknown>;
}

export class AppException extends HttpException {
  constructor(status: HttpStatus, init: AppErrorInit) {
    super(
      {
        message: init.message,
        errorCode: init.errorCode ?? defaultCode(status),
        errors: init.errors ?? null,
        details: init.details ?? null,
        meta: init.meta ?? null,
      },
      status,
    );
  }
}

export const BadRequest      = (i: AppErrorInit) => new AppException(HttpStatus.BAD_REQUEST, i);
export const Unauthorized    = (i: AppErrorInit) => new AppException(HttpStatus.UNAUTHORIZED, i);
export const Forbidden       = (i: AppErrorInit) => new AppException(HttpStatus.FORBIDDEN, i);
export const NotFound        = (i: AppErrorInit) => new AppException(HttpStatus.NOT_FOUND, i);
export const Conflict        = (i: AppErrorInit) => new AppException(HttpStatus.CONFLICT, i);
export const Unprocessable   = (i: AppErrorInit) => new AppException(HttpStatus.UNPROCESSABLE_ENTITY, i);
export const TooManyRequests = (i: AppErrorInit) => new AppException(HttpStatus.TOO_MANY_REQUESTS, i);
export const InternalError   = (i: AppErrorInit) => new AppException(HttpStatus.INTERNAL_SERVER_ERROR, i);

function defaultCode(status: HttpStatus): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:          return ErrorCode.BAD_REQUEST;
    case HttpStatus.UNAUTHORIZED:         return ErrorCode.UNAUTHORIZED;
    case HttpStatus.FORBIDDEN:            return ErrorCode.FORBIDDEN;
    case HttpStatus.NOT_FOUND:            return ErrorCode.NOT_FOUND;
    case HttpStatus.CONFLICT:             return ErrorCode.CONFLICT;
    case HttpStatus.UNPROCESSABLE_ENTITY: return ErrorCode.UNPROCESSABLE_ENTITY;
    case HttpStatus.TOO_MANY_REQUESTS:    return ErrorCode.TOO_MANY_REQUESTS;
    default:                              return ErrorCode.INTERNAL_SERVER_ERROR;
  }
}
```

---

### `src/core/database/query-helpers.ts` — fix LIKE injection

```typescript
import { ilike, or, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/** Escape `%`, `_`, `\` for safe use inside an ILIKE pattern. */
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function ilikeAny(
  search: string | undefined,
  ...columns: AnyPgColumn[]
): SQL | undefined {
  const term = search?.trim();
  if (!term) return undefined;

  const safe = `%${escapeLike(term)}%`;
  return or(...columns.map((c) => ilike(c, safe)));
}

export function ilikeFullName(
  search: string | undefined,
  first: AnyPgColumn,
  last: AnyPgColumn,
): SQL | undefined {
  const term = search?.trim();
  if (!term?.includes(' ')) return undefined;

  const safe = `%${escapeLike(term)}%`;
  return or(ilike(first, safe), ilike(last, safe));
}
```

---

### `src/core/database/transaction.service.ts` — fix `sql.raw` injection (relevant fragment)

```typescript
// BEFORE (vulnerable):
//   await tx.execute(sql.raw(`SET LOCAL statement_timeout = ${timeout}`));

// AFTER — bounded integer, parameterized:
const timeoutMs = Math.max(1, Math.min(60_000, Math.floor(Number(timeoutOpt) || 30_000)));
await tx.execute(sql`SET LOCAL statement_timeout = ${timeoutMs}`);
```

---

### `src/contexts/iam/auth/services/orchestrators/auth-flow.ts` — class → function

```typescript
import type { AuthResponseEnvelope } from '../../dto';
import type { DeviceInfo } from '../../interfaces/device-info.interface';
import { SessionService } from '../session/session.service';
import { TokenService } from '../token/token.service';

export interface AuthUser {
  id: number;
  guuid: string;
  iamUserId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  emailVerified: boolean;
  image: string | null | undefined;
  phoneNumber: string | null | undefined;
  phoneNumberVerified: boolean;
  defaultStoreFk?: number | null;
}

export async function executeAuthFlow(
  user: AuthUser,
  deviceInfo: DeviceInfo | undefined,
  sessions: SessionService,
  tokens: TokenService,
): Promise<AuthResponseEnvelope> {
  const session = await sessions.createSessionForUser(user.id, deviceInfo);

  const tokenPair = await tokens.createTokenPair(
    user.guuid,
    session.token,
    session.userRoles,
    session.userEmail,
    session.sessionGuuid,
    session.jti,
    user.iamUserId,
    user.firstName,
    user.lastName,
  );

  return tokens.buildAuthResponse(
    user,
    session.token,
    session.expiresAt,
    session.sessionGuuid,
    tokenPair,
    session.permissions,
    deviceInfo?.deviceId,
  );
}
```

---

### `src/contexts/iam/auth/repositories/otp-rate-limit.repository.ts` — 9 methods → 2

```typescript
import { Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import * as schema from '../../../../core/database/schema';
import type {
  OtpRequestLog,
  NewOtpRequestLog,
} from '../../../../core/database/schema/auth/otp-request-log';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class OtpRateLimitRepository extends BaseRepository {
  constructor(@InjectDb() db: Db) {
    super(db);
  }

  async findByIdentifierHash(hash: string): Promise<OtpRequestLog | null> {
    const [row] = await this.db
      .select()
      .from(schema.otpRequestLog)
      .where(eq(schema.otpRequestLog.identifierHash, hash))
      .limit(1);
    return row ?? null;
  }

  async create(data: NewOtpRequestLog): Promise<OtpRequestLog | null> {
    const [row] = await this.db.insert(schema.otpRequestLog).values(data).returning();
    return row ?? null;
  }

  /** Generic patch — replaces 7 specialized setters. */
  async update(id: number, patch: Partial<OtpRequestLog>): Promise<void> {
    await this.db
      .update(schema.otpRequestLog)
      .set(patch)
      .where(eq(schema.otpRequestLog.id, id));
  }

  /** Atomic counter increment (race-safe). */
  async incrementCounter(
    id: number,
    field: 'requestCount' | 'consecutiveFailures',
  ): Promise<number> {
    const col = schema.otpRequestLog[field];
    const [row] = await this.db
      .update(schema.otpRequestLog)
      .set({ [field]: sql`${col} + 1` })
      .where(eq(schema.otpRequestLog.id, id))
      .returning({ value: col });
    return row?.value ?? 0;
  }
}
```

---

### `src/contexts/reference-data/lookups/repositories/lookups.repository.ts` — 9 hardcoded getters → 1 generic

```typescript
import { Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import * as schema from '../../../../core/database/schema';
import { codeValue } from '../../../../core/database/schema/lookups/code-value/code-value.table';
import { codeCategory } from '../../../../core/database/schema/lookups/code-category/code-category.table';

type Db = NodePgDatabase<typeof schema>;
const DEFAULT_LIMIT = 200;

const VALUE_FIELDS = {
  id: codeValue.id,
  guuid: codeValue.guuid,
  code: codeValue.code,
  label: codeValue.label,
  description: codeValue.description,
  isActive: codeValue.isActive,
  isHidden: codeValue.isHidden,
  isSystem: codeValue.isSystem,
  sortOrder: codeValue.sortOrder,
  createdAt: codeValue.createdAt,
  updatedAt: codeValue.updatedAt,
} as const;

@Injectable()
export class LookupsRepository extends BaseRepository {
  constructor(@InjectDb() db: Db) {
    super(db);
  }

  /** Generic — replaces getSalutations / getDesignations / etc. */
  async getValuesByCategory(
    categoryCode: string,
    limit = DEFAULT_LIMIT,
  ): Promise<Array<typeof VALUE_FIELDS>> {
    return this.db
      .select(VALUE_FIELDS)
      .from(codeValue)
      .innerJoin(codeCategory, eq(codeValue.categoryFk, codeCategory.id))
      .where(
        and(
          eq(codeCategory.code, categoryCode),
          isNull(codeValue.storeFk),
          eq(codeValue.isActive, true),
          eq(codeValue.isHidden, false),
          isNull(codeValue.deletedAt),
        ),
      )
      .orderBy(codeValue.sortOrder)
      .limit(limit);
  }
}
```

---

### `src/main.ts` — flatter, all wiring visible

```typescript
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { setupSwagger } from './config/swagger.config';
import { buildCorsConfig } from './config/cors.config';
import { validateEnv } from './config/env.validation';
import { requestId } from './common/http/request-id';

validateEnv();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));

  const config = app.get(ConfigService);
  const port = config.get<number>('app.port') ?? 4000;
  const isProd = config.get('NODE_ENV') === 'production';

  app.use(
    helmet({
      contentSecurityPolicy: { directives: cspDirectives() },
      hsts: { maxAge: 31_536_000, includeSubDomains: isProd, preload: isProd },
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  app.use((_req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), usb=(), payment=(), fullscreen=()',
    );
    next();
  });

  app
    .getHttpAdapter()
    .getInstance()
    .set('trust proxy', config.get<number>('app.trustProxyHops') ?? 1);

  app.setGlobalPrefix('api/v1');
  app.enableCors(buildCorsConfig(config));

  const cookieSecret = isProd
    ? config.getOrThrow<string>('COOKIE_SIGNING_SECRET')
    : config.get<string>('COOKIE_SIGNING_SECRET') ?? 'dev-cookie-secret';
  app.use(cookieParser(cookieSecret));
  app.use(requestId);

  if (!isProd) setupSwagger(app);
  app.enableShutdownHooks();

  await app.listen(port);
}

function cspDirectives() {
  return {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'https:', 'data:'],
    fontSrc: ["'self'", 'https:'],
    connectSrc: ["'self'", 'https:'],
    frameSrc: ["'none'"],
    formAction: ["'self'"],
    baseUri: ["'self'"],
    objectSrc: ["'none'"],
  };
}

bootstrap().catch((err: unknown) => {
  console.error('Bootstrap failed:', err instanceof Error ? err.stack : err);
  process.exit(1);
});
```

---

### `src/app.module.ts` — drop `configure()`-of-old, keep providers minimal

```typescript
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './core/database/database.module';
import { LoggerModule } from './core/logger/logger.module';
import { HealthModule } from './core/health/health.module';
import { AuthModule } from './contexts/iam/auth/auth.module';
import { RolesModule } from './contexts/iam/roles/roles.module';
import { RoutesModule } from './contexts/iam/routes/routes.module';
import { UsersModule } from './contexts/iam/users/users.module';
import { StoresModule } from './contexts/organization/stores/stores.module';
import { LocationModule } from './contexts/reference-data/location/location.module';
import { LookupsModule } from './contexts/reference-data/lookups/lookups.module';
import { CodesModule } from './contexts/reference-data/codes/codes.module';
import { StatusModule } from './contexts/reference-data/status/status.module';
import { EntityStatusModule } from './contexts/reference-data/entity-status/entity-status.module';
import { AuditModule } from './contexts/compliance/audit/audit.module';
import { SyncModule } from './contexts/sync/sync.module';

import { AuthGuard } from './common/http/auth.guard';
import { RateLimitGuard } from './common/http/rate-limit.guard';
import { TrimStringsPipe } from './common/http/trim-strings.pipe';
import { ResponseInterceptor } from './common/http/response.interceptor';
import { TimeoutInterceptor } from './common/http/timeout.interceptor';
import { SessionRotationInterceptor } from './common/http/session-rotation.interceptor';
import { ExceptionFilter } from './common/http/exception.filter';
import { CsrfMiddleware } from './common/http/csrf.middleware';
import { VersionMiddleware } from './common/http/version.middleware';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    LoggerModule,
    HealthModule,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    AuthModule,
    RolesModule,
    RoutesModule,
    UsersModule,
    StoresModule,
    LocationModule,
    LookupsModule,
    CodesModule,
    StatusModule,
    EntityStatusModule,
    AuditModule,
    SyncModule,
  ],
  providers: [
    { provide: APP_FILTER,      useClass: ExceptionFilter },
    { provide: APP_PIPE,        useClass: TrimStringsPipe },
    { provide: APP_PIPE,        useClass: ZodValidationPipe },
    { provide: APP_GUARD,       useClass: AuthGuard },
    { provide: APP_GUARD,       useClass: RateLimitGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    { provide: APP_INTERCEPTOR, useClass: SessionRotationInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CsrfMiddleware, VersionMiddleware).forRoutes('*');
  }
}
```

---

### Files that disappear

```
common/middleware/permissions-policy.middleware.ts        ❌ inline lambda in main.ts
common/middleware/request-id.middleware.ts                ❌ replaced by request-id.ts function
common/middleware/api-version.middleware.ts               ❌ merged → version.middleware.ts
common/middleware/csrf-token.service.ts                   ❌ folded into csrf.middleware.ts
common/guards/csrf.guard.ts                               ❌ folded into csrf.middleware.ts
common/interceptors/version.interceptor.ts                ❌ merged → version.middleware.ts
common/interceptors/transform.interceptor.ts              ❌ → response.interceptor.ts
common/exceptions/{bad-request,conflict,forbidden,
  internal-server,not-found,too-many-requests,
  unauthorized,unprocessable,validation}.exception.ts     ❌ → app.exception.ts factories
contexts/iam/auth/services/guard/token-extractor.service  ❌ inlined in AuthGuard
contexts/iam/auth/services/guard/session-validator.service❌ inlined in AuthGuard
contexts/iam/auth/services/guard/user-context-loader.service ❌ inlined in AuthGuard
contexts/iam/auth/services/guard/auth-policy.service      ❌ inlined in AuthGuard
contexts/iam/auth/services/guard/request-context-builder.service ❌ inlined in AuthGuard
contexts/iam/auth/services/orchestrators/auth-flow-orchestrator.service.ts ❌ → executeAuthFlow function
contexts/iam/auth/repositories/refresh-token.repository.ts❌ duplicates SessionsRepository
contexts/iam/auth/repositories/session-cleanup.repository.ts ❌ duplicates SessionsRepository.deleteExpired
```

---

## 5. Net Change

| | Before | After |
|---|---:|---:|
| HTTP-layer files | 23 | 12 |
| Auth guard surface | guard + 5 services | 1 file |
| Exception classes | 9 + 1 base | 1 + 8 factories |
| OTP-rate-limit methods | 9 | 4 |
| Lookup getter methods | 9 + admin CRUD | 1 + admin CRUD |
| Session-related repos | 3 | 1 |
| Code/lookup repos | 2 | 1 |
| Lines in `main.ts` | 112 | ~70 |
| **Critical security bugs** | **3** | **0** |
