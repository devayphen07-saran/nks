# NKS — Full Implementation Reference

> **Generated:** 2026-04-19 | **Scope:** Backend + Mobile + Shared Packages

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Backend — NestJS](#2-backend)
   - [Bootstrap & Middleware](#21-bootstrap--middleware)
   - [Database Schema](#22-database-schema)
   - [Auth Module](#23-auth-module)
   - [Users Module](#24-users-module)
   - [Roles Module](#25-roles-module)
   - [Routes Module](#26-routes-module)
   - [Location Module](#27-location-module)
   - [Lookups Module](#28-lookups-module)
   - [Codes Module](#29-codes-module)
   - [Status & Entity-Status Modules](#210-status--entity-status-modules)
   - [Stores Module](#211-stores-module)
   - [Audit Module](#212-audit-module)
   - [Sync Module](#213-sync-module)
   - [Guards, Decorators & Pipes](#214-guards-decorators--pipes)
   - [Common Utilities](#215-common-utilities)
   - [Error Codes & API Response](#216-error-codes--api-response)
3. [Mobile — React Native / Expo](#3-mobile)
   - [App Entry & Providers](#31-app-entry--providers)
   - [Auth Flow](#32-auth-flow)
   - [Phone & OTP Screens](#33-phone--otp-screens)
   - [Onboarding & Account Setup](#34-onboarding--account-setup)
   - [Store Management Screens](#35-store-management-screens)
   - [Personal Dashboard](#36-personal-dashboard)
   - [Token Management](#37-token-management)
   - [Offline Session](#38-offline-session)
   - [Local Database & Sync Engine](#39-local-database--sync-engine)
   - [Device Security](#310-device-security)
   - [Network & Reconnection](#311-network--reconnection)
   - [Redux Store](#312-redux-store)
   - [Navigation & Routing](#313-navigation--routing)
4. [Shared Packages](#4-shared-packages)
   - [API Manager — All Endpoints](#41-api-manager)
   - [State Manager — Redux Slices](#42-state-manager)
   - [Mobile UI Components](#43-mobile-ui-components)
   - [Mobile Theme](#44-mobile-theme)
   - [Mobile Utils](#45-mobile-utils)
   - [I18n](#46-i18n)
5. [Security Summary](#5-security-summary)
6. [Known TODOs](#6-known-todos)

---

## 1. Architecture Overview

```
nks/
├── apps/
│   ├── nks-backend/          NestJS REST API (Drizzle + PostgreSQL)
│   └── nks-mobile/           Expo 54 / React Native 0.81
├── packages/                 (workspace aliases: @nks/*)
│   ├── api-manager/          Axios client + Redux thunks + React Query hooks
│   ├── state-manager/        Shared Redux slices (auth, store, routes)
│   ├── mobile-ui-components/ 44 React Native components
│   ├── mobile-theme/         Design tokens (colors, sizing, typography)
│   ├── mobile-utils/         Device, network, storage, haptics utilities
│   ├── utils/                Cross-platform constants
│   ├── common-i18n/          Translation JSON files
│   └── mobile-i18n/          i18next setup for mobile
```

**Key tech:**

| Layer | Stack |
|-------|-------|
| Backend | NestJS 11, Drizzle ORM, PostgreSQL, Zod, RS256 JWT |
| Mobile | React Native 0.81, Expo 54, Expo Router 6, Redux Toolkit, SQLCipher, styled-components |
| API client | Axios (auto-refresh, 401/403 interceptor, retry) |
| Validation | Zod 4 (backend DTOs via `nestjs-zod` global pipe) |
| Auth | Session-based (web httpOnly cookie) + Bearer JWT (mobile) + offline RS256 JWT |
| Sync | Cursor-based pull + idempotent push with HMAC-signed offline sessions |

---

## 2. Backend

### 2.1 Bootstrap & Middleware

**File:** `src/main.ts`

- Global API prefix: `/api/v1`
- Default port: `4000`
- Swagger docs at `/api/v1/docs`

**Startup sequence:**

1. `validateEnv()` — Zod-validates all env vars, exits with clear errors on failure
2. `NestFactory.create(AppModule)`
3. Helmet (CSP, HSTS, Frameguard)
4. Trust proxy
5. Cookie parser
6. CSRF middleware
7. CORS (configurable origins)
8. `app.useGlobalPipes(new ZodValidationPipe())` — **nestjs-zod** global pipe; all `createZodDto` classes auto-validated on `@Body()`/`@Query()`
9. `app.useGlobalFilters(new GlobalExceptionFilter())`
10. `app.useGlobalInterceptors(LoggingInterceptor, TransformInterceptor, TimeoutInterceptor)`

**Required env vars:**

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection |
| `BETTER_AUTH_SECRET` | Auth signing (≥32 chars) |
| `BETTER_AUTH_BASE_URL` | API base URL |
| `MSG91_AUTH_KEY` | SMS OTP provider key |
| `MSG91_WIDGET_ID` | SMS OTP widget |
| `OTP_HMAC_SECRET` | OTP signing (≥32 chars) |
| `IP_HMAC_SECRET` | IP hashing (≥32 chars) |
| `OTP_IDENTIFIER_PEPPER` | OTP identifier (≥16 chars) |
| `OFFLINE_SESSION_HMAC_SECRET` | Offline session signing (≥32 chars) |

---

### 2.2 Database Schema

**ORM:** Drizzle with `NodePgDatabase<typeof schema>`, injected via `@InjectDb()`.

**Major table groups:**

#### Auth & Authorization
| Table | Key Columns |
|-------|-------------|
| `users` | id, guuid, name, email, emailVerified, phoneNumber, phoneNumberVerified, image, isBlocked, kycLevel, loginCount |
| `user_session` | id, userId, sessionToken, refreshTokenHash, expiresAt, refreshTokenExpiresAt, deviceId, deviceName, deviceType, appVersion, activeStoreFk, roleHash |
| `user_auth_provider` | id, userId, providerId, providerAccountId |
| `user_role_mapping` | id, userFk, roleFk, storeFk, isPrimary, assignedAt, expiresAt |
| `otp_verification` | id, identifier, otp, reqId, expiresAt, verifiedAt |
| `otp_request_log` | id, identifier, requestedAt, ipHash |
| `jti_blocklist` | jti, blockedAt, expiresAt |
| `revoked_devices` | id, userId, deviceId, revokedAt |
| `permissions_changelog` | id, userId, action, entityCode, roleId, timestamp |

#### RBAC
| Table | Key Columns |
|-------|-------------|
| `roles` | id, guuid, code, name, description, storeFk, isSystem, sortOrder |
| `role_route_mapping` | id, roleFk, routeFk, canView, canCreate, canEdit, canDelete, canExport |
| `role_entity_permission` | id, roleFk, entityCode, canView, canCreate, canEdit, canDelete, deny |

#### Lookups & Reference Data
| Table | Key Columns |
|-------|-------------|
| `lookup_type` | id, code, name, isSystem |
| `lookup` | id, lookupTypeFk, code, label, description, isActive, isHidden, isSystem, sortOrder |
| `code_category` | id, code, name, description |
| `code_value` | id, categoryFk, code, label, description, sortOrder, storeFk, isSystem |
| Typed lookups: `salutation_type`, `designation_type`, `address_type`, `communication_type`, `contact_person_type`, `store_category`, `store_legal_type`, `currency`, `volumes`, `billing_frequency` |

#### Location
| Table | Key Columns |
|-------|-------------|
| `country` | id, name, isoCode2, isoCode3, dialCode |
| `state` | id, name, code, countryFk |
| `district` | id, name, stateFk |
| `pincode` | id, code, locality, districtFk |

#### Store & Multi-tenancy
| Table | Key Columns |
|-------|-------------|
| `store` | id, guuid, storeName, storeCode, ownerUserFk, storeCategoryFk, storeLegalTypeFk, isApproved |
| `store_user_mapping` | id, storeFk, userFk, deletedAt |
| `store_operating_hours` | storeFk, dayOfWeek, openTime, closeTime |
| `store_documents` | id, storeFk, documentType, fileUrl |

#### Entity System
| Table | Key Columns |
|-------|-------------|
| `status` | id, guuid, code, name, fontColor, bgColor, borderColor, isBold, isActive, isSystem, sortOrder |
| `entity_status_mapping` | id, entityCode, statusFk, isActive |

#### Sync & Offline
| Table | Key Columns |
|-------|-------------|
| `idempotency_log` | key (PK), createdAt |
| `rate_limit_entries` | id, identifier, windowStart, count |

#### Audit
| Table | Key Columns |
|-------|-------------|
| `audit_log` | id, userFk, action, entityType, entityId, meta (JSONB), ipAddress, timestamp |

---

### 2.3 Auth Module

**Location:** `src/modules/auth/`

#### Endpoints — AuthController (`/auth`)

| # | Method | Path | Auth | Role | Body/Query | Returns |
|---|--------|------|------|------|------------|---------|
| 1 | POST | `/auth/login` | Public | — | `LoginDto {email, password}` | `AuthResponseEnvelope` |
| 2 | POST | `/auth/register` | Public | — | `RegisterDto {email, password, name?}` | `AuthResponseEnvelope` |
| 3 | POST | `/auth/refresh-token` | Public | — | `RefreshTokenDto {refreshToken?}` | session tokens |
| 4 | GET | `/auth/me` | AuthGuard | — | — | `MeResponseDto` |
| 5 | POST | `/auth/logout` | AuthGuard | — | — | null |
| 6 | GET | `/auth/mobile-jwks` | Public | — | — | JWKS (RS256 public key) |
| 7 | GET | `/auth/sessions` | AuthGuard | — | — | `SessionListDto` |
| 8 | DELETE | `/auth/sessions/:sessionId` | AuthGuard | — | ParseIntPipe | void (204) |
| 9 | DELETE | `/auth/sessions` | AuthGuard | — | — | void (204) |
| 10 | GET | `/auth/session-status` | Public | — | — | `{active, revoked, wipe}` |
| 11 | POST | `/auth/profile-complete` | AuthGuard | — | `OnboardingCompleteDto` | `OnboardingCompleteResponseDto` |
| 12 | GET | `/auth/permissions-snapshot` | AuthGuard | — | — | `PermissionsSnapshot` |
| 13 | GET | `/auth/permissions-delta` | AuthGuard | — | `?version=` | delta object |
| 14 | POST | `/auth/sync-time` | Public | — | `SyncTimeDto {deviceTime}` | `{serverTime, offset}` |

Rate limits: login (10), refresh (30), session-status (5).

#### Endpoints — OtpController (`/auth/otp`)

| # | Method | Path | Auth | Body | Returns |
|---|--------|------|------|------|---------|
| 1 | POST | `/auth/otp/send` | Public | `SendOtpDto {phone}` | `SendOtpResponseDto {reqId}` |
| 2 | POST | `/auth/otp/verify` | Public | `VerifyOtpDto {phone, otp, reqId}` | `AuthResponseEnvelope` |
| 3 | POST | `/auth/otp/resend` | Public | `ResendOtpDto {reqId}` | `ResendOtpResponseDto` |
| 4 | POST | `/auth/otp/email/send` | AuthGuard | `SendEmailOtpDto {email}` | null |
| 5 | POST | `/auth/otp/email/verify` | AuthGuard | `VerifyEmailOtpDto {email, otp}` | null |

#### AuthResponseEnvelope (returned by login/register/verify-otp)

```ts
{
  user: {
    id: string, guuid: string, name: string | null,
    email: string | null, phoneNumber: string | null
  },
  session: {
    sessionId: string, sessionToken: string,
    expiresAt: string, refreshToken: string,
    refreshExpiresAt: string,
    defaultStore: { id: number, guuid: string } | null,
    jwtToken?: string      // RS256 JWT — mobile only
  },
  offlineToken?: string,                // 3-day RS256 JWT — mobile only
  offlineSessionSignature?: string      // HMAC-SHA256 — mobile only
}
```

#### MeResponseDto (GET /auth/me)

```ts
{
  id: string, guuid: string, name: string | null,
  email: string | null, emailVerified: boolean,
  phoneNumber: string | null, phoneNumberVerified: boolean,
  image: string | null
}
```

#### Services

| Service | Key Methods |
|---------|-------------|
| **PasswordAuthService** | `login(dto, deviceInfo)`, `register(dto, deviceInfo)` |
| **OnboardingService** | `completeOnboarding(userId, dto)` — sets name/email/password/phone, triggers OTP if needed |
| **OtpService** | `sendOtp(dto)`, `resendOtp(reqId)`, `sendEmailOtp(email)`, `verifyEmailOtp(dto)` |
| **OtpAuthOrchestrator** | `verifyOtpAndBuildAuthResponse(dto, deviceInfo)` — creates user if needed, issues all tokens |
| **AuthService** | `logout(token)`, `checkSessionStatus(token)`, `getUserSessions(userId)`, `terminateSession(userId, sessionId)`, `terminateAllSessions(userId)` |
| **TokenService** | `generateAccessToken(user)` (RS256), `generateRefreshToken(user)`, `generateOfflineToken(user)` |
| **TokenLifecycleService** | `refreshAccessToken(refreshToken, deviceId)` — rotation + theft detection (reuse → kill all sessions) |
| **PermissionsService** | `buildPermissionsSnapshot(userId)`, `calculateDelta(userId, sinceVersion)` |
| **PasswordService** | `hashPassword(pw)`, `verifyPassword(plain, hashed)` (bcrypt) |
| **JtiBlocklistService** | `isBlocked(jti)`, `block(jti)` |
| **SessionCleanupService** | Cron: cleans expired sessions |
| **KeyRotationScheduler** | Cron: rotates RSA keys |

#### Repositories

| Repository | Key Methods |
|------------|-------------|
| **AuthUsersRepository** | `findById`, `findByEmail`, `findByPhone`, `create`, `update`, `createUserWithInitialRole(tx)`, `withTransaction(fn)` |
| **SessionsRepository** | `create`, `findByToken`, `findActiveByUser`, `revoke`, `rotateRefreshToken(newId, updates, oldId)` |
| **AuthProviderRepository** | `findByUserId`, `create`, `findIdByUserIdAndProvider(tx)` |

#### Constants

```ts
JWT_AUDIENCE = 'nks-app'
OFFLINE_JWT_TTL_DAYS = 3
SYSTEM_ROLE_STORE_OWNER = 'STORE_OWNER'
LAST_ACTIVE_THROTTLE_MS = 300_000  // 5 min
```

#### SessionUser Interface (attached to `req.user` by AuthGuard)

```ts
interface SessionUser {
  id: string; userId: number; guuid: string;
  name: string; email: string; emailVerified: boolean;
  phoneNumber: string | null; phoneNumberVerified: boolean;
  image: string | null;
  kycLevel: number; languagePreference: string;
  whatsappOptedIn: boolean;
  isBlocked: boolean; blockedReason: string | null;
  loginCount: number; lastLoginAt: Date | null;
  roles: SessionUserRole[];
  primaryRole: string | null;
  isSuperAdmin: boolean;
  activeStoreId: number | null;
}
```

---

### 2.4 Users Module

| Method | Path | Auth | Role | Query/Body | Returns |
|--------|------|------|------|------------|---------|
| GET | `/users` | AuthGuard+RBAC | SUPER_ADMIN | `ListUsersQueryDto {page, pageSize, search?}` | Paginated `UserResponseDto[]` |

**Service:** `listUsers(opts)` — validates pagination via `PaginationValidator`.

---

### 2.5 Roles Module

| Method | Path | Auth | Role | Body | Returns |
|--------|------|------|------|------|---------|
| POST | `/roles` | AuthGuard+RBAC | STORE_OWNER | `CreateRoleDto {storeId, name, code, description?, sortOrder?}` | `RoleResponseDto` |
| GET | `/roles/:guuid` | AuthGuard+RBAC | STORE_OWNER | — | `RoleDetailResponse` (role + entity perms + route perms) |
| PUT | `/roles/:guuid` | AuthGuard+RBAC | STORE_OWNER | `UpdateRoleDto {name?, description?, sortOrder?, entityPermissions?, routePermissions?}` | `RoleResponseDto` |

**Service:** Verifies store ownership before create/read/update.

---

### 2.6 Routes Module

| Method | Path | Auth | Role | Returns |
|--------|------|------|------|---------|
| GET | `/routes/admin` | AuthGuard+RBAC | SUPER_ADMIN | Hierarchical admin routes |
| GET | `/routes/store/:storeGuuid` | AuthGuard | — | Store-scoped routes with permission flags |

---

### 2.7 Location Module

All endpoints are **Public** (no auth).

| Method | Path | Returns |
|--------|------|---------|
| GET | `/location/states/list` | All states |
| GET | `/location/states/code/:code` | State by code (e.g. 'KA') |
| GET | `/location/states/:code/districts` | Districts in state |
| GET | `/location/districts/:districtId/pincodes` | Pincodes in district |
| GET | `/location/pincodes/:code` | Pincode by 6-digit code |

**Validators:** `StateCodeValidator.validate(code)`, `PincodeValidator.validate(code)` — throw `BadRequestException` with error codes.

---

### 2.8 Lookups Module

#### Public Endpoints (no auth)

| Method | Path | Returns |
|--------|------|---------|
| GET | `/lookups/salutations` | Salutation types (Mr., Mrs., Dr.) |
| GET | `/lookups/countries` | Countries with ISO + dial codes |
| GET | `/lookups/address-types` | Address types (Home, Office) |
| GET | `/lookups/communication-types` | Communication types (Mobile, Email, WhatsApp) |
| GET | `/lookups/designations` | Designations (CEO, Manager, Staff) |
| GET | `/lookups/store-legal-types` | Store legal types (Pvt Ltd, Sole Proprietor) |
| GET | `/lookups/store-categories` | Store categories (Grocery, Pharmacy) |
| GET | `/lookups/currencies` | Currencies (INR, USD, EUR) |
| GET | `/lookups/volumes` | Volume units (Kilogram, Litre, Piece) |

#### Admin Endpoints (SUPER_ADMIN)

| Method | Path | Body | Returns |
|--------|------|------|---------|
| GET | `/lookups/admin` | — | All lookup types with value counts |
| GET | `/lookups/admin/:code` | — | Values for a lookup type |
| POST | `/lookups/admin/:code` | `CreateLookupValueDto {code, label, description?, sortOrder?}` | Created value |
| PUT | `/lookups/admin/:code/:id` | `UpdateLookupValueDto` (partial) | Updated value |
| DELETE | `/lookups/admin/:code/:id` | — | void (204) |

---

### 2.9 Codes Module

| Method | Path | Auth | Role | Body/Query | Returns |
|--------|------|------|------|------------|---------|
| GET | `/codes/categories` | AuthGuard+RBAC | SUPER_ADMIN | — | `CodeCategoryResponseDto[]` |
| POST | `/codes/categories` | AuthGuard+RBAC | SUPER_ADMIN | `CreateCodeCategoryDto {code, name, description?}` | `CodeCategoryResponseDto` |
| POST | `/codes/:categoryCode/values` | AuthGuard+RBAC | SUPER_ADMIN | `CreateCodeValueDto {code, label, description?, sortOrder?, storeId?}` | `CodeValueResponseDto` |
| GET | `/codes/:categoryCode` | Public | — | `?storeId=` | `CodeValueResponseDto[]` |
| PUT | `/codes/values/:id` | AuthGuard+RBAC | SUPER_ADMIN | `UpdateCodeValueDto {label?, description?, sortOrder?}` | `CodeValueResponseDto` |
| DELETE | `/codes/values/:id` | AuthGuard+RBAC | SUPER_ADMIN | — | void (204) |

---

### 2.10 Status & Entity-Status Modules

#### Status (`/statuses`)

| Method | Path | Auth | Role | Body/Query | Returns |
|--------|------|------|------|------------|---------|
| GET | `/statuses` | Public | — | — | Active statuses |
| GET | `/statuses/all` | AuthGuard+RBAC | SUPER_ADMIN | `GetAllStatusesQueryDto {search?}` | All statuses incl. inactive |
| POST | `/statuses` | AuthGuard+RBAC | SUPER_ADMIN | `CreateStatusDto` | Created status |
| PUT | `/statuses/:guuid` | AuthGuard+RBAC | SUPER_ADMIN | `UpdateStatusDto` | Updated status |
| DELETE | `/statuses/:guuid` | AuthGuard+RBAC | SUPER_ADMIN | — | void (204) |

**CreateStatusDto:** `{code, name, fontColor (#hex), bgColor (#hex), borderColor (#hex), isBold?, sortOrder?}` — hex validated via regex.

#### Entity-Status (`/entity-status`)

| Method | Path | Auth | Role | Returns |
|--------|------|------|------|---------|
| GET | `/entity-status/:entityCode/public` | Public | — | Active statuses for entity |
| POST | `/entity-status/:entityCode` | AuthGuard+RBAC | SUPER_ADMIN | Assign status to entity |
| DELETE | `/entity-status/:entityCode/:statusGuuid` | AuthGuard+RBAC | SUPER_ADMIN | void (204) |

---

### 2.11 Stores Module

| Method | Path | Auth | Returns |
|--------|------|------|---------|
| GET | `/stores/me` | AuthGuard | `{myStores: Store[], invitedStores: Store[]}` |

**Store shape:** `{id, guuid, storeName, storeCode, isApproved, isOwner, createdAt}`

---

### 2.12 Audit Module

| Method | Path | Auth | Role | Query | Returns |
|--------|------|------|------|-------|---------|
| GET | `/audit` | AuthGuard+RBAC | SUPER_ADMIN | `AuditListQueryDto {offset?, limit?, userId?, action?, dateFrom?, dateTo?}` | Paginated audit logs |
| GET | `/audit/:id` | AuthGuard+RBAC | SUPER_ADMIN | ParseIntPipe | Single audit log |

**Logged actions:** LOGIN, LOGOUT, OTP_SEND, OTP_VERIFY, PASSWORD_CHANGE, PERMISSION_GRANT, PERMISSION_REVOKE, TOKEN_REFRESH, TOKEN_THEFT_DETECTED, DEVICE_LOGIN, DEVICE_LOGOUT, SESSION_TERMINATE, STORE_DATA_ACCESS, ROLE_CREATED, ROLE_UPDATED, ROLE_ASSIGNED, BREAK_GLASS_ACCESS, SUPER_ADMIN_ACTION.

---

### 2.13 Sync Module

| Method | Path | Auth | Role | Params | Returns |
|--------|------|------|------|--------|---------|
| GET | `/sync/changes` | AuthGuard | — | `?cursor=&storeId=&tables=&limit=` | `ChangesResponse` |
| POST | `/sync/push` | AuthGuard+RBAC | CASHIER, MANAGER, STORE_OWNER | `SyncPushDto` | `{processed, rejected, status}` |

#### Pull — GET /sync/changes

- `cursor`: ms epoch (default 0)
- `storeId`: store guuid (required)
- `tables`: csv (supported: `state`, `district`, `routes`)
- `limit`: max rows (default 500)
- Validates store membership before returning data.

**ChangesResponse:**

```ts
{ nextCursor: number, hasMore: boolean, changes: SyncChange[] }
// SyncChange: { table, id, data, updatedAt }
```

#### Push — POST /sync/push

**SyncPushDto:**

```ts
{
  operations: [{
    id: string,        // idempotency key
    clientId: string,  // device ID
    table: string,
    op: 'insert' | 'update' | 'delete',
    opData: Record<string, unknown>,
    signature?: string   // SHA256(signingKey:op:table:JSON(opData))
  }],
  offlineSession?: {
    userId: number, storeId: number, roles: string[],
    offlineValidUntil: number, signature: string,
    deviceId?: string, offlineToken?: string
  }
}
```

**Processing:** Phase 1 validates all ops, Phase 2 executes in single atomic transaction. Idempotency via `idempotency_log` table. Device revocation checked. Offline JWT cross-validated with HMAC.

---

### 2.14 Guards, Decorators & Pipes

#### Guards

| Guard | Purpose |
|-------|---------|
| **AuthGuard** | Validates session token (cookie or Bearer). Populates `req.user: SessionUser`. Checks JTI blocklist, user not blocked. Updates `lastActiveAt` (throttled 5 min). |
| **RBACGuard** | Validates `@Roles()` + `@RequireEntityPermission()`. SUPER_ADMIN bypasses. Deny-overrides-grant pattern. |
| **RateLimitingGuard** | Uses `@RateLimit(n)` decorator. Tracks by IP or user ID. Returns 429 if exceeded. |

#### Decorators

| Decorator | Usage |
|-----------|-------|
| `@Public()` | Bypass AuthGuard |
| `@Roles('STORE_OWNER', 'MANAGER')` | Required role codes |
| `@CurrentUser()` | Injects `SessionUser` from `req.user` |
| `@CurrentStore()` | Injects `activeStoreId` from `req.user` |
| `@RateLimit(10)` | Rate limit for endpoint |
| `@RequireEntityPermission('INVOICE', 'create')` | Entity-level CRUD check |

#### Pipes

| Pipe | Usage |
|------|-------|
| `ZodValidationPipe` (nestjs-zod global) | Auto-validates `createZodDto` classes on `@Body()` and `@Query()` |
| `ZodValidationPipe` (custom, for `@Query()` with raw schema) | `@Query(new ZodValidationPipe(Schema)) query: Dto` |
| `ParseIntPipe` | `@Param('id', ParseIntPipe) id: number` |

**Pattern:** `@Param` NEVER uses `ZodValidationPipe` — numeric params use `ParseIntPipe`, string params validated in service layer.

---

### 2.15 Common Utilities

| Utility | Purpose |
|---------|---------|
| `ApiResponse` | Standardized response wrapper: `.ok(data, msg)`, `.paginated(...)`, `.validationError(...)`, `.notFound(...)` |
| `AuthControllerHelpers` | `extractDeviceInfo(req)`, `applySessionCookie(res, result)`, `setSessionCookie(res, token)` |
| `PermissionChecker` | `assertHasRequiredRoles()`, `assertStoreOwner()` |
| `fireAndForgetWithRetry(fn, opts)` | Async retry with exponential backoff |
| `extractCookieValue(header, name)` | Cookie parsing |
| `signOfflineSession(payload, secret)` / `verifyOfflineSession(...)` | HMAC-SHA256 for offline sessions |

#### Validators (common)

| Validator | Purpose |
|-----------|---------|
| `SanitizerValidator` | XSS prevention |
| `QueryValidator` | SQL injection prevention |
| `AuthorizationValidator` | Privilege escalation prevention |

#### Interceptors

| Interceptor | Purpose |
|-------------|---------|
| `LoggingInterceptor` | Logs method, path, status, duration |
| `TransformInterceptor` | Wraps raw returns in `ApiResponse<T>` |
| `TimeoutInterceptor` | 30s global request timeout |

---

### 2.16 Error Codes & API Response

**Response envelope:**

```json
{
  "status": "success | error",
  "statusCode": 200,
  "message": "Human-readable message",
  "errorCode": "AUTH-VAL-001" | null,
  "data": { ... } | null,
  "details": ["field: error msg"] | null,
  "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 } | null,
  "timestamp": "2026-04-19T10:30:45.123Z"
}
```

**Error code format:** `{MODULE}-{TYPE}-{SEQ}` (e.g. `AUTH-VAL-001`, `USR-NOT-FOUND-001`, `ENT-VAL-001`).

---

## 3. Mobile

### 3.1 App Entry & Providers

**File:** `app/_layout.tsx`

**Provider nesting order:**

```
GestureHandlerRootView
  → ReduxProvider
    → QueryClientProvider (staleTime: 5min, retries: 2)
      → I18nProvider
        → SafeAreaProvider
          → MobileThemeProvider
            → AuthProvider
              → OfflineStatusBanner
              → Slot (Expo Router)
```

**Before rendering:** SSL pinning initialized (blocks until ready). Server time pre-initialized.

---

### 3.2 Auth Flow

#### Login Flow

```
PhoneScreen → usePhoneAuth → validate → sendOtp → pendingOtpSession
    ↓
OtpScreen → useOtpVerify → validate → verifyOtp
    ↓
persistLogin(authResponse, dispatch)
  ├─ validateAuthResponse (structure + format + size)
  ├─ persist to SecureStore (tokenManager)
  ├─ set in-memory token
  ├─ persist JWTs (JWTManager)
  ├─ sync server time
  └─ dispatch(setCredentials)
    ↓
registerProactiveRefresh + cacheJWKS
    ↓
Navigate to account-type
```

#### Session Restore (app startup)

```
RootLayout → AuthProvider → dispatch(initializeAuth)
  ├─ initializeDatabase (SQLCipher)
  ├─ initializeSyncEngine
  ├─ run PII migration (AsyncStorage → SecureStore)
  ├─ hydrate JWTManager (3 tokens)
  ├─ init rate limiters
  ├─ load persisted session
  ├─ validate structure (user.id, guuid, sessionToken, etc.)
  ├─ check expiry (server-adjusted time)
  ├─ validate token format (regex)
  ├─ set in-memory token
  ├─ dispatch(setCredentials)
  ├─ restore offline session (check HMAC + role staleness)
  └─ if stale (>12min): background dispatch(refreshSession)
```

#### Token Refresh (proactive — foreground)

```
App comes to foreground → AppState listener
  → tryProactiveRefresh()
  → if access token expires within 3 min:
      refreshTokenAttempt()
        ├─ validate refresh token
        ├─ POST /auth/refresh-token
        ├─ update tokenManager + JWTManager
        ├─ extend offline session
        └─ sync server time
```

#### Token Refresh (reactive — 401)

```
API request → 401 response
  → Axios interceptor
  → queue other pending requests
  → tokenMutex.withRefreshLock()
  → refreshTokenAttempt()
  → process queue with new token
  → retry all queued requests
```

#### Logout

```
dispatch(logoutThunk)
  → tokenMutex.withClearLock()
    ├─ signOut API call
    ├─ clear tokenManager (memory + SecureStore)
    ├─ clear offline session
    ├─ clear JWTManager (tokens + JWKS)
    ├─ clear DeviceManager fingerprint
    ├─ reset proactive refresh
    ├─ reset interceptor state
    ├─ reset sync engine
    ├─ clear all local DB tables
    ├─ delete DB encryption key
    ├─ clear rate limiters
    ├─ reset server time
    └─ dispatch(logout)
```

---

### 3.3 Phone & OTP Screens

**PhoneScreen** (`features/auth/PhoneScreen.tsx`):
- 10-digit phone input, fixed +91 India code
- Rate-limited OTP sends (5/hour via `OTP_RATE_LIMITS.send`)
- Validation: `z.object({ phone: z.string().regex(/^\d{10}$/) })`

**OtpScreen** (`features/auth/OtpScreen.tsx`):
- 6-digit input via hidden TextInput (production pattern)
- Auto-verify on 6th digit
- Resend with cooldown (30s)
- Rate-limited verify (10/hour) and resend (5/hour)
- Validation: `z.object({ otp: z.string().length(6).regex(/^\d+$/) })`

---

### 3.4 Onboarding & Account Setup

| Screen | Path | Purpose | Status |
|--------|------|---------|--------|
| **AccountTypeScreen** | `/(protected)/(onboarding)/account-type` | Choose Business or Personal | Functional |
| **ProfileSetupScreen** | `/(protected)/(onboarding)/profile-setup` | Set name/email/password | UI ready, API not wired |
| **AcceptInviteScreen** | `/(protected)/(onboarding)/accept-invite` | Join via invite link | TODO |

---

### 3.5 Store Management Screens

| Screen | Path | Purpose | Status |
|--------|------|---------|--------|
| **StoreListScreen** | `/(protected)/(store)/list` | User's stores (owned + invited) | Functional (fetches from API) |
| **StoreSetupScreen** | `/(protected)/(store)/setup` | 3-step store creation form | UI ready, submit not wired |
| **StoreDrawerContent** | — | Drawer menu for store nav | Functional |

**StoreListScreen features:**
- Filter tabs: All / My Stores / Staff
- Search by store name or code
- Pull-to-refresh
- Error banner on fetch failure
- Active/Pending badges per store

**StoreSetupScreen steps:**
- Step 1: Name, code, category, legal type
- Step 2: Registration number, tax ID
- Step 3: Address, pincode, city

---

### 3.6 Personal Dashboard

| Screen | Path | Purpose | Status |
|--------|------|---------|--------|
| **PersonalDashboardScreen** | `/(protected)/(personal)/dashboard` | Expense list with search/filter | Mock data only |

---

### 3.7 Token Management

| File | Purpose |
|------|---------|
| `lib/auth/jwt-manager.ts` | Manages 3 tokens: accessToken (RS256, 15min), offlineToken (RS256, 3d), refreshToken (opaque, 7d). JWKS cache with 1h memory TTL + 7d stale limit. |
| `lib/auth/token-mutex.ts` | `withRefreshLock(fn)` / `withClearLock(fn)` — prevents concurrent refresh + logout race conditions |
| `lib/auth/token-expiry.ts` | `isTokenExpired(token, threshold?)`, `validateTokenExpiry(expiresAt?)`, `validateTokensBeforeRefresh(envelope)` |
| `lib/auth/token-validators.ts` | `validateAuthResponse(authResponse)` — pre-persistence validation of all fields + format + SecureStore size |
| `lib/auth/refresh-token-attempt.ts` | Unified refresh: validate → POST /auth/refresh-token → update all stores → sync time → extend offline session |
| `lib/auth/jwt-refresh.ts` | AppState listener: refresh if access token expires within 3 min of foreground |
| `lib/auth/axios-interceptors.ts` | Request: inject Bearer header. Response: queue + refresh on 401, notify on 403 |

---

### 3.8 Offline Session

**File:** `lib/auth/offline-session.ts`

Not a token — a local policy: "device was authenticated within 3 days, allow local POS operations."

```ts
interface OfflineSession {
  id: string;               // UUID audit trail
  userId: number; storeId: number; storeName: string;
  roles: string[];
  offlineValidUntil: number; // ms epoch
  lastSyncedAt: number; lastRoleSyncAt: number;
  offlineToken: string;      // RS256 JWT
  signature: string;         // server HMAC-SHA256 (64-char hex)
  deviceId: string;          // stable fingerprint
}
```

**Status:** `"active"` | `"expiring"` | `"expired"` | `"stale_roles"` | `"no_session"`

- Roles stale if: >24h since `lastRoleSyncAt` OR revocation detected
- Signature verification: client checks format (64-char hex); server re-computes HMAC

---

### 3.9 Local Database & Sync Engine

#### Database

- **Engine:** `expo-sqlite` with SQLCipher encryption
- **ORM:** Drizzle ORM for schema + queries
- **Key:** Generated per-device, stored in SecureStore, deleted on logout

**Local tables:**
- `sync_state` — per-table cursors + metadata
- `mutation_queue` — outbox for offline mutations
- `districts` — location reference data

#### Sync Engine (`lib/sync/sync-engine.ts`)

**Public API:**

```ts
runSync(storeGuuid: string): Promise<void>    // full pull + push
runPullOnly(storeGuuid: string): Promise<void>
runPushOnly(): Promise<void>
isSyncing(): boolean
getLastSyncedAt(): number | null
initializeSyncEngine(): Promise<void>
resetSyncState(): void
```

**Pull phase:**
1. Read per-table cursors from local DB
2. GET `/sync/changes?cursor=&storeId=&tables=`
3. Apply changes (upsert/delete) via domain handlers
4. Advance cursors after each page (crash-safe)
5. Repeat until `hasMore: false`

**Push phase:**
1. Load pending mutations (batch of 50)
2. Mark batch `in_progress`
3. Build signed operations (SHA256)
4. POST `/sync/push` with operations + offline session context
5. Mark processed as synced, rejected as quarantined
6. Repeat until queue empty

**Timeouts:** Full sync 25s, pull 10s, push 20s.

**Failure:** Network error → increment retry + exponential backoff. Max retries → quarantine.

---

### 3.10 Device Security

| File | Purpose |
|------|---------|
| `lib/device/ssl-pinning.ts` | SSL public key pinning (blocks startup until ready). Env: `EXPO_PUBLIC_SSL_PIN_1`, `PIN_2`, `PIN_EXPIRY`. |
| `lib/device/device-manager.ts` | Stable device fingerprint (SHA-256 of platform + model + appVersion). Sent as `X-Device-Fingerprint` header. |
| `lib/device/device-binding.ts` | Stable device ID via expo-device + application info. |
| `lib/device/db-key.ts` | DB encryption key lifecycle. `getDbKey()` generates/loads. `deleteDbKey()` called on logout. |

---

### 3.11 Network & Reconnection

#### Offline Status (`hooks/useOfflineStatus.ts`)

Polls every 60s + reacts to network changes. Returns:

```ts
{ mode: OfflineMode, offlineExpiresAt, remainingMs, isOnline,
  urgency: "none"|"low"|"medium"|"high"|"expired", label: "2d 4h left" | null }
```

#### Reconnection Handler (`services/reconnection-handler.ts`)

5-step sequence on offline → online transition:

1. **Revocation check:** GET `/auth/session-status` → if revoked: wipe + logout
2. **Token refresh:** `refreshTokenAttempt()` → if invalid: logout
3. **JWKS refresh:** cache fresh RS256 public keys
4. **Sync catch-up:** `runSync(storeGuuid)` — pull changes + push mutations
5. **Redux refresh:** `dispatch(setCredentials)` to update React tree

---

### 3.12 Redux Store

**File:** `store/index.ts`

| Slice | State | Actions |
|-------|-------|---------|
| `auth` | `{isInitializing, isAuthenticated, authResponse}` | `setCredentials(authResponse)`, `logout()`, `setUnauthenticated()` |
| `store` | from `@nks/state-manager` | `selectStore(id)` |

**Selectors:** `selectIsSuperAdmin(state)` — decodes JWT locally to check SUPER_ADMIN role.

**Side effects wired at store creation:**
- `tokenManager.onExpired()` → `dispatch(setUnauthenticated)`
- `tokenManager.onRefresh()` → `dispatch(refreshSession)`

---

### 3.13 Navigation & Routing

**Expo Router 6 (file-based)**

```
app/
├── _layout.tsx                    Root: providers + SSL pinning
├── (auth)/
│   ├── _layout.tsx                Auth guard (redirect if logged in)
│   ├── phone.tsx                  PhoneScreen
│   └── otp.tsx                    OtpScreen
├── (protected)/
│   ├── _layout.tsx                Protected guard (redirect if not logged in)
│   ├── index.tsx                  Redirector (→ onboarding or store)
│   ├── no-access.tsx              SUPER_ADMIN landing
│   ├── (onboarding)/
│   │   ├── account-type.tsx       AccountTypeScreen
│   │   ├── profile-setup.tsx      ProfileSetupScreen
│   │   └── accept-invite.tsx      AcceptInviteScreen
│   ├── (store)/
│   │   ├── _layout.tsx            Drawer layout
│   │   ├── list.tsx               StoreListScreen
│   │   ├── setup.tsx              StoreSetupScreen
│   │   └── store.tsx              Store home (placeholder)
│   └── (personal)/
│       ├── _layout.tsx            Drawer layout
│       └── dashboard.tsx          PersonalDashboardScreen
```

---

## 4. Shared Packages

### 4.1 API Manager

**Package:** `@nks/api-manager`

Two Axios instances: `API` (main, 30s timeout) and `IamAPI` (IAM server).

#### All Endpoints

| # | Thunk / Hook | Method | Path | Body/Query |
|---|-------------|--------|------|------------|
| **Auth** | | | | |
| 1 | `login()` | POST | `auth/login` | `{email, password}` |
| 2 | `register()` | POST | `auth/register` | `{name, email, password}` |
| 3 | `refreshToken()` | POST | `auth/refresh-token` | `{refreshToken}` |
| 4 | `signOut()` | POST | `auth/logout` | — |
| 5 | `getJwks()` | GET | `auth/mobile-jwks` | — |
| 6 | `syncTime()` | POST | `auth/sync-time` | `{deviceTime}` |
| 7 | `getMe()` | GET | `auth/me` | — |
| 8 | `sendOtp()` | POST | `auth/otp/send` | `{phone}` |
| 9 | `verifyOtp()` | POST | `auth/otp/verify` | `{phone, otp, reqId}` |
| 10 | `otpResend()` | POST | `auth/otp/resend` | `{reqId}` |
| 11 | `sendEmailOtp()` | POST | `auth/otp/email/send` | `{email}` |
| 12 | `verifyEmailOtp()` | POST | `auth/otp/email/verify` | `{email, otp}` |
| 13 | `getPermissionsSnapshot()` | GET | `auth/permissions-snapshot` | — |
| 14 | `getPermissionsDelta()` | GET | `auth/permissions-delta` | `?sinceVersion=` |
| 15 | `getSessions()` | GET | `auth/sessions` | — |
| 16 | `deleteSession()` | DELETE | `auth/sessions/:sessionId` | — |
| 17 | `deleteAllSessions()` | DELETE | `auth/sessions` | — |
| 18 | `profileComplete()` | POST | `auth/profile-complete` | `{name, email?, phoneNumber?, password?}` |
| **Routes** | | | | |
| 19 | `getAdminRoutes()` | GET | `routes/admin` | — |
| 20 | `getStoreRoutes()` | GET | `routes/store/:storeGuuid` | — |
| **Users** | | | | |
| 21 | `useUsers(params)` | GET | `users` | `?page=&pageSize=&search=` |
| **Roles** | | | | |
| 22 | `createRole()` | POST | `roles` | `{storeId, name, code, ...}` |
| 23 | `getRole()` | GET | `roles/:guuid` | — |
| 24 | `updateRole()` | PUT | `roles/:guuid` | `{name?, description?, ...}` |
| **Stores** | | | | |
| 25 | `getMyStores()` | GET | `stores/me` | — |
| **Location** | | | | |
| 26 | `getStates()` | GET | `location/states/list` | — |
| 27 | `getStateByCode()` | GET | `location/states/code/:code` | — |
| 28 | `getDistrictsByState()` | GET | `location/states/:code/districts` | — |
| 29 | `getPincodesByDistrict()` | GET | `location/districts/:districtId/pincodes` | — |
| 30 | `getPincodeByCode()` | GET | `location/pincodes/:code` | — |
| **Codes** | | | | |
| 31 | `getCodeCategories()` | GET | `codes/categories` | — |
| 32 | `getCodeValues()` | GET | `codes/:categoryCode` | `?storeId=` |
| 33 | `createCodeCategory()` | POST | `codes/categories` | `{code, name, description?}` |
| 34 | `createCodeValue()` | POST | `codes/:categoryCode/values` | `{code, label, ...}` |
| 35 | `updateCodeValue()` | PUT | `codes/values/:id` | `{label?, description?, ...}` |
| 36 | `deleteCodeValue()` | DELETE | `codes/values/:id` | — |
| **Lookups (thunks)** | | | | |
| 37-45 | `getSalutations()` ... `getVolumes()` | GET | `lookups/{type}` | — |
| **Lookups (React Query hooks)** | | | | |
| 46-54 | `useSalutations()` ... `useVolumes()` | GET | `lookups/{type}` | — |
| 55-58 | `useSubscriptionPlanTypes()` etc. | GET | `lookups/subscription/{type}` | — |
| **Lookups Admin (React Query)** | | | | |
| 59 | `useLookupTypes()` | GET | `lookups/admin` | — |
| 60 | `useLookupValues(code)` | GET | `lookups/admin/:code` | — |
| 61+ | CRUD mutations per lookup type | POST/PUT/DELETE | `lookups/admin/:code` | varies |

---

### 4.2 State Manager

**Package:** `@nks/state-manager`

| Slice | State | Key Actions |
|-------|-------|-------------|
| `auth` | `status`, `user`, `error`, `fetchedAt`, `loginState`, `registerState`, `sendOtpState`, `verifyOtpState` | `setAuthenticated`, `setUnauthenticated`, `setLocked`, `setAuthError` |
| `store` | `selectedStoreId` | `selectStore(id)` |
| `routes` | `user`, `routes[]`, `isSynced`, `fetchedAt`, `error` | `clearRoutes`, `setRoutes` |

Routes cached in `sessionStorage` (`nks-routes-cache`).

---

### 4.3 Mobile UI Components

**Package:** `@nks/mobile-ui-components` — 44 components

**Inputs:** Button, Input, PasswordInput, TextArea, Checkbox, Switch, RadioGroup, ModalSelect, SelectGeneric, SearchInput

**Typography:** Typography (H1-H5, Subtitle, Body, Caption, Overline) — props: `weight`, `color`, `type`, `colorType`

**Layout:** Flex (Row/Column), Card, Divider, AppLayout, ListPageScaffold, FlatListScaffold, BottomSheetModal, BaseModal, ModalHeader

**Data Display:** Avatar, MetricCard, ItemCard, ListRow, SectionHeader, TitleDescription, TitleWithIcon

**Navigation:** SegmentedTabs, QuickActionButton, GroupedMenu, IconButton

**Feedback:** SkeletonLoader, Alert, Tag, NoDataContainer, FlatListLoading

**Media:** ImagePreview, ImageWithoutPreview, LucideIcon

---

### 4.4 Mobile Theme

**Package:** `@nks/mobile-theme`

| Token | Values |
|-------|--------|
| **Colors** | 12 semantic groups (primary, secondary, blue, orange, violet, green, red, warning, danger, success, default, grey) × 11 variants each |
| **Font sizes** | xxSmall(10) → h1(32) |
| **Font family** | Poppins: Regular, Bold, Light, Medium, SemiBold, Thin, Italic |
| **Sizing/spacing** | xxSmall(4), xSmall(8), small(12), medium(16), regular(20), large(24), xLarge(32), xxLarge(48) |
| **Border radius** | Same scale as sizing |
| **Border width** | zero(0), mild(0.5), thin(1), light(1.5), medium(3), bold(4) |

**Hooks:** `useMobileTheme()` → `{theme}`, `useColorVariant(colorKey)` → semantic color group

---

### 4.5 Mobile Utils

**Package:** `@nks/mobile-utils`

| Category | Exports |
|----------|---------|
| **Network** | `createAxiosInstance(baseUrl)` — auto-attach Bearer, 401/403/429 handling, exponential backoff (max 3 retries) |
| **Storage** | `TokenManager` (in-memory + callbacks), `getSecureItem`, `saveSecureItem`, `deleteSecureItem` |
| **Haptics** | `hapticLightImpact()`, `hapticMediumImpact()`, `hapticHeavyImpact()`, `hapticSuccess()`, `hapticError()`, `hapticWarning()`, `hapticSelection()` |
| **Media** | `shareLocalFile(uri, title?)`, `imageCompress(uri, quality)` |

---

### 4.6 I18n

**Packages:** `@nks/common-i18n` (JSON translations), `@nks/mobile-i18n` (i18next setup)

- Languages: English (`en`), Tamil (`ta`)
- Detection: AsyncStorage → device locale → fallback `en`
- Persistence: saves selected language to AsyncStorage
- Hook: `useTranslation()` → `{t, i18n, translation}`

---

## 5. Security Summary

| Feature | Implementation |
|---------|----------------|
| **Session auth (web)** | httpOnly cookie `nks_session` (sameSite: strict, secure in prod) |
| **Session auth (mobile)** | Bearer token in Authorization header |
| **JWT signing** | RS256 (RSA public key crypto) with key rotation |
| **Password hashing** | bcrypt |
| **OTP** | MSG91 (SMS) + email OTP with rate limiting |
| **Refresh token rotation** | New refresh token each refresh; reuse → terminate all sessions (theft detection) |
| **JTI blocklist** | Prevents revoked JWTs from being used mid-flight |
| **RBAC** | Role-based (`@Roles`) + entity-level CRUD (`@RequireEntityPermission`) with deny-overrides-grant |
| **Rate limiting** | Per-endpoint configurable (RateLimitingGuard + OTP rate limits on mobile) |
| **CSRF** | CSRF middleware on backend |
| **SSL pinning** | Public key pinning on mobile (blocks startup until ready) |
| **Device fingerprint** | SHA-256(platform+model+appVersion), sent as header, validated on backend |
| **Offline session** | HMAC-SHA256 signed by server; client cannot forge; validated on push sync |
| **Token mutex** | Prevents concurrent refresh + logout race conditions |
| **Clock drift detection** | Server time sync on login/refresh; warns if drift >30s |
| **Session revocation check** | On reconnect: checks `/auth/session-status` → wipe if revoked |
| **DB encryption** | SQLCipher on mobile; key deleted on logout |
| **Input validation** | Zod on all DTOs (global pipe); SanitizerValidator (XSS); QueryValidator (SQL injection) |
| **Audit logging** | All auth/permission/data-access events logged with metadata |
| **Helmet** | CSP, HSTS, Frameguard, XSS filter headers |

---

## 6. Known TODOs

| Area | Item | Status |
|------|------|--------|
| Mobile | ProfileSetupScreen — API not wired to `profileComplete` | UI ready |
| Mobile | AcceptInviteScreen — invite flow not implemented | TODO |
| Mobile | StoreSetupScreen — form submit not wired to store creation API | UI ready |
| Mobile | PersonalDashboardScreen — uses mock data | TODO |
| Mobile | Terms of Service link on PhoneScreen | TODO |
| Backend | Store creation endpoint (`POST /stores`) | Not implemented |
| Backend | Store update/delete endpoints | Not implemented |
| Backend | Subscription management endpoints | Planned (see SUBSCRIPTION_IMPLEMENTATION_PLAN.md) |
| Backend | Product/inventory/transaction modules | Not implemented |
| Backend | Push notification infrastructure | Schema exists, endpoints not implemented |
