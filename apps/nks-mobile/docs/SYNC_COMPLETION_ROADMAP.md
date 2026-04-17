# Offline Sync Completion Roadmap

**Status:** Architecture Complete (100%) | Implementation: 18% Complete  
**Target Completion:** 1-2 weeks of focused development

---

## The Problem: Documented vs Implemented

```
Documented Architecture (OFFLINE_SYNC_ARCHITECTURE.md)
├─ 9 synced tables
├─ Per-table cursors
├─ Pull sync (GET /sync/changes)
├─ Push sync (POST /sync/push)
├─ Operation signing (HMAC)
├─ Offline session validation
├─ Crash recovery
└─ Conflict resolution
    ↓
    ↓ Only 2 of 11 parts actually working
    ↓
Current Implementation
├─ Routes pull only ✅
├─ State/District pull only (backend missing)
├─ Mobile handlers for 2 tables only ❌
├─ Push handler is a no-op ❌
└─ No domain-specific operation handlers ❌
```

---

## What's Working Today

### ✅ Fully Implemented

| Component | Details |
|---|---|
| **Pull Sync Framework** | Cursor management, pagination, hasMore flag, nextCursor calculation |
| **Push Sync Framework** | Queue deduplication, signature verification, transaction wrapping |
| **Offline Session Validation** | HMAC + JWT cross-validation, device revocation checks |
| **Crash Recovery** | resetStuck() resets in-progress mutations to pending on startup |
| **Write Guard** | assertWriteAllowed() checks permissions, tokens, JWKS freshness |
| **Sync Status Tracking** | Per-table health status, offline readiness gates |
| **Backend Routing** | GET /sync/changes and POST /sync/push endpoints |

### ⚠️ Partially Working

| Component | Working | Broken |
|---|---|---|
| **Routes Table** | Backend pull ✅ | Mobile handler ❌ |
| **State Table** | Mobile handler ✅ | Backend pull ❌ |
| **District Table** | Mobile handler ✅ | Backend pull ❌ |
| **Other 6 Tables** | — | Both ❌ |

### ❌ Not Started

| Layer | Tables | Issue |
|---|---|---|
| **Backend Pull** | 6 tables | No query methods |
| **Backend Push** | 9 tables | Handler is a stub |
| **Mobile Handlers** | 7 tables | Missing implementations |

---

## What Breaks if You Ignore This

### Scenario 1: User Syncs Routes on Mobile

```
1. Mobile calls GET /sync/changes
   ↓
2. Backend returns 50 route rows
   ↓
3. Mobile receives changes but has NO handler for 'routes'
   ↓
4. Dispatch fails with: "No handler for table routes"
   ↓
5. Routes are fetched but NOT stored in SQLite
   ↓
6. Routes table stays empty
```

### Scenario 2: User Creates a Sale Offline

```
1. Mobile enqueues: { op: 'CREATE', entity: 'sales', ... }
   ↓
2. User comes online, sync triggers
   ↓
3. Mobile sends: POST /sync/push { operations: [...] }
   ↓
4. Backend's processOperation() sees table='sales'
   ↓
5. Logs: "No handler registered for sync table sales — skipped"
   ↓
6. Returns: { processed: 0 }
   ↓
7. Mobile's markSynced() never called, operation stays in queue
   ↓
8. Next sync: batch is still there, gets re-sent
   ↓
9. Loop repeats forever — sale NEVER synced to server
```

### Scenario 3: Critical Table Missing

User can't enter offline POS mode because `isReadyForOffline()` returns false:
```
CRITICAL_TABLES = [
  'routes',
  'stores',
  'entity_permissions',  ← missing from server pull
  'tax_rate_master',     ← missing from server pull
  'status'
]

If ANY of these has cursor=0 → ready=false → offline mode blocked
```

---

## Completion Timeline

### Week 1: Core Tables (Routes + State + District)

#### Day 1-2: Routes Handler
**Mobile**
- [ ] Add routes handler to sync-table-handlers.ts
- [ ] Mapper: API camelCase → DB snake_case
  ```typescript
  routes: {
    async onUpsert(id, d) {
      const row: RouteRow = {
        id, guuid: d.guuid, route_name: d.routeName,
        // ... all 13 fields
      };
      await routesRepository.upsert(row);
    }
  }
  ```
- [ ] Test: pull routes from server → verify in SQLite

#### Day 2-3: Routes Push Handler
**Backend**
- [ ] Create `handlers/routes.handler.ts`
- [ ] Implement CREATE/UPDATE/DELETE
  ```typescript
  // Example
  private async handleRoutePush(
    op: SyncOperation,
    userId: number,
    activeStoreId: number | null,
    tx: Db,
  ): Promise<void> {
    if (op.op === 'CREATE') {
      // Validate data shape
      // Check permissions (RBAC)
      // INSERT into routes
      // Increment version
    } else if (op.op === 'UPDATE') {
      // Check base_version for conflicts
      // Update row
      // Increment version
    }
  }
  ```
- [ ] Update `processOperation()` to route to handlers
- [ ] Test: offline write on mobile → appears on server

#### Day 3: State + District Pull
**Backend**
- [ ] Add `getStateChanges()` to sync.repository.ts
- [ ] Add `getDistrictChanges()` to sync.repository.ts
- [ ] Update `getChanges()` in sync.service.ts to query all 3 tables
  ```typescript
  // Current code only queries routes:
  const routeRows = await this.syncRepository.getRouteChanges(cursorMs, limit);
  
  // Change to:
  const changes = await this.syncRepository.getAllChanges(
    cursorMs, limit, ['routes', 'state', 'district']
  );
  ```
- [ ] Test: mobile syncs all 3 tables

### Week 2: POS Tables (Stores, Status, Permissions, Tax, Hours)

#### Day 1-2: Stores Table
**Backend**
- [ ] `getStoreChanges()` query
- [ ] `handleStorePush()` operation handler

**Mobile**
- [ ] Add stores handler
- [ ] Map API response to DB row

#### Day 2-3: Status + Entity Status Mapping
**Backend**
- [ ] `getStatusChanges()`
- [ ] `getEntityStatusMappingChanges()`
- [ ] Operation handlers (likely read-only)

**Mobile**
- [ ] Add both handlers

#### Day 3-4: Entity Permissions (Critical)
**Backend**
- [ ] `getEntityPermissionsChanges()`
- [ ] Add UNIQUE constraint to prevent duplicates
- [ ] Handle role-entity-store tuples

**Mobile**
- [ ] Add permissions handler
- [ ] Critical: verify `arePermissionsLoaded()` returns true

#### Day 4-5: Tax Rate Master + Store Operating Hours
**Backend**
- [ ] `getTaxRateMasterChanges()`
- [ ] `getStoreOperatingHoursChanges()`

**Mobile**
- [ ] Add both handlers

### Week 2 (cont): Polish + Testing

#### Day 5-6: Optimization
- [ ] Wrap pull page upserts in SQLite transactions (25× faster)
- [ ] Add backend index on change_log(store_id, updated_at)
- [ ] Wrap lookup sync in transaction

#### Day 6-7: End-to-End Testing
- [ ] Create sale offline → syncs online ✅
- [ ] Backend change → appears on mobile ✅
- [ ] Conflict detection → quarantines to human review ✅
- [ ] Crash during sync → resumes safely ✅
- [ ] Store isolation → store A can't see store B data ✅

---

## Implementation Sequence (Order Matters)

### Must Do First

1. **Routes Handler (Mobile)**
   - Unblocks routes sync (backend already has pull)
   - Validates entire stack: pull → dispatch → store
   - Simplest table, good test case

2. **Routes Push Handler (Backend)**
   - Routes handler proves the operation framework works
   - Test the idempotency + signature verification

3. **State + District Pull (Backend)**
   - Unblocks mobile handlers that already exist
   - Proves multi-table pull queries work

### Then Do in Parallel

4. **Core POS Tables (All)**
   - Stores, status, entity_status_mapping
   - Tax rates, operating hours
   - Entity permissions (critical for offline auth)

5. **Optimization**
   - Transaction wrapping
   - Index creation
   - Atomic lookup sync

6. **Testing + Hardening**
   - End-to-end scenarios
   - Crash recovery
   - Large initial sync (10k+ records)

---

## Risk Assessment

### Current Risk Level: 🔴 CRITICAL

```
Without completing this:
- Mobile offline sync is non-functional
- All user writes are lost (no-op push)
- Offline POS mode can't engage (missing critical tables)
- Sync appears to work but data never reaches server
```

### Risk Mitigation

✅ **Before going live, must have:**
- Routes syncing both directions (pull + push)
- State, district, stores syncing (read-only reference data)
- Entity permissions syncing (for offline permission checks)
- Tax rates syncing (for offline sales)
- Operation handlers not stubs (for any mutable table)

✅ **Before full rollout:**
- Store operating hours syncing
- End-to-end testing in production environment
- Crash recovery testing
- Initial large bootstrap testing (100k+ records)

---

## Code Reference: Where to Make Changes

### Backend: 3 Files

**1. `SyncRepository` (repositories/sync.repository.ts)**
```
Add 8 new query methods:
- getStoreChanges()
- getStatusChanges()
- getEntityStatusMappingChanges()
- getEntityPermissionsChanges()
- getTaxRateMasterChanges()
- getStoreOperatingHoursChanges()
- getStateChanges()
- getDistrictChanges()

Follow same pattern as getRouteChanges():
- WHERE updated_at > cursorDate
- ORDER BY updated_at ASC
- LIMIT limit + 1 (for hasMore detection)
```

**2. `SyncService.processOperation()` (sync.service.ts)**
```
Replace stub with actual handler routing:

private operationHandlers = {
  'routes': this.handleRoutePush.bind(this),
  'stores': this.handleStorePush.bind(this),
  // ...
};

private async processOperation(...) {
  const handler = this.operationHandlers[op.table];
  if (handler) await handler(op, userId, activeStoreId, tx);
}

Create new methods:
- handleRoutePush()
- handleStorePush()
- handleStatusPush()
- ... (one per table)
```

**3. `SyncService.getChanges()` (sync.service.ts)**
```
Change from single-table to multi-table:

// Current:
const routeRows = await this.syncRepository.getRouteChanges(cursorMs, limit);
const changes = rows.map(SyncDataMapper.routeRowToChange);

// New:
const allChanges = await Promise.all([
  this.syncRepository.getRouteChanges(cursorMs, limit),
  this.syncRepository.getStoreChanges(cursorMs, limit),
  this.syncRepository.getStatusChanges(cursorMs, limit),
  // ...
]);
const changes = allChanges
  .flat()
  .sort((a, b) => a.updatedAt - b.updatedAt)
  .slice(0, limit + 1);
```

### Mobile: 2 Files

**1. `sync-table-handlers.ts`**
```
Add 7 new handlers:
- routes
- stores
- status
- entity_status_mapping
- entity_permissions
- tax_rate_master
- store_operating_hours

Each handler pattern:
type Handler = {
  async onUpsert(id, data) {
    const row = {
      id,
      field1: mapApiField1(data.apiField1),
      field2: mapApiField2(data.apiField2),
      // ...
    };
    await repository.upsert(row);
  },
  async onDelete(id) {
    await repository.delete(id);
  }
};

Update SYNC_TABLES = Object.keys(TABLE_HANDLERS);
```

**2. Ensure repositories support upsert + delete**
```
Check files in lib/database/repositories/:
- routesRepository.upsert(row)
- routesRepository.delete(id)
- storesRepository.upsert(row)
- storesRepository.delete(id)
- ... (one per table)

If any are missing, add them.
```

---

## Validation Checklist

### Before Merging Each Table

- [ ] Backend pull query works (test with curl/Postman)
- [ ] Backend pull returns data in correct format
- [ ] Mobile handler converts API fields to DB fields correctly
- [ ] Mobile handler calls repository.upsert() successfully
- [ ] Data appears in SQLite after pull sync
- [ ] Cursor advances correctly
- [ ] Next pull uses new cursor (no duplicate data)
- [ ] hasMore flag is accurate
- [ ] Pagination resumes correctly on app kill/restart

### Before Merging Push Handler

- [ ] Backend handler accepts the operation
- [ ] Idempotency key deduplication works (same op twice = idempotent)
- [ ] Signature verification passes for valid ops
- [ ] Signature verification rejects tampered ops
- [ ] Permission checks pass for authorized users
- [ ] Permission checks reject unauthorized users
- [ ] Server database updated correctly
- [ ] Client shows operation marked as synced
- [ ] Offline session validation passes/rejects correctly
- [ ] Version-based conflict detection works (if applicable)

---

## Questions to Ask

1. **Do all repositories have `.upsert()` and `.delete()` methods?**
   - Check `/lib/database/repositories/` for routes, stores, status, etc.
   - If missing, add them following the same pattern as state/district

2. **What's the API response format for each table?**
   - Backend returns camelCase field names
   - Mobile handlers must map to snake_case DB schema
   - Typo in field name = data lost

3. **Are there version fields on mutable tables?**
   - Routes, stores, status: probably versioned for conflict detection
   - Entity permissions: maybe version for role changes
   - Tax rates: probably versioned
   - Check backend schema for `version INT` column

4. **Should some tables be read-only?**
   - State, district: probably read-only (server master)
   - Entity permissions: read-only or allow mobile push?
   - Tax rates: read-only or allow mobile corrections?

---

## Success Criteria

✅ **Offline sync is production-ready when:**

1. All 9 tables sync in both directions (pull + push where applicable)
2. Routes fully work (pull + push)
3. Critical tables ready: routes, stores, status, permissions, tax rates
4. Crash recovery tested and working
5. Offline POS mode can engage (all critical tables have data)
6. User writes sync to server (no more silent failures)
7. Conflicts detected and quarantined (not silently overwritten)
8. Initial bootstrap handles 10k+ records efficiently
9. Permissions enforced both offline and online
10. No data loss across app kills, network drops, or restarts

---

## Effort Summary

| Task | Hours | Days | Complexity |
|---|---|---|---|
| Routes pull + push | 5 | 2 | ⭐ Low |
| State + district backend pull | 2 | 1 | ⭐ Low |
| Stores table (both directions) | 5 | 2.5 | ⭐⭐ Medium |
| Status + entity_status (backend) | 3 | 1.5 | ⭐ Low |
| Permissions + tax + hours (backend) | 8 | 4 | ⭐⭐ Medium |
| Mobile handlers (7 tables) | 6 | 3 | ⭐ Low |
| Optimization (transactions, index) | 4 | 2 | ⭐⭐ Medium |
| End-to-end testing | 6 | 3 | ⭐⭐ Medium |
| **TOTAL** | **39** | **~2 weeks** | |

---

## Next Steps

### Immediately (This Sprint)

1. [ ] Read `SYNC_IMPLEMENTATION_AUDIT.md` (the gap analysis)
2. [ ] Create a GitHub issue: "Implement missing sync tables"
3. [ ] Start with routes handler (mobile) — simplest, highest value
4. [ ] PR routes handler
5. [ ] PR routes push handler (backend)

### This Week

6. [ ] PR state + district backend pull
7. [ ] PR stores table (both directions)

### Next Week

8. [ ] PR remaining 4 tables (status, perms, tax, hours)
9. [ ] Integration testing
10. [ ] Deploy to staging
11. [ ] Load testing (10k+ record bootstrap)

---

## Files to Review

📋 **Architecture (Already Complete)**
- `OFFLINE_SYNC_ARCHITECTURE.md` — Full design document

🔍 **Gap Analysis (This Document)**
- `SYNC_IMPLEMENTATION_AUDIT.md` — What's missing and where

🗺️ **Roadmap (This Document)**
- `SYNC_COMPLETION_ROADMAP.md` — Timeline and priorities

📱 **Mobile Implementation**
- `lib/sync/sync-engine.ts` — Core sync orchestration (complete)
- `lib/sync/sync-table-handlers.ts` — Handlers for each table (18% complete)
- `lib/sync/sync-status.ts` — Health checks (complete)

🖥️ **Backend Implementation**
- `src/modules/sync/sync.controller.ts` — HTTP endpoints (complete)
- `src/modules/sync/sync.service.ts` — Orchestration (50% complete)
- `src/modules/sync/repositories/sync.repository.ts` — Data queries (10% complete)
