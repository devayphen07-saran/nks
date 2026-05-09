# Phase 3 Implementation — Sync Core Infrastructure ✅

**Status:** COMPLETE (2026-05-04)  
**Files Created:** 11  
**Total Lines:** 450+

---

## Overview

Phase 3 implements the reusable core infrastructure that bridges the database foundation (Phase 1-2) and the HTTP endpoints (Phase 4). It provides:

1. **Type Definitions** — contracts for device context, operations, and results
2. **Services** — cursor parsing, idempotency deduplication, handler registry
3. **Handler Interface & Base Class** — template for domain-specific handlers

All code is production-ready, well-documented, and follows the senior engineer guidelines: clarity over cleverness, no premature optimization, explicit error handling.

---

## Files Created

### Types (3 files, 80 lines)

#### 1. **device-context.ts** (10 lines)
```typescript
export interface DeviceContext {
  deviceId: string;    // Stable UUID from mobile
  userId: number;      // Internal bigint ID
  storeId: number;     // Active store ID
}
```
Identifies the authenticated device making a sync request. Populated by DeviceAuthGuard in Phase 4.

#### 2. **sync-result.ts** (55 lines)
Discriminated union type for operation responses:
- `ok` — create/update/delete succeeded (server_id, version)
- `duplicate` — create on existing entity (server_id, version)
- `conflict` — version mismatch (reason, server_state)
- `rejected` — validation failure, not retryable (reason)
- `error` — transient error, NOT cached, safe to retry (reason)

**Critical:** Only terminal results (ok, duplicate, conflict, rejected) are cached. Errors are never cached, allowing safe retries.

#### 3. **sync-operation.ts** (15 lines)
```typescript
export interface SyncOperation {
  client_op_id: string;           // UUID from device
  sequence: number;               // Ordering in batch
  entity: string;                 // 'customer', 'product', etc.
  operation: 'create'|'update'|'delete';
  client_id: string;              // UUID of entity
  payload: Record<string, unknown>; // Validated by handler
}
```

### Services (4 files, 160 lines)

#### 4. **sync-cursor.service.ts** (50 lines)
Parses and builds compound cursors for pagination.

```typescript
// Parse: "1725800000000:a1b2c3d4-..." → { ts, id }
// Build: updatedAt + id → cursor string
```

**Why compound cursors?**  
When 1000+ rows share the same `updated_at`, pagination needs both timestamp AND id to avoid skipping rows or infinite loops. The next query uses:
```sql
WHERE (updated_at > cursorTs OR (updated_at = cursorTs AND id > cursorId))
```

**Key Methods:**
- `parse(cursor)` — converts string to { ts, id }
- `build(updatedAt, id)` — creates next_cursor
- `INITIAL_CURSOR` — epoch + zero UUID for first pull

#### 5. **idempotency.service.ts** (75 lines)
Deduplicates push operations using clientOpId.

**Core Contract:**
- `find(clientOpId)` — returns cached result or null
- `save(clientOpId, deviceId, entityType, result)` — conditional save
- **Only caches terminal results** (ok, duplicate, conflict, rejected)
- **Never caches errors** — device retries safely

**Why not cache errors?**
1. Errors are transient (DB timeout, network issue)
2. Retries should succeed after recovery
3. Unknown-entity errors shouldn't cache before handler deployment

**Race Safety:**
Uses `INSERT ... ON CONFLICT DO NOTHING`. If two requests race, whichever inserts first wins. Both calls to `find()` return the same result.

#### 6. **dispatcher.service.ts** (35 lines)
Registry for sync handlers.

Domain modules register handlers during `onModuleInit`:
```typescript
constructor(private dispatcher: DispatcherService, private productSync: ProductsSyncService) {}
onModuleInit() {
  this.dispatcher.register('product', this.productSync);
}
```

**Key Methods:**
- `register(entity, handler)` — register a handler
- `getHandler(entity)` → handler or **undefined** (doesn't throw)

**Why return undefined instead of throwing?**  
Allows graceful handling when a handler isn't deployed yet. Caller decides to return error or retry after deployment.

### Handlers (2 files, 210 lines)

#### 7. **sync-handler.interface.ts** (60 lines)
Contract for all sync handlers.

```typescript
export interface SyncHandler {
  readonly entity: string;
  
  apply(op, device, tx): Promise<SyncResult>;
  getChangesSince(cursorTs, cursorId, storeId, limit, tx): Promise<{...}>;
}
```

#### 8. **base-sync-handler.ts** (150 lines)
Abstract base class for domain handlers.

**Provided Functionality:**

1. **Operation Dispatch**
   - `apply()` routes to create/update/delete handlers
   - Validates operation type

2. **Create Operations**
   - Delegates to `applyCreate()` (domain-specific)
   - Subclass checks for duplicates and creates entity

3. **Update Operations**
   - `findByIdForUpdate()` locks row with FOR UPDATE
   - Checks version against expected_version
   - Returns conflict if mismatch
   - Applies changes via `applyUpdate()` (overridable)
   - Increments version and saves

4. **Delete Operations**
   - Same locking and version checking as update
   - Sets deleted_at (soft delete only)
   - Increments version

5. **Pull Pagination**
   - `getChangesSince()` handles compound cursor logic
   - Fetches limit+1 to detect has_more
   - Returns { changes[], hasMore, nextCursor }
   - Maps rows to wire format

**Abstract Methods Domain Handlers Must Implement:**
- `toWireFormat(entity)` — DB row → API response
- `applyCreate(op, device, tx)` — create logic
- `findByIdForUpdate(id, storeId, tx)` — query with lock
- `queryChangesSince(...)` — pagination query
- `saveEntity(entity, tx)` — persist changes

**Optional Overrides:**
- `applyUpdate(op, device, entity, tx)` — custom update logic (default: Object.assign)
- `handleUpdate()`, `handleDelete()` — full custom behavior

### Module & Exports (2 files, 50 lines)

#### 9. **services/index.ts** (3 lines)
Re-exports all services.

#### 10. **handlers/index.ts** (2 lines)
Re-exports handler interface and base class.

#### 11. **sync/index.ts** (17 lines)
Main barrel export for sync context. Exports:
- All types
- All services
- Handler interface and base class
- SyncModule

---

## Architecture Diagram

```
Mobile Device                Backend
─────────────────────────────────────────────────────

POST /sync/push
  ├─ X-Device-Id header
  ├─ operations[]
  │
  └─→ SyncController (Phase 4)
      ├─ DeviceAuthGuard (Phase 4)
      │  └─ validates device registration
      │     └─ populates DeviceContext (Phase 3)
      │
      └─ SyncService.applyOperation (Phase 4)
         ├─ IdempotencyService.find() (Phase 3)
         │  └─ cache hit? return cached result
         │
         ├─ DispatcherService.getHandler() (Phase 3)
         │  └─ look up domain handler
         │
         └─ handler.apply(op, device, tx) (Phase 3)
            └─ BaseSyncHandler.handleCreate/Update/Delete (Phase 3)
               ├─ lock, validate, apply changes
               └─ return SyncResult
         
         └─ IdempotencyService.save() (Phase 3)
            └─ cache result (terminal only)

GET /sync/pull?entity=...&cursor=...
  └─ SyncService.pullEntity (Phase 4)
     ├─ SyncCursorService.parse() (Phase 3)
     │  └─ "1725800000000:..." → { ts, id }
     │
     └─ handler.getChangesSince() (Phase 3)
        └─ BaseSyncHandler compound cursor query (Phase 3)
           ├─ fetch limit+1 rows
           ├─ detect has_more
           └─ build next_cursor
```

---

## Design Patterns

### 1. Handler-Driven Architecture
Domain handlers extend `BaseSyncHandler` and override abstract methods. The infrastructure handles:
- Idempotency
- Versioning
- Locking
- Soft deletes
- Pagination

Domain handler only implements domain logic.

### 2. Discriminated Union (SyncResult)
Each status carries different response fields. TypeScript's discriminated union ensures correct usage.

```typescript
if (result.status === 'ok') {
  // TypeScript knows: server_id, version are available
  // reason, server_state are NOT available
}
```

### 3. Compound Cursor for Pagination
When multiple rows share the same `updated_at`, a single timestamp isn't enough to resume pagination without:
- Skipping rows
- Creating infinite loops
- Fetching duplicates

Compound cursor `(ts, id)` solves this:
```sql
WHERE (updated_at > ts OR (updated_at = ts AND id > cursorId))
```

### 4. Conditional Idempotency
Not all responses are cached. This design allows:
- Safe retries on transient errors
- Graceful handling of undeployed handlers
- No dead-keying of operations

### 5. FOR UPDATE Locks
Update and delete operations lock the row pessimistically:
```sql
SELECT * FROM entity WHERE id = ... FOR UPDATE;
```
Ensures consistent version checking in concurrent scenarios.

---

## Critical Implementation Details

### Soft Deletes Only
Delete operations never hard-delete from the database at the application layer. Instead:
1. Set `deleted_at = NOW()`
2. Set `is_active = false` (if applicable)
3. Increment version
4. Update updated_at

Hard deletes happen only via the tombstone-GC scheduler (Phase 2), after 90 days.

**Why?**
- Mobile may not have received the delete yet
- Deletes can be soft-reverted
- Audit trail is preserved
- GC is centralized and scheduled

### Version Checking (Optimistic Concurrency)
Every update/delete checks:
```typescript
if (entity.version !== payload.expected_version) {
  return { status: 'conflict', reason: '...', server_state: entity };
}
```

The device resends with the correct version (from server_state). No deadlocks, high concurrency.

### Error Caching Policy
```typescript
async save(clientOpId, deviceId, entity, result) {
  if (result.status === 'error') {
    return; // Don't cache
  }
  // Cache ok, duplicate, conflict, rejected
  await insert(...).onConflictDoNothing();
}
```

**Rationale:**
- `error` = transient → retry
- `unknown_entity` = not cached → retry after deployment
- Terminal results = never retry → cache

---

## Integration Points

### Phase 4 (Next Phase) Will:
1. Create `SyncService` using IdempotencyService, DispatcherService, SyncCursorService
2. Create `SyncController` with `POST /sync/push` and `GET /sync/pull` endpoints
3. Create `DeviceAuthGuard` to populate DeviceContext
4. Create DTOs for request/response validation
5. Wire SyncModule into AppModule

### Domain Modules (Later) Will:
1. Extend `BaseSyncHandler<ProductEntity>`
2. Override abstract methods
3. Register handler: `dispatcher.register('product', productSync)`
4. Add sync columns to their domain tables

---

## Testing Ready

The implementation is testable:

- **IdempotencyService**: mock DB repo, test find/save behavior
- **SyncCursorService**: parse/build test cases with edge timestamps
- **DispatcherService**: register/getHandler tests
- **BaseSyncHandler**: mock subclass, test dispatch, locking, version checking
- **SyncResult**: TypeScript ensures correct discriminated union usage

---

## Summary

Phase 3 is complete and production-ready. It provides the reusable infrastructure for:

- **Type safety** — all sync contracts are explicit and validated by TypeScript
- **Handler dispatch** — registry-based, extensible by domain modules
- **Idempotency** — deduplication with race-safe inserts
- **Pagination** — compound cursors for edge cases
- **Concurrency** — version checking + FOR UPDATE locks

The code is clear, well-documented, and designed for easy extension. Domain handlers only need to implement domain logic; the infrastructure handles the rest.

**Next:** Phase 4 will wire these services into HTTP endpoints and add the DeviceAuthGuard.
