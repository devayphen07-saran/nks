# NKS Backend Architecture

> Last updated: 2026-04-08

---

## 1. Authentication

### 1.1 Auth Methods

| Method | Endpoint | Description |
|--------|----------|-------------|
| Email + Password | `POST /auth/login` | Login with email and bcrypt-hashed password |
| Email + Password | `POST /auth/register` | Register new user. First user gets SUPER_ADMIN |
| Phone OTP | `POST /auth/otp/send` | Send SMS OTP via MSG91 |
| Phone OTP | `POST /auth/otp/verify` | Verify OTP and create session (login or register) |
| Phone OTP | `POST /auth/otp/resend` | Resend using original MSG91 reqId |
| Email OTP | `POST /auth/otp/email/send` | Send email OTP (authenticated, onboarding) |
| Email OTP | `POST /auth/otp/email/verify` | Verify email OTP and mark verified |

### 1.2 Token System (Dual Token)

The backend issues two tokens per session:

| Token | Type | Purpose | Lifetime |
|-------|------|---------|----------|
| **sessionToken** | Opaque (BetterAuth) | Server-side session validation | 1 hour |
| **jwtToken** | RS256 JWT | Client-side claims (mobile offline) | 1 hour |
| **refreshToken** | Opaque | Token rotation to get new session+JWT | 30 days |

**Web clients:** `sessionToken` is set as `nks_session` httpOnly cookie (SameSite=Strict, Secure in prod). Also sent in response body.

**Mobile clients:** Both tokens returned in response body. Mobile stores in SecureStore and passes `Authorization: Bearer <sessionToken>` header.

### 1.3 Auth Response Shape

```
POST /auth/login → 200
{
  "data": {
    "user": {
      "id": "1", "guuid": "abc-123", "name": "Saran",
      "email": "saran@example.com", "emailVerified": true,
      "phoneNumber": "+919876543210", "phoneNumberVerified": true,
      "image": null, "lastLoginAt": "2026-04-08T...", "lastLoginIp": "..."
    },
    "session": {
      "sessionId": "sess_abc123",
      "tokenType": "Bearer",
      "sessionToken": "opaque-token-...",
      "jwtToken": "eyJhbGciOiJSUzI1NiI...",
      "issuedAt": "2026-04-08T10:00:00Z",
      "expiresAt": "2026-04-08T11:00:00Z",
      "refreshToken": "refresh-token-...",
      "refreshExpiresAt": "2026-05-08T10:00:00Z",
      "mechanism": "password",
      "absoluteExpiry": "2026-04-08T11:00:00Z",
      "defaultStore": { "guuid": "store-abc" } | null
    },
    "authContext": {
      "method": "password",
      "mfaVerified": false, "mfaRequired": false,
      "trustLevel": "standard", "stepUpRequired": false
    },
    "access": {
      "isSuperAdmin": false,
      "activeStoreId": 1,
      "roles": [
        { "roleCode": "STORE_OWNER", "storeId": 1, "storeName": "My Store",
          "isPrimary": true, "assignedAt": "...", "expiresAt": null }
      ]
    },
    "flags": { "ONBOARDING_COMPLETE": false, "STORE_SETUP": true }
  },
  "message": "Login successful",
  "statusCode": 200
}
```

### 1.4 Refresh Token Rotation

```
POST /auth/refresh-token
Body: { "refreshToken": "..." }  (or from nks_session cookie)
```

Flow:
1. Extract `sessionId` from refresh token
2. Verify token against stored hash (timing-safe comparison)
3. **Reuse detection:** If token was already rotated (revoked), terminate ALL user sessions (theft assumed)
4. Generate new `sessionToken` + `jwtToken` + `refreshToken`
5. Old refresh token is revoked immediately
6. Set new `nks_session` cookie for web

### 1.5 Session Management

| Endpoint | Guard | Description |
|----------|-------|-------------|
| `GET /auth/me` | AuthGuard | Get current user profile |
| `POST /auth/logout` | None | Invalidate session + clear cookie |
| `GET /auth/sessions` | AuthGuard | List all active device sessions |
| `DELETE /auth/sessions/:id` | AuthGuard | Terminate specific session |
| `DELETE /auth/sessions` | AuthGuard | Terminate all sessions |

**Session limits:** Max 5 concurrent sessions per user. Oldest session evicted when limit exceeded.

### 1.6 Security Features

| Feature | Implementation |
|---------|---------------|
| Password hashing | bcrypt, 12 rounds |
| Password policy | Min 12 chars, uppercase + lowercase + number + special |
| JWT signing | RS256 (RSA 2048-bit) |
| JWKS endpoint | `GET /auth/.well-known/jwks.json` (1h cache, 7-day fallback keys) |
| Account lockout | Auto-unlock after 15 minutes of failed attempts |
| OTP rate limiting | 100 requests per 24h per identifier (HMAC-SHA256 hashed for GDPR) |
| First-user bootstrap | First registered user auto-assigned SUPER_ADMIN role |
| Device tracking | `X-Device-ID`, `X-Device-Name`, `X-Device-Type` headers |
| Time sync | `POST /auth/sync-time` for mobile clock drift detection |

### 1.7 Additional Auth Endpoints

| Endpoint | Guard | Description |
|----------|-------|-------------|
| `POST /auth/token/verify` | AuthGuard | Verify JWT claims, detect role changes |
| `GET /auth/permissions-snapshot` | AuthGuard | Full permissions for mobile sync |
| `GET /auth/permissions-delta?sinceVersion=v1` | AuthGuard | Delta permissions since version |
| `POST /auth/sync-time` | None | Device time offset calculation |
| `GET /auth/.well-known/jwks.json` | None | JWKS public key set |

---

## 2. Guards & Access Control

### 2.1 AuthGuard

Applied globally. Runs on every request unless `@Public()` is present.

**Flow:**
1. Check `@Public()` → skip if present
2. Extract token from `Authorization: Bearer <token>` or `nks_session` cookie
3. Look up session in `user_session` table
4. Check session not expired
5. Load user from `users` table
6. Check `user.isBlocked !== true`
7. Load all roles from `user_role_mapping` (joined with `roles` table)
8. Determine `primaryRole` and `isSuperAdmin`
9. Attach `SessionUser` to `request.user`
10. Fire-and-forget update `lastActiveAt`

### 2.2 RBACGuard

Runs after AuthGuard when `@Roles()` or `@RequireEntityPermission()` decorators are present.

**Flow:**
1. **SUPER_ADMIN bypass:** If `user.isSuperAdmin === true`, allow immediately
2. **Role check:** If `@Roles('STORE_OWNER')` is present, check if any of user's roles match
3. **Entity permission check:** If `@RequireEntityPermission({ entityCode, action })` is present:
   - Fetch entity permissions for user's roles in the active store
   - Merge across roles: union grant (any role grants → allowed)
   - **DENY overrides:** If any role explicitly denies, access is blocked regardless of grants

### 2.3 Decorators

| Decorator | Purpose | Example |
|-----------|---------|---------|
| `@Public()` | Skip AuthGuard | `@Public() @Get('health')` |
| `@Roles(...codes)` | Require role code(s) | `@Roles('SUPER_ADMIN')` |
| `@RequireEntityPermission(req)` | Entity-level CRUD check | `@RequireEntityPermission({ entityCode: 'INVOICE', action: 'edit' })` |
| `@CurrentUser()` | Extract SessionUser from request | `@CurrentUser() user: SessionUser` |
| `@CurrentUser('userId')` | Extract specific field | `@CurrentUser('userId') id: number` |

---

## 3. Roles

### 3.1 System Roles

Seeded in `roles` table with `storeFk = NULL`, `isSystem = true`, `isEditable = false`:

| Code | Description |
|------|-------------|
| `SUPER_ADMIN` | Platform-wide administrator. Full access to everything. |
| `USER` | Default platform user. |
| `STORE_OWNER` | Full access to their store. |
| `STAFF` | Access via custom role assignment. |

### 3.2 Custom Roles

Store owners create custom roles scoped to their store (e.g., CASHIER, MANAGER, DELIVERY).

### 3.3 Role Endpoints

| Endpoint | Guard | Description |
|----------|-------|-------------|
| `POST /roles` | STORE_OWNER | Create custom role with entity + route permissions |
| `GET /roles/:guuid` | STORE_OWNER | Get role details with all permissions |
| `PUT /roles/:guuid` | STORE_OWNER | Update role name, description, permissions |

**Guards:** System role codes (`SUPER_ADMIN`, `USER`, `STORE_OWNER`, `STAFF`) are reserved and cannot be used for custom roles. System roles cannot be modified or deleted.

### 3.4 Permission Model

Two permission layers:

**Route Permissions** (`role_route_mapping`):
- Maps roles to sidebar/screen routes
- CRUD flags per route: `canView`, `canCreate`, `canEdit`, `canDelete`, `canExport`

**Entity Permissions** (`role_entity_permission`):
- Maps roles to business entities (INVOICE, PRODUCT, CUSTOMER, etc.)
- CRUD flags per entity: `canView`, `canCreate`, `canEdit`, `canDelete`
- `deny` flag: explicitly denies access (overrides grants from other roles)

### 3.5 Permission Resolution

When a user has multiple roles in a store:
1. Fetch all active roles for user in store
2. For each entity, merge permissions across roles:
   - **Grant union:** If any role grants `canView`, the user can view
   - **Deny override:** If any role sets `deny: true`, access is blocked entirely

---

## 4. Routes

### 4.1 Route Endpoints

| Endpoint | Guard | Description |
|----------|-------|-------------|
| `GET /routes/admin` | SUPER_ADMIN | Admin panel sidebar routes |
| `GET /routes/store/:storeGuuid` | Authenticated | Store routes for user's role |

### 4.2 Route Response Shape

Routes are returned as a hierarchical tree:

```json
{
  "user": { "id": 1, "name": "Saran", "email": "..." },
  "routes": [
    {
      "id": 1,
      "routeName": "Dashboard",
      "routePath": "/dashboard",
      "fullPath": "/store/dashboard",
      "iconName": "LayoutDashboard",
      "routeType": "sidebar",
      "routeScope": "store",
      "isPublic": false,
      "sortOrder": 1,
      "canView": true, "canCreate": false,
      "canEdit": false, "canDelete": false, "canExport": true,
      "children": [...]
    }
  ]
}
```

### 4.3 Route Resolution Logic

**Admin routes** (`GET /routes/admin`):
- Fetches all routes where `routeScope = 'admin'`
- Filters by SUPER_ADMIN role's route permissions
- Returns tree structure sorted by `sortOrder`

**Store routes** (`GET /routes/store/:storeGuuid`):
- Resolves store guuid to storeId
- If user is STORE_OWNER → all store routes with full CRUD
- If user has custom role → routes mapped to that role with role-specific CRUD flags
- Returns tree structure sorted by `sortOrder`

---

## 5. Lookups

### 5.1 Public Endpoints (No Auth Required)

All prefixed with `GET /lookups/`. Decorated with `@Public()`.

**Code-Value Family** (from `code_value` + `code_category` tables):

| Endpoint | Description |
|----------|-------------|
| `/salutations` | Mr., Mrs., Dr., etc. |
| `/address-types` | Home, Office, Shipping, Billing |
| `/designations` | CEO, Manager, Staff |
| `/store-legal-types` | Pvt Ltd, Sole Proprietor, Partnership |
| `/store-categories` | Grocery, Pharmacy, Restaurant |

**Dedicated Tables:**

| Endpoint | Table | Description |
|----------|-------|-------------|
| `/countries` | `country` | Countries with ISO codes, dialing codes |
| `/communication-types` | `communication_type` | Mobile, Email, Fax, WhatsApp |
| `/currencies` | `currency` | INR, USD, EUR with symbols |
| `/volumes` | `volumes` | Kilogram, Litre, Piece with units |

**Phase 1 Normalization Tables:**

| Endpoint | Description |
|----------|-------------|
| `/plan-types` | STARTER, PROFESSIONAL, ENTERPRISE, PREMIUM |
| `/tax-line-statuses` | PENDING, APPROVED, REJECTED |
| `/entity-types` | INVOICE, PRODUCT, CUSTOMER, ORDER, etc. |
| `/notification-statuses` | PENDING, SENT, DELIVERED, READ, FAILED |
| `/staff-invite-statuses` | PENDING, ACCEPTED, REVOKED, EXPIRED |
| `/billing-frequencies` | MONTHLY, QUARTERLY, ANNUAL, ONE_TIME |
| `/tax-registration-types` | REGULAR, COMPOSITION, EXEMPT, SEZ |
| `/tax-filing-frequencies` | MONTHLY, QUARTERLY, HALF_YEARLY, ANNUAL |

### 5.2 Admin Endpoints (SUPER_ADMIN Only)

For managing code-based lookup categories and their values:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/lookups/admin` | GET | List all code categories with value counts |
| `/lookups/admin/:code` | GET | List all values for a category (includes inactive) |
| `/lookups/admin/:code` | POST | Add new value to category |
| `/lookups/admin/:code/:id` | PUT | Update value (blocked for isSystem) |
| `/lookups/admin/:code/:id` | DELETE | Soft-delete value (blocked for isSystem) |

---

## 6. Endpoint Summary

### Auth Controller (`/auth`)

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| POST | `/auth/login` | Public | Email + password login |
| POST | `/auth/register` | Public | Register (first user = SUPER_ADMIN) |
| POST | `/auth/refresh-token` | Public | Rotate tokens |
| GET | `/auth/me` | Auth | Get current user |
| POST | `/auth/logout` | Public | Invalidate session |
| GET | `/auth/.well-known/jwks.json` | Public | JWKS public keys |
| POST | `/auth/sync-time` | Public | Device time sync |
| POST | `/auth/token/verify` | Auth | Verify JWT claims |
| GET | `/auth/permissions-snapshot` | Auth | Full permissions |
| GET | `/auth/permissions-delta` | Auth | Delta permissions |
| GET | `/auth/sessions` | Auth | List sessions |
| DELETE | `/auth/sessions/:id` | Auth | Kill session |
| DELETE | `/auth/sessions` | Auth | Kill all sessions |

### OTP Controller (`/auth/otp`)

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| POST | `/auth/otp/send` | Public | Send phone OTP |
| POST | `/auth/otp/verify` | Public | Verify phone OTP + login |
| POST | `/auth/otp/resend` | Public | Resend OTP |
| POST | `/auth/otp/email/send` | Auth | Send email OTP |
| POST | `/auth/otp/email/verify` | Auth | Verify email OTP |

### Roles Controller (`/roles`)

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| POST | `/roles` | STORE_OWNER | Create custom role |
| GET | `/roles/:guuid` | STORE_OWNER | Get role + permissions |
| PUT | `/roles/:guuid` | STORE_OWNER | Update role + permissions |

### Routes Controller (`/routes`)

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/routes/admin` | SUPER_ADMIN | Admin panel routes |
| GET | `/routes/store/:storeGuuid` | Auth | Store routes for user |

### Lookups Controller (`/lookups`)

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/lookups/salutations` | Public | Salutations |
| GET | `/lookups/countries` | Public | Countries |
| GET | `/lookups/address-types` | Public | Address types |
| GET | `/lookups/communication-types` | Public | Communication types |
| GET | `/lookups/designations` | Public | Designations |
| GET | `/lookups/store-legal-types` | Public | Store legal types |
| GET | `/lookups/store-categories` | Public | Store categories |
| GET | `/lookups/currencies` | Public | Currencies |
| GET | `/lookups/volumes` | Public | Volumes |
| GET | `/lookups/plan-types` | Public | Plan types |
| GET | `/lookups/tax-line-statuses` | Public | Tax line statuses |
| GET | `/lookups/entity-types` | Public | Entity types |
| GET | `/lookups/notification-statuses` | Public | Notification statuses |
| GET | `/lookups/staff-invite-statuses` | Public | Staff invite statuses |
| GET | `/lookups/billing-frequencies` | Public | Billing frequencies |
| GET | `/lookups/tax-registration-types` | Public | Tax registration types |
| GET | `/lookups/tax-filing-frequencies` | Public | Tax filing frequencies |
| GET | `/lookups/admin` | SUPER_ADMIN | List lookup categories |
| GET | `/lookups/admin/:code` | SUPER_ADMIN | List values for category |
| POST | `/lookups/admin/:code` | SUPER_ADMIN | Create lookup value |
| PUT | `/lookups/admin/:code/:id` | SUPER_ADMIN | Update lookup value |
| DELETE | `/lookups/admin/:code/:id` | SUPER_ADMIN | Delete lookup value |

### Location Controller (`/location`)

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/location/states` | Public | All Indian states |
| GET | `/location/states/:code` | Public | State by code |
| GET | `/location/states/:stateId/districts` | Public | Districts by state |
| GET | `/location/districts/:districtId/pincodes` | Public | Pincodes by district |
| GET | `/location/pincodes/:code` | Public | Pincode by 6-digit code |

### Codes Controller (`/codes`)

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/codes/categories` | Auth | List code categories |
| GET | `/codes/categories/:code/values` | Auth | Values for category |
| POST | `/codes/categories` | SUPER_ADMIN | Create category |
| POST | `/codes/categories/:code/values` | Auth | Create value |
| PUT | `/codes/values/:id` | Auth | Update value |
| DELETE | `/codes/values/:id` | Auth | Soft-delete value |

### Users Controller (`/users`)

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/users` | SUPER_ADMIN | List users with pagination |

### Status Controller (`/statuses`)

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/statuses` | Auth | List all statuses |
| GET | `/statuses/active` | Auth | List active statuses |
| POST | `/statuses` | SUPER_ADMIN | Create status |
| PUT | `/statuses/:guuid` | SUPER_ADMIN | Update status |
| DELETE | `/statuses/:guuid` | SUPER_ADMIN | Soft-delete status |

### Entity Status Controller (`/entity-statuses`)

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/entity-statuses/:entityCode` | Auth | Get statuses for entity |
| POST | `/entity-statuses/:entityCode` | SUPER_ADMIN | Assign status to entity |
| DELETE | `/entity-statuses/:entityCode/:statusGuuid` | SUPER_ADMIN | Remove status from entity |

---

## 7. Architecture Patterns

### 7.1 Response Wrapper

All endpoints return `ApiResponse<T>`:
```json
{ "data": T, "message": "...", "statusCode": 200 }
```

Services return plain data. Controllers wrap with `ApiResponse.ok(data, message)`.

### 7.2 Module Pattern

```
modules/<name>/
├── dto/                    # Request/response types
├── mapper/                 # Row → DTO transformations
├── <name>.controller.ts    # HTTP endpoints
├── <name>.service.ts       # Business logic
├── <name>.repository.ts    # Database queries
└── <name>.module.ts        # NestJS module
```

### 7.3 Database

- **ORM:** Drizzle ORM with PostgreSQL
- **Schema:** Domain-grouped under `core/database/schema/` (auth, store, rbac, location, tax, lookups, etc.)
- **Auth provider:** BetterAuth with Drizzle adapter
- **Soft deletes:** `deletedAt` + `isActive` flags on all entities
- **Audit fields:** `createdBy`, `modifiedBy`, `deletedBy` referencing `users.id`
