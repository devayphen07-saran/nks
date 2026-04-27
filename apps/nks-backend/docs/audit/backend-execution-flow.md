# NKS Backend — Complete Execution Flow

> Full file-by-file behavioral trace of the NestJS backend.
> Derived from real on-disk source — no assumptions.
>
> **Last updated:** 2026-04-27 — reflects the guard/interceptor/pipe/middleware refactor.

---

## 1. Overview Flow (Linear)

```
HTTP Request
  │
  ├─[Express layer — main.ts, in this exact order]
  │     1. helmet                           security headers (CSP, HSTS, frame-deny)
  │     2. inline middleware                Permissions-Policy header
  │     3. trust-proxy setting              not middleware, just app config
  │     4. global prefix                    /api/v1
  │     5. cors                             allowed origins
  │     6. cookie-parser                    populates req.cookies (signed support)
  │     7. requestIdMiddleware              x-request-id propagation
  │
  ├─[Nest layer — AppModule.configure → forRoutes('*')]
  │     8. ApiVersionMiddleware             rejects unsupported /api/v{n}/ or X-API-Version
  │     9. CsrfMiddleware                   sets csrf_token cookie for unauthenticated requests
  │
  ├─[Global guards — APP_GUARD providers, registration order]
  │    10. AuthGuard                        token → single-JOIN session+user+roles → req.user + _pendingSessionUpdates
  │    11. RateLimitingGuard                DB-backed sliding-window upsert
  │
  ├─[Route-level guards — @UseGuards on controllers]
  │    12. RBACGuard                        @RequireEntityPermission decision
  │    13. OwnershipGuard                   only on routes that need it
  │
  ├─[Global interceptors — APP_INTERCEPTOR, BEFORE handler in registration order]
  │    14. SessionRotationInterceptor       passthrough on the way in (registers tap for after)
  │    15. ResponseInterceptor              passthrough on the way in
  │    16. LoggingInterceptor               starts request timing
  │    17. TimeoutInterceptor               rxjs timeout(30s)
  │
  ├─[Pipes — APP_PIPE]
  │    18. AppValidationPipe                trims strings, then validates against Zod DTO schema
  │
  ├─[Param decorators]                      @Body, @Query, @Param, @CurrentUser, @Req, @Res
  │
  ├─[Controller method]                     thin — delegates to service
  │
  ├─[Service layer]                         orchestrators → flows → providers → repositories
  │
  ├─[Repository layer]                      Drizzle ORM queries (pg pool)
  │
  ├─[Interceptors AFTER handler — reverse registration order]
  │    19. TimeoutInterceptor               no-op on success
  │    20. LoggingInterceptor               logs response time
  │    21. ResponseInterceptor              wraps result in ApiResponse envelope
  │    22. SessionRotationInterceptor       reads _pendingSessionUpdates → applies DB rotation + Set-Cookie
  │
  ├─[On error — APP_FILTER]
  │       GlobalExceptionFilter             AppException | Zod | HttpException | DB | unknown → ApiResponse
  │
  └─ Response sent (JSON envelope or raw if @RawResponse())
```

---

## 2. Detailed Execution by Layer

### 2.1 Middleware

Order is **Express middleware first** (`app.use(...)` in `main.ts`), then **Nest middleware** (`AppModule.configure`).

| # | File | Type | What it does |
|---|------|------|--------------|
| 1 | `main.ts` (helmet) | Express | Sets CSP, HSTS, X-Frame-Options, Referrer-Policy. |
| 2 | `main.ts` (inline lambda) | Express | Sets `Permissions-Policy` header (camera=(), microphone=(), …). |
| 3 | `main.ts` (cookie-parser) | Express | Parses `Cookie` header into `req.cookies` and `req.signedCookies`. Cookie signing secret is required in production. |
| 4 | `common/middleware/request-id.middleware.ts` (`requestIdMiddleware`) | Express (`app.use()`) | Reads or generates `x-request-id`; mirrors to `X-Request-ID` response header. |
| 5 | `common/middleware/api-version.middleware.ts` (`ApiVersionMiddleware`) | Nest, `configure()` forRoutes('*') | Validates `X-API-Version` header and `/api/v{n}/` URL segment against `SUPPORTED_VERSIONS`. Rejects unsupported with 400 `API_VERSION_UNSUPPORTED`. Stamps `X-API-Version` on response. |
| 6 | `common/middleware/csrf.middleware.ts` (`CsrfMiddleware`) | Nest, `configure()` forRoutes('*') | For unauthenticated requests: reads `nks_session` cookie → computes `HMAC-SHA256(csrfSecret ?? sessionToken, CSRF_HMAC_SECRET)` → writes/refreshes `csrf_token` cookie. Skips if session already authenticated. Does NOT validate. |

Supporting (not directly in the request path but used by middleware):
- `common/middleware/csrf-token.service.ts` — HMAC compute helper (`computeFor(sessionToken)`, `validate(provided, expected)`, `isExempt(path)`).

### 2.2 Guards

Execution: **global first** (`APP_GUARD` array order), **then class-level**, **then method-level**.

| # | File | Scope | Reads | Writes | Throws |
|---|------|-------|-------|--------|--------|
| 1 | `common/guards/auth.guard.ts` | Global | `Authorization` (Bearer) or `nks_session` cookie | `req.user`, `req._pendingSessionUpdates` | `Unauthorized` / `Forbidden` |
| 2 | `common/guards/rate-limiting.guard.ts` | Global | `req.user.userId` (if set) or `req.ip` + `req.route.path` | `rate_limit_entries` row (DB upsert) | `TooManyRequests` |
| 3 | `common/guards/rbac.guard.ts` | Route (where applied) | `@RequireEntityPermission`, `@EntityResource`, `req.user`, `req.params` | nothing | `BadRequest` (unknown entity) / `Forbidden` |
| 4 | `common/guards/ownership.guard.ts` | Route (where applied) | record ownership criteria | nothing | `Forbidden` |

`AuthGuard` is **pure validation** — it never writes cookies or updates the DB. It delegates to six sub-services and stamps a signal for the post-handler interceptor:

- `services/guard/token-extractor.service.ts` — `TokenExtractorService.extract()` — reads `Authorization: Bearer` or `nks_session` cookie. Rejects 400 if both are present (CSRF bypass prevention).
- `services/guard/session-validator.service.ts` — `SessionValidatorService.validate()` — calls `AuthContextService.findSessionAuthContext(token)` (single DB round trip: session + user + JTI + roles via JOIN). Checks expiry, revocation, and CSRF header (cookie sessions only).
- `services/guard/session-lifecycle.service.ts` — `SessionLifecycleService.isRotationDue()` — checks if `Date.now() - lastRotatedAt >= ROTATION_INTERVAL_SECONDS`. No DB writes.
- `services/guard/user-context-loader.service.ts` — `UserContextLoaderService.load()` — builds `SessionUser` from the pre-fetched `user` and `roles` data. No additional DB calls.
- `services/guard/auth-policy.service.ts` — `AuthPolicyService.enforceAccountStatus()` (throws if blocked/inactive), `detectIpChange()` (logs only, never rejects).
- `common/guards/services/csrf-validation.service.ts` — `CsrfValidationService.validate()` — HMAC double-submit check with `crypto.timingSafeEqual(SHA256(provided), SHA256(expected))`.

After all checks pass, for cookie sessions the guard stamps:

```typescript
req._pendingSessionUpdates = {
  authType: 'cookie',
  sessionToken,
  sessionId: session.id,
  csrfSecretOrToken: session.csrfSecret ?? token,  // per-session random secret, or legacy fallback
  shouldRotateSession: isRotationDue,
  csrfSecretOverride: isRotateCsrf ? crypto.randomBytes(32).toString('hex') : undefined,
};
```

`SessionRotationInterceptor` reads `_pendingSessionUpdates` after the handler and applies all cookie/DB side effects. If the handler throws, no side effects are applied.

### 2.3 Interceptors

Registered order in `app.module.ts`: `SessionRotationInterceptor` → `ResponseInterceptor` → `LoggingInterceptor` → `TimeoutInterceptor`.

NestJS interceptors wrap in reverse on the way out, so the effective after-handler order is: `TimeoutInterceptor` → `LoggingInterceptor` → `ResponseInterceptor` → `SessionRotationInterceptor`.

| # | File | Before handler | After handler |
|---|------|----------------|---------------|
| 1 | `common/interceptors/session-rotation.interceptor.ts` | passthrough | reads `req._pendingSessionUpdates`; applies rolling rotation (new session token + CSRF secret in DB + cookies), or `@RotateCsrf()` CSRF-only rotation, or cookie sync |
| 2 | `common/interceptors/response.interceptor.ts` (`ResponseInterceptor`) | passthrough | wraps result in `ApiResponse` envelope; reads `RESPONSE_MESSAGE_KEY` metadata; handles `PaginatedResult<T>` and 204 passthrough |
| 3 | `common/interceptors/logging.interceptor.ts` | records start time | logs method, path, status, duration |
| 4 | `common/interceptors/timeout.interceptor.ts` | starts `rxjs.timeout(30s)` | converts `TimeoutError` → `RequestTimeoutException(408)` |

`SessionRotationInterceptor` three cases:
1. **Rolling rotation** (`shouldRotateSession: true`): generates new session token + new CSRF secret, writes to DB (CAS WHERE clause prevents races), sets `nks_session` + `csrf_token` cookies.
2. **`@RotateCsrf()` in-place** (`csrfSecretOverride` set, `shouldRotateSession: false`): writes only the new CSRF secret to DB, refreshes `csrf_token` cookie.
3. **Cookie sync** (neither): refreshes `csrf_token` cookie only if stale (keeps session token unchanged).

### 2.4 Pipes

| # | File | What it does |
|---|------|--------------|
| 1 | `common/pipes/app-validation.pipe.ts` (`AppValidationPipe`) | Single `APP_PIPE`: trims string fields (delegates to `TrimStringsPipe.process()`), then validates against Zod DTO schema (extends nestjs-zod's `ZodValidationPipe`). Skips trim on sensitive keys: `password`, `currentPassword`, `newPassword`, `confirmPassword`, `token`, `accessToken`, `refreshToken`, `secret`, `otp`, `pin`. |
| 2 | `common/pipes/parse-id.pipe.ts` | Route-level: parses numeric IDs from path params. |
| 3 | `common/pipes/parse-entity.pipe.ts` | Route-level: looks up entity by id/guuid; throws 404 if not found. |
| 4 | `contexts/reference-data/status/pipes/parse-status.pipe.ts` | Status-specific parse pipe. |

### 2.5 Controllers (catalogue)

Each controller is thin: it receives DTOs, delegates to a service, returns the result for `ResponseInterceptor` to wrap.

| Path | File |
|------|------|
| `/auth/*` | `contexts/iam/auth/controllers/auth.controller.ts` |
| `/auth/otp/*` | `contexts/iam/auth/controllers/otp.controller.ts` |
| `/roles/*` | `contexts/iam/roles/roles.controller.ts` |
| `/routes/*` | `contexts/iam/routes/routes.controller.ts` |
| `/admin/routes/*` | `contexts/iam/routes/admin-routes.controller.ts` |
| `/users/*` | `contexts/iam/users/users.controller.ts` |
| `/me/*` | `contexts/iam/users/self-users.controller.ts` |
| `/stores/*` | `contexts/organization/stores/stores.controller.ts` |
| `/codes/*` | `contexts/reference-data/codes/codes.controller.ts` |
| `/admin/codes/*` | `contexts/reference-data/codes/admin-codes.controller.ts` |
| `/lookups/*` | `contexts/reference-data/lookups/lookups.controller.ts` |
| `/admin/lookups/*` | `contexts/reference-data/lookups/admin-lookups.controller.ts` |
| `/locations/*` | `contexts/reference-data/location/location.controller.ts` |
| `/status/*` | `contexts/reference-data/status/status.controller.ts` |
| `/admin/status/*` | `contexts/reference-data/status/admin-status.controller.ts` |
| `/entity-status/*` | `contexts/reference-data/entity-status/entity-status.controller.ts` |
| `/admin/entity-status/*` | `contexts/reference-data/entity-status/admin-entity-status.controller.ts` |
| `/audit/*` | `contexts/compliance/audit/audit.controller.ts` |
| `/sync/*` | `contexts/sync/sync.controller.ts` |
| `/health` | `core/health/health.controller.ts` |

### 2.6 Service Call Sequence (high-level)

For a typical `/auth/login` request:

```
AuthController.login(dto, req, res)
  └── PasswordAuthService.login(dto, deviceInfo)
        ├── AuthUsersRepository.findByEmailWithPassword(email)
        ├── PasswordService.verify(plain, hash)
        ├── AuthUsersRepository.resetAndRecordLogin(userId)
        └── AuthFlowOrchestrator.executeAuthFlow(user, deviceInfo)
              ├── SessionService.createSessionForUser(userId, deviceInfo)
              │     ├── BetterAuth.internalAdapter.createSession(...)
              │     ├── PermissionsService.getUserPermissions(userId)
              │     └── SessionsRepository.updateByToken(token, sessionFields)
              ├── TokenService.createTokenPair(...)
              │     ├── jose.SignJWT(...).sign(privateKey)         // access
              │     ├── crypto.randomBytes(32) + bcrypt.hash       // refresh
              │     └── SessionsRepository.setRefreshTokenData(...)
              └── TokenService.buildAuthResponse(...)
                    ├── PermissionsService.buildPermissionsSnapshot(userId)
                    └── OfflineSessionHmac.sign(...)
```

All other contexts follow the same `Controller → Service → Repository → Drizzle` shape.

### 2.7 Repository Layer

Every repository extends `core/database/base.repository.ts` (or, in 1 case, owns its own db reference). The base provides:
- `db` (injected `NodePgDatabase`)
- `conn(tx?)` for transaction-aware execution
- `paginate()` — smart-skip count when on the visible last page
- `toOffset(page, pageSize)`

Transaction orchestration via `core/database/transaction.service.ts` (`txService.run(fn)`).

### 2.8 Exception Filter

`common/filters/global-exception.filter.ts` (`GlobalExceptionFilter`) registered as `APP_FILTER`.

Priority chain when `catch(exception, host)` is invoked:

1. `AppException` → reads `errorCode`, `errors`, `details`, builds `ApiResponse`.
2. `ZodValidationException` → flattens issues into `errors: { field: [msg] }`, status 400.
3. `HttpException` → reads response shape; defaults `errorCode` from status code.
4. PostgreSQL errors detected by `code` shape (`/^[0-9A-Z]{5}$/` + `severity` + `routine`/`schema`):
   - `23505 (unique_violation)` → 409 `DB_UNIQUE_CONSTRAINT_VIOLATION`
   - `23503 (foreign_key_violation)` → 409 if delete-restriction, else 422
   - `23502 (not_null_violation)` → 500 with error log (service bug)
5. Fallback → 500 `INTERNAL_SERVER_ERROR`.

Every path produces an `ApiResponse<null>` JSON envelope and structured log line carrying the `requestId`.

---

## 3. File-by-File Mapping

> Grouped by directory. Critical runtime files get individual entries; large fan-out areas (DTOs, schema tables, mappers, validators) get group entries.

### 3.1 Root

#### `src/main.ts`
- **Role:** Application bootstrap.
- **Executes:** Once on process start.
- **Input:** Environment variables.
- **Modifies:** Express app instance — registers helmet, inline Permissions-Policy lambda, trust-proxy, global prefix `api/v1`, CORS, `cookie-parser`, `requestIdMiddleware`, optional Swagger.
- **Output:** HTTP server listening on `app.port`.
- **Note:** `CsrfMiddleware` and `ApiVersionMiddleware` are **not** registered here — they run via `AppModule.configure()` so they participate in NestJS DI.

#### `src/app.module.ts`
- **Role:** Root Nest module — wires every feature module + global pipes/guards/interceptors/filter.
- **Executes:** Once at boot.
- **Global providers (APP_* tokens):**
  - `APP_FILTER` → `GlobalExceptionFilter`
  - `APP_PIPE` → `AppValidationPipe` (single pipe: trim + Zod)
  - `APP_GUARD` → `AuthGuard`, `RateLimitingGuard`
  - `APP_INTERCEPTOR` → `SessionRotationInterceptor`, `ResponseInterceptor`, `LoggingInterceptor`, `TimeoutInterceptor`
- **Middleware:** `configure()` applies `ApiVersionMiddleware`, `CsrfMiddleware` to `forRoutes('*')`.

### 3.2 `config/`

| File | Role |
|------|------|
| `app.config.ts` | Loads `port`, `trustProxyHops`, `nodeEnv`, `allowedOrigins` from env. |
| `app-config.service.ts` | Typed wrapper exposing `isProduction`, `isDevelopment`, etc. |
| `config.module.ts` | Global `ConfigModule` with `validateEnv()` schema. |
| `cors.config.ts` | Builds `CorsOptions` for `app.enableCors()`. |
| `database.config.ts` | Reads `DATABASE_URL`, builds `pg.Pool` for Drizzle. |
| `env.validation.ts` | Zod schema for env vars; called from `main.ts` before bootstrap. |
| `jwt.config.ts` | `JWTConfigService` — RSA keys (private/public), JWKS publication. |
| `msg91.config.ts` | OTP provider config. |
| `swagger.config.ts` | `setupSwagger()` — only mounted when `NODE_ENV !== 'production'`. |

### 3.3 `core/`

#### Database
- `core/database/database.module.ts` — global module, exports the `pg.Pool` + Drizzle handle via `DATABASE_TOKEN`.
- `core/database/database.constants.ts` — `DATABASE_TOKEN` symbol.
- `core/database/inject-db.decorator.ts` — `@InjectDb()` parameter decorator.
- `core/database/base.repository.ts` — abstract base; provides `db`, `conn(tx)`, `paginate(...)`, `toOffset(...)`.
- `core/database/transaction.service.ts` — `txService.run(fn, { name, timeout })`; emits `SET LOCAL statement_timeout` per tx.
- `core/database/query-helpers.ts` — `ilikeAny(search, ...cols)`, `ilikeFullName(...)`.
- `core/database/schema.ts` + `core/database/schema/index.ts` — barrel exports of every Drizzle table.

#### Schema (Drizzle)
The `core/database/schema/` tree has **8 top-level domains**, each with `*.table.ts` (column DDL), `*.relations.ts` (relations), and `index.ts`:

| Domain | Tables |
|--------|--------|
| `audit-log/` | `audit_logs` |
| `auth/` | `users`, `user_session`, `user_role_mapping`, `user_auth_provider`, `otp_verification`, `otp_request_log` |
| `communication/` | `communication`, `contact_person`, `notes`, `staff_invite` |
| `entity-system/` | `entity`, `status`, `entity_status_mapping` |
| `location/` | `country`, `state`, `district`, `pincode`, `address`, `address_type` |
| `lookups/` | 18 catalogue tables (code_value, code_category, salutation_type, communication_type, currency, volumes, billing_frequency, plan_type, lookup, lookup_type, notes_type, notification_status, staff_invite_status, store_category, store_legal_type, designation_type, contact_person_type, entity_type) |
| `notifications/` | `notifications`, `notification_types`, `notification_templates`, `push_tokens` |
| `plans/` | `plans`, `plan_price`, `subscription`, `subscription_item` |
| `rbac/` | `roles`, `routes`, `role_route_mapping`, `role_permissions`, `permission_action` |
| `store/` | `store`, `store_user_mapping`, `store_documents`, `store_operating_hours` |
| `sync/` | `idempotency_log`, plus `sync-columns.ts` shared column factory |
| `tax/` | 12 tables (commodity_codes, daily_tax_summary, tax_agencies, tax_filing_frequency, tax_level_mapping, tax_levels, tax_line_status, tax_names, tax_rate_master, tax_registration_type, tax_registrations, transaction_tax_lines) |
| flat root files | `audit-log`, `files`, `jti-blocklist`, `permissions-changelog`, `rate-limit-entries`, `revoked-devices`, `system-config`, `user-preferences`, `enums/` |

`base.entity.ts` provides the shared column factories: `baseEntity()`, `auditFields(usersId)`, soft-delete columns.

#### Crypto / Logger / Health
- `core/crypto/rsa-keys.ts` — RSA key loading (used by `JWTConfigService`).
- `core/logger/logger.module.ts` + `logger.service.ts` — `nestjs-pino` configuration.
- `core/health/health.controller.ts` + `health.module.ts` — `/health` endpoint, no auth.

### 3.4 `common/`

#### Constants
| File | Purpose |
|------|---------|
| `app-constants.ts` | `AUTH_CONSTANTS`, `OTP_CONSTANTS`, `SERVER_CONSTANTS`, regexes. |
| `api-version.constants.ts` | `SUPPORTED_VERSIONS`, `CURRENT_API_VERSION`, `extractUrlVersion()`. |
| `entity-codes.constants.ts` | `EntityCodes` enum used by `@RequireEntityPermission`. |
| `error-codes.constants.ts` | `ErrorCode` constants + `errPayload(code)` helper. |
| `pg-error-codes.ts` | `PG_UNIQUE_VIOLATION`, `PG_FOREIGN_KEY_VIOLATION`, `PG_NOT_NULL_VIOLATION`. |
| `system-role-codes.constant.ts` | `SystemRoleCodes` (`SUPER_ADMIN`, `STORE_OWNER`, `USER`). |

#### Decorators (parameter + metadata)
| File | Purpose |
|------|---------|
| `current-user.decorator.ts` | `@CurrentUser()` — returns `req.user`. |
| `public.decorator.ts` | `@Public()` — sets `IS_PUBLIC_KEY`; `AuthGuard` short-circuits. |
| `rate-limit.decorator.ts` | `@RateLimit(n)` — overrides per-route limit. |
| `raw-response.decorator.ts` | `@RawResponse()` — `ResponseInterceptor` skips wrapping. |
| `response-message.decorator.ts` | `@ResponseMessage('...')` — sets envelope `message`. |
| `rotate-csrf.decorator.ts` | `@RotateCsrf()` — signals guard to pre-generate a new CSRF secret; interceptor writes it post-handler. |
| `entity-resource.decorator.ts` | `@EntityResource(code)` — class-level entity code fallback. |
| `require-entity-permission.decorator.ts` | `@RequireEntityPermission({entityCode, action, scope})`. |
| `no-entity-permission-required.decorator.ts` | Documents intentional self-service routes. |
| `require-permission.decorator.ts` | `@RequirePermission(entityCode, action)` — bundles `RBACGuard` + metadata + `@ApiBearerAuth()`. Does NOT include `AuthGuard` (already a global `APP_GUARD`). |
| `deprecated.decorator.ts` | `@Deprecated({sunset, successor})` — RFC 8594 headers. |

#### DTO / Types / Events
| File | Purpose |
|------|---------|
| `dto/pagination.schema.ts` | Zod schema for `page`, `pageSize`, `sortBy`, `sortOrder`. |
| `types/index.ts` | Shared TS aliases. |
| `events/audit.events.ts` | `AuditEvents.AUDIT_RECORD` constant. |
| `events/session.events.ts` | `SessionEvents.REVOKE_ALL_FOR_USER` etc. |

#### Exceptions / Filters
- `common/exceptions/app.exception.ts` — single `AppException` class + factory functions (`Unauthorized`, `Forbidden`, `BadRequest`, …). Replaces the previous 9-class layout.
- `common/exceptions/index.ts` — barrel.
- `common/filters/global-exception.filter.ts` — see §2.8.

#### Guards / Middleware / Interceptors / Pipes
Listed in §2.1–§2.4.

#### Utils
| File | Purpose |
|------|---------|
| `api-response.ts` | `ApiResponse<T>` envelope class. Error factory methods only — success wrapping is done by `ResponseInterceptor`. |
| `auth-helpers.ts` | `AuthControllerHelpers` — extract device info, set/clear session cookie, wrap auth response for clients. |
| `cookie.utils.ts` | `extractCookieValue(cookieHeader, name)`. |
| `full-name.ts` | Concat first/last name. |
| `offline-session-hmac.ts` | HMAC sign/verify for the offline-sync session JSON. |
| `paginated-result.ts` | `PaginatedResult<T>` + `paginated({items,page,pageSize,total})`. |
| `permission-checker.ts` | `assertHasRoleInStore(roles, storeId)` — used by `RBACGuard`. |

#### Validators
- `authorization.validator.ts` — assert helpers used inside services (e.g., owner-only checks).
- `device.validator.ts` — `DeviceTypeEnum`.
- `password.validator.ts` — strength rule (12 char min).
- `sanitizer.validator.ts` — strips dangerous chars.
- `session.validator.ts` — login method / device type whitelists.

### 3.5 `contexts/iam/auth/`

```
auth/
├── auth.module.ts                 ← wires everything below
├── auth.constants.ts              ← OTP/session/jwt timing
├── config/
│   └── better-auth.ts             ← BetterAuth setup (uses `internalAdapter`)
├── controllers/
│   ├── auth.controller.ts         ← /auth/login, /register, /refresh-token, /me, /logout, /sessions, …
│   └── otp.controller.ts          ← /auth/otp/request, /verify
├── decorators/
│   └── inject-auth.decorator.ts   ← internal helper
├── dto/
│   ├── login.dto.ts, register.dto.ts, refresh-token.dto.ts
│   ├── otp.dto.ts, otp-response.dto.ts, email-verify.dto.ts
│   ├── onboarding.dto.ts, password-validation.dto.ts
│   ├── permissions.dto.ts, auth-response.dto.ts, auth.dto.ts
│   └── index.ts
├── interfaces/
│   ├── device-info.interface.ts   ← `DeviceInfo` shared shape
│   └── session-user.interface.ts  ← `SessionUser` shape attached to req.user
├── listeners/
│   └── session-revocation.listener.ts ← consumes SessionEvents.REVOKE_ALL_FOR_USER
├── mapper/
│   ├── auth-mapper.ts             ← user/role → auth response
│   └── session.mapper.ts          ← row → SessionUser
├── repositories/                  ← see §2.7
│   ├── auth-users.repository.ts
│   ├── auth-provider.repository.ts
│   ├── sessions.repository.ts     ← includes findSessionAuthContext() single JOIN
│   ├── refresh-token.repository.ts
│   ├── session-cleanup.repository.ts
│   ├── otp.repository.ts
│   ├── otp-rate-limit.repository.ts
│   ├── jti-blocklist.repository.ts
│   ├── revoked-devices.repository.ts
│   └── permissions-changelog.repository.ts
├── services/
│   ├── flows/                     ← password-auth, onboarding, user-creation
│   ├── orchestrators/             ← auth-flow, otp-auth orchestrators
│   ├── otp/                       ← otp.service, otp-rate-limit.service
│   ├── permissions/               ← permissions.service (snapshot + delta)
│   ├── providers/                 ← msg91.service
│   ├── security/                  ← password.service, key-rotation-{alert,scheduler}.service
│   ├── session/                   ← auth.service, auth-context.service, session.service,
│   │                                  session-cleanup.service, refresh-token.service,
│   │                                  device-revocation-query.service
│   ├── shared/                    ← auth-utils.service (system-role caching, role hashing)
│   ├── token/                     ← token.service, token-lifecycle.service, jti-blocklist.service
│   └── guard/                     ← auth-policy.service, user-context-loader.service
└── validators/                    ← Zod-based input validators per flow
```

Guard sub-services live in `common/guards/services/`:
- `token-extractor.service.ts` — bearer vs cookie extraction
- `session-validator.service.ts` — single-query validation + CSRF check
- `session-lifecycle.service.ts` — `isRotationDue()` check only
- `csrf-validation.service.ts` — HMAC double-submit validation

### 3.6 `contexts/iam/roles/`

```
roles/
├── roles.module.ts
├── roles.controller.ts            ← /roles CRUD
├── roles.service.ts               ← high-level role mutations + changelog fan-out
├── role-mutation.service.ts       ← write-side
├── role-query.service.ts          ← read-side (used by RolesService, not by AuthGuard directly)
├── permission-evaluator.service.ts← deny-wins evaluation, in-process TTL cache
├── repositories/
│   ├── roles.repository.ts
│   └── role-permissions.repository.ts
├── dto/                           ← role-response, roles input schemas
├── mapper/role.mapper.ts
└── validators/roles.validator.ts
```

### 3.7 `contexts/iam/routes/`

```
routes/
├── routes.module.ts
├── routes.controller.ts           ← public navigation tree
├── admin-routes.controller.ts     ← admin route management
├── routes.service.ts              ← builds permission-filtered tree
├── routes.types.ts
├── dto/route-response.dto.ts, routes.interface.ts
├── mapper/route.mapper.ts
└── validators/routes.validator.ts
```

### 3.8 `contexts/iam/users/`

```
users/
├── users.module.ts
├── users.controller.ts            ← admin user list/get
├── self-users.controller.ts       ← /me — self-service
├── users.service.ts
├── user-preferences.service.ts
├── repositories/user-preferences.repository.ts
├── dto/users-response.dto.ts
├── mapper/user.mapper.ts
└── validators/user-preferences.validator.ts
```

### 3.9 `contexts/organization/stores/`

```
stores/
├── stores.module.ts
├── stores.controller.ts           ← /stores
├── stores.service.ts              ← create / update / set default
├── store-query.service.ts         ← read-side; consumed by RBACGuard
├── repositories/stores.repository.ts
├── mapper/stores.mapper.ts
└── dto/set-default-store.dto.ts
```

### 3.10 `contexts/reference-data/`

| Sub-context | Public controller | Admin controller | Service | Repository |
|---|---|---|---|---|
| `codes/` | `codes.controller.ts` | `admin-codes.controller.ts` | `codes.service.ts` | (uses `lookups.repository`) |
| `lookups/` | `lookups.controller.ts` | `admin-lookups.controller.ts` | `lookups.service.ts` | `lookups.repository.ts` |
| `location/` | `location.controller.ts` | — | `location.service.ts` | `location.repository.ts` |
| `status/` | `status.controller.ts` | `admin-status.controller.ts` | `status.service.ts` | `status.repository.ts` |
| `entity-status/` | `entity-status.controller.ts` | `admin-entity-status.controller.ts` | `entity-status.service.ts` | `entity-status.repository.ts` |

Each carries its own `dto/`, `mapper/`, `validators/`, and barrel `index.ts`.

### 3.11 `contexts/compliance/audit/`

```
audit/
├── audit.module.ts
├── audit.controller.ts            ← /audit (admin)
├── audit.service.ts               ← log() emits AUDIT_RECORD
├── audit-event.listener.ts        ← async insert into audit_logs
├── repositories/audit.repository.ts
├── mapper/audit.mapper.ts
├── dto/requests/audit-list-query.dto.ts
├── dto/responses/audit-log.response.dto.ts
└── validators/audit.validator.ts
```

### 3.12 `contexts/sync/`

```
sync/
├── sync.module.ts
├── sync.controller.ts             ← /sync/changes (pull), /sync/push (offline mutations)
├── sync.service.ts                ← god-service: validation + batching + idempotency + revocation
├── sync.constants.ts
├── handlers/
│   ├── sync-handler.interface.ts
│   └── sync-handler.factory.ts
├── repositories/sync.repository.ts
├── mapper/sync-data.mapper.ts
├── dto/requests/{sync-changes-query,sync-push}.dto.ts
├── dto/responses/sync-changes.response.dto.ts
└── validators/{sync-access,sync-data}.validator.ts
```

### 3.13 `shared/`

| File | Purpose |
|------|---------|
| `mail/mail.service.ts` + `mail/mail.module.ts` | Outbound email (transactional). |
| `permissions-changelog/permissions-changelog.service.ts` + module | Cross-aggregate permission-event recorder used by `RolesService`. |

### 3.14 `core/health`, `core/logger` already covered above.

### 3.15 Tests

`common/tests/architecture.spec.ts` — module-boundary architecture tests (forbids cycles, enforces import rules).

---

## 4. Data Flow Tracking

### 4.1 Authorization token

```
Bearer header (mobile)        ┐
   "Authorization: Bearer X"  │
                              │   TokenExtractorService.extract(req)
nks_session cookie (web)      │   → returns { token, authType }
   req.cookies['nks_session'] ┘   → throws 400 if both present

   ↓
AuthContextService.findSessionAuthContext(token)
   ↓ (single DB round trip — full JOIN)
   ↓   user_session
   ↓   LEFT JOIN jti_blocklist    ← revocation check
   ↓   INNER JOIN users           ← user row
   ↓   LEFT JOIN user_role_mapping (active) + roles + store  ← roles
   ↓
{ session, user, revokedJti, roles[] }
   ↓ checks: !session, revokedJti, expiresAt < now, !user
   ↓ if authType='cookie': CsrfValidationService.validate(req, session.csrfSecret ?? token)
   ↓
UserContextLoaderService.load(user, roles, activeStoreFk, sessionId)
   ↓ (no additional DB calls — uses pre-fetched data)
   ↓
req.user = SessionUser
req._pendingSessionUpdates = { ... }   ← cookie sessions only
```

### 4.2 Cookies

| Cookie | Set by | Read by |
|--------|--------|---------|
| `nks_session` | `AuthControllerHelpers.applySessionCookie` after login/refresh; `SessionRotationInterceptor` on rolling rotation | `TokenExtractorService` (token extraction), `CsrfMiddleware` (HMAC computation) |
| `csrf_token` | `CsrfMiddleware` (pre-auth); `SessionRotationInterceptor` (post-auth refresh + rotation) | Browser JS reads it; client echoes it back in `X-CSRF-Token` header on unsafe methods |
| `signed/__sig.*` | `cookie-parser` with `COOKIE_SIGNING_SECRET` | Implicit; available via `req.signedCookies` (rarely used) |

### 4.3 `req.user`

| Set in | Field | Used by |
|--------|-------|---------|
| `AuthGuard.canActivate()` | `req.user = SessionUser` | `RBACGuard`, controllers via `@CurrentUser()`, audit emitter, rate-limit key |

### 4.4 `requestId`

```
Ingress  → X-Request-ID header (if any)
            ↓
requestIdMiddleware (main.ts app.use())
  - reads req.headers['x-request-id']
  - else randomUUID()
  - writes req.headers['x-request-id'] = id
  - res.setHeader('X-Request-ID', id)

Used by:
  - ResponseInterceptor   → ApiResponse.requestId
  - GlobalExceptionFilter → ApiResponse.requestId + structured log field
  - All audit log emissions
  - Outbound HTTP calls (must forward header)
```

### 4.5 CSRF token

```
Pre-auth (unauthenticated requests):
  CsrfMiddleware (via configure())
    csrfSecret = session.csrfSecret ?? cookies['nks_session'] ?? '_anon'
    expected = HMAC-SHA256(csrfSecret, CSRF_HMAC_SECRET)
    if cookies['csrf_token'] !== expected → res.cookie('csrf_token', expected, { httpOnly: false, sameSite: ... })

State-mutating authenticated request (POST/PUT/PATCH/DELETE, cookie session):
  SessionValidatorService → CsrfValidationService.validate(req, csrfSecret)
    expected = HMAC-SHA256(session.csrfSecret ?? sessionToken, CSRF_HMAC_SECRET)
    provided = req.headers['x-csrf-token']
    SHA256(provided) vs SHA256(expected) via crypto.timingSafeEqual → ForbiddenException if mismatch

Post-handler (cookie session only):
  SessionRotationInterceptor reads _pendingSessionUpdates:
    - Rolling rotation  → new session token + new CSRF secret written to DB; both cookies refreshed
    - @RotateCsrf()     → new CSRF secret only written to DB; csrf_token cookie refreshed
    - Cookie sync       → csrf_token cookie refreshed if stale (no DB write)

CSRF is skipped entirely for Bearer token requests.
Pre-migration sessions with NULL csrf_secret fall back to HMAC(sessionToken, CSRF_HMAC_SECRET).
```

### 4.6 Response wrapping

```
Controller returns: T | PaginatedResult<T> | StreamableFile | Buffer | etc.

ResponseInterceptor (after handler):
  if (statusCode === 204)            → undefined (no body)
  if (binary / @RawResponse())       → passthrough
  if (T instanceof PaginatedResult)  → ApiResponse{ data: r.data, meta: r.meta }
  else                               → ApiResponse{ data: T ?? null }

  All envelopes carry: status, statusCode (from res.statusCode), message (@ResponseMessage or 'Success'),
                       data, meta, errorCode (null), errors (null), details (null), requestId.

statusCode in the JSON body always matches the HTTP response status — no desync possible.
```

### 4.7 Error path

```
throw — anywhere
   ↓ (rxjs catchError chain through interceptors)
   ↓
GlobalExceptionFilter.catch()
   ↓
buildResponse() — see §2.8 priority chain
   ↓
res.status(envelope.statusCode).json(envelope)
   ↓ (if 429) Retry-After header
   ↓ (if >= 500) logger.error with requestId, errorCode, stack
   ↓ (else)     logger.warn with requestId, errorCode
```

---

## 5. Final End-to-End Flow

### Successful authenticated `POST /api/v1/roles` request

```
TCP/HTTP arrives
  ↓
helmet → security headers set
  ↓
inline lambda → Permissions-Policy header set
  ↓
cookieParser → req.cookies populated
  ↓
requestIdMiddleware → req.headers['x-request-id'] propagated; X-Request-ID set on res
  ↓
[Nest DI scope entered]
  ↓
ApiVersionMiddleware → URL /api/v1/ is supported; X-API-Version stamped on response
  ↓
CsrfMiddleware → session cookie present; csrf_token cookie refreshed if stale
  ↓
AuthGuard
   - @Public() not set on handler
   - TokenExtractorService.extract() → { token, authType: 'cookie' }
   - SessionValidatorService.validate() → findSessionAuthContext() single JOIN
     { session, user, revokedJti=null, roles[] }
   - expiry OK, JTI not revoked, user exists
   - CsrfValidationService.validate() → HMAC check passes
   - UserContextLoaderService.load(user, roles, ...) → SessionUser (no DB calls)
   - AuthPolicyService.enforceAccountStatus() → active, not blocked
   - SessionLifecycleService.isRotationDue() → rotation interval not elapsed → false
   - req.user = SessionUser
   - req._pendingSessionUpdates = { shouldRotateSession: false, ... }
   - returns true
  ↓
RateLimitingGuard
   - key = `rl:user:${userId}`
   - upsert into rate_limit_entries; hits ≤ 100 → returns true
  ↓
RBACGuard (route-level, via @RequirePermission('ROLE', 'create'))
   - reads @RequireEntityPermission({ entityCode: 'ROLE', action: 'create' })
   - permissionEvaluator.isKnownEntityCode('ROLE') → true
   - scope='STORE' → assertStoreContext, storeQuery.findActiveWithOwnership
   - permissionEvaluator.evaluate(...) → true
  ↓
SessionRotationInterceptor (before) — passthrough
  ↓
ResponseInterceptor (before) — passthrough
  ↓
LoggingInterceptor (before) — records start time
  ↓
TimeoutInterceptor (before) — starts 30s timer
  ↓
AppValidationPipe → body strings trimmed → validated against CreateRoleDto Zod schema
  ↓
@Body, @CurrentUser decorators inject values
  ↓
RolesController.create(dto, user)
  ↓
RolesService.createRole(dto, user)
   ├─ TransactionService.run(async (tx) => {
   │    - RolesRepository.create(roleData, tx)
   │    - RolePermissionsRepository.bulkUpsert(roleId, perms, tx)
   │    - PermissionsChangelogRepository.record(events, tx)
   │  })
   └─ AuditService.log({ action: 'ROLE_CREATED', ... })  // event emitter
  ↓
Returns RoleResponseDto
  ↓
TimeoutInterceptor (after) — no-op
  ↓
LoggingInterceptor (after) — logs method, path, 201, duration
  ↓
ResponseInterceptor (after) — wraps in ApiResponse{ status:'success', statusCode:201, data: Role, requestId }
  ↓
SessionRotationInterceptor (after)
   - reads _pendingSessionUpdates.shouldRotateSession = false
   - csrf_token cookie stale check → refreshes if needed
  ↓
res.status(201).json(envelope)
```

### Error path (e.g., DB unique violation on duplicate role code)

```
RolesRepository.create(...) throws { code: '23505', constraint: 'roles_code_key' }
  ↓ (rxjs error propagates through interceptors)
  ↓
GlobalExceptionFilter.catch
   - isDbError → true (5-char code, severity, routine present)
   - handleDbError → 23505 → 409 + DB_UNIQUE_CONSTRAINT_VIOLATION
   - envelope = ApiResponse{ status:'error', statusCode:409, message:'A record with this value already exists', errorCode:'DB_UNIQUE_CONSTRAINT_VIOLATION', requestId }
   - logger.warn (status < 500)
  ↓
res.status(409).json(envelope)
```

---

## 6. Summary

- **Pipeline depth:** 4 Express middleware → 2 Nest middleware → 2 global guards → 1-2 route guards → 4 interceptors (before) → 1 pipe → controller → service → repository → 4 interceptors (after) → optional filter → response.
- **Files involved per request:** ~25 hot-path files for an authenticated CRUD call.
- **Source of truth for ordering:** `main.ts` (Express middleware), `app.module.ts` (Nest middleware + APP_GUARD/PIPE/INTERCEPTOR/FILTER arrays), and route-level decorators.
- **Single DB round trip per authenticated request:** `findSessionAuthContext()` returns session + user + roles + JTI in one JOIN query.
- **Guard is pure validation:** all cookie and DB side effects are deferred to `SessionRotationInterceptor` post-handler. If the handler throws, no session state is mutated.
- **All other files** in the codebase (DTOs, mappers, schema, validators, lookup tables) are referenced indirectly from the hot path via DI.

This document mirrors the actual on-disk source and is the canonical reference for the request lifecycle.
