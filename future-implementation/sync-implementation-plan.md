# Sync Implementation Plan (v5) — Fixed & Complete

Source: `sync-architecture-v5.md` + device registration flow + store switching

Each phase is self-contained. Execute phases sequentially.

**Status:** Phases 1-4 Ready | Phases 5-12 Planned

---

## Overview

This is a clean-slate build of an offline-first sync system for NestJS backend + React Native (Expo) mobile POS.

**Scope:** Sync infrastructure only (reusable plumbing). Domain-specific handlers (products, customers, sales, payments, stock-movements) are added per-entity once infrastructure is complete.

**Key Difference from v4:**
- Device registration with store switching (no logout)
- Compound cursor pagination (no row skipping)
- Idempotency cache: terminal results only, transient errors not cached
- REPEATABLE READ on pull (transactionally consistent snapshots)
- Soft deletes only at application layer

---

# Phase 1 — Database Foundation

Schema groundwork before any sync code. Nothing depends on application logic yet.

## New Files

| File | Purpose |
|---|---|
| `src/core/database/schema/sync/processed-operations.table.ts` | Drizzle schema for the idempotency table. |
| `src/core/database/schema/sync/sync-columns.ts` | Helper returning the standard sync column set to spread into any syncable table. |
| `src/core/database/schema/sync/index.ts` | Barrel export. |
| `src/core/database/schema/devices/device-registration.table.ts` | `device_registrations` table schema. |
| `src/core/database/schema/devices/index.ts` | Barrel export. |
| `migrations/<n>_create_processed_operations.sql` | Create table + indexes. |
| `migrations/<n>_create_device_registrations.sql` | Create table + unique constraint. |

## Existing Files to Modify

| File | Change |
|---|---|
| `src/core/database/schema/index.ts` | Re-export `./sync` and `./devices`. |

## Data Model

### `processed_operations` (Idempotency Cache)

| Column | Type | Notes |
|---|---|---|
| `client_op_id` | uuid | PRIMARY KEY (mobile-generated) |
| `device_id` | text | NOT NULL |
| `entity_type` | text | NOT NULL |
| `result` | jsonb | NOT NULL — entire cached response |
| `processed_at` | timestamptz | default NOW() |

**Indexes:** `(device_id, processed_at)`, `(processed_at)`

**Retention:** 90 days (deleted by IdempotencyCleanupScheduler in Phase 2)

**Key Behavior:** Caches ONLY terminal results (ok, duplicate, conflict, rejected). Never caches `error` or unknown entity. Transient errors are retryable; unknowns retry after server deploys handler.

### `device_registrations` (Device-Store Binding)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PRIMARY KEY default gen_random_uuid() |
| `device_id` | text | NOT NULL — stable UUID from mobile |
| `user_fk` | bigint | FK → users(id) ON DELETE CASCADE |
| `store_fk` | bigint | FK → store(id) ON DELETE CASCADE |
| `last_seen_at` | timestamptz | default NOW(), bumped on sync |
| `created_at` | timestamptz | default NOW() |

**Unique Constraint:** `(device_id, user_fk, store_fk)`

**Key Behavior:**
- One device can register at multiple stores (for same user)
- One user can have multiple devices
- When user switches stores, UPSERT creates new row for new store
- Old registration becomes orphaned (never queried again)
- `last_seen_at` bumped fire-and-forget on every sync request
- Cascade deletes: if user/store deleted → registrations deleted

**Usage:**
- Login: creates registration `(device_id, user_id, default_store_id)`
- Store switch: UPSERT updates to `(device_id, user_id, NEW_STORE_ID)`
- DeviceAuthGuard: validates `(device_id, user_id, CURRENT_ACTIVE_STORE_ID)`

### `sync-columns.ts` Helper

Returns columns to spread into any syncable domain table:

| Column | Type | Notes |
|---|---|---|
| `version` | int | default 1, incremented on every write |
| `created_by_device` | text | NULL for web-originated rows |
| `last_modified_by_user_id` | uuid | nullable |

When domain team adds syncable table:
1. Spread `...syncColumns()` into Drizzle schema
2. Add compound index: `(updated_at ASC, id ASC)`

## Implementation Steps

1. Write Drizzle schema for `processed_operations` with both indexes
2. Write Drizzle schema for `device_registrations` with unique constraint
3. Write `sync-columns.ts` helper
4. Generate migrations
5. Run migrations; verify types regenerate
6. Re-export from `core/database/schema/index.ts`

---

# Phase 2 — Constants & Cleanup Schedulers

Data hygiene running before any sync traffic.

## New Files

| File | Purpose |
|---|---|
| `src/contexts/sync/sync.constants.ts` | All sync constants in one place. |
| `src/contexts/sync/schedulers/idempotency-cleanup.scheduler.ts` | Daily cron: delete expired idempotency rows. |
| `src/contexts/sync/schedulers/tombstone-gc.scheduler.ts` | Weekly cron: hard-delete old soft-deleted rows. |
| `src/contexts/sync/schedulers/queue-cleanup.scheduler.ts` | Daily cron: delete old `done` rows from mobile sync_queue. |

## Constants

```typescript
// sync.constants.ts
export const IDEMPOTENCY_TTL_DAYS = 90;
export const TOMBSTONE_TTL_DAYS = 90;
export const DEFAULT_PULL_LIMIT = 500;
export const MAX_PUSH_BATCH = 50;
export const MAX_PUSH_BYTES = 500_000;           // 500 KB
export const STALE_DEVICE_THRESHOLD_DAYS = 90;
export const SYNC_QUEUE_DONE_TTL_DAYS = 7;

// Entity priority (mobile push ordering, higher = first)
export const ENTITY_PRIORITY: Record<string, number> = {
  sale: 10,
  payment: 10,
  customer: 5,
  stock_movement: 3,
  product: 1,
  category: 1,
  tax: 1,
};
```

## Schedulers

**IdempotencyCleanupScheduler:**
- Cron: `@Cron('0 2 * * *')` — daily 02:00 UTC
- Query: `DELETE FROM processed_operations WHERE processed_at < NOW() - INTERVAL '90 days'`

**TombstoneGcScheduler:**
- Cron: `@Cron('0 3 * * 0')` — weekly Sunday 03:00 UTC
- Configurable table list (domain teams register on module init)
- Query per table: `DELETE FROM <table> WHERE deleted_at < NOW() - INTERVAL '90 days'`
- Only hard-delete permitted at application layer

**QueueCleanupScheduler (mobile sync_queue):**
- Cron: `@Cron('0 1 * * *')` — daily 01:00 UTC
- Query: `DELETE FROM sync_queue WHERE status='done' AND synced_at < NOW() - INTERVAL '7 days'`

## Implementation Steps

8. Create `sync.constants.ts` with all constants
9. Implement `IdempotencyCleanupScheduler` with DELETE logic
10. Implement `TombstoneGcScheduler` (configurable tables)
11. Implement `QueueCleanupScheduler`
12. Mark scheduler module `@Public` (skip AuthGuard)
13. Add tests for cleanup logic

---

# Phase 3 — Sync Core Infrastructure

Reusable primitives. No HTTP surface yet.

## New Files

| File | Purpose |
|---|---|
| `src/contexts/sync/types/device-context.ts` | `DeviceContext` interface. |
| `src/contexts/sync/types/sync-result.ts` | Discriminated union result type. |
| `src/contexts/sync/types/sync-operation.ts` | Inbound operation shape. |
| `src/contexts/sync/handlers/sync-handler.interface.ts` | Handler contract. |
| `src/contexts/sync/handlers/base-sync-handler.ts` | Abstract base class. |
| `src/contexts/sync/services/sync-cursor.service.ts` | Cursor parsing/building. |
| `src/contexts/sync/services/idempotency.service.ts` | Idempotency cache. |
| `src/contexts/sync/services/dispatcher.service.ts` | Handler registry. |

## Types

**DeviceContext:**
```typescript
interface DeviceContext {
  deviceId: string;    // X-Device-Id header
  userId: number;      // from JWT
  storeId: number;     // user's active store
}
```

**SyncResult (discriminated union):**
```typescript
type SyncResult =
  | { status: 'ok'; client_op_id: string; server_id: string; version: number }
  | { status: 'duplicate'; client_op_id: string; server_id: string; version: number }
  | { status: 'conflict'; client_op_id: string; server_state: object; reason: string }
  | { status: 'rejected'; client_op_id: string; reason: string }
  | { status: 'error'; client_op_id?: string; reason: string };
```

**SyncOperation:**
```typescript
interface SyncOperation {
  client_op_id: string;
  sequence: number;
  entity: string;
  operation: 'create' | 'update' | 'delete';
  client_id: string;  // UUID
  payload: Record<string, unknown>;
}
```

## Services

**SyncCursorService:**
- Parse: `"<ms>:<uuid>"` → `{ts: Date, id: string}`
- Build: last row → compound cursor string
- `INITIAL_CURSOR = '0:00000000-0000-0000-0000-000000000000'`

**IdempotencyService:**
- `find(clientOpId)`: returns cached SyncResult or null
- `save(clientOpId, deviceId, entity, result)`: saves ONLY terminal results
  - ✅ Saves: ok, duplicate, conflict, rejected
  - ❌ Never saves: error, unknown entity
  - Uses: INSERT ... ON CONFLICT DO NOTHING (race-safe)

**DispatcherService:**
- `register(entity, handler)`: register handler for entity
- `getHandler(entity)`: returns handler or undefined (doesn't throw)

## Handlers

**ISyncHandler Interface:**
```typescript
interface ISyncHandler<T> {
  readonly entity: string;
  apply(op, device, tx): Promise<SyncResult>;
  getChangesSince(cursorTs, cursorId, storeId, limit, tx): Promise<{
    changes: SyncChange[],
    hasMore: boolean,
    nextCursor: string
  }>;
}
```

**BaseSyncHandler (Abstract):**
- Implements `apply()` dispatch: create/update/delete
- `handleCreate()` → abstract, override in domain handler
- `handleUpdate()` → FOR UPDATE lock + version check + apply payload
- `handleDelete()` → soft delete only, version++, updated_at = NOW()
- Implements `getChangesSince()` → compound cursor with limit + 1
- Abstract methods: `toWireFormat()`, `applyCreate()`

## Key Design Decisions

**Compound Cursor Pagination:**
- Query: `(updated_at > cursorTs) OR (updated_at = cursorTs AND id > cursorId)`
- Solves: multiple rows with same updated_at (no skipping)
- Cursor format: `"<timestamp_ms>:<uuid>"`
- Fetch: `limit + 1` (to detect hasMore)

**Version Checking (Optimistic + Pessimistic):**
- Update/Delete acquire FOR UPDATE lock on row
- Check `current.version === payload.expected_version`
- If mismatch → return conflict + server_state
- Apply changes, `version++`, `updated_at = NOW()`

**Soft Deletes Only:**
- No hard DELETE at application layer
- DELETE operation → soft delete (deleted_at = NOW(), version++)
- Only tombstone-GC scheduler (Phase 2) may hard-delete after 90 days

## Implementation Steps

14. Define `DeviceContext`, `SyncResult`, `SyncOperation` types
15. Implement `SyncCursorService` (parse, build, INITIAL_CURSOR)
16. Implement `IdempotencyService` (find, conditional save with INSERT ON CONFLICT)
17. Implement `DispatcherService` (register, getHandler returns undefined)
18. Implement `ISyncHandler` interface
19. Implement `BaseSyncHandler` abstract class:
    - `apply()` dispatch to create/update/delete
    - `handleCreate()`, `handleUpdate()`, `handleDelete()`
    - `getChangesSince()` with compound cursor
    - Abstract `toWireFormat()`, `applyCreate()`

---

# Phase 4 — Sync Service & Controller ✅ COMPLETE (2026-05-04)

HTTP surface + orchestrator.

## Status: 7/8 Steps Complete (87.5%)

✅ SyncService with idempotency  
✅ SyncController with endpoints  
✅ DTOs with Zod validation  
✅ DeviceAuthGuard implemented  
✅ CurrentDevice decorator  
✅ Module wiring  
⏳ AppModule integration (FINAL STEP)

## New Files ✅

| File | Status | Purpose |
|---|---|---|
| `src/contexts/sync/sync.service.ts` | ✅ | `applyOperation()`, `pullEntity()` |
| `src/contexts/sync/sync.controller.ts` | ✅ | `POST /sync/push`, `GET /sync/pull` |
| `src/contexts/sync/sync.module.ts` | ✅ | NestJS module |
| `src/contexts/sync/guards/device-auth.guard.ts` | ✅ | Device validation |
| `src/contexts/sync/decorators/current-device.decorator.ts` | ✅ | `@CurrentDevice()` param |
| `src/contexts/sync/dto/*.dto.ts` | ✅ | Zod DTOs |
| `src/contexts/sync/index.ts` | ✅ | Barrel export |

## SyncService — Push (applyOperation)

```typescript
async applyOperation(op: SyncOperation, device: DeviceContext): Promise<SyncResult> {
  // 1. Check idempotency cache
  const cached = await this.idempotency.find(op.client_op_id);
  if (cached) return cached.result;

  // 2. Check handler exists BEFORE transaction (key: don't cache unknown entity)
  const handler = this.dispatcher.getHandler(op.entity);
  if (!handler) {
    return {
      client_op_id: op.client_op_id,
      status: 'error',
      reason: `Unknown entity: ${op.entity}`
    };
  }

  // 3. Dispatch in transaction
  let result: SyncResult;
  try {
    result = await this.dataSource.transaction(async (tx) => {
      return handler.apply(op, device, tx);
    });
  } catch (err) {
    // Transient error — NOT cached
    return {
      client_op_id: op.client_op_id,
      status: 'error',
      reason: err.message
    };
  }

  // 4. Cache ONLY terminal results
  await this.idempotency.save(
    op.client_op_id,
    device.deviceId,
    op.entity,
    result
  );

  return result;
}
```

## SyncService — Pull (pullEntity)

```typescript
async pullEntity(query: PullQuery, device: DeviceContext): Promise<PullResponse> {
  const { entity, cursor, limit = DEFAULT_PULL_LIMIT } = query;

  const handler = this.dispatcher.getHandler(entity);
  if (!handler) throw new BadRequestException(`Unknown entity: ${entity}`);

  const { cursorTs, cursorId } = this.cursorService.parse(cursor);

  // REPEATABLE READ: consistent snapshot
  return this.dataSource.manager.transaction('REPEATABLE READ', async (tx) => {
    const serverTime = await tx.query('SELECT NOW() AS now');

    const { changes, hasMore, nextCursor } = await handler.getChangesSince(
      cursorTs,
      cursorId,
      device.storeId,
      limit,
      tx
    );

    return {
      server_time: serverTime[0].now.toISOString(),
      entity,
      changes,
      has_more: hasMore,
      next_cursor: nextCursor
    };
  });
}
```

## SyncController

```typescript
@Controller('sync')
@UseGuards(DeviceAuthGuard)  // runs AFTER global AuthGuard
export class SyncController {
  @Post('push')
  async push(@Body() body: PushRequestDto, @CurrentDevice() device: DeviceContext) {
    const results = [];
    for (const op of body.operations) {
      results.push(await this.syncService.applyOperation(op, device));
    }
    return { server_time: new Date().toISOString(), results };
  }

  @Get('pull')
  async pull(@Query() query: PullQueryDto, @CurrentDevice() device: DeviceContext) {
    return this.syncService.pullEntity(query, device);
  }
}
```

## DeviceAuthGuard

```typescript
/**
 * IMPORTANT: This guard depends on global AuthGuard having already run.
 * AuthGuard populates req.user = { userId, activeStoreId, ... }.
 * DeviceAuthGuard reads req.user + X-Device-Id, validates device registration
 * for CURRENT active store, and attaches DeviceContext.
 *
 * After store switch (POST /auth/switch-store), active_store_fk changes.
 * DeviceAuthGuard then validates against the NEW store.
 */
@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(private deviceRegistrationService: DeviceRegistrationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const deviceId = req.headers['x-device-id'];
    if (!deviceId) throw new ForbiddenException('X-Device-Id header required');

    const userId = req.user?.userId;
    const activeStoreId = req.user?.activeStoreId;
    if (!userId || !activeStoreId) throw new ForbiddenException('Auth context missing');

    const registration = await this.deviceRegistrationService
      .findByDeviceAndUserAndStore(deviceId, userId, activeStoreId);
    if (!registration) {
      throw new ForbiddenException('Device not registered for this user at this store');
    }

    this.deviceRegistrationService.bumpLastSeen(registration.id).catch(() => {});

    req.deviceContext = { deviceId, userId, storeId: activeStoreId };
    return true;
  }
}
```

## DTOs (Zod)

**Push Request:**
```typescript
const PushRequestSchema = z.object({
  device_id: z.string().min(1),
  operations: z.array(SyncOperationSchema).min(1).max(MAX_PUSH_BATCH)
});
// + byte-size check middleware
```

**Pull Query:**
```typescript
const PullQuerySchema = z.object({
  entity: z.string().min(1),
  cursor: z.string().regex(/^\d+:[0-9a-f-]+$/i).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(500)
});
```

## API Surface

**`POST /sync/push`**
- Auth: Bearer + `X-Device-Id` (both required)
- Body: `{ device_id, operations[] }` (max 50 ops, 500 KB)
- Response: `{ server_time, results[] }`
- Status: `ok` | `duplicate` | `conflict` | `rejected` | `error`

**`GET /sync/pull`**
- Auth: Bearer + `X-Device-Id`
- Query: `entity`, `cursor` (optional), `limit` (1-500, default 500)
- Response: `{ server_time, entity, changes[], has_more, next_cursor }`
- Transaction: REPEATABLE READ

## Implementation Steps

20. ✅ Implement `SyncService.applyOperation()`
21. ✅ Implement `SyncService.pullEntity()`
22. ✅ Implement DTOs with Zod
23. ✅ Implement `DeviceAuthGuard`
24. ✅ Implement `@CurrentDevice()` decorator
25. ✅ Implement `SyncController`
26. ⏳ **Wire `SyncModule` into `AppModule` (FINAL STEP)**

---

# Phase 5 — Auth / Device Integration

Device registration as side-effect of login + store switch.

## New Files

| File | Purpose |
|---|---|
| `src/contexts/iam/auth/services/device/device-registration.service.ts` | `registerDevice()` with UPSERT logic |
| `src/contexts/iam/auth/repositories/devices.repository.ts` | CRUD helpers |

## Device Registration Flow

**On Login:**
```
POST /auth/login
  headers: { 'X-Device-Id': 'tablet-uuid' }

AuthController.login():
  1. Validate credentials
  2. Create session with active_store_fk = user.default_store_fk
  3. if (X-Device-Id header):
       await registerDevice(userId, activeStoreId, deviceId)
       → UPSERT (tablet-uuid, user-42, store-7)
  4. Return token
```

**On Store Switch:**
```
POST /auth/switch-store
  body: { storeId: 15 }
  headers: { 'X-Device-Id': 'tablet-uuid' }

AuthController.switchStore():
  1. Verify user can access store 15
  2. Update session: active_store_fk = 15
  3. await registerDevice(userId, storeId=15, deviceId)
     → UPSERT (tablet-uuid, user-42, store-15)
     → Old row (tablet-uuid, user-42, store-7) orphaned
  4. Return success
```

**On Sync Request:**
```
GET /sync/pull
  headers: {
    'Authorization': 'Bearer <token with activeStoreId: 15>',
    'X-Device-Id': 'tablet-uuid'
  }

DeviceAuthGuard:
  SELECT * FROM device_registrations
  WHERE device_id = 'tablet-uuid'
    AND user_fk = 42
    AND store_fk = 15  ← Now checks NEW store!
  → ✅ Found → Sync proceeds
```

## DeviceRegistrationService

```typescript
@Injectable()
export class DeviceRegistrationService {
  /**
   * Register or update device for user at store.
   * UPSERT: creates row for (device, user, NEW_STORE)
   * Old rows for (device, user, OLD_STORE) become orphaned.
   */
  async registerDevice(
    userId: number,
    storeId: number,
    deviceId: string
  ): Promise<DeviceRegistration> {
    return this.db
      .insert(deviceRegistration)
      .values({ deviceId, userId, storeId, lastSeenAt: new Date() })
      .onConflictDoUpdate({
        target: [
          deviceRegistration.deviceId,
          deviceRegistration.userId,
          deviceRegistration.storeId
        ],
        set: { lastSeenAt: new Date() }
      })
      .returning();
  }

  async findByDeviceAndUserAndStore(
    deviceId: string,
    userId: number,
    storeId: number
  ): Promise<DeviceRegistration | null> {
    const result = await this.db
      .select()
      .from(deviceRegistration)
      .where(
        and(
          eq(deviceRegistration.deviceId, deviceId),
          eq(deviceRegistration.userId, userId),
          eq(deviceRegistration.storeId, storeId)
        )
      )
      .limit(1);
    return result[0] || null;
  }

  async bumpLastSeen(registrationId: string): Promise<void> {
    await this.db
      .update(deviceRegistration)
      .set({ lastSeenAt: new Date() })
      .where(eq(deviceRegistration.id, registrationId))
      .execute();
  }
}
```

## AuthController Updates

```typescript
@Controller('auth')
export class AuthController {
  @Post('switch-store')
  @UseGuards(JwtAuthGuard)
  async switchStore(
    @Body() body: { storeId: number },
    @CurrentUser() user: User,
    @Req() req: any
  ) {
    const { storeId } = body;

    // 1. Verify access
    const hasAccess = await this.userStoreAccessService
      .userCanAccessStore(user.id, storeId);
    if (!hasAccess) {
      throw new ForbiddenException('No access to this store');
    }

    // 2. Update session
    await this.userSessionService.updateActiveStore(user.id, storeId);

    // 3. Update device registration (if mobile)
    const deviceId = req.headers['x-device-id'];
    if (deviceId) {
      await this.deviceRegistrationService.registerDevice(
        user.id,
        storeId,
        deviceId
      );
    }

    return { success: true, activeStoreId: storeId };
  }
}
```

## Implementation Steps

27. Implement `DevicesRepository` (upsert, find, bump)
28. Implement `DeviceRegistrationService.registerDevice()`
29. Add `updateActiveStore()` to `UserSessionService`
30. Add `switchStore()` endpoint to `AuthController`
31. Hook into login flow
32. Export from `AuthModule`

---

# Phase 6 — Web Write-Path Conformance

Every web/admin write on syncable tables must maintain version + updated_at.

## Contract

**On Create:**
```
version: 1
created_by_device: null (for web)
last_modified_by_user_id: current_user_id
updated_at: NOW()
```

**On Update:**
```
version: version + 1
last_modified_by_user_id: current_user_id
updated_at: NOW()
// Accept version in PATCH body, validate, return 409 on mismatch
```

**On Delete:**
```
// Soft delete only!
deleted_at: NOW()
version: version + 1
updated_at: NOW()
is_active: false
```

## Existing Files to Modify

| File | Change |
|---|---|
| Every domain write service | Increment version, set updated_at, set last_modified_by_user_id |
| Every PATCH /:id endpoint | Accept `version` in body, return 409 on mismatch with server_state |
| Every DELETE endpoint | Convert to soft delete. Hard DELETE forbidden. |
| `CLAUDE.md` | Document the contract |

## Implementation Steps

33. Audit ALL write services on syncable tables
34. Add version increment to every update path
35. Add updated_at = NOW() to every write
36. Add last_modified_by_user_id to every write
37. Update PATCH endpoints to accept/validate version
38. Convert hard DELETE to soft delete
39. Document contract in CLAUDE.md
40. Add CI check for version skips

---

# Phase 7 — Mobile Database Foundation

SQLite schema, migrations, app-launch recovery.

## New Files

| File | Purpose |
|---|---|
| `lib/db/schema.ts` | SQLite tables + sync columns |
| `lib/db/database.ts` | expo-sqlite + migration runner |
| `lib/db/recovery.ts` | App-launch reset |
| `lib/db/transactions.ts` | `writeWithQueue()` helper |
| `lib/db/device-id.ts` | Generate + persist stable UUID |

## Device ID Generation

```typescript
// lib/db/device-id.ts
import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';

const DEVICE_ID_KEY = 'sync_device_id';

export async function getOrCreateDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!id) {
    id = randomUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  }
  return id;
}
```

**Behavior:**
- iOS: Survives app reinstalls (Keychain)
- Android: Cleared on uninstall (Keystore)

## App-Launch Recovery

```typescript
// lib/db/recovery.ts
export async function runRecovery(db: SQLiteDatabase) {
  // Reset stuck queue rows
  await db.runAsync(
    `UPDATE sync_queue SET status = 'pending' WHERE status = 'in_progress'`
  );

  // Reset stuck domain rows
  const tables = ['sales', 'sale_items', 'customers', 'products', 'payments', 'categories', 'taxes'];
  for (const table of tables) {
    await db.runAsync(
      `UPDATE ${table} SET sync_status = 'pending' WHERE sync_status = 'syncing'`
    );
  }
}
```

## Implementation Steps

41. Implement `getOrCreateDeviceId()`
42. Define SQLite schema
43. Build migration runner
44. Implement `runRecovery()`
45. Implement `writeWithQueue()`

---

# Phase 8 — Mobile Sync Workers

Push and pull algorithms.

## New Files

| File | Purpose |
|---|---|
| `lib/sync/SyncQueue.ts` | Read/write helpers |
| `lib/sync/SyncApiClient.ts` | push/pull, 401 refresh |
| `lib/sync/PushWorker.ts` | Full push algorithm |
| `lib/sync/PullWorker.ts` | Full pull algorithm |
| `lib/sync/ConflictResolver.ts` | server_state storage + re-queue |
| `lib/sync/backoff.ts` | Exponential backoff + jitter |
| `lib/sync/cascading-failures.ts` | Dependency scan |

## PushWorker Algorithm

```
acquire push_mutex
try:
  while true:
    batch = SELECT FROM sync_queue
            WHERE status='pending' AND (next_retry_at IS NULL OR <= NOW())
            ORDER BY priority DESC, sequence ASC
            LIMIT 50

    if empty: break

    // Mark as in-progress
    for op in batch:
      UPDATE sync_queue SET status='in_progress'
      UPDATE <entity> SET sync_status='syncing'

    try:
      response = POST /sync/push { operations: batch }
    catch NetworkError:
      revert to pending
      break

    // Process results
    for result in response.results:
      switch result.status:
        'ok' | 'duplicate':
          UPDATE sync_queue SET status='done'
          UPDATE domain SET sync_status='synced', version=result.version
        'conflict':
          UPDATE sync_queue SET status='failed'
          UPDATE domain SET sync_status='failed'
          Store server_state for UI
        'rejected':
          UPDATE sync_queue SET status='failed'
        'error':
          UPDATE sync_queue SET status='pending', retry_count++, next_retry_at=backoff()

    // Cascading scan
    cascadingFailures.scan(response.results, remainingPendingOps)

  // Cleanup
  DELETE FROM sync_queue WHERE status='done' AND synced_at < NOW() - 7 days

finally:
  release push_mutex
```

## PullWorker Algorithm

```
acquire pull_mutex
try:
  for entity in [sales, customers, products, ...]:
    cursor = sync_metadata[entity].last_pulled_at
    has_more = true

    while has_more:
      response = GET /sync/pull?entity=<entity>&cursor=<cursor>&limit=500

      for change in response.changes:
        existing = SELECT sync_status FROM <entity> WHERE id = change.id

        // Local edits win
        if existing.sync_status IN ('pending', 'syncing', 'failed'):
          if change.operation == 'delete':
            UPDATE <entity> SET sync_status='failed'
          else:
            continue
        else:
          if change.operation == 'delete':
            UPDATE <entity> SET deleted_at=NOW(), sync_status='synced'
          else:
            INSERT INTO <entity> (...)
            ON CONFLICT(id) DO UPDATE SET sync_status='synced'

      has_more = response.has_more
      cursor = response.next_cursor

    // Advance only when fully drained
    UPDATE sync_metadata SET last_pulled_at = cursor

finally:
  release pull_mutex
```

## Implementation Steps

46. Implement `SyncQueue` helpers
47. Implement `SyncApiClient` (401 refresh + retry)
48. Implement `PushWorker`
49. Implement `PullWorker`
50. Implement `ConflictResolver`
51. Implement backoff + jitter
52. Implement cascading failures scan

---

# Phase 9 — Mobile Orchestration

Public sync API, triggers, lifecycle.

## New Files

| File | Purpose |
|---|---|
| `lib/sync/SyncManager.ts` | `requestSync()`, `forceSync()`, `ensureEmptyQueue()` |
| `lib/sync/NetworkMonitor.ts` | NetInfo → requestSync |
| `lib/sync/full-rebootstrap.ts` | Wipe + full pull |

## SyncManager

```typescript
async requestSync(): Promise<void>  // Debounced
async forceSync(): Promise<void>    // Immediate
async ensureEmptyQueue(timeoutMs: number): Promise<{ success: boolean; pendingCount: number }>
subscribe(listener: (state: SyncState) => void): () => void
```

## Stale Device Check

```typescript
const cursors = await db.getAllAsync('SELECT last_pulled_at FROM sync_metadata');
const oldestMs = Math.min(...cursors.map(c => parseCursor(c.last_pulled_at).ts));
const daysSinceOldest = (Date.now() - oldestMs) / (1000 * 60 * 60 * 24);

if (daysSinceOldest > STALE_DEVICE_THRESHOLD_DAYS) {
  await fullRebootstrap();
}
```

## Day-Close Forced Push

```typescript
async ensureEmptyQueue(timeoutMs: number): Promise<{ success: boolean; pendingCount: number }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const pending = await db.countAsync('sync_queue WHERE status IN ("pending","in_progress")');
    if (pending === 0) return { success: true, pendingCount: 0 };
    await this.forceSync();
    await sleep(1000);
  }
  const remaining = await db.countAsync('sync_queue WHERE status IN ("pending","in_progress")');
  return { success: remaining === 0, pendingCount: remaining };
}
```

## Implementation Steps

53. Implement `SyncManager`
54. Implement `NetworkMonitor`
55. Wire triggers
56. Implement stale-device check
57. Implement `fullRebootstrap()`
58. Implement `ensureEmptyQueue()` with timeout

---

# Phase 10 — Mobile Domain Conversion

Convert to local-first reads/writes.

## New Files

| File | Purpose |
|---|---|
| `components/SyncIndicator.tsx` | Cloud icon + status |
| `components/UnsyncedBadge.tsx` | Failed ops counter |
| `app/(protected)/(store)/sync-status.tsx` | Queue depth, last sync, failed items |

## Hook Conversion

```typescript
// ❌ BEFORE: Network-dependent
export function useSaleList(storeId: number) {
  const { data } = useQuery(['sales', storeId], () =>
    api.get(`/stores/${storeId}/sales`)
  );
}

// ✅ AFTER: Local-first
export function useSaleList(storeId: number) {
  const [sales, setSales] = useState<Sale[]>([]);
  const { db } = useDatabase();
  const { requestSync } = useSync();

  useEffect(() => {
    const load = async () => {
      const rows = await db.getAllAsync(
        'SELECT * FROM sales WHERE store_id = ? ORDER BY created_at DESC',
        [storeId]
      );
      setSales(rows);
    };
    load();
    const unsub = syncManager.subscribe(() => load());
    return unsub;
  }, [storeId]);

  return sales;
}

// ✅ Create mutation
export function useSaleCreate(storeId: number) {
  const { db } = useDatabase();
  const { requestSync } = useSync();

  const create = async (data: SaleCreateInput) => {
    const sale = {
      id: randomUUID(),
      ...data,
      store_id: storeId,
      sync_status: 'pending'
    };

    await db.withTransaction(async () => {
      await db.insertAsync('sales', sale);
      await db.insertAsync('sync_queue', {
        id: randomUUID(),
        entity_id: sale.id,
        entity_type: 'sale',
        operation: 'create',
        payload: sale,
        status: 'pending'
      });
    });

    await requestSync();
    return sale;
  };

  return { create };
}
```

## Implementation Steps

59. Convert all read hooks to SQLite
60. Convert all write hooks to `writeWithQueue()`
61. Implement `SyncIndicator`
62. Implement `UnsyncedBadge`
63. Implement sync-status screen
64. Implement conflict resolution UI
65. Implement dead-letter screen

---

# Phase 11 — Observability

Keep it simple for initial launch.

## Backend Logging

- Structured logs on push/pull with: duration, device_id, entity, op_count
- Log conflicts/rejections at WARN level
- Hourly stale-device check

## Mobile Metadata

- On push: include `{ queue_depth, oldest_pending_age_seconds, last_pushed_at, last_pulled_at, failed_count }`
- Backend logs metadata per-device

## Alerts

- Any device with `last_pushed_at` > 24h behind → log entry

## Implementation Steps

66. Add structured logging to push/pull
67. Add stale-device check scheduler
68. Include metadata in mobile push requests
69. Setup alert channel

---

# Phase 12 — Testing

## Test Cases

- Handler unit tests: create, update-ok, update-conflict, delete, not-found, invalid-op
- Idempotency: same op twice → cached; transient error → not cached; unknown entity → not cached
- Compound cursor: 1000 rows same updated_at → paginate without skipping
- REPEATABLE READ: concurrent write doesn't appear in snapshot
- Cascading failures: rejected parent → dependent pre-marked failed
- Web conformance: PATCH without version → 409; PATCH with wrong version → 409 + server_state
- Tombstone GC: 91-day-old → deleted; 89-day → survives
- Idempotency cleanup: 91-day-old → deleted; 89-day → survives
- Full re-bootstrap: wipe → pull → row counts match
- End-to-end: 100 ops queued → reconnect → all reach server, zero duplicates

## Implementation Steps

70. Write handler unit tests
71. Write idempotency tests
72. Write cursor tests
73. Write concurrency tests
74. Write cascading failure tests
75. Write web conformance tests
76. Write GC tests
77. Write e2e tests
78. Add CI guard for version skips
79. Target: >90% coverage

---

# Adding a Domain Handler (Template)

Once Phase 1-6 complete, adding sync support for new entity requires:

## Backend (One Service File)

```typescript
// src/contexts/products/services/products-sync.service.ts
@Injectable()
export class ProductsSyncService extends BaseSyncHandler<Product> {
  readonly entity = 'product';

  constructor(private productsRepo: ProductsRepository) { super(); }

  toWireFormat(row: Product) {
    return {
      id: row.id,
      name: row.name,
      price: row.price,
      version: row.version
    };
  }

  async applyCreate(op: SyncOperation, device: DeviceContext, tx: EntityManager) {
    const existing = await tx.findOne(Product, { where: { id: op.client_id } });
    if (existing) {
      return {
        status: 'duplicate',
        client_op_id: op.client_op_id,
        server_id: existing.id,
        version: existing.version
      };
    }

    const product = tx.create(Product, {
      id: op.client_id,
      ...op.payload,
      version: 1,
      store_fk: device.storeId,
      created_by_device: device.deviceId,
      updated_at: new Date()
    });
    await tx.save(product);

    return {
      status: 'ok',
      client_op_id: op.client_op_id,
      server_id: product.id,
      version: 1
    };
  }
}
```

## Register in Module

```typescript
// products.module.ts
export class ProductsModule implements OnModuleInit {
  constructor(
    private dispatcher: DispatcherService,
    private productsSyncService: ProductsSyncService
  ) {}

  onModuleInit() {
    this.dispatcher.register('product', this.productsSyncService);
  }
}
```

## Database

**Add sync columns:**
```typescript
export const products = pgTable('products', {
  ...baseEntity(),
  name: varchar(255).notNull(),
  price: numeric(12, 2).notNull(),
  ...syncColumns()  // ← Adds version, created_by_device, last_modified_by_user_id
});
```

**Add migration:**
```sql
ALTER TABLE products
  ADD COLUMN version INT NOT NULL DEFAULT 1,
  ADD COLUMN created_by_device TEXT,
  ADD COLUMN last_modified_by_user_id UUID;

UPDATE products SET version = 1;

CREATE INDEX idx_products_sync ON products(updated_at ASC, id ASC);
```

---

# Summary

**Total phases:** 12  
**Backend infrastructure phases:** 1-6  
**Mobile phases:** 7-9  
**Integration phases:** 10-12

**Key principles:**
- Explicit over implicit
- Clear error handling
- No surprises (terminal vs transient errors)
- Extensibility (one handler file per entity)

**Device registration & store switching:**
- Device registers at login with `X-Device-Id` header
- UPSERT: `(device_id, user_id, store_id)`
- Store switch: `POST /auth/switch-store` updates session + device registration
- DeviceAuthGuard validates sync requests for CURRENT active store
- No logout needed

**Ready to implement:** Phases 1-4 (database + infrastructure)