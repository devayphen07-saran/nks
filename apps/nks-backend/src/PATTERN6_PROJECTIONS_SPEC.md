# Pattern 6: Projections & Read Model Optimization Specification

**Document Version:** 1.0
**Last Updated:** 2026-04-29
**Status:** Production-Ready (8.5/10 readiness)

## Overview

This document specifies the Ayphen Pattern 6 implementation for NKS backend: **Projections & Read Model Optimization**. It defines how the codebase transforms entities into wire-format DTOs, uses DB-level column projection, paginates list endpoints, and caches frequently-accessed reference data.

NKS is already strong on projections — most patterns are in place. This guide documents them and identifies the targeted improvements.

---

## 1. Layered Projection Architecture

NKS separates projection responsibilities into 3 layers:

```
┌─────────────────────────────────────────────────────────────┐
│  Controller     ← receives Query DTO, returns Response DTO  │
└─────────────────────────────────────────────────────────────┘
              ↓                                  ↑
┌─────────────────────────────────────────────────────────────┐
│  Query Service ← orchestrates fetching + mapping            │
└─────────────────────────────────────────────────────────────┘
              ↓                                  ↑
┌─────────────────────────────────────────────────────────────┐
│  Mapper        ← Entity row → Response DTO (pure function)  │
└─────────────────────────────────────────────────────────────┘
              ↓                                  ↑
┌─────────────────────────────────────────────────────────────┐
│  Repository    ← DB-level .select({ }) projection           │
└─────────────────────────────────────────────────────────────┘
```

**Responsibility split:**
- **Repository:** Selects only the columns needed (`select({ id, name, ... })`)
- **Mapper:** Converts row shape to wire-format DTO (pure function, no DB)
- **Query Service:** Orchestrates fetching, applies pagination, calls mapper
- **Controller:** Validates input, returns Response DTO (wrapped by interceptor)

---

## 2. DB-Level Column Projection

**Pattern:** Always use explicit `.select({ })` in repositories. Never fetch full rows when only a subset is needed.

### 2.1 Simple Projection
```typescript
// repositories/lookups.repository.ts
const lookupValueSelect = {
  id: lookup.id,
  guuid: lookup.guuid,
  code: lookup.code,
  label: lookup.label,
  description: lookup.description,
  isActive: lookup.isActive,
  isHidden: lookup.isHidden,
  isSystem: lookup.isSystem,
  sortOrder: lookup.sortOrder,
  createdAt: lookup.createdAt,
  updatedAt: lookup.updatedAt,
};

async getValuesByType(typeCode: string): Promise<LookupValueRow[]> {
  return this.db
    .select(lookupValueSelect)
    .from(lookup)
    .innerJoin(lookupType, eq(lookup.lookupTypeFk, lookupType.id))
    .where(and(...conditions))
    .orderBy(lookup.sortOrder);
}
```

**Why:** Reduces network bytes, parser CPU, and serialization overhead. Smaller payloads = faster query execution.

### 2.2 Computed Columns at DB Level
```typescript
// repositories/stores.repository.ts
async findActiveWithOwnership(userId: number, storeId: number) {
  const [row] = await this.db
    .select({
      id: schema.store.id,
      guuid: schema.store.guuid,
      isOwner: sql<boolean>`(${schema.store.ownerUserFk} = ${userId})`,
    })
    .from(schema.store)
    .where(and(...conditions));
  return row ?? null;
}
```

**Why:** Pushing computed values to the DB avoids transferring raw data only to discard it.

### 2.3 Multi-Join Projection
```typescript
// repositories/roles.repository.ts
async findUserRoles(userId: number): Promise<UserRoleWithStoreRow[]> {
  return this.db
    .select({
      roleId: userRoleMapping.roleFk,
      roleCode: schema.roles.code,
      isSystem: schema.roles.isSystem,
      storeFk: userRoleMapping.storeFk,
      storeGuuid: schema.store.guuid,
      storeName: schema.store.storeName,
      isPrimary: userRoleMapping.isPrimary,
    })
    .from(userRoleMapping)
    .innerJoin(schema.roles, eq(userRoleMapping.roleFk, schema.roles.id))
    .leftJoin(schema.store, eq(userRoleMapping.storeFk, schema.store.id))
    .where(this.activeRoleMappingCondition(userId));
}
```

**Why:** A single query with joins beats N+1 queries by orders of magnitude.

---

## 3. Mapper Pattern

**Convention:** Mappers are **classes with static methods**. They are pure functions — no DB access, no side effects, no async.

### 3.1 Basic Mapper Template
```typescript
// mapper/stores.mapper.ts
import type { UserStoreRow } from '../repositories/stores.repository';

export interface StoreDto {
  guuid: string;
  storeName: string;
  storeCode: string | null;
  isApproved: boolean;
  isOwner: boolean;
  createdAt: string;
}

export class StoresMapper {
  static buildStoreDto(row: UserStoreRow): StoreDto {
    return {
      guuid: row.guuid,
      storeName: row.storeName,
      storeCode: row.storeCode,
      isApproved: row.storeStatus === 'ACTIVE' && row.isVerified,
      isOwner: row.isOwner,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
```

**Rules:**
- ✅ Static methods (`static buildXyzDto(row): Dto`)
- ✅ Naming: `buildXyzDto` for single, `buildXyzList` for arrays
- ✅ Pure functions (no DB, no async, no side effects)
- ✅ Convert dates to ISO strings (immutable serialization)
- ✅ Compute derived booleans at mapper level (e.g., `isApproved`)
- ❌ No `this` references — purely transformational
- ❌ No nested DB lookups

### 3.2 Hierarchical Tree Mapper
```typescript
// mapper/role.mapper.ts (excerpt)
export class RoleMapper {
  static buildEntityPermissionTree(rows: PermissionRow[]): EntityPermissionNode[] {
    // Build flat map first (O(n))
    const byCode = new Map<string, EntityPermissionNode>();
    for (const row of rows) {
      byCode.set(row.code, { ...row, children: [] });
    }
    // Link children to parents (O(n))
    const roots: EntityPermissionNode[] = [];
    for (const node of byCode.values()) {
      const parent = node.parentCode ? byCode.get(node.parentCode) : null;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    return roots;
  }
}
```

**Why:** Tree construction stays in the mapper, not the query service. Keeps query services thin.

### 3.3 List Mapper Helper
```typescript
// Common pattern — array map at the call site
const dtos = rows.map(StoresMapper.buildStoreDto);
```

**Note:** No need for `buildList()` static — `Array.map(Mapper.buildXyzDto)` reads naturally.

---

## 4. Pagination Pattern

NKS uses a typed `PaginatedResult<T>` class wrapped at the response layer.

### 4.1 PaginatedResult Class
```typescript
// common/utils/paginated-result.ts
export class PaginatedResult<T> {
  readonly data: T[];
  readonly meta: PaginationMeta;
  constructor(data: T[], meta: PaginationMeta) {
    this.data = data;
    this.meta = meta;
  }
}

export function paginated<T>(opts: {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}): PaginatedResult<T> {
  // ...returns new PaginatedResult(...)
}
```

**Why a class (not interface):** TransformInterceptor uses `instanceof PaginatedResult` to decide whether to flatten meta into the envelope. No magic `__paginated` flag needed.

### 4.2 Usage in Query Service
```typescript
async listStatuses(opts: GetAllStatusesQueryDto): Promise<PaginatedResult<StatusResponse>> {
  const { rows, total } = await this.repository.findPage(opts);
  return paginated({
    items: rows.map(StatusMapper.buildStatusDto),
    page: opts.page,
    pageSize: opts.pageSize,
    total,
  });
}
```

**Repository contract:** `findPage()` returns `{ rows, total }` — count + page in one call (or two parallel calls via `Promise.all`).

---

## 5. Read-Model Caching

NKS uses **application-level in-memory caches** for frequently-read reference data. No Redis dependency — caches refresh on module init or when data changes.

### 5.1 Module-Init Cache (Reference Data)
**Pattern:** Load on startup, refresh on writes. Best for small, stable data sets (entity codes, role codes, country codes).

```typescript
// repositories/role-permissions.repository.ts
@Injectable()
export class PermissionsRepository extends BaseRepository implements OnModuleInit {
  private entityCodeSet = new Set<string>();

  async onModuleInit(): Promise<void> {
    await this.refreshEntityCache();
  }

  async refreshEntityCache(): Promise<void> {
    const rows = await this.db
      .select({ code: entityType.code })
      .from(entityType)
      .where(and(eq(entityType.isActive, true), isNull(entityType.deletedAt)));
    this.entityCodeSet = new Set(rows.map((r) => r.code));
  }

  isKnownEntityCode(code: string): boolean {
    return this.entityCodeSet.has(code);
  }
}
```

**Trade-offs:**
- ✅ Zero per-request DB cost
- ✅ O(1) lookup
- ⚠️ Stale until `refreshEntityCache()` called (must hook into write operations)
- ⚠️ Per-process — won't propagate to other instances (acceptable for read-mostly data)

### 5.2 TTL Cache (Per-Request Computation)
**Pattern:** Lazy-populate, time-bound. Best for expensive computations that are user-specific.

```typescript
// permission-evaluator.service.ts
class PermissionCache {
  private readonly store = new Map<string, CacheEntry>();
  private readonly roleIdToKeys = new Map<number, Set<string>>();

  constructor(private readonly ttlMs: number, private readonly maxSize = 5_000) {}

  get(key: string): boolean | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.removeFromIndex(key);
      return undefined;
    }
    return entry.value;
  }

  // Secondary index: roleId → set of keys, allows O(k) eviction.
  invalidateForRole(roleId: number): void {
    const keys = this.roleIdToKeys.get(roleId);
    if (!keys) return;
    for (const key of keys) this.store.delete(key);
    this.roleIdToKeys.delete(roleId);
  }
}
```

**Trade-offs:**
- ✅ Bounded memory (maxSize eviction)
- ✅ Lazy eviction (no background timer)
- ✅ Selective invalidation via secondary index
- ⚠️ Cold cache after invalidation (next read pays full cost)

### 5.3 When to Cache vs Query

| Data Profile | Pattern | Example |
|--------------|---------|---------|
| Small, stable, public reads | OnModuleInit cache | Entity codes, country list |
| Per-user, expensive compute | TTL cache | Permission evaluation |
| Large, write-heavy | Don't cache | User sessions, audit logs |
| Per-request, simple | Don't cache | Session lookups (already O(1)) |

---

## 6. N+1 Avoidance

NKS avoids N+1 patterns via three techniques:

### 6.1 Joined Projections
```typescript
// One query with JOIN, not N queries by ID
const rolesWithStores = await this.db
  .select({ ...roleColumns, storeName: schema.store.storeName })
  .from(schema.roles)
  .leftJoin(schema.store, eq(schema.roles.storeFk, schema.store.id));
```

### 6.2 Promise.all Parallelization
```typescript
// role-query.service.ts
const [role, permissions, routes, totalRoles] = await Promise.all([
  this.rolesRepository.findByGuuid(guuid),
  this.permissionsRepository.findEntityPermissions(roleId),
  this.routesRepository.findRoutePermissions(roleId),
  this.rolesRepository.count(),
]);
```

### 6.3 Bulk Operations
```typescript
// role-permissions.repository.ts
async bulkUpsert(roleId: number, entries: BulkUpsertEntry[], modifiedBy: number) {
  // Single multi-row INSERT ... ON CONFLICT, not N upserts.
}
```

**Anti-pattern to avoid:**
```typescript
// ❌ DON'T DO THIS — N+1 query
for (const userId of userIds) {
  const user = await this.usersRepository.findById(userId);
  // ...
}

// ✅ DO THIS — single query
const users = await this.usersRepository.findManyByIds(userIds);
```

---

## 7. List vs Detail DTOs

For resources with expensive joins (e.g., roles with permission trees), provide separate DTOs for list and detail views.

### 7.1 List DTO (Lightweight)
```typescript
export interface RoleResponseDto {
  guuid: string;
  name: string;
  code: string;
  description: string | null;
  isSystem: boolean;
}
```

### 7.2 Detail DTO (Full Tree)
```typescript
export interface RoleDetailResponseDto extends RoleResponseDto {
  entityPermissions: EntityPermissionNode[];  // hierarchical tree
  routePermissions: RoutePermission[];        // route-level access
  store: { guuid: string; name: string } | null;
}
```

**Rule of thumb:** If the list endpoint requires a JOIN that's not needed for the row fingerprint, push it to the detail endpoint.

---

## 8. Computed Fields & Derived State

Place derived fields where they're cheapest to compute:

| Field Type | Where to Compute | Why |
|------------|------------------|-----|
| Boolean from row data (`isApproved`) | Mapper | No extra query, runs once per row |
| Aggregate from related tables (`totalUsers`) | Repository (SQL) | Use SQL `count()` not in-memory loop |
| Permission check (`canEdit`) | Query service (cached) | Multiple inputs, expensive |
| Localized strings | Controller / interceptor | User locale unknown to mapper |

---

## 9. Production Inventory

### 9.1 Mappers (13 in production)
| Path | Methods |
|------|---------|
| `iam/users/mapper/user.mapper.ts` | `buildUserDto` |
| `iam/roles/mapper/role.mapper.ts` | `buildRoleDto`, `buildRoleDetailDto`, `buildEntityPermissionTree`, `mergePermissions` |
| `iam/auth/mapper/session.mapper.ts` | `buildSessionDto` |
| `iam/routes/mapper/route.mapper.ts` | `buildRouteDto`, `buildRouteTree` |
| `organization/stores/mapper/stores.mapper.ts` | `buildStoreDto` |
| `compliance/audit/mapper/audit.mapper.ts` | `buildAuditLogDto` |
| `reference-data/lookups/mapper/lookups.mapper.ts` | `buildCountryDto`, `buildCommunicationTypeDto`, `buildCurrencyDto`, `buildVolumeDto` |
| `reference-data/status/mapper/status.mapper.ts` | `buildStatusDto` |
| `reference-data/entity-status/mapper/entity-status.mapper.ts` | `buildEntityStatusDto` |
| `reference-data/location/location.mapper.ts` | `buildStateDto`, `buildDistrictDto`, `buildPincodeDto` |
| `sync/mapper/sync-data.mapper.ts` | `buildRouteChange`, `buildStateChange`, `buildDistrictChange` |

### 9.2 Read-Model Caches (in production)
- `PermissionsRepository.entityCodeSet` — entity type codes (refreshed on init)
- `PermissionEvaluatorService.cache` — permission evaluation TTL cache (5min)
- `auth-utils.service.ts` system role ID cache

---

## 10. Implementation Checklist

When adding a new query endpoint:

- [ ] Repository uses explicit `.select({ })` — no `db.query.table.findMany()` for hot paths
- [ ] Mapper exists as `class XyzMapper` with `static buildXyzDto`
- [ ] Mapper is a pure function (no async, no DB, no `this`)
- [ ] Date fields converted to ISO strings in mapper
- [ ] List endpoint returns `PaginatedResult<T>` via `paginated({...})` helper
- [ ] Detail endpoints use richer DTO when joins are expensive
- [ ] Multiple parallel queries use `Promise.all` (not sequential await)
- [ ] No DB queries inside `for` loops (use bulk fetch by IDs instead)
- [ ] Computed booleans (`isApproved`, `isOwner`) live in mapper, not query service
- [ ] If reference data is small + stable → consider OnModuleInit cache
- [ ] If computation is per-user + expensive → consider TTL cache
- [ ] Cache invalidation hooked into corresponding command service

---

## 11. Design Principles

1. **Project at the source.** DB selects only the columns needed.
2. **Mappers are pure.** No async, no DB, no side effects.
3. **One query per request — ideally.** Use joins, not loops.
4. **Cache reference data, not write paths.** Reference codes ≈ great. Sessions ≈ never.
5. **Class-based PaginatedResult.** Lets interceptor identify via `instanceof`.
6. **Hierarchical data → tree in mapper.** Query service stays thin.
7. **List vs Detail.** Don't make list views pay for detail joins.
8. **Compute derivations once.** Either at DB (SQL) or at mapper (boolean) — not in controller.

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-29 | Initial specification — 13 mappers cataloged, 4 caching patterns, 3-layer architecture |
