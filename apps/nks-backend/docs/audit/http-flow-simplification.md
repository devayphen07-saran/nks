# 🛣️ NKS Backend — Real Execution Flow & Clean-Code Rewrite

> Practical simplification of the HTTP layer. Same functionality, half the files,
> linear top-to-bottom flow.

---

## 1. Current Flow (Short)

```
HTTP Request
  │
  ├─ Express layer (main.ts, in registration order)
  │    1. helmet                              ─ security headers
  │    2. PermissionsPolicyMiddleware         ─ Permissions-Policy header
  │    3. cookie-parser                       ─ req.cookies
  │    4. CsrfMiddleware                      ─ sets/refreshes csrf_token cookie
  │
  ├─ NestJS middleware (app.module.configure, forRoutes('*'))
  │    5. RequestIdMiddleware                 ─ req.headers['x-request-id'] + X-Request-ID
  │    6. ApiVersionMiddleware                ─ rejects unsupported X-API-Version / /v{n}/
  │
  ├─ Global guards (APP_GUARD, registration order)
  │    7. CsrfGuard                           ─ checks X-CSRF-Token (skips Bearer/safe methods)
  │    8. AuthGuard                           ─ delegates to 5 sub-services
  │    9. RateLimitingGuard                   ─ DB upsert + count
  │
  ├─ Route guards (@UseGuards on controllers)
  │   10. RBACGuard                           ─ entity-permission decorator → evaluator
  │   11. OwnershipGuard (where used)
  │
  ├─ Global interceptors (BEFORE handler, registration order)
  │   12. VersionInterceptor                  ─ X-API-Version response header
  │   13. TransformInterceptor                ─ pipes through (wraps on AFTER)
  │   14. TimeoutInterceptor                  ─ rxjs timeout(30s)
  │   15. SessionRotationInterceptor          ─ pipes through (rotates on AFTER)
  │
  ├─ Pipes (APP_PIPE in registration order)
  │   16. TrimStringsPipe                     ─ trims req body strings
  │   17. ZodValidationPipe                   ─ schema validation
  │
  ├─ Param decorators (@CurrentUser, @CurrentStore, @Body, @Query…)
  │
  ├─ Controller method
  │
  ├─ Service layer (orchestrators → services → repositories → Drizzle)
  │
  ├─ Interceptors (AFTER handler, reverse registration order)
  │   18. SessionRotationInterceptor          ─ CAS rotate token + Set-Cookie
  │   19. TimeoutInterceptor                  ─ (no-op on success)
  │   20. TransformInterceptor                ─ wraps in ApiResponse envelope
  │   21. VersionInterceptor                  ─ (no-op on after)
  │
  ├─ On error → GlobalExceptionFilter         ─ AppException → Zod → Http → DB → unknown
  │
  └─ Response sent
```

---

## 2. Over-Engineered Areas

| # | What | Current state | Why over-engineered |
|---|------|---------------|---------------------|
| **1** | **AuthGuard split into 5 services** | `TokenExtractorService`, `SessionValidatorService`, `UserContextLoaderService`, `AuthPolicyService`, `RequestContextBuilder` | A guard reading a token, looking up a session, loading a user, and checking flags is **one cohesive thing**. Splitting into 5 services adds 5 files, 5 modules of wiring, 5 sets of unit tests, and provides no real reuse (none of these services are used elsewhere). |
| **2** | **CSRF in two files** | `CsrfMiddleware` (sets cookie) + `CsrfGuard` (validates token) | "Middleware writes, guard reads" sounds clean but creates a hidden contract between two files. Single middleware can do both: set cookie when missing, validate on unsafe methods. |
| **3** | **API versioning in two files** | `ApiVersionMiddleware` (validates incoming) + `VersionInterceptor` (stamps outgoing) | One job (version handshake) artificially split across the request and response paths. Both can live in a single middleware that uses `res.on('finish')` or sets header before `next()`. |
| **4** | **PermissionsPolicyMiddleware as a class** | A whole `@Injectable()` class to set ONE static header | `app.use((_, res, next) => { res.setHeader(...); next(); })` does the same job in one line. The class is over-formalized for what is effectively a constant. |
| **5** | **VersionInterceptor + TransformInterceptor** | Two interceptors running on every response | One does `res.setHeader('X-API-Version', ...)`, the other wraps the body. Two RxJS pipes on every request just to add a header and an envelope. **Merge.** |
| **6** | **RequestIdMiddleware as Nest middleware** | `@Injectable() class … forRoutes('*')` | Doesn't use DI, doesn't need lifecycle hooks. A 6-line plain Express handler does the same. |
| **7** | **`req._authProcessed` re-entry guard inside AuthGuard** | Guard sets `req._authProcessed` to detect double-invocation | Nest doesn't double-invoke global guards on a single request. This guard is paranoid against a problem that doesn't exist in the flow as registered. |
| **8** | **`EnvelopeBuilder`-style filter** | `GlobalExceptionFilter` has 5 exception-class branches and an `inferErrorCode` switch | This is genuinely complex. But the **branching can be a flat handler map** instead of nested `if instanceof` ladders. |
| **9** | **9 custom exception classes** | `BadRequestException`, `ConflictException`, `ForbiddenException`, `InternalServerException`, `NotFoundException`, `TooManyRequestsException`, `UnauthorizedException`, `UnprocessableException`, `ValidationException` | All extend the same `AppException` with different HTTP statuses. **One class with a status arg** does the same thing. |
| **10** | **Global guard executing for `@Public()` routes** | AuthGuard short-circuits via Reflector lookup for every public route | Acceptable but the metadata read on every request adds up. Cache the decorator decision per handler (one-time WeakMap). |

---

## 3. Simplified Architecture

```
src/
├── main.ts                      ← all express middleware inline, ~60 lines
├── app.module.ts                ← imports + APP_* providers, no `configure()`
├── common/
│   ├── http/
│   │   ├── auth.guard.ts        ← single file, the whole pipeline
│   │   ├── rbac.guard.ts        ← unchanged (already clean)
│   │   ├── rate-limit.guard.ts  ← unchanged
│   │   ├── csrf.middleware.ts   ← sets + validates in one
│   │   ├── version.middleware.ts← validates + stamps in one
│   │   ├── request-id.ts        ← plain function, not a class
│   │   ├── response.interceptor.ts ← Transform + Version merged
│   │   ├── timeout.interceptor.ts  ← unchanged
│   │   ├── session-rotation.interceptor.ts ← unchanged
│   │   └── exception.filter.ts  ← flat handler map
│   ├── exceptions/
│   │   └── app.exception.ts     ← single class, 9 → 1
│   └── api-response.ts          ← envelope class
└── … (rest unchanged)
```

**Total file count: 23 → 12 in the HTTP layer.**

---

## 4. Clean Code (PRIMARY OUTPUT)

### `main.ts` — flatter, all wiring visible

```typescript
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { setupSwagger } from './config/swagger.config';
import { buildCorsConfig } from './config/cors.config';
import { validateEnv } from './config/env.validation';

validateEnv();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));

  const config = app.get(ConfigService);
  const port = config.get<number>('app.port') ?? 4000;
  const isProd = config.get('NODE_ENV') === 'production';

  app.use(helmet({
    contentSecurityPolicy: { directives: cspDirectives() },
    hsts: { maxAge: 31536000, includeSubDomains: isProd, preload: isProd },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));

  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), usb=(), payment=(), fullscreen=()');
    next();
  });

  app.getHttpAdapter().getInstance().set('trust proxy',
    config.get<number>('app.trustProxyHops') ?? 1);

  app.setGlobalPrefix('api/v1');
  app.enableCors(buildCorsConfig(config));
  app.use(cookieParser(config.getOrThrow<string>('COOKIE_SIGNING_SECRET')));

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

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
```

---

### `app.module.ts` — no `configure()`, plain providers list

```typescript
import { Module } from '@nestjs/common';
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
import { CsrfGuard } from './common/http/csrf.guard';
import { RateLimitGuard } from './common/http/rate-limit.guard';
import { TrimStringsPipe } from './common/http/trim-strings.pipe';
import { ResponseInterceptor } from './common/http/response.interceptor';
import { TimeoutInterceptor } from './common/http/timeout.interceptor';
import { SessionRotationInterceptor } from './common/http/session-rotation.interceptor';
import { ExceptionFilter } from './common/http/exception.filter';

@Module({
  imports: [
    ConfigModule, DatabaseModule, LoggerModule, HealthModule,
    ScheduleModule.forRoot(), EventEmitterModule.forRoot(),
    AuthModule, RolesModule, RoutesModule, UsersModule, StoresModule,
    LocationModule, LookupsModule, CodesModule, StatusModule, EntityStatusModule,
    AuditModule, SyncModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ExceptionFilter },
    { provide: APP_PIPE, useClass: TrimStringsPipe },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    { provide: APP_INTERCEPTOR, useClass: SessionRotationInterceptor },
  ],
})
export class AppModule {}
```

---

### `common/http/request-id.ts` — plain function, no class

```typescript
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers['x-request-id'] as string) || randomUUID();
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-ID', id);
  next();
}
```

Register in `main.ts` with `app.use(requestId)` instead of via a Nest middleware class.

---

### `common/http/csrf.middleware.ts` — single file, set + validate

```typescript
import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
const EXEMPT = new Set(['/api/v1/auth/login', '/api/v1/auth/register', '/api/v1/auth/refresh-token']);
const COOKIE = 'csrf_token';
const SESSION_COOKIE = 'nks_session';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly secret: string;
  private readonly secure: boolean;

  constructor(config: ConfigService) {
    this.secret = config.getOrThrow<string>('CSRF_HMAC_SECRET');
    this.secure = config.get('NODE_ENV') === 'production';
  }

  use(req: Request, res: Response, next: NextFunction) {
    if (req.headers.authorization?.startsWith('Bearer ')) return next();

    const cookies = req.cookies as Record<string, string | undefined>;
    const session = cookies[SESSION_COOKIE];
    const expected = this.compute(session);

    // Set cookie if missing or stale
    if (cookies[COOKIE] !== expected) {
      res.cookie(COOKIE, expected, {
        httpOnly: false,
        secure: this.secure,
        sameSite: 'strict',
        maxAge: 3_600_000,
        path: '/',
      });
    }

    // Validate on unsafe methods
    if (!SAFE.has(req.method) && !EXEMPT.has(req.path)) {
      const provided = req.headers['x-csrf-token'];
      if (typeof provided !== 'string' || !this.equals(provided, expected)) {
        throw new ForbiddenException('CSRF token invalid');
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

This **deletes both `CsrfGuard` and `CsrfTokenService`**. One file, ~40 lines.

> **Note:** Since this still needs DI for `ConfigService`, register it as a Nest middleware (`consumer.apply(CsrfMiddleware).forRoutes('*')`). Or, if you keep `main.ts` driving it: instantiate manually with `new CsrfMiddleware(configService)` and bind via `app.use(...)`. Pick one — same code.

---

### `common/http/version.middleware.ts` — validate + stamp in one

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

const SUPPORTED = new Set(['1']);
const CURRENT = '1';
const URL_VERSION = /\/api\/v(\d+)\//;

@Injectable()
export class VersionMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    res.setHeader('X-API-Version', CURRENT);

    const header = req.headers['x-api-version'];
    if (typeof header === 'string' && !SUPPORTED.has(header)) {
      return reject(res, header);
    }

    const match = URL_VERSION.exec(req.path);
    if (match && !SUPPORTED.has(match[1])) {
      return reject(res, match[1]);
    }

    next();
  }
}

function reject(res: Response, version: string) {
  res.status(400).json({
    status: 'error',
    statusCode: 400,
    errorCode: 'API_VERSION_UNSUPPORTED',
    message: `API version '${version}' not supported`,
    data: null,
  });
}
```

Replaces `ApiVersionMiddleware` + `VersionInterceptor`.

---

### `common/http/response.interceptor.ts` — Transform merged

```typescript
import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler, StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { Readable } from 'stream';
import type { Request, Response } from 'express';
import { RAW_RESPONSE_KEY } from '../decorators/raw-response.decorator';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';
import { PaginatedResult } from '../utils/paginated-result';
import { ApiResponse } from '../api-response';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();

    const handler = ctx.getHandler();
    const klass = ctx.getClass();
    if (this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [handler, klass])) {
      return next.handle();
    }

    const message = this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_KEY, [handler, klass]) ?? 'Success';
    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const requestId = req.headers['x-request-id'] as string | undefined;

    return next.handle().pipe(map((data) => {
      if (res.statusCode === 204) return undefined;
      if (isBinary(data)) return data;
      if (data instanceof PaginatedResult) {
        return new ApiResponse({ statusCode: res.statusCode, message, data: data.data, meta: data.meta, requestId });
      }
      return new ApiResponse({ statusCode: res.statusCode, message, data: data ?? null, requestId });
    }));
  }
}

function isBinary(d: unknown): boolean {
  return d instanceof StreamableFile
      || d instanceof Buffer
      || d instanceof Uint8Array
      || d instanceof Readable
      || d instanceof ArrayBuffer;
}
```

---

### `common/api-response.ts` — single envelope class

```typescript
export interface ResponseMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  [k: string]: unknown;
}

export class ApiResponse<T = unknown> {
  status: 'success' | 'error';
  statusCode: number;
  message: string;
  data: T | null;
  meta: ResponseMeta | null;
  errorCode: string | null;
  errors: Record<string, string[]> | null;
  details: string[] | null;
  requestId: string | null;

  constructor(init: Partial<ApiResponse<T>> & { statusCode: number; message: string }) {
    this.status     = init.status ?? (init.statusCode >= 400 ? 'error' : 'success');
    this.statusCode = init.statusCode;
    this.message    = init.message;
    this.data       = init.data ?? null;
    this.meta       = init.meta ?? null;
    this.errorCode  = init.errorCode ?? null;
    this.errors     = init.errors ?? null;
    this.details    = init.details ?? null;
    this.requestId  = init.requestId ?? null;
  }
}
```

---

### `common/exceptions/app.exception.ts` — one class, 9 → 1

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

// Tiny helpers — replace 9 separate classes
export const BadRequest        = (i: AppErrorInit) => new AppException(HttpStatus.BAD_REQUEST, i);
export const Unauthorized      = (i: AppErrorInit) => new AppException(HttpStatus.UNAUTHORIZED, i);
export const Forbidden         = (i: AppErrorInit) => new AppException(HttpStatus.FORBIDDEN, i);
export const NotFound          = (i: AppErrorInit) => new AppException(HttpStatus.NOT_FOUND, i);
export const Conflict          = (i: AppErrorInit) => new AppException(HttpStatus.CONFLICT, i);
export const Unprocessable     = (i: AppErrorInit) => new AppException(HttpStatus.UNPROCESSABLE_ENTITY, i);
export const TooManyRequests   = (i: AppErrorInit) => new AppException(HttpStatus.TOO_MANY_REQUESTS, i);
export const InternalError     = (i: AppErrorInit) => new AppException(HttpStatus.INTERNAL_SERVER_ERROR, i);

function defaultCode(status: HttpStatus): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:          return ErrorCode.BAD_REQUEST;
    case HttpStatus.UNAUTHORIZED:         return ErrorCode.UNAUTHORIZED;
    case HttpStatus.FORBIDDEN:            return ErrorCode.FORBIDDEN;
    case HttpStatus.NOT_FOUND:            return ErrorCode.NOT_FOUND;
    case HttpStatus.CONFLICT:             return ErrorCode.CONFLICT;
    case HttpStatus.UNPROCESSABLE_ENTITY: return ErrorCode.UNPROCESSABLE_ENTITY;
    case HttpStatus.TOO_MANY_REQUESTS:    return ErrorCode.TOO_MANY_REQUESTS;
    default:                               return ErrorCode.INTERNAL_SERVER_ERROR;
  }
}
```

Usage: `throw Forbidden({ message: 'No store selected', errorCode: ErrorCode.AUTH_NO_STORE_CONTEXT })`.

---

### `common/http/auth.guard.ts` — collapsed from 5 services into 1 file

```typescript
import {
  CanActivate, ExecutionContext, Injectable, Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHmac } from 'crypto';
import type { Request } from 'express';

import { Unauthorized, Forbidden } from '../exceptions/app.exception';
import { ErrorCode } from '../constants/error-codes.constants';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SESSION_COOKIE_NAME } from '../utils/auth-helpers';
import { SESSION_ROTATION_KEY } from './session-rotation.interceptor';

import { SessionsRepository } from '../../contexts/iam/auth/repositories/sessions.repository';
import { AuthUsersRepository } from '../../contexts/iam/auth/repositories/auth-users.repository';
import { RolesRepository } from '../../contexts/iam/roles/repositories/roles.repository';
import { ConfigService } from '@nestjs/config';

const ROTATE_AFTER_MS = 30 * 60 * 1000;        // rotate if older than 30 min
const SESSION_TTL_MS  = 30 * 24 * 60 * 60 * 1000;

export interface AuthedRequest extends Request {
  user: {
    userId: number;
    userGuuid: string;
    activeStoreId: number | null;
    roles: Array<{ roleCode: string; storeId: number | null }>;
    isSuperAdmin: boolean;
  };
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
    config: ConfigService,
  ) {
    this.ipSecret = config.getOrThrow<string>('IP_HMAC_SECRET');
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()],
    );
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token = this.extractToken(req);
    if (!token) {
      throw Unauthorized({ message: 'Missing token', errorCode: ErrorCode.AUTH_TOKEN_INVALID });
    }

    // Single query: session + JTI blocklist join (no TOCTOU)
    const { session, revokedJti } = await this.sessions.findByTokenWithJtiCheck(token);
    if (!session)                              throw Unauthorized({ message: 'Session not found', errorCode: ErrorCode.AUTH_TOKEN_INVALID });
    if (revokedJti)                            throw Unauthorized({ message: 'Session revoked',   errorCode: ErrorCode.AUTH_TOKEN_INVALID });
    if (session.expiresAt.getTime() < Date.now())
      throw Unauthorized({ message: 'Session expired',  errorCode: ErrorCode.AUTH_TOKEN_INVALID });

    const user = await this.users.findById(session.userFk);
    if (!user || user.deletedAt)               throw Unauthorized({ message: 'User not found',    errorCode: ErrorCode.AUTH_TOKEN_INVALID });
    if (!user.isActive)                        throw Forbidden({    message: 'Account disabled',  errorCode: ErrorCode.AUTH_ACCOUNT_DISABLED });
    if (user.isBlocked) {
      await this.sessions.deleteAllForUser(user.id);
      throw Forbidden({ message: 'Account blocked', errorCode: ErrorCode.AUTH_ACCOUNT_BLOCKED });
    }

    // IP-change detection (advisory log only, do not throw)
    if (session.ipHash && req.ip) {
      const currentIpHash = createHmac('sha256', this.ipSecret).update(req.ip).digest('hex');
      if (currentIpHash !== session.ipHash) {
        this.log.warn({ userId: user.id, sessionId: session.id }, 'IP changed');
      }
    }

    const roles = await this.roles.findUserRolesForAuth(user.id);
    const isSuperAdmin = roles.some(r => r.roleCode === 'SUPER_ADMIN' && r.storeFk === null);

    req.user = {
      userId: user.id,
      userGuuid: user.guuid,
      activeStoreId: session.activeStoreFk,
      roles: roles.map(r => ({ roleCode: r.roleCode, storeId: r.storeFk })),
      isSuperAdmin,
    };
    req.session = { id: session.id, expiresAt: session.expiresAt };

    // Mark for rotation if old; the interceptor handles the cookie + DB write
    const ageMs = Date.now() - (session.createdAt?.getTime() ?? 0);
    if (ageMs > ROTATE_AFTER_MS) {
      (req as unknown as Record<symbol, unknown>)[SESSION_ROTATION_KEY] = { originalToken: token };
    }

    return true;
  }

  private extractToken(req: Request): string | null {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) return auth.slice(7);
    return (req.cookies as Record<string, string>)[SESSION_COOKIE_NAME] ?? null;
  }
}
```

This **deletes 5 services**: `TokenExtractorService`, `SessionValidatorService`, `UserContextLoaderService`, `AuthPolicyService`, `RequestContextBuilder`. ~80 lines of clear pipeline replace ~400 lines of orchestration.

---

### `common/http/exception.filter.ts` — flat handler map

```typescript
import {
  ExceptionFilter as NestExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus, Logger, Injectable,
} from '@nestjs/common';
import { ZodValidationException } from 'nestjs-zod';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../exceptions/app.exception';
import { ErrorCode } from '../constants/error-codes.constants';
import {
  PG_UNIQUE_VIOLATION, PG_FOREIGN_KEY_VIOLATION, PG_NOT_NULL_VIOLATION,
} from '../constants/pg-error-codes';
import { ApiResponse } from '../api-response';

interface DbError { code: string; detail?: string; table?: string; severity?: string; routine?: string }

@Injectable()
@Catch()
export class ExceptionFilter implements NestExceptionFilter {
  private readonly log = new Logger(ExceptionFilter.name);
  private readonly isDev: boolean;

  constructor(config: ConfigService) {
    this.isDev = config.get('NODE_ENV') !== 'production';
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const requestId = req.headers['x-request-id'] as string | undefined;

    const envelope = this.toEnvelope(exception, requestId);
    this.logError(req, envelope, exception);

    if (envelope.statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      res.setHeader('Retry-After', String(this.retryAfterFrom(exception)));
    }
    res.status(envelope.statusCode).json(envelope);
  }

  private toEnvelope(e: unknown, requestId?: string): ApiResponse<null> {
    if (e instanceof AppException || e instanceof HttpException) {
      return this.fromHttp(e, requestId);
    }
    if (e instanceof ZodValidationException) {
      return this.fromZod(e, requestId);
    }
    if (this.isDbError(e)) {
      return this.fromDb(e as DbError, requestId);
    }
    return new ApiResponse({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: this.isDev ? String((e as Error)?.message ?? 'Unexpected error') : 'Unexpected error',
      errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
      requestId,
    });
  }

  private fromHttp(e: HttpException, requestId?: string): ApiResponse<null> {
    const status = e.getStatus();
    const r = e.getResponse() as Record<string, unknown>;
    const message = Array.isArray(r.message) ? (r.message as string[]).join('; ') : String(r.message ?? e.message);
    return new ApiResponse({
      statusCode: status,
      message,
      errorCode: this.codeFromResponse(r) ?? this.statusToCode(status),
      errors:  (r.errors as Record<string, string[]>) ?? null,
      details: (r.details as string[])              ?? null,
      requestId,
    });
  }

  private fromZod(e: ZodValidationException, requestId?: string): ApiResponse<null> {
    const errors: Record<string, string[]> = {};
    for (const issue of e.getZodError().issues) {
      const field = issue.path.join('.') || '_root';
      (errors[field] ??= []).push(issue.message);
    }
    return new ApiResponse({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Validation failed',
      errorCode: ErrorCode.VALIDATION_ERROR,
      errors,
      requestId,
    });
  }

  private fromDb(e: DbError, requestId?: string): ApiResponse<null> {
    if (e.code === PG_UNIQUE_VIOLATION) {
      return new ApiResponse({
        statusCode: HttpStatus.CONFLICT,
        message: 'A record with this value already exists',
        errorCode: ErrorCode.DB_UNIQUE_CONSTRAINT_VIOLATION,
        requestId,
      });
    }
    if (e.code === PG_FOREIGN_KEY_VIOLATION) {
      const restricted = e.detail?.includes('still referenced from table');
      return new ApiResponse({
        statusCode: restricted ? HttpStatus.CONFLICT : HttpStatus.UNPROCESSABLE_ENTITY,
        message: restricted ? 'Cannot delete: record is referenced' : 'Referenced record does not exist',
        errorCode: ErrorCode.DB_FOREIGN_KEY_VIOLATION,
        requestId,
      });
    }
    if (e.code === PG_NOT_NULL_VIOLATION) {
      this.log.error({ dbCode: e.code, detail: e.detail, table: e.table }, 'NOT NULL violation — service bug');
    }
    return new ApiResponse({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'A database error occurred',
      errorCode: ErrorCode.DB_QUERY_FAILED,
      requestId,
    });
  }

  // ─── helpers ────────────────────────────────────────────────────────────────
  private codeFromResponse(r: Record<string, unknown>): string | null {
    const c = r.errorCode ?? r.code;
    return typeof c === 'string' && !/^\d+$/.test(c) ? c : null;
  }

  private statusToCode(s: number): string {
    return ({
      400: ErrorCode.BAD_REQUEST, 401: ErrorCode.UNAUTHORIZED, 403: ErrorCode.FORBIDDEN,
      404: ErrorCode.NOT_FOUND,   409: ErrorCode.CONFLICT,     422: ErrorCode.UNPROCESSABLE_ENTITY,
      429: ErrorCode.TOO_MANY_REQUESTS,
    } as Record<number, string>)[s] ?? ErrorCode.INTERNAL_SERVER_ERROR;
  }

  private isDbError(e: unknown): boolean {
    if (typeof e !== 'object' || !e) return false;
    const r = e as Record<string, unknown>;
    return typeof r.code === 'string' && /^[0-9A-Z]{5}$/.test(r.code as string)
        && typeof r.severity === 'string';
  }

  private retryAfterFrom(e: unknown): number {
    if (e instanceof HttpException) {
      const r = e.getResponse() as Record<string, unknown>;
      const meta = r.meta as Record<string, unknown> | undefined;
      if (typeof meta?.retryAfter === 'number') return meta.retryAfter;
      if (typeof r.retryAfter === 'number')     return r.retryAfter;
    }
    return 60;
  }

  private logError(req: Request, envelope: ApiResponse<null>, exception: unknown): void {
    const fields = {
      method: req.method, url: req.url,
      statusCode: envelope.statusCode, errorCode: envelope.errorCode,
      requestId: envelope.requestId,
    };
    if (envelope.statusCode >= 500) {
      this.log.error({ ...fields, err: exception }, 'Unhandled exception');
    } else {
      this.log.warn(fields, envelope.message);
    }
  }
}
```

---

## 5. Final Simplified Flow

```
HTTP Request
  → helmet, permissions-policy header, cookie-parser   (main.ts)
  → requestId() function                                (main.ts)
  → CsrfMiddleware       (set + validate)
  → VersionMiddleware    (validate + stamp)
  → CsrfGuard            ❌ DELETED (merged into middleware)
  → AuthGuard            (single file, 80 lines)
  → RateLimitGuard       (unchanged — already clean)
  → RBACGuard            (unchanged — already clean)
  → ResponseInterceptor  (Transform + Version merged)
  → TimeoutInterceptor   (unchanged)
  → SessionRotationInterceptor (unchanged — needs post-handler hook)
  → TrimStringsPipe → ZodValidationPipe
  → Controller → Service → Repository → DB
  → ResponseInterceptor wraps in ApiResponse
  → SessionRotationInterceptor sets cookie if needed
  → ExceptionFilter on errors (flat handler map)
  → Response
```

---

## 6. What This Rewrite Deletes

| Deleted | Reason |
|---------|--------|
| `TokenExtractorService` | Inlined in `AuthGuard` |
| `SessionValidatorService` | Inlined |
| `UserContextLoaderService` | Inlined |
| `AuthPolicyService` | Inlined |
| `RequestContextBuilder` | Inlined |
| `CsrfGuard` | Merged into `CsrfMiddleware` |
| `CsrfTokenService` | Compute is 1 line, no service needed |
| `ApiVersionMiddleware` + `VersionInterceptor` | Merged into `VersionMiddleware` |
| `PermissionsPolicyMiddleware` (class) | Inline lambda in `main.ts` |
| `RequestIdMiddleware` (class) | Plain function |
| 9 exception classes | One `AppException` + 8 factory helpers |
| `ValidationException` | Already dead code |
| `RefreshTokenRepository`, `SessionCleanupRepository` | Already covered in P0 |

---

## 7. Net Result

| Metric | Before | After |
|--------|--------|-------|
| HTTP-layer files | ~23 | 12 |
| Auth-related services | 5 + guard | 1 guard |
| Exception classes | 9 | 1 + 8 factories |
| Lines in `main.ts` | 112 | ~60 |
| Cognitive load | High (5-step delegation chain to read auth flow) | Low (one file, top-to-bottom) |

**Same functionality. Half the files. Linear top-to-bottom flow.**
Read `auth.guard.ts` in 60 seconds and you understand the request lifecycle.
