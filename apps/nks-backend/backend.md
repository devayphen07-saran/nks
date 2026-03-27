# NKS Backend — Architecture Reference

> **Last updated:** 2026-03-19  
> **Runtime:** NestJS 11 · TypeScript 5 · Drizzle ORM · PostgreSQL · BetterAuth

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Folder Structure](#2-folder-structure)
3. [Application Bootstrap](#3-application-bootstrap)
4. [Configuration Layer](#4-configuration-layer)
5. [Database Layer](#5-database-layer)
6. [Schema Reference](#6-schema-reference)
7. [Authentication & Sessions](#7-authentication--sessions)
8. [Modules](#8-modules)
9. [Common Layer](#9-common-layer)
10. [Shared Services](#10-shared-services)
11. [Error Handling](#11-error-handling)
12. [Request Lifecycle](#12-request-lifecycle)
13. [API Endpoints](#13-api-endpoints)
14. [Key Rules & Conventions](#14-key-rules--conventions)
15. [Scripts & Dev Tooling](#15-scripts--dev-tooling)

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11 (Express platform) |
| Language | TypeScript 5.7 |
| Database | PostgreSQL via `pg` pool |
| ORM | Drizzle ORM 0.45 |
| Auth | BetterAuth 1.5 (session-based) |
| Security | Helmet ^8.1.0 |
| Validation | nestjs-zod + Zod 4 |
| API Docs | Swagger / OpenAPI (`@nestjs/swagger`) |
| Migrations | Drizzle Kit |

> **Note:** `@nestjs/jwt`, `passport`, `passport-jwt`, `bcrypt` are listed as dependencies but are currently unused — BetterAuth handles all session management.

---

## 2. Folder Structure

```text
nks-backend/
├── backend.md                     ← This file
├── db.md                          ← Database schema reference
├── README.md
├── package.json
├── nest-cli.json
├── tsconfig.json
├── tsconfig.build.json
├── drizzle.config.ts              ← Drizzle Kit config (migrations)
├── eslint.config.mjs
├── .prettierrc
├── .env.example
├── .env
│
├── scripts/
│   ├── seed.ts               └── src/
    ├── main.ts                    ← Application bootstrap
    ├── app.module.ts              ← Root module
    │
    ├── config/                    ← Config files (registerAs namespaces)
    │   ├── app.config.ts
    │   ├── config.module.ts
    │   ├── cors.config.ts
    │   ├── database.config.ts
    │   └── swagger.config.ts
    │
    ├── common/                    ← Cross-cutting concerns
    │   ├── constants/             ← Error codes, App constants
    │   ├── decorators/            ← @CurrentUser, @Roles, @Permissions
    │   ├── enums/                 ← Global enums (empty)
    │   ├── exceptions/            ← Custom AppException hierarchy
    │   ├── filters/               ← GlobalExceptionFilter (unified error shape)
    │   ├── guards/                ← AuthGuard (BetterAuth), RBACGuard
    │   ├── interceptors/          ← Logging (timing), Transform (ApiResponse)
    │   ├── interfaces/            ← IRepository, PaginatedResult
    │   ├── middlewares/           ← RequestIdMiddleware (tracing), Helmet
    │   ├── pipes/                 ← ParseIdPipe, ZodValidationPipe
    │   ├── types/                 ← Db, Tx, Id, Guuid, PageQuery
    │   └── utils/                 ← api-response.ts
    │
    ├── core/                      ← Infrastructure Layer
    │   ├── auth/                  ← BetterAuth integration & AuthModule
    │   │   ├── auth.ts            ← BetterAuth instance + hooks
    │   │   ├── auth.module.ts
    │   │   ├── auth.service.ts
    │   │   ├── auth.controller.ts
    │   │   ├── auth.constants.ts
    │   │   ├── inject-auth.decorator.ts
    │   │   ├── session-user.interface.ts  ← Typed session shape
    │   │   ├── dto/               ← register.dto.ts, login.dto.ts, index.ts
    │   │   └── entities/          ← Empty directory
    │   │
    │   ├── database/              ← Drizzle provider & TransactionService
    │   │   ├── database.module.ts
    │   │   ├── database.constants.ts
    │   │   ├── inject-db.decorator.ts
    │   │   ├── transaction.service.ts
    │   │   ├── schema.ts          ← Master barrel export
    │   │   ├── migrations/        ← Drizzle migration files
    │   │   └── schema/            ← Directory-per-entity schema organization
    │   │       ├── base.entity.ts         ← Core baseEntity + auditFields
    │   │       ├── index.ts               ← Deep barrel
    │   │       ├── enums/                 ← Shared schema enums
    │   │       ├── users/                 ← Each entity folder contains:
    │   │       │   ├── <entity>.table.ts
    │   │       │   ├── <entity>.relations.ts
    │   │       │   └── index.ts
    │   │       ├── roles/
    │   │       ├── permissions/
    │   │       ├── company/
    │   │       ├── address/
    │   │       ├── country/               ← Individual geography folders (also state, city, county, pincode)
    │   │       └── ... (32 entities total)
    │   │
    │   └── cache/                 ← Placeholder
    │
    ├── modules/                   ← Feature Layer
    │   ├── users/                 ← Profile management
    │   ├── company/               ← Tenant & Company registration
    │   ├── roles/                 ← Admin RBAC management
    │   ├── lookup/                ← Static reference lookups
    │   ├── geography/             ← Hierarchical geo-data
    │   └── orders/                ← [Stub] Order lifecycle (boilerplate only)
    │
    └── shared/                    ← External Integrations (stubs)
        ├── mail/                  ← Emailing
        ├── notifications/         ← Push notifications
        └── storage/               ← File & Image uploads
```

---

## 3. Application Bootstrap

**`src/main.ts`**

```typescript
const app    = await NestFactory.create(AppModule);
const config = app.get(ConfigService);

app.use(helmet());                                   // security headers
app.setGlobalPrefix('api');
app.enableCors(buildCorsConfig(configService));      // from cors.config.ts
setupSwagger(app);                                   // at /api/docs
app.useGlobalPipes(new ZodValidationPipe());         // nestjs-zod
app.useGlobalFilters(new GlobalExceptionFilter());
app.useGlobalInterceptors(
  new LoggingInterceptor(),
  new TransformInterceptor(),                        // wraps data in ApiResponse<T>
);
await app.listen(port);
```

### Global Middleware

**`RequestIdMiddleware`** is registered in `AppModule` to ensure every request has a unique `X-Request-ID` tracking header.

- Port from `app.port` config (fallback `4000`)
- CORS origins from `ALLOWED_ORIGINS` env var (comma-separated)
- Global prefix `/api` — all routes are `/api/...`
- Swagger UI at `/api/docs`

---

## 4. Configuration Layer

All config is registered via `registerAs()` from `@nestjs/config`.

| Namespace | File | Key Variables |
|---|---|---|
| `app` | `app.config.ts` | `port`, `nodeEnv`, `allowedOrigins[]` |
| `database` | `database.config.ts` | `url` (DATABASE_URL) |

**`cors.config.ts`** — `buildCorsConfig(configService)` returns:
```typescript
{
  origin:         string[],   // from app.allowedOrigins
  credentials:    true,
  methods:        ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','Accept'],
  exposedHeaders: ['Content-Range','X-Content-Range'],
  maxAge:         86400,      // 24h preflight cache
}
```

**`.env.example`:**
```bash
DATABASE_URL=
PORT=4000
NODE_ENV=development
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:4000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8081
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
INIT=false
```

---

## 5. Database Layer

### DatabaseModule (`core/database/database.module.ts`)

```
@Global() module — provides DATABASE_TOKEN and TransactionService to entire app
```

- Creates a `pg.Pool` from `database.url`
- Wraps it in `drizzle(pool, { schema })` → `NodePgDatabase<typeof schema>`
- Exported token: `DATABASE_TOKEN`
- Exported service: `TransactionService`

### `@InjectDb()` Decorator

Shorthand for `@Inject(DATABASE_TOKEN)`. Only used in **repositories** and `TransactionService`.

### `TransactionService` (`core/database/transaction.service.ts`)

The **only** place in the application that calls `db.transaction()`.

```typescript
run<T>(fn: (tx: DbTransaction) => Promise<T>): Promise<T>
```

**Rule:** Services inject `TransactionService`, not `@InjectDb()`.

### `DbTransaction` type

```typescript
export type DbTransaction = Parameters<
  Parameters<NodePgDatabase<typeof schema>['transaction']>[0]
>[0];
```

### `drizzle.config.ts`

```typescript
{
  schema: './src/core/database/schema.ts',
  out:    './drizzle',          // migration output
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL }
}
```

---

## 6. Schema Reference

### Base Entity (`base.entity.ts`)

**`baseEntity`** — spread into every table:

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint` PK | `bigserial` with `mode: 'number'` for numeric ID handling. |
| `guuid` | `varchar(255)` | Globally unique identifier. |
| `sortOrder` | `integer` | Optional display sorting. |
| `isActive` | `boolean` | Default `true`. |
| `createdDate` | `timestamp tz` | `defaultNow`. |
| `modifiedDate` | `timestamp tz` | Auto-updated via `$onUpdateFn`. |

**`auditFields(getUsersId: () => AnyPgColumn)`** — factory pattern for audit tracking:

| Column | Type | Notes |
|---|---|---|
| `createdBy` | `bigint → users.id` | Numeric FK. |
| `modifiedBy` | `bigint → users.id` | Numeric FK. |
| `deletedBy` | `bigint → users.id` | Numeric FK. |

> The factory pattern accepts `() => AnyPgColumn` to resolve self-referential numeric PK types without circular dependency issues.

---

### Schema Tables

#### Core Auth (BetterAuth managed)

| Table | Purpose |
|---|---|
| `users` | Primary user record. Extends `baseEntity` + `auditFields`. Contains KYC level, language, FCM token, blocking status, login count. Self-referential `blockedBy → users.id` |
| `user_auth_provider` | OAuth/social provider links per user |
| `user_session` | Active BetterAuth sessions |

#### RBAC

| Table | Purpose |
|---|---|
| `roles` | System and tenant roles. `code` (unique), `roleName`, `isSystem` flag, optional `companyFk` for tenant-scoped roles |
| `permissions` | Fine-grained permissions. `code` (e.g. `users:read`), `resource`, `action`, `name` |
| `role_permission_mapping` | M:N roles ↔ permissions. Unique on `(roleFk, permissionFk)` |
| `user_role_mapping` | M:N users ↔ roles. Scoped by optional `companyFk`. Tracks `assignedDate`, `assignedBy`, `revokedDate`, `revokedBy` |

#### Company

| Table | Purpose |
|---|---|
| `company` | Business entity. `companyName`, `companyCode`, `companyTypeFk`, `registrationNumber` (business reg), `taxNumber` (GST/VAT), `kycLevel`, `isVerified`. Self-referential `parentCompanyFk` for franchises |
| `company_type` | Lookup: Retailer, Wholesaler, Distributor, etc. |
| `company_user_mapping` | Users belonging to a company |

#### Geography (Lookups)

`country` → `state_region_province` → `city` → `county`  
Also: `calling_code` (phone dial codes), `pincode`

#### Contact & Communication

| Table | Purpose |
|---|---|
| `address` / `address_type` | Postal addresses with type (Home, Office, etc.) |
| `communication` / `communication_type` | Email/Phone/WhatsApp contact records |
| `contact_person` / `contact_person_type` | Contact person records with type |

#### Other Lookups

| Table | Purpose |
|---|---|
| `salutation` | Mr, Mrs, Dr, etc. |
| `volumes` | **Schema-ready, no business logic yet.** UOM registry: KG, L, PCS, etc. Self-referential `baseVolumeFk` + `conversionFactor` for unit conversion |
| `audit_log` | Change tracking log |
| `otp_verification` | OTP codes for phone/email verification |
| `routes` | API route registry (for dynamic RBAC) |

---

### Polymorphic Relationship System

The backend implements a **Polymorphic Ownership Pattern** for shared entities like `address`, `communication`, `contact_person`, and `notes`. This allows a single `address` table to serve multiple owners (e.g., `users`, `company`, `customers`) without adding dozens of nullable Foreign Keys.

#### How it works:
1. **Registry**: All owner tables are registered in the `entity` table (columns: `id`, `entity_name`).
2. **Generic Link**: The child table (e.g., `address`) contains:
   - `entityFk`: Points to the relevant row in the `entity` table.
   - `recordId`: The actual numeric `id` of the record in that owner's table.
3. **Optimized Lookup**: A composite index exists on `(entity_fk, record_id)` for high-performance retrieval.

---

### Interface & Type Registry (`common/types`, `common/interfaces`)

Global contracts used to ensure cross-layer consistency:

| Type / Interface | Purpose |
|---|---|
| `Db` | Fully typed `NodePgDatabase<typeof schema>` instance. |
| `Tx` | Represents a Drizzle transaction context. |
| `Id` | Type alias for `number` (numeric DB PK). |
| `Guuid` | Type alias for `string` (BetterAuth identity). |
| `IRepository<T>` | Common contract for all repository classes. |
| `PaginatedResult<T>` | Standard shape for all paginated API responses. |
| `SoftDeletable` | Interface for entities using the `isActive` pattern. |

---

## 7. Authentication & Sessions

BetterAuth handles all auth. There are **no JWTs** — sessions are cookie-based.

### BetterAuth Config (`core/auth/auth.ts`)

```typescript
betterAuth({
  useNumberId: true,           // Ensures IDs are treated as numbers
  advanced: {
    database: {
      generateId: false,       // Allows Postgres bigserial to handle PKs
    },
  },
  database: drizzleAdapter(db, { provider: 'pg', schema: { ... } }),
  socialProviders: { google: { ... } },
  plugins: [phoneNumber()],
  user: {
    additionalFields: {
      userId: { type: 'number', fieldName: 'id' },  // maps DB 'id' to 'userId' key
    }
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Auto-assigns SUPER_ADMIN role to the very first user
        }
      }
    }
  }
})
```

### Session User — `SessionUser` Interface

```typescript
interface SessionUser {
  id:     string;  // Numeric PK as string (e.g. "1")
  userId: number;  // ✅ DB numeric PK (coerced number)
  // ... other fields
}
```

> **Critical:** `id` is the `guuid` (string). `userId` is the numeric DB `id`. Always use `userId` for repository calls.

### AuthGuard Flow

```
Request → AuthGuard.canActivate()
  → Builds Web Headers from Express (cookie + authorization)
  → authService.getSession(headers) → calls BetterAuth session check
  → Throws UnauthorizedException if no session
  → Sets request.user = SessionUser (typed)
  → Sets request.session = session metadata
```

### Session Schema Mapping

BetterAuth's `user` → `users` table  
BetterAuth's `session` → `user_session` table  
BetterAuth's `account` → `user_auth_provider` table

### `@CurrentUser()` Decorator

```typescript
@CurrentUser()                    // → SessionUser (full object)
@CurrentUser('userId')            // → number (DB PK — use for DB queries)
@CurrentUser('email')             // → string
```

---

## 8. Modules

### AuthModule (`core/auth/`)

| File | Role |
|---|---|
| `auth.ts` | BetterAuth instance (singleton) |
| `auth.service.ts` | `register()`, `login()`, `getSession()`, `getUserRoles()`, `getUserPermissions()` |
| `auth.controller.ts` | `POST /api/auth/register`, `POST /api/auth/login`, passes to BetterAuth handler |
| `inject-auth.decorator.ts` | `@InjectAuth()` shorthand |

---

### UsersModule (`modules/users/`)

**Endpoints** (all behind `AuthGuard`):

| Method | Route | Handler |
|---|---|---|
| `GET` | `/api/users/me` | `getProfile` — returns `PublicUser` (sensitive fields stripped) |
| `PATCH` | `/api/users/me` | `updateProfile` — updates name, email, image, phone, language, FCM token, WhatsApp opt-in |

**DTOs:**
- `UpdateProfileDto` — optional fields: `name`, `email`, `image` (URL), `phoneNumber`, `languagePreference` (`en`\|`ta`), `fcmToken`, `whatsappOptedIn`

**UsersRepository key methods:**
- `findById(id)`, `findByEmail(email)`, `findByPhone(phone)`, `update(id, data, tx?)`

---

### CompanyModule (`modules/company/`)

**Endpoint:**

| Method | Route | Handler |
|---|---|---|
| `POST` | `/api/company/register` | Register new company, atomically assign current user as `STORE_OWNER` |

**RegisterCompanyDto:** `companyName`, `companyCode`, `companyTypeCode` (lookup), `registrationNumber?`, `taxNumber?`

**CompanyService.register() flow:**
1. Validate `companyTypeCode` → resolve `companyTypeFk` (read, no tx)
2. Resolve `STORE_OWNER` role by code (read, no tx)
3. `TransactionService.run(async tx => { create company; addUserToCompany })` — atomic

**CompanyRepository methods:**
- `create(data, tx?)`, `findTypeByCode(code)`, `addUserToCompany(data, tx?)`

---

### LookupModule (`modules/lookup/`)

Provides static reference data for dropdowns and forms.

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/lookups/company-types` | List active company types |
| `GET` | `/api/lookups/salutations` | List active salutations (Mr, Mrs, etc.) |
| `GET` | `/api/lookups/calling-codes` | List active phone dial codes |
| `GET` | `/api/lookups/designations` | List active designations |

---

### GeographyModule (`modules/geography/`)

Provides hierarchical geography data.

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/geography/countries` | List all active countries |
| `GET` | `/api/geography/countries/:id/states` | List states for a country |
| `GET` | `/api/geography/states/:id/cities` | List cities for a state |

---

### RolesModule (`modules/roles/`)

All endpoints are `SUPER_ADMIN` only (`AuthGuard + RBACGuard + @Roles('SUPER_ADMIN')`).

#### Endpoint Map

```
GET    /api/roles                          → listRoles
GET    /api/roles/:id                      → getRole
POST   /api/roles                          → createRole
PATCH  /api/roles/:id                      → updateRole  (blocked if isSystem)
DELETE /api/roles/:id                      → deleteRole  (blocked if isSystem)

GET    /api/roles/:id/permissions          → getRolePermissions
POST   /api/roles/:id/permissions          → assignPermissionToRole
DELETE /api/roles/:id/permissions/:pid     → revokePermissionFromRole

POST   /api/roles/assign-user             → assignRoleToUser
DELETE /api/roles/revoke-user             → revokeRoleFromUser

GET    /api/roles/permissions/all          → listPermissions (?resource=users)
POST   /api/roles/permissions              → createPermission
```

#### Business Rules

- `isSystem = true` roles cannot be updated or deleted (throws `403 FORBIDDEN`)
- Cannot revoke `SUPER_ADMIN` from yourself
- Roles are soft-deleted (sets `isActive = false`, `deletedDate`, `deletedBy`)

#### DTOs

| DTO | Fields |
|---|---|
| `CreateRoleDto` | `name`, `code` (auto-uppercased), `description?`, `sortOrder?`, `isSystem?` |
| `UpdateRoleDto` | Partial of CreateRole, minus `code` |
| `AssignRoleDto` | `userId: number`, `roleId: number` |
| `AssignPermissionDto` | `permissionId: number` |
| `CreatePermissionDto` | `name`, `code`, `resource`, `action`, `description?` |

---

## 9. Common Layer

### Interceptors

| Interceptor | Purpose |
|---|---|
| `LoggingInterceptor` | Logs incoming request info: `METHOD /path → STATUS (Xms)`. |
| `TransformInterceptor` | Wraps all raw controller returns in `ApiResponse.ok(data)`. |

### Middlewares

| Middleware | Purpose |
|---|---|
| `helmet` | System-level security headers. |
| `RequestIdMiddleware` | Injects `X-Request-ID` into every request/response for tracing. |

### Guards

#### `AuthGuard` (`common/guards/auth.guard.ts`)

```
Validates BetterAuth cookie/token → attaches typed SessionUser to request.user
Throws UnauthorizedException ({ errorCode: AUTH_SESSION_EXPIRED }) if invalid
```

#### `RBACGuard` (`common/guards/rbac.guard.ts`)

```
Reads @Roles() and @Permissions() metadata from route handler
Loads user's roles via authService.getUserRoles(userId)
SUPER_ADMIN bypasses all checks
Checks role codes → then permission codes
Throws ForbiddenException if unauthorized
```

Usage:
```typescript
@Roles('SUPER_ADMIN', 'STORE_OWNER')
@Permissions('company:read')
```

### Decorators

| Decorator | Purpose |
|---|---|
| `@CurrentUser(field?)` | Extract typed `SessionUser` or a specific field from `request.user` |
| `@Roles(...codes)` | Sets `roles` metadata — consumed by `RBACGuard` |
| `@Permissions(...codes)` | Sets `permissions` metadata — consumed by `RBACGuard` |

### `ApiResponse<T>`

All controllers return:
```typescript
{
  success: boolean,
  message: string,
  data: T,
  total?: number    // paginated only
}
```

Static methods: `ApiResponse.ok(data, message?)`, `ApiResponse.paginated(data[], total, message?)`

---

## 10. Shared Services

| Service | Status |
|---|---|
| `MailService` | **Empty stub** — email sending not yet implemented |
| `NotificationsModule` | **Empty stub** — push notifications not yet implemented |
| `StorageModule` | **Empty stub** — file uploads not yet implemented |

---

## 11. Error Handling

### Exception Hierarchy

```
HttpException (NestJS)
  └── AppException (base class for all custom errors)
        ├── BadRequestException    → 400
        ├── UnauthorizedException  → 401
        ├── ForbiddenException     → 403
        ├── NotFoundException      → 404
        ├── ConflictException      → 409
        ├── UnprocessableException → 422
        ├── TooManyRequestsException → 429
        └── InternalServerException → 500
```

All exceptions carry:
```typescript
{ errorCode: ErrorCodeType, message: string, errors?: Record<string,string[]>, meta?: Record<string,unknown> }
```

### `GlobalExceptionFilter`

Handles in priority order:
1. `AppException` — custom typed exceptions
2. `ZodValidationException` — from nestjs-zod (field-level validation errors)
3. `HttpException` — standard NestJS exceptions
4. PostgreSQL errors — unique constraint (`23505` → `409 CONFLICT`), FK violation (`23503` → `422 UNPROCESSABLE`)
5. Catch-all — logs and returns `500 INTERNAL_SERVER_ERROR`

**Response shape:**
```json
{
  "success": false,
  "errorCode": "ROLE_NOT_FOUND",
  "message": "Role not found",
  "errors": null,
  "timestamp": "2026-03-19T15:00:00.000Z",
  "path": "/api/roles/99"
}
```

### Error Code Registry (`common/constants/error-codes.constants.ts`)

Convention: `<DOMAIN>_<ENTITY>_<REASON>`

Domains covered: `AUTH`, `OTP`, `USER`, `COMPANY`, `ROLE`, `PERMISSION`, `GEOGRAPHY`, `ADDRESS`, `COMMUNICATION`, `CONTACT_PERSON`, `NOTES`, `SALUTATION`, `DESIGNATION`, `COMPANY_TYPE`, `CALLING_CODE`, `VOLUME`, `FILE`, `DB`

---

## 12. Request Lifecycle

```
HTTP Request
    │
    ▼
HelmetMiddleware (security headers)
    │
    ▼
RequestIdMiddleware (X-Request-ID generation/propagation)
    │
    ▼
CorsMiddleware (origin check via allowedOrigins)
    │
    ▼
NestJS Router → matches /api/<prefix>/<route>
    │
    ▼
Guards (in order):
  1. AuthGuard      → validates BetterAuth session → sets request.user: SessionUser (numeric ID coerced)
  2. RBACGuard      → checks @Roles / @Permissions metadata
    │
    ▼
ZodValidationPipe  → validates & transforms request body via Zod schema
    │
    ▼
LoggingInterceptor → logs METHOD /path → STATUS (Xms)
    │
    ▼
Controller method  → extracts params, calls service
    │
    ▼
Service layer      → business logic, validation, calls repository / TransactionService
    │
    ▼
Repository layer   → Drizzle ORM queries, accepts optional tx
    │
    ▼
PostgreSQL database
    │
    ▼
TransformInterceptor → wraps data in ApiResponse.ok(data)
    │
    ▼
GlobalExceptionFilter (on any thrown exception) → structured error response
```

---

## 13. API Endpoints

### Base URL: `http://localhost:4000/api`

| Method | Path | Guard | Description |
|---|---|---|---|
| `POST` | `/auth/register` | — | Register user via BetterAuth |
| `POST` | `/auth/login` | — | Login via BetterAuth |
| `GET/POST` | `/auth/*` | — | BetterAuth handler (OAuth, sessions, etc.) |
| `GET` | `/users/me` | AuthGuard | Get current user profile |
| `PATCH` | `/users/me` | AuthGuard | Update current user profile |
| `POST` | `/company/register` | AuthGuard | Register company (assigns STORE_OWNER) |
| `GET` | `/roles` | AuthGuard + RBAC (SUPER_ADMIN) | List all roles |
| `GET` | `/roles/:id` | AuthGuard + RBAC | Get role by ID |
| `POST` | `/roles` | AuthGuard + RBAC | Create role |
| `PATCH` | `/roles/:id` | AuthGuard + RBAC | Update role |
| `DELETE` | `/roles/:id` | AuthGuard + RBAC | Soft-delete role |
| `GET` | `/roles/:id/permissions` | AuthGuard + RBAC | List role's permissions |
| `POST` | `/roles/:id/permissions` | AuthGuard + RBAC | Assign permission to role |
| `DELETE` | `/roles/:id/permissions/:pid` | AuthGuard + RBAC | Revoke permission from role |
| `POST` | `/roles/assign-user` | AuthGuard + RBAC | Assign role to user |
| `DELETE` | `/roles/revoke-user` | AuthGuard + RBAC | Revoke role from user |
| `GET` | `/roles/permissions/all` | AuthGuard + RBAC | List all permissions |
| `POST` | `/roles/permissions` | AuthGuard + RBAC | Create permission |

Swagger: `http://localhost:4000/api/docs`

---

## 14. Key Rules & Conventions

### Layer Rules

| Layer | What it does | What it must NOT do |
|---|---|---|
| **Repository** | Drizzle queries (`db.select`, etc.). Accepts `tx?: Tx`. | Business logic, calling other repositories. |
| **Service** | Business logic, orchestrates Repos, uses `TransactionService`. | Raw DB queries or holding the `@InjectDb()` instance. |
| **Controller** | HTTP routing, input validation (Zod), response wrapping. | Business logic or DB access. |

### Repository Pattern

All repositories should follow a standard pattern:
1. **Inject Database**: Use `@InjectDb() private readonly db: Db`.
2. **Contextual Execution**: Methods that modify data must accept an optional `tx?: Tx` parameter.
3. **Transaction Handoff**: `const client = tx ?? this.db;` allows the method to run within an existing transaction or fall back to the global pool.

```typescript
async update(id: Id, data: UpdateDto, tx?: Tx) {
  const client = tx ?? this.db;
  return client.update(...).set(data).where(...).returning();
}
```

### Transaction Pattern

```typescript
// ✅ Correct — service uses TransactionService
await this.txService.run(async (tx) => {
  await this.repoA.create(data, tx);
  await this.repoB.link(id, tx);
});

// ❌ Wrong — service should never hold raw db
@InjectDb() private db: ...
await this.db.transaction(...)
```

### ID Disambiguation

```typescript
// In any controller handler:
@CurrentUser('userId') userId: number  // ← Numeric PK (coerced number) ✅
@CurrentUser('id')     id: string      // ← BetterAuth ID (numeric string)
```

**Rule:** Always use `userId` (number) for all database/repository queries.

### Soft Delete

All tables use soft delete via `isActive = false` + `deletedDate` + `deletedBy`. Hard deletes are forbidden in application code.

### DTOs

All DTOs use `createZodDto()` from `nestjs-zod`. The `ZodValidationPipe` (global) automatically validates and transforms request bodies.

### Error Codes

Always use `ErrorCode.SOME_CODE` from `error-codes.constants.ts`. Never use raw strings in exceptions.

---

## 15. Scripts & Dev Tooling

```bash
npm run dev          # Start dev server (watch mode)
npm run db:seed      # Run seeder (sets INIT=true)
npm run build        # Production build
npm run lint         # ESLint with auto-fix
npm run test         # Jest unit tests
npm run test:e2e     # End-to-end tests
```

### Drizzle Kit

```bash
npx drizzle-kit generate   # Generate migration SQL from schema changes
npx drizzle-kit migrate    # Apply pending migrations
npx drizzle-kit studio     # Open Drizzle Studio (DB browser)
```

Migration output: `./drizzle/` directory.
