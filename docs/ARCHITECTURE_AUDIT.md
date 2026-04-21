# NKS Backend — Senior Architect Audit

**Date:** 2026-04-20
**Auditor:** Senior Architect Framework
**Scope:** Full architectural review of `apps/nks-backend/src/`

---

## Architecture Scorecard

| Area | Score | Status |
|---|---|---|
| Module structure | 9/10 | Excellent bounded contexts |
| Layering discipline | 8/10 | Controller > Service > Repo |
| Dependency direction | 9/10 | Acyclic, documented |
| Schema design | 9/10 | Base entities, audit-safe |
| Transaction management | 6/10 | Inconsistent |
| Cross-cutting concerns | 7/10 | Global guards missing |
| Multi-tenancy | 5/10 | No RLS, guard-dependent |
| Event-driven design | 1/10 | Nonexistent |
| CQRS readiness | 2/10 | Read/write intermingled |
| Observability hooks | 6/10 | Logging only |
| Domain modeling | 4/10 | Anemic services |
| Scalability (horizontal) | 6/10 | Shared DB, no message bus |
| **OVERALL** | **6.2/10** | **Strong foundation, tactical gaps** |

---

## Part 1: Architectural Topography

### Current Layered View

```
EDGE LAYER
  Helmet | CORS | Cookie-Parser | CSRF | RequestId | Pino Logger
                           |
INTERCEPTOR CHAIN
  LoggingInterceptor > TransformInterceptor > Timeout(30s)
                           |
VALIDATION
  ZodValidationPipe (Global)
                           |
PRESENTATION LAYER (14 Controllers)
  AuthController | OtpController | StoresController
  UsersController | RolesController | AuditController ...
                           |
GUARDS (per-route, opt-in)
  AuthGuard | RBACGuard | RateLimitingGuard | OwnershipGuard
                           |
APPLICATION / ORCHESTRATION (35 Services)
  AuthFlowOrchestrator | OtpAuthOrchestrator
  PasswordAuthService | PermissionsService
                           |
DATA ACCESS (29 Repositories)
  AuthUsersRepository | SessionsRepository
  TransactionService (centralized, but bypassed 4x)
                           |
PERSISTENCE
  Drizzle ORM > PostgreSQL (67 tables, 5 base entities)
                           |
EXTERNAL
  MSG91 (SMS) | Mail (stub) | BetterAuth | S3 (optional)
```

### Observations

- Clean layering — 4-tier separation respected across 526 files
- Explicit dependency direction documented in auth.module.ts
- Edge layer is hardened (Helmet, CSRF, CORS, rate limiting)
- Guards are opt-in (every route self-declares — high risk)
- Orchestrators live in services/ (should be its own layer)
- No event/message bus (everything synchronous)
- No CQRS separation (reads and writes in same repo)
- Anemic domain (logic in services, no aggregates)

---

## Part 2: Module Graph Analysis

### Dependency Graph

```
AppModule
+-- ConfigModule (@Global)            -- Legitimate
+-- DatabaseModule (@Global)          -- Legitimate
+-- LoggerModule
+-- MailModule (@Global)              -- Questionable
+-- AuditModule (@Global)             -- Questionable
+-- AuthModule (@Global)              -- BAD: hides coupling
|   +-- AuthCoreModule
|   +-- SecurityModule
|   +-- ProvidersModule
|   +-- AuthPermissionsModule
|   +-- OtpModule
|   +-- AuthSessionModule
|   +-- AuthTokenModule
|   +-- AuthFlowsModule
|   `-- > RolesModule
+-- RolesModule
|   `-- > StoresModule
+-- StoresModule (@Global)            -- BAD: domain module globalizing
+-- UsersModule
+-- RoutesModule
+-- LookupsModule
+-- CodesModule
+-- LocationModule
+-- StatusModule
+-- EntityStatusModule
+-- SyncModule
`-- AuditModule
```

---

## Architectural Issues

### Issue #1: Global Module Abuse (HIGH)

**6 modules marked @Global():**

| Module | Verdict |
|---|---|
| ConfigModule | Legitimate |
| DatabaseModule | Legitimate |
| MailModule | Questionable (only 2-3 consumers) |
| AuditModule | Questionable (should be observer pattern) |
| AuthModule | BAD (hides coupling, breaks encapsulation) |
| StoresModule | BAD (domain module globalizing itself) |

**Consequences:**
- Hidden coupling — can't grep `imports: [StoresModule]` to find consumers
- Impossible to swap — can't extract to microservice later
- Test isolation broken — mocking requires global overrides
- Circular dep risk increased

**Fix:** Remove @Global from domain modules, require explicit imports.

---

### Issue #2: Missing Bounded Contexts (MEDIUM)

**Current:** 29 flat modules with unclear boundaries.

**Problems:**
- `users` vs `auth` boundaries unclear
- `lookups`, `codes`, `status`, `entity-status` — 4 modules for reference data
- `roles` + `routes` + `auth` are a cluster but sit as peers

**Target structure:**

```
src/
+-- contexts/
|   +-- iam/                    -- Identity & Access Management
|   |   +-- auth/
|   |   +-- users/
|   |   +-- roles/
|   |   +-- routes/
|   |   `-- iam.module.ts
|   +-- organization/           -- Multi-tenant entities
|   |   +-- stores/
|   |   +-- store-members/
|   |   `-- organization.module.ts
|   +-- reference-data/         -- Lookups, codes, status
|   |   +-- lookups/
|   |   +-- codes/
|   |   +-- location/
|   |   `-- reference-data.module.ts
|   +-- compliance/             -- Audit, GDPR, retention
|   |   +-- audit/
|   |   `-- compliance.module.ts
|   `-- sync/
|       `-- sync.module.ts
+-- shared/                     -- Cross-context primitives
|   +-- kernel/                 -- Value objects (Email, Phone, UUID)
|   +-- events/                 -- Domain events
|   `-- result/                 -- Result<T,E> types
+-- core/                       -- Infrastructure
|   +-- database/
|   +-- cache/
|   +-- queue/
|   `-- observability/
`-- common/                     -- Framework-level helpers
    +-- guards/
    +-- interceptors/
    `-- filters/
```

---

### Issue #3: TransactionService Bypassed (HIGH)

**TransactionService** created as single source of truth but bypassed in 7 locations:

| File | Line | Direct `this.db.transaction()` |
|---|---|---|
| auth-users.repository.ts | 300 | `this.db.transaction(fn)` |
| auth-users.repository.ts | 338 | `this.db.transaction(async (tx) => ...)` |
| sessions.repository.ts | 275 | `this.db.transaction(async (tx) => ...)` |
| sessions.repository.ts | 321 | `this.db.transaction(async (tx) => ...)` |
| sessions.repository.ts | 451 | `this.db.transaction(async (tx) => ...)` |
| sync.repository.ts | 134 | `this.db.transaction(fn)` |
| sync.repository.ts | 220 | `this.db.transaction(fn)` |

**Impact:** No tx name in logs, no timing, no single place to add retries/tracing.

**Fix:** Route all transactions through `TransactionService.run()`.

---

### Issue #4: No Unit of Work Pattern (MEDIUM)

**Problem:** Transaction context threaded manually via `tx?` parameter.

**Fix:** Use `AsyncLocalStorage` to auto-propagate transaction context:

```typescript
// Repository auto-uses tx if in one:
async update(userId: number, data: UpdateUser): Promise<User | null> {
  const db = this.txContext.getCurrent() ?? this.db;
  return db.update(users).set(data).where(...).returning();
}
```

---

### Issue #5: Anemic Domain Model (MEDIUM)

**Problem:** Services contain all logic. Entities have no behavior.

Business rules scattered across services:
- Account locking (5 failed attempts)
- User blocking check
- Brute-force thresholds

**Fix:** Introduce domain aggregates (e.g., `UserAccount` with `canLogin()`, `recordFailedLogin()`, `isLocked()`) that encapsulate invariants.

---

### Issue #6: Zero Event Emissions (HIGH)

**Finding:** `grep -rn "EventEmitter|@OnEvent|events.emit" src/` returns ZERO results.

**Missing events:**

| Trigger | Missing Event | Handlers Needed |
|---|---|---|
| User registers | `UserRegistered` | Welcome email, analytics, CRM sync |
| Token theft detected | `SecurityIncident` | Alert team, notify user, metrics |
| Role assigned | `RoleAssigned` | Audit log, cache invalidation |
| Session revoked | `SessionRevoked` | Device notification |

**Fix:** Install `@nestjs/event-emitter`, define typed domain events, publish from services.

---

### Issue #7: No CQRS Separation (LOW)

**Problem:** Each repository handles both reads and writes against the same model.

**Impact:** Can't scale reads independently, can't cache aggressively, session list query does 4 joins.

**Fix (lite):** Split read/write repos for critical paths (sessions, permissions). Read repos can use replicas + cache.

---

### Issue #8: Weak Multi-Tenancy Enforcement (HIGH)

**Problem:** Tenancy enforced purely by application code (guards). If developer forgets guard, query returns ALL tenants' data.

**Fix — Defense in Depth:**
1. **TenantContext** (AsyncLocalStorage) — set after AuthGuard
2. **Repository-level enforcement** — auto-scope queries via `tenantContext.get()`
3. **PostgreSQL RLS** — database-level guarantee, impossible to leak

---

### Issue #9: No Base Repository Abstraction (MEDIUM)

**Problem:** 29 repositories re-implement identical CRUD patterns. Hundreds of duplicated lines.

**Fix:** `BaseRepository<TTable>` with generic `findById()`, `create()`, `update()`, `softDelete()`, `exists()`. Concrete repos only add domain-specific queries.

---

### Issue #10: Opt-in Security (HIGH)

**Problem:** AuthGuard applied per-controller. New endpoint without `@UseGuards` = fully open.

**Fix:** Register `AuthGuard`, `RateLimitingGuard`, `RBACGuard` as `APP_GUARD`. Use `@Public()` to opt out.

---

### Issue #11: No Explicit Caching Layer (MEDIUM)

**Problem:** Hot queries hit DB on every request.

At 1000 req/sec:
- AuthGuard: 1000 user queries + 1000 role queries = 2000 q/s before business logic
- Default pool (20 connections): exhausted

**Fix:** Redis `CacheService` with `getOrLoad()` pattern for sessions, roles, permissions. Expected 95% cache hit = 20x DB load reduction.

---

### Issue #12: No Queue System (MEDIUM)

**Problem:** Email sending, audit writes, cleanup all run synchronously in-request.

**Fix:** BullMQ queues for email, audit, permissions-rebuild, cleanup. Retries + backoff + dead letter queue built-in.

---

### Issue #13: No Distributed Tracing (MEDIUM)

**Current:** Structured logging (Pino) + Request IDs only.
**Missing:** OpenTelemetry, Prometheus metrics, APM.

**Fix:** `nestjs-otel` + `@Span()` decorators + custom counters (login_total, session_created, etc.).

---

### Issue #14: No Service Extraction Seams (LOW)

**Problem:** Well-organized monolith but no extraction path. Shared schema, direct DI, no API contracts between modules.

**Fix:** Phased approach — domain events first, then context facades, then service extraction when pain justifies it.

---

## Consolidated Issue Table

| # | Issue | Severity | Effort |
|---|---|---|---|
| 1 | @Global() on AuthModule + StoresModule | HIGH | 4h |
| 2 | Flat module structure (no bounded contexts) | MEDIUM | 8-16h |
| 3 | TransactionService bypassed 7x | HIGH | 6h |
| 4 | No Unit of Work (ALS context) | MEDIUM | 6h |
| 5 | Anemic domain model | MEDIUM | 20-40h |
| 6 | No domain events | HIGH | 8h |
| 7 | No CQRS separation | LOW | 16h |
| 8 | Weak multi-tenancy (no RLS) | HIGH | 12h |
| 9 | No base repository abstraction | MEDIUM | 6h |
| 10 | Guards not APP_GUARD (opt-in) | HIGH | 4h |
| 11 | No cache layer | MEDIUM | 12h |
| 12 | No queue infrastructure | MEDIUM | 16h |
| 13 | No distributed tracing | MEDIUM | 12h |
| 14 | No service extraction seams | LOW | Ongoing |

---

## Enhancement Roadmap

### Quarter 1 — Foundation Hardening (60h)

| Week | Task | Hours |
|---|---|---|
| 1 | Critical bug fixes (previous audits) | 20h |
| 2 | Global guard registration + @Public decorators | 6h |
| 3 | TransactionService enforcement + ALS UoW | 12h |
| 4 | BaseRepository abstraction | 6h |
| 5 | Remove @Global from domain modules | 4h |
| 6 | Domain events for auth flows | 12h |

### Quarter 2 — Scalability Prep (80h)

| Week | Task | Hours |
|---|---|---|
| 1-2 | Bounded context reorganization | 16h |
| 3 | Redis cache layer + hot path caching | 12h |
| 4 | BullMQ queue infrastructure | 16h |
| 5 | OpenTelemetry + metrics | 12h |
| 6 | Multi-tenancy RLS + TenantContext | 12h |
| 7 | Buffer for fixes | 12h |

### Quarter 3 — Domain Modeling (120h)

Introduce aggregates for:
- **UserAccount** — brute force, blocking, lifecycle
- **Session** — rotation, theft, lifecycle
- **Store** — members, status, configuration
- **Role** — assignment, expiration

### Quarter 4 — CQRS + Service Extraction

- Split read/write repos for sessions + permissions
- Extract Audit service (append-only, isolated)
- Prepare Notifications service (email/SMS/push)
- Use NestJS microservices (gRPC, NATS, or Kafka)

---

## Architectural Maturity Level

```
Level 1 (Starter):              [##########]  Passed
Level 2 (Modular):              [##########]  Passed
Level 3 (Testable):             [######----]  Partial (no tests)
Level 4 (Scalable):             [####------]  Partial (no cache/queue/events)
Level 5 (Enterprise):           [##--------]  Major gaps
Level 6 (Microservice-ready):   [----------]  Not yet

Current Level: 3.5 / 6
Target Level (12 months): 5 / 6
```

---

## Strategic Recommendation

You've built a solid modular monolith. **Do NOT rush to microservices.**

Focus on:
1. **Hardening what exists** (global guards, tx enforcement, tests) — Q1
2. **Adding scalability primitives** (events, cache, queues) — Q2
3. **Enriching domain model** (aggregates, invariants) — Q3
4. **CQRS for hot paths only** when metrics justify it — Q4

Service extraction should be a natural consequence of pain, not a goal.
