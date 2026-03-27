# NKS — Full Application Engineering Playbook

> **Pre-Development Rule**: No coding starts until brainstorming is completed, documentation is reviewed, and decisions are aligned across the team.

---

## Table of Contents

1. [Product Understanding & Scope](#1-product-understanding--scope)
2. [System Architecture & Tech Stack](#2-system-architecture--tech-stack)
3. [Domain-Driven Design](#3-domain-driven-design)
4. [API Contract & Communication](#4-api-contract--communication)
5. [User Management & Security](#5-user-management--security)
6. [Database Strategy](#6-database-strategy)
7. [Backend Engineering Standards](#7-backend-engineering-standards)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Data Handling & Serialization](#9-data-handling--serialization)
10. [Error, Loading & UX States](#10-error-loading--ux-states)
11. [Performance Strategy](#11-performance-strategy)
12. [Observability & Monitoring](#12-observability--monitoring)
13. [Realtime Strategy](#13-realtime-strategy)
14. [CI/CD & Deployment](#14-cicd--deployment)
15. [Testing Strategy](#15-testing-strategy)
16. [Data Safety & Reliability](#16-data-safety--reliability)
17. [Failure & Resilience Design](#17-failure--resilience-design)
18. [Configuration Management](#18-configuration-management)
19. [Documentation Standards](#19-documentation-standards)
20. [Definition of Done](#20-definition-of-done)
21. [Final Pre-Dev Checklist](#21-final-pre-dev-checklist)

---

## 1. Product Understanding & Scope

### Core Problem Statement

NKS (Namma Kadai System) is an offline-first Point of Sale platform for small-to-medium retail stores. Staff must be able to complete sales at any moment regardless of network connectivity. All data eventually syncs to the server when connectivity is restored. Zero sales are ever lost.

### Target Users

| User | Primary App | Key Needs |
|---|---|---|
| Cashier / Store Staff | `nks-mobile` (Expo) | Fast checkout, barcode scan, receipt, offline operation |
| Store Manager | `nks-mobile` + `nks-web` | Shift reports, inventory alerts, end-of-day reconciliation |
| Admin / Owner | `nks-web` (Next.js) | Multi-store P&L, product/pricing management, audit trail |

### MVP Scope

**In MVP:**
- Cashier login + device binding
- Barcode-scanned product lookup (offline cache)
- Checkout: cart → payment → receipt
- Offline queue with background sync (Transactional Outbox Pattern)
- Inventory deduction (delta-based, negative allowed)
- Shift open/close with cash count
- Admin web: product CRUD, pricing, user management, basic sales reports

**Deferred (Post-MVP):**
- Multi-currency support
- Loyalty / rewards program
- Kitchen display system (KDS) integration
- Advanced analytics / BI dashboard
- Supplier purchase order automation

### Critical User Journeys (Happy Paths)

1. **Checkout (online)**: Open cart → scan products → apply discount → select payment → print receipt → sale synced immediately
2. **Checkout (offline)**: Identical to above — sale written to local SQLite, added to outbox, receipt shown instantly
3. **Reconnect sync**: Device comes back online → connectivity probe detects ONLINE → `drainQueue()` triggered → 50 pending sales synced in ~2s
4. **Shift close**: Manager reviews totals → system blocks close if `PENDING` queue is not empty → cash count recorded → shift locked
5. **Admin price update**: Admin changes price in `nks-web` → next delta pull on device applies the update within 4 hours (cache TTL)

### Edge Cases Identified Early

- Network drops mid-request (ghost sale prevention → idempotency keys)
- Two devices selling the last unit simultaneously (negative inventory — allow, alert, resolve)
- Device clock drift > 5 minutes (warn staff, audit log)
- Offline token expired after 30 days offline (DEAD event → manual resolution)
- Product deleted on server while device is offline (DEAD event + admin notification)

---

## 2. System Architecture & Tech Stack

### Full Stack

| Layer | Technology | Location |
|---|---|---|
| Mobile App | Expo (React Native 0.81) + Expo Router | `apps/nks-mobile` |
| Web Admin | Next.js 16 (App Router) + Tailwind CSS v4 | `apps/nks-web` |
| Backend API | NestJS 11 + Drizzle ORM | `apps/nks-backend` |
| Database (server) | PostgreSQL | Managed instance |
| Local DB (device) | SQLite via WatermelonDB | On-device |
| Auth | Better Auth + JWT (access + refresh) | Backend |
| Validation | Zod + class-validator / nestjs-zod | Backend |
| Logging | Pino + nestjs-pino | Backend |
| API Docs | NestJS Swagger (@nestjs/swagger) | Backend |
| Mobile UI | `@nks/mobile-ui-components` + `@nks/mobile-theme` | `libs-mobile/` |
| Web UI | `@nks/web-ui-components` + shadcn/base-ui | `libs-web/` |
| i18n | `@nks/mobile-i18n`, `@nks/web-i18n`, `@nks/common-i18n` | `libs-common/` |
| Monorepo | pnpm workspaces + Nx | root |

### Architecture Pattern

**Backend**: Modular NestJS monolith — one codebase, split into domain modules with clear boundaries. Migrate to separate services only when a specific module's load requires it (e.g., sync processor under heavy offline catch-up load).

**Sync**: Transactional Outbox Pattern. Mobile device always writes to local SQLite first. Background worker drains outbox to server. Server applies events via idempotent endpoint.

**API**: REST with versioned routes (`/api/v1/...`). WebSocket for real-time admin notifications (inventory alerts, new sale events on dashboard).

### High-Level Module Boundaries

```
nks-backend/
├── modules/
│   ├── auth/          ← login, refresh, device binding, offline tokens
│   ├── users/         ← user CRUD, roles, permissions
│   ├── stores/        ← store configuration, shift management
│   ├── products/      ← product/category CRUD, pricing, barcode
│   ├── inventory/     ← stock levels, alerts, adjustments
│   ├── sales/         ← sale records, line items, receipts
│   ├── sync/          ← outbox event ingestion, idempotency, delta pull
│   ├── payments/      ← payment method processing, reconciliation
│   ├── reports/       ← shift totals, P&L, tax summaries
│   └── audit/         ← append-only audit log, admin alerts
```

---

## 3. Domain-Driven Design

### Domain Map

| Domain | Owns | Must Not Touch |
|---|---|---|
| **Auth** | Sessions, tokens, device binding, offline JWT | User profile data |
| **Users** | Profiles, roles, store assignments | Auth tokens |
| **Stores** | Store config, shifts, devices | Product catalog |
| **Products** | Catalog, categories, barcodes, pricing | Inventory levels |
| **Inventory** | Stock levels, alerts, adjustments, purchase order suggestions | Product metadata |
| **Sales** | Sales, line items, receipts | Payment processing |
| **Payments** | Payment methods, settlement, reconciliation | Sale records |
| **Sync** | Outbox ingestion, idempotency store, delta generation | Business logic |
| **Reports** | Aggregations only (read-only projections) | Source tables |
| **Audit** | Append-only log, zero deletes, zero updates | Everything else |

### Cross-Domain Rules

- No module directly queries another module's database table. Use the module's exported service.
- `sync` module ingests raw events and dispatches to the correct domain service (e.g. `SalesService.applyEvent()`).
- `reports` module reads from dedicated read-optimized views or materialized tables — never from transactional tables directly in production.
- No shared `utils/` folder that becomes a dumping ground. Utilities live inside the domain that owns them or in a named `libs-common` package with a clear public API.

---

## 4. API Contract & Communication

### URL Structure

```
/api/v1/auth/...
/api/v1/users/...
/api/v1/stores/...
/api/v1/products/...
/api/v1/inventory/...
/api/v1/sales/...
/api/v1/sync/events       ← Outbox push (mobile → server)
/api/v1/sync/delta        ← Delta pull (server → mobile)
/api/v1/payments/...
/api/v1/reports/...
```

### Versioning Strategy

- URL-based versioning: `/api/v1/...`
- Breaking changes always increment the version: `/api/v2/...`
- Old versions remain supported for one release cycle with deprecation headers
- `Deprecation: true` and `Sunset: <date>` headers added on deprecated routes

### Standard Response Envelope

All responses use this shape:

```typescript
{
  "status": "success" | "error" | "warning",
  "message": string,
  "data": object | null,
  "meta": {               // Only on paginated list responses
    "page": number,
    "limit": number,
    "total": number,
    "totalPages": number
  }
}
```

### Pagination

All list endpoints are paginated. Default: `page=1`, `limit=20`. Maximum `limit=100`.

```
GET /api/v1/products?page=1&limit=20&search=rice&category=grocery
```

### Standard Error Format

```typescript
{
  "status": "error",
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",       // Machine-readable code
  "errors": [                       // Only on validation errors
    { "field": "price", "message": "Must be a positive number" }
  ]
}
```

### Error Code Registry

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | DTO validation failed |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Valid token, insufficient role |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Duplicate / state conflict |
| 410 | `IDEMPOTENCY_REPLAY` | Duplicate sync event (already processed) |
| 422 | `BUSINESS_RULE_VIOLATION` | Price mismatch, schema mismatch |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error (no sensitive detail exposed) |

### DTO Validation

All DTOs use `nestjs-zod` schemas. Every field is explicitly typed. No `any`. No `unknown` without explicit parsing.

### API Documentation

Swagger auto-generated at `/api/docs` (dev + staging only). All endpoints annotated with `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth`. Documentation is treated as code — PRs that add endpoints must include Swagger annotations.

---

## 5. User Management & Security

### Authentication Strategy

**Server-side:**
- Better Auth handles session management, OAuth providers, email/password
- `@nestjs/jwt` issues short-lived access tokens (15 minutes) + long-lived refresh tokens (7 days)
- Offline JWT issued on device login — valid for 30 days, scoped to `device_id` + store hardware fingerprint
- Offline token stored in Expo SecureStore (iOS Keychain / Android Keystore) — never in SQLite

**Device binding:**
- Hardware fingerprint included in offline token payload
- Sync endpoint rejects requests where fingerprint does not match token

### Token Flow

```
POST /api/v1/auth/login
  → { accessToken (15min), refreshToken (7d), offlineToken (30d) }

POST /api/v1/auth/refresh
  → { accessToken (15min) }  (rotates refresh token)

POST /api/v1/auth/device/register
  → { offlineToken (30d), deviceId }
```

### Authorization — RBAC

| Role | Scope |
|---|---|
| `super_admin` | All stores, all data, user management |
| `store_admin` | Own store only — full CRUD on products, staff, shifts |
| `manager` | Own store — view reports, manage shifts, approve discounts |
| `cashier` | Own store — checkout only, no price edits, no reports |
| `device` | Service role — sync endpoint access only |

Guards applied at controller level using `@Roles(...)` decorator. Never implement role checks inside service methods — that is the guard's responsibility.

### Security Hardening

- **Rate limiting**: `@nestjs/throttler` — 100 req/min default, 10 req/min on auth endpoints
- **Input validation**: All input through Zod schemas before reaching service layer
- **CORS**: Explicit allowlist — no wildcard in production
- **Secure headers**: Helmet applied globally in `main.ts`
- **Secrets**: All secrets via environment variables. Never hardcoded. Never committed. Use Vault or secret manager in production.
- **HMAC signing**: Every mobile outbox event signed with `HMAC-SHA256(event_payload, device_secret)`. Server verifies before processing.
- **Price validation**: Server re-validates price at `device_created_at` timestamp. > 5% discrepancy → reject + audit flag.
- **SQL injection**: Drizzle ORM parameterized queries. No raw string interpolation in queries.
- **XSS**: No HTML rendered from user content without sanitization.

### Audit Logging

Every significant user action writes to `audit_log`:
- `user_id`, `store_id`, `action`, `resource_type`, `resource_id`, `before_value` (JSON), `after_value` (JSON), `ip_address`, `user_agent`, `created_at`
- Table has no `UPDATE`, no `DELETE` at application level
- Corrections are new rows referencing the original via `parent_id`

---

## 6. Database Strategy

### PostgreSQL Schema Conventions

- All tables use `snake_case`
- Every table has `id UUID DEFAULT gen_random_uuid() PRIMARY KEY`
- Every table has `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` and `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- Soft delete via `deleted_at TIMESTAMPTZ` — never hard delete application data
- Foreign keys always declared with explicit `ON DELETE` behavior (usually `RESTRICT` or `SET NULL` depending on domain rules)

### Core Tables (Server)

```
users, roles, user_roles
stores, devices
products, product_categories, product_prices
inventory_levels, inventory_alerts, inventory_adjustments
sales, sale_items
payments
shifts, shift_cash_counts
outbox_events (server copy — for audit trail)
idempotency_store
sync_state (per device)
audit_log
```

### Indexing Strategy

Every FK column has an index. Additional indexes:
- `products(barcode)` — fast scan lookup
- `sales(store_id, server_received_at)` — shift/report queries
- `outbox_events(device_id, status, next_retry_at)` — queue worker queries
- `idempotency_store(key, store_id)` — duplicate check
- `audit_log(user_id, created_at)`, `audit_log(resource_type, resource_id)`

### Migration Rules

- All migrations via `drizzle-kit` version-controlled scripts in `apps/nks-backend/scripts/migrations/`
- Migrations **never** run automatically on server startup
- Deploy order: run migrations → deploy new server code
- Every migration has a corresponding rollback migration script
- Naming: `YYYYMMDDHHMMSS_description.sql`

### Admin & CMS

- Product catalog, pricing, tax rates, store configuration — all editable via `nks-web` admin panel
- No redeploy needed for content changes
- Price history is preserved — new price creates a new `product_prices` row with `effective_from` timestamp, never overwrites the old row

---

## 7. Backend Engineering Standards

### Layer Structure

```
Controller  →  Service  →  Repository  →  Database (Drizzle)
```

- **Controllers**: Route handling, DTO parsing, guard application, response formatting only. Zero business logic.
- **Services**: All business logic. Depend on repositories, not on other controllers.
- **Repositories**: All database queries. Return domain objects, not raw DB rows. No business logic.

### Module Structure

```
modules/sales/
├── sales.module.ts
├── sales.controller.ts
├── sales.service.ts
├── sales.repository.ts
├── dto/
│   ├── create-sale.dto.ts
│   └── sale-response.dto.ts
├── entities/
│   └── sale.entity.ts
└── sales.spec.ts
```

### Core NestJS Patterns

**Guards** — authentication and role enforcement, applied at controller class or method level:
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('manager', 'store_admin')
```

**Interceptors** — applied globally:
- `LoggingInterceptor`: logs request method, path, userId, requestId, duration
- `TransformInterceptor`: wraps all responses in the standard envelope
- `TimeoutInterceptor`: enforces 30-second request timeout

**Filters** — global exception filter catches all unhandled exceptions and formats them into the standard error envelope. Never expose stack traces in production responses.

**Pipes** — `ZodValidationPipe` applied globally. All incoming DTOs validated before reaching the controller method.

### API Rules

- Backend is source of truth for all business rules — never trust client-derived calculations
- Price at time of sale is validated against server records
- Discount limits are enforced server-side (e.g. cashier cannot exceed 10% without manager approval)
- Shift totals are always computed by the server using `server_received_at`, never accepted from the device

---

## 8. Frontend Architecture

### Mobile (`nks-mobile` — Expo / React Native)

**Navigation**: Expo Router (file-based routing). Route groups:
```
app/
├── (auth)/          ← login, device registration
├── (pos)/           ← checkout, cart, barcode scanner
├── (shift)/         ← open shift, close shift, cash count
├── (reports)/       ← sales history, inventory view
└── (settings)/      ← device settings, profile
```

**Design System**: Always use `@nks/mobile-theme` tokens and `@nks/mobile-ui-components` components. See `docs/libs-mobile.md` for the full rules.

**State Management**:
- Server state (API responses): RTK Query or TanStack Query — normalized cache, automatic background refetch
- Local/offline state: WatermelonDB reactive queries — components observe database changes directly
- UI state (modals, form state): React Hook Form for forms, local `useState` for transient UI

**Forms**: All forms use `react-hook-form` with Zod schema validation. Never use uncontrolled inputs.

**Styling**: `styled-components/native` with `@nks/mobile-theme` tokens. Template literal syntax only inside `libs-mobile`. No hardcoded colors or spacing values. See `docs/libs-mobile.md` §5.

**i18n**: All user-facing strings via `@nks/mobile-i18n` or `@nks/common-i18n`. No raw string literals in JSX.

---

### Web Admin (`nks-web` — Next.js)

**Routing**: App Router (`app/` directory). Route groups:
```
app/
├── (auth)/          ← admin login
├── (dashboard)/     ← overview, KPIs
├── (products)/      ← product/category/pricing CRUD
├── (inventory)/     ← stock management, alerts
├── (sales)/         ← sales history, receipts
├── (reports)/       ← shift reports, P&L, tax summaries
├── (stores)/        ← store/device/staff management
└── (settings)/      ← admin settings, roles
```

**UI Components**: `@nks/web-ui-components` (shadcn-based, Tailwind CSS v4). All reusable components live in the lib, not in `app/`.

**Styling**: Tailwind CSS v4 utility classes. `class-variance-authority` (CVA) for variant-based component APIs. `tailwind-merge` + `clsx` for conditional class merging.

**State Management**:
- Server state: TanStack Query (React Query) — all API calls, cache, optimistic updates
- Client state: Zustand for global UI state (sidebar, modals, active store context)

**Data Fetching**: Server Components for initial page data (SEO + performance). Client Components only when interactivity is required.

**i18n**: All strings via `@nks/web-i18n` or `@nks/common-i18n`.

---

## 9. Data Handling & Serialization

### Standard Response Format

```typescript
// Success
{
  "status": "success",
  "message": "Products retrieved successfully",
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 342, "totalPages": 18 }
}

// Error
{
  "status": "error",
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "errors": [{ "field": "price", "message": "Must be a positive number" }]
}
```

### Rules

- All list endpoints return paginated responses — no endpoint returns an unbounded array
- All decimal values (prices, totals) serialized as strings in JSON to avoid float precision errors. Client parses with `Decimal.js` or equivalent
- All timestamps returned as ISO 8601 strings in UTC
- All IDs are UUIDs as strings
- Null fields are included explicitly, never omitted (easier client parsing)
- `data` is always an object. For lists: `data: { items: [...] }`, not `data: [...]`

### DTO Typing

All DTOs are Zod schemas shared from `libs-common` where mobile and web consume the same contract:
```typescript
// libs-common/src/dto/sale.dto.ts
export const CreateSaleDto = z.object({ ... });
export type CreateSaleDto = z.infer<typeof CreateSaleDto>;
```

---

## 10. Error, Loading & UX States

### Mobile

Every screen that loads data must implement all four states:
- **Loading**: `SkeletonLoader` from `@nks/mobile-ui-components`
- **Empty**: `NoDataContainer` with contextual message and action button
- **Error**: Inline error with retry button — no full-screen crash for recoverable errors
- **Success**: The actual content

**Error boundaries**: One top-level `ErrorBoundary` for unrecoverable crashes with a restart prompt. Feature-level boundaries around major screens.

**Global error handler**: All API errors flow through a central handler that distinguishes:
- `401` → trigger token refresh → retry once → else redirect to login
- `429` → show rate-limit banner, pause requests for backoff duration
- `5xx` → show "Server issue, will retry" banner, queue retry

### Web

Same four states required on every data-fetching component. TanStack Query `isLoading`, `isError`, `isEmpty` states mapped to consistent UI components.

**Toast notifications** for all mutation feedback (create, update, delete). Never use alert dialogs for non-destructive operations.

**Optimistic updates** on toggle operations (e.g. product active/inactive). Rollback on error.

### Backend

- Never return `500` with implementation details. Log the full error with `requestId`, return generic message to client.
- Validation errors always include `field` names so the frontend can map errors to form fields.
- `requestId` header returned on every response for cross-service tracing.

---

## 11. Performance Strategy

### Mobile

- **WatermelonDB lazy loading**: Never load full product catalog into memory. Use indexed queries with `limit`.
- **FlatList optimization**: `FlatListScaffold` from `@nks/mobile-ui-components` handles `keyExtractor`, `getItemLayout`, `removeClippedSubviews`, `windowSize` tuning.
- **Image optimization**: Expo Image with memory + disk cache. Thumbnails only in list views. Full image on demand.
- **Bundle splitting**: Expo Router handles route-based code splitting automatically.
- **Barcode scanner**: Camera initialized lazily only when scanner screen is active.

### Web

- **Server Components first**: Fetch data in Server Components. Use Client Components only for interactivity. Minimize the JS bundle sent to the browser.
- **Next.js Image**: All images through `<Image>` component with explicit `width` and `height`.
- **Route-based code splitting**: Automatic via App Router.
- **Table virtualization**: Large data tables (sales history, inventory) use `@tanstack/react-virtual`.

### Backend

- **Query optimization**: All queries reviewed with `EXPLAIN ANALYZE` before production. No N+1 queries.
- **Index usage**: All WHERE clauses on non-PK columns must have a corresponding index.
- **Pagination enforced**: Services never return unbounded result sets.
- **Response size control**: Large payloads (reports) support streaming or chunked responses.
- **Caching**: Frequently-read, rarely-changed data (product catalog delta, tax rates) cached with Redis. Cache TTL matches the mobile device cache TTL (4 hours). Cache invalidated on admin update.

---

## 12. Observability & Monitoring

### Structured Logging (Pino)

Every log entry includes:
```json
{
  "level": "info",
  "time": "2026-03-20T10:00:00.000Z",
  "requestId": "uuid",
  "userId": "uuid",
  "storeId": "uuid",
  "method": "POST",
  "path": "/api/v1/sync/events",
  "statusCode": 200,
  "duration": 45,
  "msg": "Sync events processed"
}
```

Log levels:
- `info`: Normal operation, every request
- `warn`: Business rule violations, retries, slow queries (>500ms)
- `error`: Unexpected failures, 5xx responses, DEAD outbox events
- `debug`: Development only (never enabled in production)

### Metrics to Monitor

| Metric | Alert Threshold |
|---|---|
| API p99 latency | > 2000ms |
| Sync endpoint error rate | > 1% |
| DEAD outbox events | > 0 (any is an alert) |
| Queue backlog (PENDING events) | > 500 per device |
| Negative inventory | > 0 (alert per product) |
| Device clock drift | > 5 minutes |
| DB query time | > 500ms |
| Active WebSocket connections | Informational |

### Tools

- **Centralized logging**: Forward Pino JSON logs to a log aggregation service (e.g. Loki, Datadog, or CloudWatch).
- **APM**: Instrument with OpenTelemetry. Trace spans from HTTP request through service → repository → DB query.
- **Alerting**: PagerDuty / Slack integration for `error`-level events and threshold breaches.
- **Health endpoint**: `GET /health` returns `{ status: "ok", db: "ok", version: "x.x.x" }`. Used by load balancer and mobile connectivity probe.

---

## 13. Realtime Strategy

### When to Use WebSockets vs Polling

| Use Case | Approach | Reason |
|---|---|---|
| Admin dashboard — live sale feed | WebSocket | Low latency, push-based |
| Admin dashboard — inventory alerts | WebSocket | Immediate notification |
| Mobile connectivity probe | HTTP polling (10s interval) | Navigator.onLine is unreliable |
| Mobile sync status | WatermelonDB reactive query | Reactive to local DB writes |
| Report data refresh | HTTP polling (60s) | Low frequency, no need for persistent socket |

### WebSocket Implementation

**Event naming convention**: `domain:action` — e.g. `sale:created`, `inventory:negative`, `shift:closed`, `device:sync_complete`

**Channels / Rooms**: Every WebSocket client joins a room scoped to their `store_id`. Admin clients join all stores. Never broadcast to all connected clients without store filtering.

**Reconnection logic**: Exponential backoff starting at 1s, max 30s. Retry indefinitely while user is authenticated. Show "Reconnecting..." badge in UI after first failed attempt.

**Acknowledgement**: All critical events (inventory alerts, DEAD outbox notifications) use acknowledgement pattern — server retransmits until the client acknowledges receipt.

**Fallback**: If WebSocket fails after 3 reconnection attempts, fall back to 30-second polling for that session.

---

## 14. CI/CD & Deployment

### Environments

| Environment | Branch | Purpose |
|---|---|---|
| `development` | `dev` | Local development + integration testing |
| `staging` | `staging` | QA, UAT, pre-release validation |
| `production` | `main` | Live traffic |

### Pipeline (per app)

```
Push / PR opened
  → Lint (ESLint + Prettier check)
  → Type check (tsc --noEmit)
  → Unit tests (Jest)
  → Integration tests
  → Build artifact
  → [On merge to staging] → Deploy to staging
  → [On merge to main]    → Run migrations → Deploy to production
```

### Rules

- No direct pushes to `main` or `staging`. All changes via PRs.
- PRs require at least one approval + all CI checks passing.
- Migrations run before server code deployment, never after.
- Feature flags via environment config — new features gated behind flags during rollout.
- **Rollback strategy**: Every deployment is containerized. Rollback = redeploy the previous image tag. Migration rollback scripts are tested in staging before production deployment.
- Artifacts are versioned with git SHA. `version` field in `/health` response reflects the deployed SHA.

### Build & Run Commands

```bash
# Root (monorepo)
pnpm install              # Install all dependencies
pnpm dev                  # Run all apps in dev mode (parallel)
pnpm build                # Build all apps
pnpm test                 # Run all tests

# Backend
pnpm --filter nks-backend dev
pnpm --filter nks-backend build
pnpm --filter nks-backend test

# Mobile
pnpm --filter nks-mobile start      # Expo dev server
pnpm --filter nks-mobile build:ios
pnpm --filter nks-mobile build:android

# Web
pnpm --filter nks-web dev
pnpm --filter nks-web build

# Database
pnpm --filter nks-backend db:migrate     # Run pending migrations
pnpm --filter nks-backend db:seed        # Seed development data
pnpm --filter nks-backend db:flush       # Wipe and reseed (dev only)
```

---

## 15. Testing Strategy

### Test Types

| Type | Scope | Tool | Location |
|---|---|---|---|
| Unit | Single function / service method | Jest | `*.spec.ts` alongside source |
| Integration | Module + DB | Jest + real PostgreSQL | `test/` folder |
| E2E (API) | Full HTTP request cycle | Supertest | `test/` folder |
| E2E (Mobile) | Critical user flows | Detox | `apps/nks-mobile/e2e/` |

### Rules

- **Mock external services only**: 3rd-party APIs (payment gateways, SMS) are mocked. Internal modules are tested with real implementations where possible.
- **No mocking the database in integration tests**: Integration tests use a real PostgreSQL test database (Docker). Mocked DB tests give false confidence.
- **Test data**: Each test seeds its own data. Tests never depend on order or shared state.
- **Critical E2E flows to always cover**:
  - Checkout flow online
  - Checkout flow simulating offline (skip network in WatermelonDB test)
  - Outbox drain — verify idempotency (send same event twice, verify single sale in DB)
  - Negative inventory — verify sale is not blocked, alert is created
  - Shift close — verify blocked while queue is non-empty

### Coverage Targets

| Layer | Minimum Coverage |
|---|---|
| Services (business logic) | 80% |
| Controllers | 60% (route + guard tests) |
| Repositories | Covered by integration tests |
| Sync module | 90% (critical path) |

---

## 16. Data Safety & Reliability

### Backup Strategy

- Automated daily PostgreSQL snapshots retained for 30 days
- Point-in-time recovery (PITR) enabled — WAL archiving to object storage
- Backups tested monthly via restore drill into a staging database

### Data Archival

- Sales older than 2 years moved to archive tables with `_archive` suffix
- Archived data remains queryable but excluded from operational indexes
- `audit_log` is never archived — retained indefinitely

### Failure Recovery

- If a device's outbox has DEAD events, an admin intervention flow is provided in `nks-web` to view the event payload, resolve the conflict, and either re-queue or dismiss
- If the server processes a duplicate idempotency key, the cached response is returned — the duplicate is logged but no alert is raised
- If PostgreSQL is unavailable, the backend returns `503` with `Retry-After` header. Mobile devices continue operating offline without interruption.

---

## 17. Failure & Resilience Design

### API Retries (Mobile)

Outbox retry schedule with jitter:

| Attempt | Base Delay | With ±20% Jitter |
|---|---|---|
| 1 | 0s | Immediate |
| 2 | 5s | 4–6s |
| 3 | 30s | 24–36s |
| 4 | 5min | 4–6min |
| 5 | 30min | 24–36min |
| 6 | 1hr | 48–72min |
| 7–10 | 24hr | 19–29hr |
| 10+ | DEAD | Admin intervention required |

### Timeouts

- Mobile outbox HTTP request timeout: 10 seconds
- Connectivity probe timeout: 3 seconds
- Backend service method timeout: 25 seconds (NestJS interceptor)
- Database query timeout: 10 seconds (Drizzle config)

### Partial Failures

- Outbox batch sends all events for one sale as a single POST. If the POST fails, no events for that sale are marked SYNCED. Retry the whole batch.
- If one sale in a 5-parallel-worker round fails, the other 4 continue. The failed sale retries independently on the next cycle.

### Idempotent APIs

All write endpoints that can be retried must be idempotent:
- `POST /api/v1/sync/events` — idempotency by `event.id` UUID
- `POST /api/v1/payments/process` — idempotency by `payment_reference` UUID
- `POST /api/v1/shifts/close` — idempotent (closing an already-closed shift is a no-op)

### Circuit Breakers

If the sync endpoint fails 5 consecutive times in 60 seconds from a given device, the mobile app enters `DEGRADED` state and slows polling to every 60 seconds until one request succeeds.

---

## 18. Configuration Management

### Environment Variables

```bash
# Backend (.env)
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
HMAC_SECRET=...
BETTER_AUTH_SECRET=...
REDIS_URL=redis://...
PORT=3000
NODE_ENV=production

# Mobile (app.config.ts / .env.local)
EXPO_PUBLIC_API_URL=https://api.nks.app
EXPO_PUBLIC_ENVIRONMENT=production

# Web (.env.local)
NEXT_PUBLIC_API_URL=https://api.nks.app
```

### Rules

- No secrets in code, no secrets in git, no secrets in Docker images
- Secrets injected at runtime via environment or secret manager
- `NestJS ConfigModule` loaded globally, validated with Zod on startup — app fails fast if a required variable is missing
- Feature flags as boolean environment variables: `FEATURE_LOYALTY_ENABLED=false`

---

## 19. Documentation Standards

### What Must Be Maintained

| Doc | Location | Tool |
|---|---|---|
| Architecture & system design | `docs/prd/` | Markdown |
| API reference | `/api/docs` | Swagger (auto-generated) |
| Mobile library guide | `docs/libs-mobile.md` | Markdown |
| ADR (Architecture Decision Records) | `docs/adr/` | Markdown (one file per decision) |
| Onboarding guide | `docs/onboarding.md` | Markdown |

### ADR Format

```markdown
# ADR-001: Title

**Date**: YYYY-MM-DD
**Status**: Accepted | Deprecated | Superseded by ADR-XXX

## Context
Why did we need to make this decision?

## Decision
What did we decide?

## Consequences
What are the trade-offs?
```

### Documentation Is Code

- PRs that introduce new endpoints must update Swagger annotations
- PRs that change architectural decisions must add or update an ADR
- PRs that add new `libs-mobile` components must update the component catalogue in `docs/libs-mobile.md`

---

## 20. Definition of Done

A feature is complete **only** when all of the following are true:

- [ ] Code implemented and peer-reviewed
- [ ] API endpoint documented in Swagger (if applicable)
- [ ] Unit tests written — all passing
- [ ] Integration or E2E tests written for critical flows
- [ ] All four UI states handled: loading, empty, error, success
- [ ] Error handling in place for all failure modes
- [ ] Structured logs added at appropriate levels
- [ ] No hardcoded secrets, credentials, or environment-specific values
- [ ] No TypeScript `any` without documented justification
- [ ] PR approved and merged to target branch
- [ ] Staging deploy verified by QA or developer
- [ ] Relevant documentation updated (Swagger, ADR, component catalogue)

---

## 21. Final Pre-Dev Checklist

Before writing the first line of feature code:

- [ ] Architecture diagram created and reviewed by team
- [ ] PostgreSQL schema finalized and reviewed
- [ ] Auth strategy and RBAC roles defined
- [ ] API contracts documented (routes, request/response shapes)
- [ ] Mobile UI components identified — use existing components before creating new ones
- [ ] Web UI components identified — use `@nks/web-ui-components` before building new
- [ ] Deployment pipeline configured for target environment
- [ ] Migration scripts written and tested on staging
- [ ] Feature flag created if doing phased rollout
- [ ] Risks identified (edge cases from §1 reviewed)
- [ ] Offline sync impact assessed — does this feature introduce new outbox event types?
- [ ] Performance impact assessed — does this feature add a query that needs an index?

---

## Core Principle

> Build systems that are easy to extend, debug, and scale — not just easy to start.

The POS must work in a store with zero internet connectivity for a full 8-hour shift and lose zero sales. Every architectural decision — the outbox pattern, delta events, dual timestamps, idempotency keys, device binding — exists to protect the integrity of every transaction for every cashier in every store.
