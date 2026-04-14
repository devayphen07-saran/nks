# NKS Backend — Complete Technical Reference

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Application Bootstrap](#2-application-bootstrap)
3. [Database Schema](#3-database-schema)
4. [Common Layer](#4-common-layer)
5. [Auth Module](#5-auth-module)
   - 5.5 [JWTConfigService](#55-jwtconfigservice)
   - 5.6 [Key Rotation & Alerting](#56-keyrotationscheduler--keyrotationalertservice)
6. [Roles Module](#6-roles-module)
7. [Routes Module](#7-routes-module)
8. [Lookups Module](#8-lookups-module)
9. [Audit Module](#9-audit-module)
10. [Auth Flow Traces](#10-auth-flow-traces)
11. [Permission System](#11-permission-system)

---

## 1. Architecture Overview

**Framework**: NestJS with Drizzle ORM (PostgreSQL)
**Global Prefix**: `api/v1`
**Authentication**: BetterAuth + custom RS256 JWT + httpOnly cookies
**Validation**: Zod schemas via `nestjs-zod` (`ZodValidationPipe`)

### Module Dependency Graph

```
AppModule
  ├── ConfigModule
  ├── DatabaseModule
  ├── LoggerModule (pino)
  ├── AuditModule (@Global)
  ├── AuthModule (@Global) ── imports [RolesModule, RoutesModule]
  ├── RolesModule
  ├── RoutesModule
  ├── LocationModule
  ├── LookupsModule
  ├── CodesModule
  ├── UsersModule
  ├── StatusModule
  ├── EntityStatusModule
  └── SyncModule
```

### Global Middleware/Pipes/Filters/Interceptors (applied in `main.ts`)

| Layer | Class | Purpose |
|---|---|---|
| Middleware | `RequestIdMiddleware` | Attaches `X-Request-ID` (UUID v4) to every request/response |
| Middleware | `CsrfMiddleware` | CSRF token generation/validation; exempt: Bearer token requests and `/api/v1/auth/*` |
| Middleware | `helmet()` | CSP headers, HSTS, frameguard, referrer policy |
| Middleware | `cookieParser()` | Parses `Cookie` header into `req.cookies` |
| Pipe | `ZodValidationPipe` | Global Zod schema validation |
| Filter | `GlobalExceptionFilter` | Unified error responses: AppException > ZodValidationException > HttpException > DB errors > 500 |
| Interceptor | `LoggingInterceptor` | Logs method, path, status, duration |
| Interceptor | `TransformInterceptor` | Wraps raw returns in `ApiResponse<T>` |
| Interceptor | `TimeoutInterceptor` | 30-second request timeout (matches `REQUEST_TIMEOUT_MS` constant) |

---

## 2. Application Bootstrap

- Validates environment variables via `validateEnv()` before startup
- CORS configured from `ALLOWED_ORIGINS` env var
- Swagger docs at `/api/v1/docs`
- Default port: 4000

---

## 3. Database Schema

### 3.1 Base Entities

| Base Entity | Fields | Use Case |
|---|---|---|
| `coreEntity()` | id (bigserial PK), guuid (UUID), isActive, createdAt, updatedAt, deletedAt | Standard transactional tables |
| `betterAuthEntity()` | id (bigserial PK), guuid (UUID), createdAt, updatedAt | BetterAuth-managed tables (hard-deleted) |
| `junctionEntity()` | id (bigserial PK), createdAt | Mapping/junction tables |
| `baseEntity()` | coreEntity + sortOrder, isHidden, isSystem | Reference/lookup tables |
| `appendOnlyEntity()` | id (bigserial PK), createdAt | Immutable audit tables |
| `auditFields(getUsersId)` | createdBy, modifiedBy, deletedBy (all FK to users with onDelete: 'restrict') | Who-did-what tracking |

### 3.2 Enums

| Enum | Values |
|---|---|
| `deviceTypeEnum` | IOS, ANDROID |
| `sessionDeviceTypeEnum` | IOS, ANDROID, WEB |
| `notificationChannelEnum` | WEBSOCKET, PUSH, BOTH |
| `routeScopeEnum` | admin, store |
| `routeTypeEnum` | sidebar, tab, screen, modal |
| `volumeTypeEnum` | weight, volume, length, count, area |
| `storeStatusEnum` | ACTIVE, SUSPENDED, CLOSED |
| `otpPurposeEnum` | LOGIN, PHONE_VERIFY, EMAIL_VERIFY, RESET_PASSWORD |
| `auditActionTypeEnum` | CREATE, UPDATE, DELETE, LOGIN, LOGOUT, TOKEN_REFRESH, TOKEN_REVOKE, PASSWORD_RESET, EMAIL_VERIFIED, PHONE_VERIFIED, OTP_REQUESTED, OTP_VERIFIED, OTP_FAILED, INVITE_SENT, INVITE_ACCEPTED, INVITE_REVOKED, ROLE_ASSIGNED, ROLE_REVOKED, PERMISSION_GRANTED, PERMISSION_REVOKED, STORE_CREATED, STORE_DELETED, ACCOUNT_BLOCKED, ACCOUNT_UNBLOCKED |
| `authMethodEnum` | OTP, PASSWORD, GOOGLE |

### 3.3 Auth Tables

#### `users`
**Base**: `coreEntity()` + `auditFields(selfRef)`

| Column | Type | Constraints |
|---|---|---|
| iamUserId | varchar(64) | unique |
| name | varchar(255) | NOT NULL |
| email | varchar(255) | unique |
| emailVerified | boolean | default false |
| image | text | |
| phoneNumber | varchar(20) | unique |
| phoneNumberVerified | boolean | default false |
| kycLevel | smallint | default 0 |
| languagePreference | varchar(5) | default 'en' |
| whatsappOptedIn | boolean | default true |
| isBlocked | boolean | default false |
| blockedReason | text | |
| blockedAt | timestamp(tz) | |
| accountLockedUntil | timestamp(tz) | brute-force lockout |
| blockedBy | bigint FK(users) | onDelete: set null |
| primaryLoginMethod | authMethodEnum | |
| loginCount | integer | default 0 |
| failedLoginAttempts | integer | default 0 |
| lastLoginAt | timestamp(tz) | |
| lastActiveAt | timestamp(tz) | |
| profileCompleted | boolean | default false |
| profileCompletedAt | timestamp(tz) | |
| permissionsVersion | varchar(20) | default 'v1' |

**Check**: `email IS NOT NULL OR phone_number IS NOT NULL`
**Indexes**: email, phoneNumber, iamUserId (unique), blockedBy, profileCompleted, permissionsVersion

#### `user_session`
**Base**: `betterAuthEntity()`

| Column | Type | Constraints |
|---|---|---|
| expiresAt | timestamp(tz) | NOT NULL |
| token | text | NOT NULL, unique |
| ipAddress | varchar(50) | |
| userAgent | text | |
| userId | bigint FK(users) | NOT NULL, onDelete: cascade |
| deviceId | varchar(100) | |
| deviceName | varchar(100) | |
| deviceType | sessionDeviceTypeEnum | |
| platform | varchar(20) | |
| appVersion | varchar(20) | |
| loginMethod | authMethodEnum | |
| activeStoreFk | bigint FK(store) | onDelete: set null |
| refreshTokenHash | varchar(64) | SHA256 hash |
| refreshTokenExpiresAt | timestamp(tz) | |
| accessTokenExpiresAt | timestamp(tz) | |
| ipHash | varchar(64) | HMAC-SHA256 of IP |
| roleHash | varchar(64) | SHA256 for change detection |
| refreshTokenRevokedAt | timestamp(tz) | |
| revokedReason | varchar(50) | ROTATION, TOKEN_REUSE, LOGOUT, PASSWORD_CHANGE, ADMIN_FORCE_LOGOUT |
| isRefreshTokenRotated | boolean | default false |

#### `user_auth_provider`
**Base**: `betterAuthEntity()`

| Column | Type | Constraints |
|---|---|---|
| accountId | text | NOT NULL |
| providerId | text | NOT NULL |
| userId | bigint FK(users) | NOT NULL, onDelete: cascade |
| accessToken, refreshToken, idToken | text | |
| accessTokenExpiresAt, refreshTokenExpiresAt | timestamp(tz) | |
| scope | text | |
| password | text | bcrypt hash |
| isVerified | boolean | default false |
| verifiedAt | timestamp(tz) | |

**Unique**: (userId, providerId)

#### `otp_verification`
**Base**: `betterAuthEntity()`

| Column | Type | Constraints |
|---|---|---|
| identifier | text | NOT NULL (phone/email) |
| value | text | NOT NULL (OTP hash or MSG91 placeholder) |
| purpose | otpPurposeEnum | NOT NULL |
| attempts | smallint | default 0 |
| isUsed | boolean | default false |
| expiresAt | timestamp(tz) | NOT NULL |
| authProviderId | bigint FK(user_auth_provider) | onDelete: restrict |
| reqId | text | MSG91 request ID |

#### `otp_request_log`
**Base**: `betterAuthEntity()`

| Column | Type | Constraints |
|---|---|---|
| identifierHash | text | NOT NULL (SHA256 + pepper) |
| requestCount | smallint | default 1 |
| windowExpiresAt | timestamp(tz) | NOT NULL |
| lastAttemptAt | timestamp(tz) | |
| consecutiveFailures | smallint | default 0 |

#### `user_role_mapping`
**Base**: `coreEntity()`

| Column | Type | Constraints |
|---|---|---|
| userFk | bigint FK(users) | NOT NULL, onDelete: cascade |
| roleFk | bigint FK(roles) | NOT NULL, onDelete: restrict |
| storeFk | bigint FK(store) | nullable; NULL = platform role |
| isPrimary | boolean | default false |
| assignedBy | bigint FK(users) | onDelete: set null |
| assignedAt | timestamp(tz) | default now |

**Partial Unique Indexes**:
- `urm_unique_global_idx`: (userFk, roleFk) WHERE storeFk IS NULL AND deletedAt IS NULL
- `urm_unique_store_idx`: (userFk, roleFk, storeFk) WHERE storeFk IS NOT NULL AND deletedAt IS NULL

### 3.4 RBAC Tables

#### `roles`
**Base**: `baseEntity()` + `auditFields`

| Column | Type | Constraints |
|---|---|---|
| code | varchar(30) | NOT NULL |
| roleName | varchar(50) | NOT NULL |
| description | varchar(250) | |
| storeFk | bigint FK(store) | nullable; NULL = system role |
| isSystem | boolean | default false |
| isEditable | boolean | default true |

**System Role Codes**: SUPER_ADMIN, USER, STORE_OWNER, STAFF

#### `routes`
**Base**: `baseEntity()` + `auditFields`

| Column | Type | Constraints |
|---|---|---|
| parentRouteFk | bigint FK(routes, self) | onDelete: set null |
| routeName | varchar(100) | NOT NULL |
| routePath | varchar(200) | NOT NULL |
| fullPath | varchar(400) | default '' |
| description | varchar(255) | |
| iconName | varchar(80) | nullable |
| routeType | routeTypeEnum | default 'screen' |
| routeScope | routeScopeEnum | default 'admin' |
| isPublic | boolean | default false |

**Unique**: (routePath, routeScope) WHERE deletedAt IS NULL

#### `role_route_mapping`
**Base**: `junctionEntity()`

| Column | Type | Constraints |
|---|---|---|
| roleFk | bigint FK(roles) | NOT NULL, onDelete: cascade |
| routeFk | bigint FK(routes) | NOT NULL, onDelete: cascade |
| allow | boolean | default true |
| deny | boolean | default false |
| canView, canCreate, canEdit, canDelete, canExport | boolean | defaults false |
| assignedBy | bigint FK(users) | onDelete: set null |

#### `role_entity_permission`
**Base**: `baseEntity()`

| Column | Type | Constraints |
|---|---|---|
| roleFk | bigint FK(roles) | NOT NULL, onDelete: cascade |
| entityTypeFk | bigint FK(entity_type) | NOT NULL, onDelete: restrict |
| canView, canCreate, canEdit, canDelete | boolean | defaults false |
| deny | boolean | default false |

### 3.5 Store Tables

#### `store`
**Base**: `baseEntity()` + `auditFields`

| Column | Type | Key Constraints |
|---|---|---|
| iamStoreId | varchar(64) | unique |
| storeName | varchar(255) | NOT NULL |
| storeCode | varchar(50) | unique |
| ownerUserFk | bigint FK(users) | onDelete: restrict |
| storeLegalTypeFk | bigint FK(store_legal_type) | NOT NULL |
| storeCategoryFk | bigint FK(store_category) | NOT NULL |
| registrationNumber | varchar(100) | |
| taxNumber | varchar(100) | GST/VAT |
| storeStatus | storeStatusEnum | default 'ACTIVE' |
| countryFk | bigint FK(country) | |
| timezone | varchar(60) | default 'UTC' |
| defaultTaxRate | numeric(5,2) | default 0 |
| parentStoreFk | bigint FK(store, self) | onDelete: restrict |

#### `store_user_mapping`
**Base**: `coreEntity()`

| Column | Type | Constraints |
|---|---|---|
| storeFk | bigint FK(store) | NOT NULL, onDelete: cascade |
| userFk | bigint FK(users) | NOT NULL, onDelete: cascade |
| designationFk | bigint FK(code_value) | onDelete: set null |
| joinedDate | timestamp(tz) | default now |

**Partial Unique**: (storeFk, userFk) WHERE deletedAt IS NULL

### 3.6 Audit Table

#### `audit_logs`
**Base**: `appendOnlyEntity()`

| Column | Type | Constraints |
|---|---|---|
| userFk | bigint FK(users) | onDelete: set null |
| storeFk | bigint FK(store) | onDelete: set null |
| sessionFk | bigint FK(user_session) | onDelete: set null |
| action | auditActionTypeEnum | NOT NULL |
| entityType | varchar(50) | |
| entityId | bigint | |
| oldValues, newValues, meta | jsonb | |
| ipAddress | inet | |
| isSuccess | boolean | default true |
| failureReason | text | |

---

## 4. Common Layer

### 4.1 AuthGuard

1. Checks `@Public()` decorator — skips if public
2. Extracts session token from `Authorization: Bearer <token>` OR `nks_session` httpOnly cookie
3. Validates session from DB (`user_session` table by token)
4. Checks session expiry
5. Fetches user from `users` table
6. Queries `user_role_mapping` JOIN `roles` JOIN `store` for live role data
7. Populates `req.user: SessionUser`
8. Checks `isBlocked` — deletes all sessions and throws 401
9. Fire-and-forget: updates `lastActiveAt`

### 4.2 RBACGuard

1. SUPER_ADMIN bypasses all checks
2. Checks `@Roles()` decorator — verifies user has at least one required role
3. Checks `@RequireEntityPermission()`:
   - Queries `role_entity_permission` for user's roles in active store
   - DENY overrides ALL grants (deny-overrides-grant pattern)

### 4.3 RateLimitingGuard

Standalone in-memory IP-based rate limiter (`@nestjs/throttler` not required).

- **Window**: 15 minutes, **Limit**: 100 requests per IP
- Sliding window — resets per IP independently
- Exempt IPs can be configured (e.g., internal health checkers)
- Applied via `@UseGuards(RateLimitingGuard)` at controller level
- **Not currently applied** to any controller (available for use; production deployments should use infrastructure-level rate limiting via nginx/API Gateway)

### 4.4 ApiResponse

Standard envelope: `{ status, statusCode, message, errorCode, data, details, meta, timestamp }`

### 4.5 GlobalExceptionFilter

Priority order: `AppException` > `ZodValidationException` > `HttpException` > PostgreSQL errors (23505→409, 23503→422) > Unknown→500

---

## 5. Auth Module

`@Global()` module. Imports `RolesModule`, `RoutesModule`.

### 5.1 AuthController (`/auth`)

| Method | Path | Guards | Description |
|---|---|---|---|
| POST | `/auth/login` | none | Email+password login |
| POST | `/auth/register` | none | Register new user; first user gets SUPER_ADMIN |
| POST | `/auth/refresh-token` | none | Rotate access+refresh tokens |
| GET | `/auth/me` | AuthGuard | Get authenticated user profile |
| POST | `/auth/logout` | none | Invalidate session |
| GET | `/auth/.well-known/jwks.json` | none | JWKS public key set (1h cache) |
| GET | `/auth/mobile-jwks` | none | RS256 JWKS for mobile offline |
| POST | `/auth/sync-time` | none | Mobile time sync |
| POST | `/auth/token/verify` | AuthGuard | Verify JWT claims, detect role changes |
| GET | `/auth/permissions-snapshot` | AuthGuard | Full permissions snapshot |
| GET | `/auth/permissions-delta` | AuthGuard | Delta permissions since version |
| GET | `/auth/sessions` | AuthGuard | List active sessions |
| DELETE | `/auth/sessions/:sessionId` | AuthGuard | Terminate specific session |
| DELETE | `/auth/sessions` | AuthGuard | Terminate all sessions |
| GET | `/auth/session-status` | none | Check session revocation status (manual token validation) |

### 5.2 OtpController (`/auth/otp`)

| Method | Path | Guards | Description |
|---|---|---|---|
| POST | `/auth/otp/send` | none | Send OTP via MSG91 |
| POST | `/auth/otp/verify` | none | Verify OTP and create session |
| POST | `/auth/otp/resend` | none | Resend OTP |
| POST | `/auth/otp/email/send` | AuthGuard | Send email OTP |
| POST | `/auth/otp/email/verify` | AuthGuard | Verify email OTP |

### 5.3 AuthResponseEnvelope (response shape)

**Login Response** (`POST /auth/otp/verify`, `POST /auth/register`):
```json
{
  "requestId": "uuid",
  "traceId": "uuid",
  "apiVersion": "1.0",
  "timestamp": "2026-04-13T...",
  "user": {
    "id": number,
    "guuid": "uuid",
    "name": string,
    "email": string,
    "emailVerified": boolean,
    "phoneNumber": string,
    "phoneNumberVerified": boolean,
    "image": string | null
  },
  "session": {
    "sessionId": string,
    "sessionToken": string,
    "expiresAt": timestamp,
    "refreshToken": string,
    "refreshExpiresAt": timestamp,
    "jwtToken": string,
    "defaultStore": { guuid: string } | null
  },
  "access": {
    "isSuperAdmin": boolean,
    "activeStoreId": number | null,
    "roles": [
      {
        "roleCode": string,
        "storeId": number | null,
        "storeName": string | null,
        "isPrimary": boolean,
        "assignedAt": timestamp,
        "expiresAt": timestamp | null
      }
    ]
  },
  "offlineToken": string
}
```

**Notes on field mapping**:
- `session.jwtToken` → 15-min RS256 JWT for API calls (mobile maps this to internal `accessToken` in JWTManager, SecureStore key: `auth.jwt.access`)
- `session.sessionToken` → opaque BetterAuth session token (used for session-status checks, SecureStore key: `nks_session`)
- `session.refreshToken` → 7-day opaque token for rotation (SecureStore key: `auth.jwt.refresh`)
- `session.defaultStore` → `{ guuid }` (not `{ id, name }` — uses guuid per Zod schema)
- `offlineToken` → 3-day RS256 JWT for offline authorization (same kid as jwtToken, SecureStore key: `auth.jwt.offline`)
- Mobile stores jwtToken, offlineToken, and refreshToken in SecureStore via JWTManager

**Token Refresh Response** (`POST /auth/refresh-token`):
```json
{
  "sessionId": string,
  "sessionToken": string,
  "jwtToken": string,
  "expiresAt": timestamp,
  "refreshToken": string,
  "refreshExpiresAt": timestamp,
  "defaultStore": { "guuid": string } | null,
  "offlineToken": string
}
```

### 5.4 Key Services

#### AuthService
- `login(dto, deviceInfo)` — Email+password with brute-force protection (5 attempts, 15-min lockout)
- `register(dto, deviceInfo)` — Atomic transaction: user + auth provider + role. First user → SUPER_ADMIN
- `createSessionForUser(userId, deviceInfo)` — BetterAuth session + role embedding + JWT signing
- `createTokenPair(...)` — RS256 JWT (15min) + opaque refresh token (SHA256 stored)
- `refreshAccessToken(refreshToken, deviceId)` — Token rotation with theft detection
- `buildAuthResponse(...)` — Constructs AuthResponseEnvelope

#### OtpService
- `sendOtp(dto)` — Rate limit → MSG91 sendOtp → store OTP record
- `verifyOtp(dto)` — Find OTP → MSG91 verifyOtp → mark used
- `sendEmailOtp(email)` — Generate 6-digit, HMAC-SHA256 hash, store
- `verifyEmailOtp(dto)` — Verify hash (timing-safe), mark verified

#### OtpAuthOrchestrator
Bridges: OtpService.verifyOtp() → UserCreationService.findOrCreateByPhone() → AuthFlowOrchestrator.executeAuthFlow()

#### AuthFlowOrchestrator
Unified flow: createSessionForUser() → createTokenPair() → buildAuthResponse()

#### SessionService
- Session limit enforced atomically via `deleteExcessSessions()` SQL (no race conditions from concurrent logins). Two enforcement points exist:
  - `SessionService.enforceSessionLimit()` — called **before** new session creation; keeps up to 4 (`MAX_SESSIONS_PER_USER - 1`)
  - `AuthService.enforceSessionLimit()` — called **after** session creation; keeps up to 5 (`MAX_CONCURRENT_SESSIONS`)
- Hard-delete on revocation
- Scheduled cleanup of expired sessions

#### PasswordService
- bcrypt with 12 rounds
- Strength validation (12+ chars, upper, lower, number, special)

#### RefreshTokenService
- 32 random bytes (base64url) + SHA256 hash stored
- Timing-safe comparison

#### SessionStatusService (`GET /auth/session-status`)

Session revocation check for mobile reconnection (no AuthGuard):
1. Extract **opaque BetterAuth session token** from `Authorization: Bearer <token>` header OR `nks_session` cookie
2. Query `user_session` table by `token` column (exact string match — this is the opaque session token, NOT the JWT)
3. If no session found → `{ active: false, revoked: true, wipe: false }`
4. If session expired (`expiresAt < now`) → `{ active: false, revoked: true, wipe: false }`
5. If session valid → check `users.isBlocked` → `{ active: true, revoked: false, wipe: isBlocked }`
6. If `wipe: true`: client performs remote wipe (logout + clear offline session + clear local database)

**IMPORTANT**: Mobile must send the **opaque session token** (`tokenManager.get()`), NOT the JWT access token (`JWTManager.getRawAccessToken()`). The `user_session.token` column stores the opaque BetterAuth token. Sending the JWT will never match any session record.

**Why no AuthGuard**: After long offline periods, the JWT access token is expired. AuthGuard would reject the request with 401 before the revocation status could be returned.

#### OtpRateLimitService
- 5 OTP requests per identifier per 1-hour window
- Exponential backoff: 0, 0, 30s, 60s, 2m, 5m, 15m
- Identifiers hashed with SHA256 + pepper (GDPR/DPDP compliance)
- Throws `TooManyRequestsException` (not raw `HttpException`) with `meta: { retryAfter, failureCount? }` for backoff and window-exceeded cases

### 5.5 JWTConfigService

- **Algorithm**: RS256
- **Access Token TTL**: 15 minutes
- **Offline Token TTL**: 3 days
- **Key ID (kid)**: SHA-256 thumbprint of RS256 public key (not hardcoded). Computed as: `kid = hex(sha256(der_spki_public_key))` (see `jwt.config.ts:computeKeyThumbprint()`). This enables mobile clients to match tokens against cached JWKS entries post-rotation without manual configuration changes.
- **Key Rotation**: 30-day fallback grace period for offline clients. New keys are added to JWKS immediately; old keys remain valid for 30 days post-rotation. JWKS cached 1 hour on clients.
- **JWT Payload**: `{ sub, sid, jti, email?, roles[], iat, exp, iss: 'nks-auth', aud: 'nks-app', kid }`

### 5.6 KeyRotationScheduler & KeyRotationAlertService

**Automated Zero-Downtime Key Rotation**

The system implements automatic JWT key rotation with comprehensive alerting.

**KeyRotationScheduler** (`key-rotation-scheduler.ts`):
- **Schedule**: Every 30 days (configurable via `JWT_KEY_ROTATION_INTERVAL_DAYS`)
- **Maintenance Window**: 02:00 UTC (configurable via `JWT_ROTATION_WINDOW_START`, `JWT_ROTATION_WINDOW_DURATION`)
- **Process**:
  1. Archive current active key as fallback (expires in 30 days)
  2. Generate new RSA 2048-bit key pair (via HSM/KMS in production; `generateNewKeyPair()` is a placeholder — returns null until wired to external key management)
  3. Recompute KID as SHA-256 hex thumbprint of new public key
  4. Add new key to JWKS immediately (old key remains valid)
  5. Alert ops team on success/failure
- **Zero-Downtime**: Old key valid for 30 days → offline clients (3-day JWT TTL) have 9+ offline windows to validate
- **Emergency Rotation**: Manual trigger via `POST /admin/auth/rotate-keys-emergency` for key compromise

**KeyRotationAlertService** (`key-rotation-alert.service.ts`):
- **Channel 1 — Structured pino log**: Always fires on success/failure (works with any log aggregator: Datadog, CloudWatch, etc.)
- **Channel 2 — Slack webhook**: Optional, configure `SLACK_WEBHOOK_URL` (5-second timeout, non-blocking)
- **Email**: Not yet implemented. Wire `@nestjs-modules/mailer` when ready.
- **Alert Content**:
  - Success: Old/new KID, rotation duration, reason (scheduled/emergency)
  - Failure: Error details, old KID (unchanged), CRITICAL flag. If Slack also fails, emits `KEY_ROTATION_ALERT_ALL_CHANNELS_FAILED` FATAL log for independent alerting.
- **Configuration**: `KEY_ROTATION_ALERT_ENABLED=true` (default), `SLACK_WEBHOOK_URL` (optional)

**Admin Endpoints** (planned — service methods exist, controller not yet wired):
| Method | Path | Service Method | Description |
|---|---|---|---|
| GET | `/admin/auth/key-rotation-status` | `KeyRotationScheduler.getRotationStatus()` | Current rotation status (enabled, currentKid, lastRotation, activeKeys) |
| POST | `/admin/auth/rotate-keys-emergency` | `KeyRotationScheduler.rotateKeysEmergency()` | Manually trigger emergency key rotation (SUPER_ADMIN only) |
| GET | `/admin/auth/test-key-rotation-alerts` | `KeyRotationAlertService.testAlertConfiguration()` | Test Slack webhook configuration |

> **Note**: These endpoints require an admin controller to be created. The service methods are implemented and ready to be wired.
> **DI Status**: `KeyRotationScheduler` and `KeyRotationAlertService` are **not currently registered in `AuthModule` providers** — they will not instantiate at runtime (including `onModuleInit` scheduling) until added to the providers array.w

**Documentation**:
- **Runbook**: [KEY_ROTATION_RUNBOOK.md](./KEY_ROTATION_RUNBOOK.md) — Operations guide with failure scenarios and recovery procedures
- **Implementation Guide**: [KEY_ROTATION_IMPLEMENTATION_GUIDE.md](./KEY_ROTATION_IMPLEMENTATION_GUIDE.md) — Integration steps for deploying to production
- **Solution Summary**: [KEY_ROTATION_SOLUTION_SUMMARY.md](./KEY_ROTATION_SOLUTION_SUMMARY.md) — Architecture overview and configuration reference

---

## 6. Roles Module

### Controller (`/roles`) — All guarded: AuthGuard + RBACGuard + `@Roles('STORE_OWNER')`

| Method | Path | Description |
|---|---|---|
| POST | `/roles` | Create custom role (store ownership verified) |
| GET | `/roles/:guuid` | Get role detail with entity + route permissions |
| PUT | `/roles/:guuid` | Update role + entity permissions |

### RolesService — Authorization Helpers

Three public delegation methods (exposed for cross-module use — other services call `RolesService`, never `RolesRepository` directly):

- `isStoreOwner(userId, storeId): Promise<boolean>` — delegates to `RolesRepository.isStoreOwner()`
- `findUserRoles(userId)` — delegates to `RolesRepository.findUserRoles()`
- `getActiveRolesForStore(userId, storeId)` — delegates to `RolesRepository.getActiveRolesForStore()`

Used by: `RoutesService` (for sidebar nav), `CodesService` (store ownership guard)

### RoleEntityPermissionRepository — Return Contract

Repository methods follow the null-return pattern (no HTTP exceptions thrown from repository layer):

- `deletePermission(roleId, entityCode): Promise<boolean>` — returns `false` if entity type not found, `true` on success
- `create(roleId, entityCode, data): Promise<RoleEntityPermissionRow | null>` — returns `null` if entity type not found
- `upsertPermission(roleId, entityCode, permission): Promise<boolean>` — returns `false` if entity type not found

Callers in `RolesService.updateEntityPermissions()` check the return value and throw `NotFoundException` when `null`/`false` is returned.

---

## 7. Routes Module

### Controller (`/routes`) — Guarded: AuthGuard + RBACGuard

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/routes/admin` | SUPER_ADMIN | Admin routes (hierarchical tree) |
| GET | `/routes/store/:storeGuuid` | any authenticated | Store routes for user |

### RoutesService

Uses `RolesService` (not `RolesRepository` directly) for all role-related queries:
- `rolesService.findUserRoles(userId)` — for admin route role ID resolution
- `rolesService.isStoreOwner(userId, storeId)` — for store owner fast-path
- `rolesService.getActiveRolesForStore(userId, storeId)` — for custom role route resolution

---

## 7.5 Status & EntityStatus Modules

### StatusService

Exposes a public `findByGuuid(guuid): Promise<Status | null>` method for cross-module use. Used by `EntityStatusService` to resolve a status guuid to its row without importing `StatusRepository` directly.

### EntityStatusService

Uses `StatusService` (not `StatusRepository` directly) for status lookups — `this.statusService.findByGuuid(dto.statusGuuid)`.

### CodesService

Uses `RolesService` (not `RolesRepository` directly) for store ownership verification — `this.rolesService.isStoreOwner(userId, storeId)`.

> **Module boundary rule**: Services must call other modules' services, never their repositories directly. Only the owning service may interact with its own repository.

---

## 8. Lookups Module

### Public Endpoints (17 total)

`/lookups/salutations`, `/lookups/countries`, `/lookups/address-types`, `/lookups/communication-types`, `/lookups/designations`, `/lookups/store-legal-types`, `/lookups/store-categories`, `/lookups/currencies`, `/lookups/volumes`, `/lookups/plan-types`, `/lookups/tax-line-statuses`, `/lookups/entity-types`, `/lookups/notification-statuses`, `/lookups/staff-invite-statuses`, `/lookups/billing-frequencies`, `/lookups/tax-registration-types`, `/lookups/tax-filing-frequencies`

### Admin Endpoints (SUPER_ADMIN only)

| Method | Path | Description |
|---|---|---|
| GET | `/lookups/admin` | All categories with counts |
| GET | `/lookups/admin/:code` | Values for category |
| POST | `/lookups/admin/:code` | Create value |
| PUT | `/lookups/admin/:code/:id` | Update value |
| DELETE | `/lookups/admin/:code/:id` | Soft-delete value |

---

## 8.5 Sync Module (Offline Sync)

### Controller (`/sync`)

| Method | Path | Guards | Query/Body | Description |
|---|---|---|---|---|
| GET | `/sync/changes` | AuthGuard | cursor (ms), storeId (guuid), tables (reserved — only 'routes' currently supported) | Fetch data changes since cursor for offline sync |
| POST | `/sync/push` | AuthGuard + RBACGuard + Roles | operations (array) | Upload offline mutations from mobile device |

### SyncRepository

**Exported Methods**:

`verifyStoreMembership(userId, storeGuuid): Promise<number | null>`
- Verifies user can access the store via either store membership or ownership
- `store_user_mapping`: LEFT JOIN where user_fk = userId AND deleted_at IS NULL
- WHERE store.guuid = storeGuuid AND (store.owner_user_fk = userId OR store_user_mapping.user_fk = userId)
- Covers STORE_OWNER whose association comes from `store.ownerUserFk` (not a row in store_user_mapping)
- Returns numeric store.id if access is confirmed, else null
- Used to authorize `/sync/changes` requests

`getRouteChanges(cursorMs, limit): Promise<RouteChangeRow[]>`
- Fetches routes WHERE updated_at > new Date(cursorMs)
- Orders by updated_at ASC, fetches limit+1 rows (to detect hasMore)
- Returns full rows including deletedAt field (null = active, non-null = soft-deleted)
- Currently only route table syncs (no store-scoped tables yet)

### SyncService

**GET /sync/changes** → `SyncService.getChanges(userId, cursorMs, storeGuuid)`:
- Guard: `AuthGuard` only (any authenticated user)
- Query validation: cursor ≥ 0, storeId required (guuid string)
- Verifies user belongs to store via `syncRepository.verifyStoreMembership()`
- If user not in store: returns empty `{ nextCursor: cursorMs, hasMore: false, changes: [] }`
- Fetches routes via `syncRepository.getRouteChanges(cursorMs, limit)`
- Maps rows to SyncChange format:
  - deletedAt IS NOT NULL → `{ operation: 'delete', data: null }`
  - deletedAt IS NULL → `{ operation: 'upsert', data: fullRow }`
- Returns: `{ nextCursor: number, hasMore: boolean, changes: SyncChange[] }`
- nextCursor = max(updatedAt) of returned rows as milliseconds since epoch
- hasMore = true if rowCount > limit

**POST /sync/push** → `SyncService.processPushBatch(operations, userId, activeStoreId)`:
- Guards: `AuthGuard` + `RBACGuard` + `@Roles('CASHIER', 'MANAGER', 'STORE_OWNER')`
- Processes batched mutations from `req.body.operations` array
- Each operation wrapped in transaction with idempotency log (prevents duplicate re-processing)
- Field-level conflict resolution via `fieldLevelMerge()` static method
- Returns: `{ processed: number }` — count of successfully applied operations

---

## 9. Audit Module

`@Global()` module.

**AuditEventType**: LOGIN, LOGOUT, OTP_VERIFY, OTP_SEND, PASSWORD_CHANGE, PERMISSION_GRANT, PERMISSION_REVOKE, TOKEN_REFRESH, TOKEN_THEFT_DETECTED, SUPER_ADMIN_ACTION, BREAK_GLASS_ACCESS, DEVICE_LOGIN, DEVICE_LOGOUT, SESSION_TERMINATE, STORE_DATA_ACCESS

All audit log writes are non-blocking (fire-and-forget).

---

## 10. Auth Flow Traces

### 10.1 OTP Login Flow

```
POST /auth/otp/send
  → OtpController.sendOtp(dto)
  → OtpService.sendOtp(dto)
    → OtpRateLimitService.checkAndRecordRequest(phone)
      → OtpRateLimitRepository.findByIdentifierHash(SHA256(phone+pepper))
      → Check window expiry, request count (5/hr), exponential backoff
    → Msg91Service.sendOtp(phone) → HTTP POST to MSG91
    → OtpRepository.insertOtpRecord(phone, 'PHONE_VERIFY', 'MSG91_MANAGED', expiresAt, reqId)
  ← { reqId, mobile }

POST /auth/otp/verify
  → OtpController.verifyOtp(dto, req, res)
  → extractDeviceInfo(req) → {deviceId, deviceName, deviceType, appVersion, ipAddress, userAgent}
  → OtpAuthOrchestrator.verifyOtpAndBuildAuthResponse(dto, deviceInfo)
    → OtpService.verifyOtp(dto)
      → OtpRepository.findByIdentifierPurposeAndReqId(phone, 'PHONE_VERIFY', reqId)
      → Check: not null, not isUsed, not expired
      → Msg91Service.verifyOtp(reqId, otp) → HTTP POST to MSG91
      → OtpRepository.markAsUsedByReqId(reqId)
    → UserCreationService.findOrCreateByPhone(phone)
      → AuthUsersRepository.findByPhone(phone) / create(...)
      → AuthUsersRepository.verifyPhone(userId)
    → AuthFlowOrchestrator.executeAuthFlow(user, deviceInfo)
      → AuthService.createSessionForUser(userId, deviceInfo)
        → BetterAuth.createSession(String(userId))
        → getUserPermissions(userId) → roles
        → hashRoles(roles) → SHA256
        → SessionsRepository.updateByToken(token, {roleHash, device...})
        → JWTConfigService.signToken({sub, sid, jti, email, roles})  [RS256, 15min]
        → enforceSessionLimit(userId) [max 5]
      → AuthService.createTokenPair(...)
        → RefreshTokenService.generateRefreshToken() [32 bytes + SHA256]
        → JWTConfigService.signToken(...)
        → SessionsRepository.setRefreshTokenData(...)
      → AuthService.buildAuthResponse(...) → AuthResponseEnvelope
  → applySessionCookie(res, result) [httpOnly, secure, sameSite:strict]
  ← ApiResponse.ok(result)
```

### 10.2 Token Refresh Flow

```
POST /auth/refresh-token
  → Parse refresh token from body OR cookie
  → AuthService.refreshAccessToken(refreshToken, deviceId)
    → SHA256 of provided token
    → SessionsRepository.findByRefreshTokenHashForUpdate(hash) [SELECT ... FOR UPDATE]
    → Validate: exists, not revoked, not expired
    → THEFT DETECTION: if isRefreshTokenRotated == true:
      → All user sessions terminated
      → AuditService.logTokenTheftDetected()
      → Throw UnauthorizedException
    → Generate new refresh token + new JWT
    → Mark old as rotated + store new hash
  ← new tokens
```

### 10.3 Registration Flow

```
POST /auth/register
  → SanitizerValidator.sanitizeEmail/sanitizeName
  → Check email not taken
  → PasswordService.hash(password) [bcrypt 12 rounds]
  → AuthUsersRepository.createUserWithInitialRole(...)
    → db.transaction: INSERT user + INSERT auth_provider + assign role
    → First user → SUPER_ADMIN, else → USER
  → createSessionForUser + createTokenPair + buildAuthResponse
```

---

## 11. Permission System

### Role Architecture

```
Platform Roles (storeFk IS NULL):
  SUPER_ADMIN — bypasses all guards
  USER — basic platform access

Store-Scoped Roles (storeFk IS NOT NULL):
  STORE_OWNER — full store access (store.ownerUserFk)
  STAFF — system store role
  Custom: MANAGER, CASHIER, etc. (created by STORE_OWNER)
```

### Permission Resolution

1. **AuthGuard** queries live role data on every request → `req.user.roles`
2. **RBACGuard**:
   - SUPER_ADMIN → bypass all
   - `@Roles()` → check role codes
   - `@RequireEntityPermission()` → query entity permissions for user's store roles:
     - Union grant (OR) across all roles
     - DENY overrides ALL grants

### Route Permissions

`role_route_mapping` maps roles → routes with allow/deny + CRUD flags. Routes resolved as hierarchical trees for frontend sidebar navigation.

### Permission Versioning (Mobile Sync)

- `users.permissionsVersion` = `vN`, incremented on role/permission changes
- Mobile can request full snapshot or delta since version
