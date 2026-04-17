# Sync Implementation Audit: Backend vs Mobile

**Date:** 2026-04-17  
**Status:** CRITICAL GAPS IDENTIFIED  
**Scope:** Both frontend and backend sync implementation

---

## Executive Summary

The offline sync architecture is **fully documented** but only **partially implemented**. 

### Implementation Status

| System | Coverage | Status |
|---|---|---|
| **Mobile Sync Engine** | 100% of pull/push orchestration | ✅ Complete |
| **Mobile Table Handlers** | 2/11 tables (18%) | ⚠️ Incomplete |
| **Backend Sync Endpoints** | 100% of HTTP routing | ✅ Complete |
| **Backend Pull Query** | 1/11 tables (9%) | ⚠️ Incomplete |
| **Backend Push Operations** | 0/11 tables (0%) | ❌ Missing |
| **Operation Signing** | HMAC verification | ✅ Complete |
| **Offline Session Validation** | Token + HMAC checks | ✅ Complete |

---

## Implemented Tables

### Backend: Fully Implemented

**Routes Table Only**
```
GET /sync/changes
├─ getRouteChanges(cursor, limit)
└─ returns: { changes[], nextCursor, hasMore }

POST /sync/push
├─ processPushBatch(operations)
├─ verifyOperationSignature()
├─ validateOfflineSessionSignature()
└─ processOperation() ← STUB — logs warning, skips all operations
```

### Mobile: Partially Implemented

**State & District Tables Only**
```
lib/sync/sync-table-handlers.ts
├─ state: { onUpsert, onDelete }
├─ district: { onUpsert, onDelete }
└─ SYNC_TABLES = ['state', 'district']

lib/sync/sync-engine.ts
├─ runSync() ← pulls from server but gets nothing for other tables
├─ runPullOnly() ← same issue
└─ runPushOnly() ← queues operations, but server's processOperation() is a stub
```

---

## Missing Implementations

### 9 Tables Need to Be Synced

| Table | Backend Pull | Mobile Handler | Priority |
|---|---|---|---|
| **routes** | ✅ Implemented | ❌ Missing | CRITICAL |
| **stores** | ❌ Missing | ❌ Missing | CRITICAL |
| **status** | ❌ Missing | ❌ Missing | CRITICAL |
| **entity_status_mapping** | ❌ Missing | ❌ Missing | CRITICAL |
| **entity_permissions** | ❌ Missing | ❌ Missing | CRITICAL |
| **tax_rate_master** | ❌ Missing | ❌ Missing | CRITICAL |
| **store_operating_hours** | ❌ Missing | ❌ Missing | CRITICAL |
| **state** | ❌ Missing | ✅ Implemented | HIGH |
| **district** | ❌ Missing | ✅ Implemented | HIGH |

---

## Backend Sync Gaps

### 1. Pull Sync — Missing Table Queries

`SyncRepository` only has:
```typescript
async getRouteChanges(cursorMs: number, limit: number): Promise<RouteChangeRow[]>
```

**Missing methods:**
```typescript
// Location
async getStateChanges(cursorMs: number, limit: number)
async getDistrictChanges(cursorMs: number, limit: number)

// Store
async getStoreChanges(cursorMs: number, limit: number)
async getStoreOperatingHoursChanges(cursorMs: number, limit: number)

// Entity System
async getStatusChanges(cursorMs: number, limit: number)
async getEntityStatusMappingChanges(cursorMs: number, limit: number)

// RBAC (if exists)
async getEntityPermissionChanges(cursorMs: number, limit: number)

// Tax
async getTaxRateMasterChanges(cursorMs: number, limit: number)
```

### 2. Push Sync — Operation Handler is a Stub

`SyncService.processOperation()`:
```typescript
private async processOperation(
  op: SyncOperation,
  _userId: number,
  _activeStoreId: number | null,
  _tx: unknown,
): Promise<void> {
  this.logger.warn(
    `No handler registered for sync table "${op.table}" — operation ${op.id} skipped`
  );
}
```

**What needs to be implemented:**
```typescript
// Router to domain-specific handlers
const operationHandlers: Record<string, (op: SyncOperation, tx: Db) => Promise<void>> = {
  'routes': handleRoutePush,
  'stores': handleStorePush,
  'status': handleStatusPush,
  'entity_status_mapping': handleEntityStatusMappingPush,
  'entity_permissions': handleEntityPermissionsPush,
  'tax_rate_master': handleTaxRateMasterPush,
  'store_operating_hours': handleStoreOperatingHoursPush,
  // ...
};

// Each handler performs:
// - Validate data shape
// - Check user permissions (RBAC)
// - Handle CREATE/UPDATE/DELETE
// - Resolve conflicts if needed (version-based)
// - Return processed count
```

### 3. Missing Backend Schema Exports

The sync repository needs access to all table schemas:
```typescript
// Currently has:
import * as schema from '../../../core/database/schema';

// Can only use:
schema.routes

// Needs to also access:
schema.store
schema.status
schema.entityStatusMapping
schema.entityPermissions
schema.taxRateMaster
schema.storeOperatingHours
schema.state
schema.district
```

---

## Mobile Sync Gaps

### 1. Table Handlers — 9 Missing

`sync-table-handlers.ts` needs:
```typescript
export const TABLE_HANDLERS: Record<string, TableHandler> = {
  // Implemented (2/11)
  state: { onUpsert, onDelete },
  district: { onUpsert, onDelete },

  // Missing (9/11)
  routes: { onUpsert, onDelete },           // ← CRITICAL
  stores: { onUpsert, onDelete },           // ← CRITICAL
  status: { onUpsert, onDelete },           // ← CRITICAL
  entity_status_mapping: { onUpsert, onDelete },
  entity_permissions: { onUpsert, onDelete },
  tax_rate_master: { onUpsert, onDelete },
  store_operating_hours: { onUpsert, onDelete },
};
```

### 2. Missing Repository Methods

The mobile app needs repository methods for each table:
```typescript
// Currently used by TABLE_HANDLERS:
stateRepository.upsert(row)
districtRepository.upsert(row)

// Needs to add (check what's available):
routesRepository.upsert(row)
storesRepository.upsert(row)
statusRepository.upsert(row)
entityStatusMappingRepository.upsert(row)
entityPermissionsRepository.upsert(row)
taxRateMasterRepository.upsert(row)
storeOperatingHoursRepository.upsert(row)

// And all corresponding delete methods:
repository.delete(id)
```

### 3. API Response Mapping

Each handler must map from API camelCase to DB snake_case:
```typescript
// Example (state is already done):
async onUpsert(id, d) {
  const row: StateRow = {
    id,
    guuid: str(d.guuid),           // API field: d.guuid
    state_name: str(d.stateName),  // DB field: state_name
    state_code: str(d.stateCode),
    gst_state_code: nullable<string>(d.gstStateCode),
    is_union_territory: bool(d.isUnionTerritory),
    is_active: bool(d.isActive),
    updated_at: str(d.updatedAt),
    deleted_at: nullable<string>(d.deletedAt),
  };
  await stateRepository.upsert(row);
}

// Need to create similar mappers for routes, stores, status, etc.
// Must match the backend API response shape EXACTLY
```

---

## Current Implementation Details

### Backend: What's Working

**SyncController (100%)**
```typescript
GET /sync/changes
  ✅ Validates store membership
  ✅ Paginates (limit 500, detects hasMore)
  ✅ Returns nextCursor for resuming

POST /sync/push
  ✅ Validates authorization (RBACGuard)
  ✅ Deduplicates via idempotency key
  ✅ Verifies operation signatures (HMAC)
  ✅ Validates offline session (HMAC + JWT cross-check)
  ✅ Device revocation check
  ✅ Transaction wrapper per operation
```

**SyncService (50%)**
```typescript
✅ getChanges()
   - Store membership check
   - Cursor validation
   - Routes query (but only routes)
   - hasMore detection
   - nextCursor calculation

✅ processPushBatch()
   - Signature verification
   - Idempotency deduplication
   - Transaction wrapping
   - Per-operation result tracking

✅ validateOfflineSessionSignature()
   - HMAC verification
   - Expiry check
   - Device revocation lookup
   - JWT cross-validation

❌ processOperation()
   - STUB — no-op for all operations
```

**SyncRepository (10%)**
```typescript
✅ verifyStoreMembership()
✅ getRouteChanges()
✅ isAlreadyProcessed()
✅ logIdempotencyKey()
✅ withTransaction()
✅ deleteOldIdempotencyEntries()

❌ getStateChanges()
❌ getDistrictChanges()
❌ getStoreChanges()
❌ getStatusChanges()
❌ ... (6 more missing)
```

### Mobile: What's Working

**sync-engine.ts (100%)**
```typescript
✅ runSync(storeGuuid)
   - Reads per-table cursors
   - Calculates MIN cursor
   - Calls GET /sync/changes
   - Dispatches to TABLE_HANDLERS
   - Advances per-table cursors
   - Handles pagination loop

✅ runPullOnly()
✅ runPushOnly()
✅ initializeSyncEngine()
✅ resetStuck()
✅ isSyncing()
✅ getLastSyncedAt()
✅ resetSyncState()
```

**sync-table-handlers.ts (18%)**
```typescript
✅ state: { onUpsert, onDelete }
✅ district: { onUpsert, onDelete }

❌ routes: { onUpsert, onDelete }
❌ stores: { onUpsert, onDelete }
❌ status: { onUpsert, onDelete }
❌ entity_status_mapping: { onUpsert, onDelete }
❌ entity_permissions: { onUpsert, onDelete }
❌ tax_rate_master: { onUpsert, onDelete }
❌ store_operating_hours: { onUpsert, onDelete }
```

**write-guard.ts (100%)**
```typescript
✅ assertWriteAllowed()
   - Permissions loaded check
   - JWKS freshness check
   - Offline token expiry check
   - Role verification
   - HMAC session validation
```

**sync-status.ts (100%)**
```typescript
✅ isTableSynced()
✅ getSyncStatus()
✅ isReadyForOffline()
✅ arePermissionsLoaded()
```

---

## Data Flow Gaps

### Current Flow (Incomplete)

```
Mobile                    Server
  │                         │
  │  GET /sync/changes      │
  │ (cursor=0, tables=*) ──▶│
  │                         │
  │  ◀─ changes (routes:20  │ Query routes: ✅
  │     changes only)       │ Query state: ❌
  │                         │ Query stores: ❌
  │                         │ etc.
  │
  │  Dispatch to handlers   │
  │  - state: ✅            │
  │  - district: ✅         │
  │  - routes: ❌ NO HANDLER
  │  - stores: ❌ NO HANDLER
  │  - etc.
  │
  │  POST /sync/push        │
  │  (operations) ────────▶ │
  │                         │
  │                         │ processOperation()
  │                         │ ❌ STUB — skips all
  │
  │  ◀─ { processed: 0 }    │
  │  All operations lost
```

---

## Critical Blockers

### 1. No Routes Handler on Mobile

**Impact:** Routes are fetched but never applied locally. The routing table is empty.

**Fix:**
```typescript
// In sync-table-handlers.ts
routes: {
  async onUpsert(id, d) {
    const row: RouteRow = {
      id,
      guuid: str(d.guuid),
      route_name: str(d.routeName),
      route_path: str(d.routePath),
      full_path: str(d.fullPath),
      parent_route_fk: nullable<number>(d.parentRouteFk),
      route_type: str(d.routeType),
      route_scope: str(d.routeScope),
      is_public: bool(d.isPublic),
      is_active: bool(d.isActive),
      updated_at: str(d.updatedAt),
      deleted_at: nullable<string>(d.deletedAt),
    };
    await routesRepository.upsert(row);
  },
  async onDelete(id) {
    await routesRepository.delete(id);
  },
}
```

### 2. Operation Handler is a No-Op

**Impact:** All offline writes are accepted by the client, queued, sent to the server, and silently dropped. Users think their changes are synced but they disappear.

**Fix:** Implement domain handlers:
```typescript
// Backend: sync.service.ts
private async processOperation(
  op: SyncOperation,
  userId: number,
  activeStoreId: number | null,
  tx: Db,
): Promise<void> {
  const handler = this.operationHandlers[op.table];
  if (!handler) {
    this.logger.warn(`No handler for table "${op.table}" — skipped`);
    return;
  }
  await handler(op, userId, activeStoreId, tx);
}

private operationHandlers = {
  'routes': this.handleRoutePush.bind(this),
  'stores': this.handleStorePush.bind(this),
  'status': this.handleStatusPush.bind(this),
  // ...
};

private async handleRoutePush(
  op: SyncOperation,
  userId: number,
  activeStoreId: number | null,
  tx: Db,
): Promise<void> {
  // Validate permissions, apply operation, handle conflicts
}
```

### 3. No State/District Pull on Backend

**Impact:** Mobile has handlers for state/district but the server never sends them in the pull response.

**Fix:** Add to `SyncRepository`:
```typescript
async getStateChanges(cursorMs: number, limit: number): Promise<StateChangeRow[]> {
  const cursorDate = new Date(cursorMs);
  return this.db.select({
    id: schema.state.id,
    guuid: schema.state.guuid,
    stateName: schema.state.stateName,
    stateCode: schema.state.stateCode,
    // ...
  })
  .from(schema.state)
  .where(gt(schema.state.updatedAt, cursorDate))
  .orderBy(schema.state.updatedAt)
  .limit(limit + 1);
}
```

---

## Path to Completion

### Phase 1: Routes (Highest Priority)

**Backend**
- [ ] Routes pull: `getRouteChanges()` ← already exists ✅
- [ ] Routes push: `handleRoutePush()` in sync.service.ts
- [ ] Update `processOperation()` to route to handlers

**Mobile**
- [ ] Add `routes` to TABLE_HANDLERS
- [ ] Ensure `routesRepository.upsert()` exists
- [ ] Test pull + local storage

### Phase 2: State & District (Backend Only)

**Backend**
- [ ] State pull: `getStateChanges()`
- [ ] District pull: `getDistrictChanges()`
- [ ] State push handler (likely read-only, no mutations)
- [ ] District push handler (likely read-only, no mutations)

### Phase 3: Core POS Tables

**Backend**
- [ ] Stores pull: `getStoreChanges()`
- [ ] Status pull: `getStatusChanges()`
- [ ] Entity Status Mapping pull
- [ ] Entity Permissions pull (critical for offline auth)
- [ ] Tax Rate Master pull
- [ ] Store Operating Hours pull

**Backend Operations**
- [ ] Stores push handler
- [ ] Status push handler (likely read-only)
- [ ] Tax Rate Master push handler (likely read-only)
- [ ] Store Operating Hours push handler
- [ ] Entity Permissions push (might be read-only)

**Mobile**
- [ ] Add all 9 handlers to TABLE_HANDLERS
- [ ] Map API responses to DB schemas
- [ ] Test end-to-end sync

### Phase 4: Validation & Optimization

- [ ] Add UNIQUE constraints to prevent duplicate syncs
- [ ] Wrap pull page upserts in transactions (25× speedup for initial bootstrap)
- [ ] Wrap lookup sync in atomic transaction
- [ ] Add backend index on change_log(store_id, updated_at)
- [ ] Test crash recovery during sync
- [ ] Load test with 10k+ records

---

## Checklist for Completion

### Backend

- [ ] `SyncRepository` has methods for all 9 tables:
  - [ ] `getRouteChanges()` (exists)
  - [ ] `getStoreChanges()`
  - [ ] `getStatusChanges()`
  - [ ] `getEntityStatusMappingChanges()`
  - [ ] `getEntityPermissionsChanges()`
  - [ ] `getTaxRateMasterChanges()`
  - [ ] `getStoreOperatingHoursChanges()`
  - [ ] `getStateChanges()`
  - [ ] `getDistrictChanges()`

- [ ] `SyncService.processOperation()` is not a stub:
  - [ ] Routes CREATE/UPDATE/DELETE handlers
  - [ ] Stores CREATE/UPDATE/DELETE handlers
  - [ ] Status handlers (probably read-only)
  - [ ] Entity Permissions handlers
  - [ ] Tax Rate Master handlers (probably read-only)
  - [ ] Store Operating Hours handlers
  - [ ] All handlers do permission validation
  - [ ] All handlers handle version-based conflicts

### Mobile

- [ ] `sync-table-handlers.ts` has handlers for all 9 tables:
  - [ ] routes: { onUpsert, onDelete }
  - [ ] stores: { onUpsert, onDelete }
  - [ ] status: { onUpsert, onDelete }
  - [ ] entity_status_mapping: { onUpsert, onDelete }
  - [ ] entity_permissions: { onUpsert, onDelete }
  - [ ] tax_rate_master: { onUpsert, onDelete }
  - [ ] store_operating_hours: { onUpsert, onDelete }
  - [ ] state: { onUpsert, onDelete } (exists)
  - [ ] district: { onUpsert, onDelete } (exists)

- [ ] All handlers map API response to DB row:
  - [ ] camelCase → snake_case conversion
  - [ ] Type coercion (str, num, bool, nullable)
  - [ ] Calls correct repository method

- [ ] All repositories have upsert + delete methods:
  - [ ] Check `/lib/database/repositories/` for each table

### Integration

- [ ] End-to-end test: create/edit/delete on mobile → appears on server
- [ ] End-to-end test: server change → appears on mobile after pull
- [ ] Conflict resolution: version-based reject for financial records
- [ ] Crash recovery: app killed mid-sync, resumable on restart
- [ ] Sync isolation: store A changes don't leak to store B
- [ ] Permission checks: unauthorized operations rejected server-side
- [ ] Offline capability: mobile stores first 5 critical tables as "ready for offline"

---

## Estimated Effort

| Task | Effort | Notes |
|---|---|---|
| Routes mobile handler | 2 hours | Simple mapper |
| Routes backend push | 3 hours | Permission checks, version handling |
| State/District backend pull | 2 hours | Straightforward queries |
| 6 remaining tables backend pull | 8 hours | Similar pattern to routes |
| 6 remaining tables backend push | 12 hours | Different business logic per table |
| 6 remaining tables mobile handlers | 6 hours | Mappers follow the same pattern |
| Testing + crash recovery | 8 hours | Critical for offline reliability |
| **Total** | **~41 hours** | ~1 week of focused work |

---

## Files to Modify/Create

### Backend

```
src/modules/sync/
├── repositories/sync.repository.ts          (add 8 query methods)
├── sync.service.ts                          (add 8+ push handlers)
├── handlers/                                (NEW FOLDER)
│   ├── index.ts
│   ├── routes.handler.ts
│   ├── stores.handler.ts
│   ├── status.handler.ts
│   ├── entity-permissions.handler.ts
│   ├── tax-rate-master.handler.ts
│   └── ...
└── dto/
    └── responses/
        └── sync-changes.response.dto.ts     (extend for new tables)
```

### Mobile

```
lib/sync/
├── sync-table-handlers.ts                   (add 7 new handlers)
├── mappers/                                 (NEW FOLDER)
│   ├── routes.mapper.ts
│   ├── stores.mapper.ts
│   ├── entity-permissions.mapper.ts
│   └── ...
└── repositories/
    └── *                                    (ensure upsert/delete methods exist)
```

---

## Recommendations

1. **Start with routes** (both directions). It's the simplest and will validate the entire stack.
2. **Then add state + district on backend** to unblock the mobile handlers that already exist.
3. **Batch the remaining 6 tables** since they follow the same pattern.
4. **Add comprehensive end-to-end tests** for each table before moving to the next.
5. **Implement the UNIQUE constraint** on entity_permissions during this phase to prevent sync duplicates.
6. **Wrap pull page upserts in transactions** (25× perf improvement).
