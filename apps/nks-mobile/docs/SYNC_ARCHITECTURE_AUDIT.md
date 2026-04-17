# Sync Architecture — How Data Is Checked & Synced Per Table

**Date:** April 2026  
**Files:** `lib/sync/sync-engine.ts`, `lib/sync/sync-lookups.ts`, `lib/database/repositories/sync-state.repository.ts`

---

## How Each Table Gets Its Data

```
┌─────────────────────────────────────────────────────────────────────┐
│                        13 LOCAL TABLES                              │
├──────────────────────┬──────────────────────────────────────────────┤
│   Cursor-Based Sync  │  routes                              ✅ Done │
├──────────────────────┼──────────────────────────────────────────────┤
│   TTL-Based Sync     │  lookup (9 types, 24h TTL)           ✅ Done │
├──────────────────────┼──────────────────────────────────────────────┤
│   NOT SYNCED YET     │  stores                              ❌ Gap  │
│                      │  status                              ❌ Gap  │
│                      │  entity_status_mapping               ❌ Gap  │
│                      │  entity_permissions                  ❌ Gap  │
│                      │  store_operating_hours               ❌ Gap  │
│                      │  tax_rate_master                     ❌ Gap  │
│                      │  user_role_mapping                   ❌ Gap  │
│                      │  state  (static ref data)            ❌ Gap  │
│                      │  district (static ref data)          ❌ Gap  │
├──────────────────────┼──────────────────────────────────────────────┤
│   Outbox (Push Only) │  mutation_queue                      ✅ Done │
├──────────────────────┼──────────────────────────────────────────────┤
│   Meta               │  sync_state                          ✅ Done │
└──────────────────────┴──────────────────────────────────────────────┘
```

**7 of 11 data tables have no sync mechanism at all.**

---

## Full Sync Flow Diagram

```
App comes online (NetInfo listener)
        │
        ▼
handleReconnection()
        │
        ├─ Step 1: GET /auth/session-status  (revocation check)
        ├─ Step 2: POST /auth/refresh-token  (token refresh)
        ├─ Step 3: GET /auth/mobile-jwks     (key cache refresh)
        ├─ Step 4: runSync(storeGuuid)        ◄──── SYNC ENGINE
        └─ Step 5: dispatch(setCredentials())


runSync(storeGuuid)
        │
        ├─── PULL phase: pullChanges(storeGuuid)
        │           │
        │           ├─ getCursor()  → reads sync_state WHERE key='cursor:routes'
        │           │                 returns 0 on first sync
        │           │
        │           └─ loop:
        │               GET /sync/changes?cursor=X&storeId=storeGuuid&tables=routes
        │                       │
        │               for each change:
        │                   if table='routes' AND op='upsert' → routesRepository.upsert()
        │                   if table='routes' AND op='delete' → routesRepository.delete()
        │                   other tables → ⚠️ SILENTLY IGNORED
        │                       │
        │               saveCursor(response.nextCursor)
        │               if !response.hasMore → break
        │
        └─── PUSH phase: pushMutations()
                    │
                    ├─ load offline session (contains userId, storeId, signature)
                    │
                    └─ loop:
                        getMutationQueueBatch(50)
                                │
                        for each item, sign:
                            SHA256(signingKey:op:table:JSON(opData))
                                │
                        POST /sync/push { operations[], offlineSession }
                                │
                        on success:  deleteMutationsById(processed ids)
                        on failure:  incrementRetry(batch[0].id)
                                     if retries >= 3 → DELETE mutation (hard)
                                     stop queue
```

---

## Table-by-Table Sync Status

### ✅ Table 1: `routes` — Cursor-Based Incremental Sync

**How it works:**

```
Cursor stored in:  sync_state WHERE key = 'cursor:routes'
Default cursor:    0 (means "give me everything since beginning")

Every sync cycle:
  GET /sync/changes?cursor={lastCursor}&storeId={guuid}&tables=routes
  → { nextCursor: 1714000000000, hasMore: false, changes: [...] }

For each change:
  operation='upsert' → routesRepository.upsert(data)   ← INSERT OR UPDATE on guuid conflict
  operation='delete' → routesRepository.delete(id)     ← physical delete

After all pages:
  saveCursor(nextCursor)                                ← saves to sync_state
```

**Conflict resolution:** Last-write-wins via `guuid` upsert. Server always wins on pull.

**Re-sync detection:** If cursor = 0, it's a fresh sync. If cursor > 0, it's incremental.

---

### ✅ Table 2: `lookup` — TTL-Based Full Replacement (24h)

**How it works:**

```
Sync trigger: syncLookups(dispatch, force=false)
Called from:  OTP verification success (after login)
              Manual force refresh

TTL check:
  getValue('sync:lookupSyncedAt')
  if (Date.now() - lastSynced) < 24h AND !force → skip

On sync:
  9 parallel API calls (Promise.allSettled):
    getSalutations()
    getCountries()
    getAddressTypes()
    getCommunicationTypes()
    getDesignations()
    getStoreLegalTypes()
    getStoreCategories()
    getCurrencies()
    getVolumes()

  For each type:
    clearByType(type)        ← delete all old rows for this type
    saveAll(type, rows)      ← insert fresh rows in a loop

  setValue('sync:lookupSyncedAt', Date.now())
```

**Freshness check:** `Date.now() - lastSynced < 24h` — time-based, not cursor.

**Partial failure:** Each type is independent. If `currencies` API fails, others still save. Failed types just log a warning and are retried on next sync cycle.

---

### ✅ Outbox: `mutation_queue` — Push-Only, FIFO

**How offline writes get synced:**

```
User action while offline:
  write-guard.ts checks: JWT expiry + role + permissions
  → mutationQueueRepository.enqueue(operation, entity, payload)

  Stored row:
    idempotency_key: uuidv7()       ← prevents duplicate submission
    status: 'pending'
    retries: 0
    max_retries: 5
    device_id: deviceFingerprint

On reconnect:
  pushMutations() picks up all 'pending' rows, ordered by id (FIFO)
  Sends to POST /sync/push
  On success: deleteByIds(processedIds)
  On failure: incrementRetry(id) with exponential backoff
              30s → 2min → 8min → 32min → 128min → quarantine
```

---

### ❌ Table 3: `stores` — NOT SYNCED

**Current state:**

```
SYNC_KEYS.CURSOR_STORES = 'cursor:stores'  ← defined but NEVER READ OR WRITTEN
storesRepository.upsert()                  ← exists but nothing calls it from sync
```

**Where does store data come from?**
The auth response includes `defaultStore: { guuid }` but this only provides the guuid, not full store details. The full store record (name, logo, timezone, status) is not populated into the local DB from any known sync path.

**Impact:** Store name, logo, operating hours shown to user may be stale or missing. POS can't display store info reliably offline.

---

### ❌ Table 4: `entity_permissions` — NOT SYNCED

**Current state:**

```
entityPermissionsRepository.upsert()   ← exists
entityPermissionsRepository.can()      ← used by write-guard (offline permission check)

But: nothing writes permissions to this table from any sync path.
```

**Impact:** `can()` will return `false` for everything (no rows = fail-safe deny). Offline permission checking is completely broken until this table is populated.

**Fix required:** Backend permission-snapshot endpoint + mobile sync (see `AUTH_RESPONSE_ISSUES.md` Issue #1 and backend guard fixes).

---

### ❌ Table 5: `tax_rate_master` — NOT SYNCED

**Current state:**

```
taxRateMasterRepository.upsert()        ← exists
taxRateMasterRepository.findByStore()   ← used to calculate tax offline

But: nothing populates this table.
```

**Impact:** All POS transactions offline use wrong tax rates (table is empty → 0% tax or error). This is a **financial calculation bug** — critical for a POS system.

---

### ❌ Table 6: `status` — NOT SYNCED

**Current state:**

```
SYNC_KEYS.CURSOR_STATUS = 'cursor:status'   ← defined but never used
statusRepository has upsert(), findAll()    ← exists but never driven by sync
```

**Impact:** Status dropdown options in forms (e.g., order status, product status) are empty offline.

---

### ❌ Table 7: `entity_status_mapping` — NOT SYNCED

No cursor, no sync path. Joined with `status` to show entity-specific statuses.

---

### ❌ Table 8: `store_operating_hours` — NOT SYNCED

No cursor, no sync. POS can't show "store is currently open/closed" without this.

---

### ❌ Table 9: `user_role_mapping` — NOT SYNCED

Populated from `authResponse.access.roles` on login/refresh only. If roles change server-side between sessions, mobile won't know until next login or token refresh.

---

### ❌ Tables 10–11: `state` + `district` — NOT SYNCED

Static Indian state/district reference data. Not expected to change frequently, but currently never loaded.

---

## Critical Bugs in Current Sync Code

### Bug 1: `pullChanges()` Silently Ignores Non-Route Tables

```ts
// sync-engine.ts line 206 — CURRENT
for (const change of response.changes) {
  if (change.table === 'routes') {           // ← hardcoded
    if (change.operation === 'upsert' ...) {
      await routesRepository.upsert(...)
    }
  }
  // change.table === 'stores' → IGNORED
  // change.table === 'status' → IGNORED
  // change.table === 'entity_permissions' → IGNORED
}
```

Even if the backend adds `stores` or `status` to the sync endpoint response, the mobile will silently ignore those changes. The cursor will advance (treating them as processed) but the rows will never be written.

**Fix:**

```ts
// sync-engine.ts — dispatch table changes to correct repository
for (const change of response.changes) {
  await applyChange(change);
}

async function applyChange(change: SyncChange): Promise<void> {
  switch (change.table) {
    case "routes":
      if (change.operation === "upsert" && change.data) {
        await routesRepository.upsert(mapRouteData(change.data));
      } else if (change.operation === "delete") {
        await routesRepository.delete(change.id);
      }
      break;

    case "stores":
      if (change.operation === "upsert" && change.data) {
        await storesRepository.upsert(mapStoreData(change.data));
      } else if (change.operation === "delete") {
        await storesRepository.delete(change.id);
      }
      break;

    case "status":
      if (change.operation === "upsert" && change.data) {
        await statusRepository.upsert(mapStatusData(change.data));
      }
      break;

    case "entity_permissions":
      if (change.operation === "upsert" && change.data) {
        await entityPermissionsRepository.upsert(
          mapPermissionData(change.data),
        );
      }
      break;

    case "tax_rate_master":
      if (change.operation === "upsert" && change.data) {
        await taxRateMasterRepository.upsert(mapTaxData(change.data));
      }
      break;

    default:
      log.warn(`Unknown table in sync change: ${change.table}`);
  }
}
```

---

### Bug 2: `MAX_RETRIES` Constant Ignores Schema's `max_retries` Column

```ts
// sync-engine.ts line 339 — CURRENT
const MAX_RETRIES = 3; // ← module constant

if (batch[0].retries + 1 >= MAX_RETRIES) {
  // delete mutation
}
```

But the schema defines:

```ts
// mutation-queue.schema.ts
max_retries: integer('max_retries').notNull().default(5),
```

The per-mutation `max_retries` column is **never read**. Every mutation is deleted after 3 retries regardless of its configured max.

**Fix:**

```ts
// sync-engine.ts
if (batch[0].retries + 1 >= batch[0].max_retries) {
  // read from the row, not a constant
  await mutationQueueRepository.markQuarantined(batch[0].id); // set status='quarantined'
  // do NOT hard delete — quarantined items can be reviewed/retried manually
}
```

---

### Bug 3: Max Retries → Hard Delete, Never Quarantines

```ts
// sync-engine.ts — CURRENT
await deleteMutationsById([batch[0].id]); // ← hard delete on max retries
```

The schema has `status = 'quarantined'` for failed mutations, but the sync engine **never sets this status** — it just deletes the row. Any offline write that fails 3 times silently disappears with no audit trail, no user notification, no recovery path.

**Fix:**

```ts
// mutation-queue.repository.ts — add method
async markQuarantined(id: number, errorCode: number, errorMsg: string): Promise<void> {
  await this.db
    .update(mutationQueue)
    .set({
      status:          'quarantined',
      last_error_code: errorCode,
      last_error_msg:  errorMsg,
    })
    .where(eq(mutationQueue.id, id));
}

// sync-engine.ts — use it
await mutationQueueRepository.markQuarantined(
  batch[0].id,
  (err as AxiosError).response?.status ?? 0,
  String(err)
);
// Show UI notification: "1 offline action could not be synced"
```

---

### Bug 4: `clientId` Changes on Every Retry — Duplicate Processing Risk

```ts
// sync-engine.ts line 275 — CURRENT
clientId: `${item.id}-${Date.now()}`,  // ← changes every retry!
```

Scenario:

1. Mobile sends mutation with `clientId: "42-1714000000"`
2. Server processes it and responds with `{ processed: 1 }`
3. Network drops before mobile receives response
4. Mobile retries with `clientId: "42-1714000001"` (new clientId)
5. Server processes it **again** → duplicate write

`idempotency_key` is stored in the DB but **never sent in the PushOperation body**. This is the exact purpose of idempotency keys.

**Fix:**

```ts
// sync-engine.ts
const op: PushOperation = {
  id: item.idempotency_key, // ← use idempotency_key as id
  clientId: item.idempotency_key, // ← stable across retries
  table: item.entity,
  op: item.operation,
  opData: item.payload,
};
```

Server should deduplicate by `id` field (already the idempotency key pattern).

---

### Bug 5: Single Shared Cursor for All Tables

```ts
// sync-state.repository.ts
async getCursor(): Promise<number> {
  const row = await this.getValue('cursor:routes');  // ← always 'cursor:routes'
  return row ? parseInt(row, 10) : 0;
}

async saveCursor(cursorMs: number): Promise<void> {
  await this.setValue('cursor:routes', String(cursorMs));  // ← always 'cursor:routes'
}
```

There is one cursor shared for everything. When multi-table sync is added:

- `stores` changes at cursor 100
- `routes` changes at cursor 200
- Shared cursor advances to 200 after routes sync
- Next sync asks for changes since 200 — `stores` changes at 100 are missed forever

**Fix:** Per-table cursors already defined in `SYNC_KEYS`, just not used:

```ts
// sync-state.repository.ts — add per-table cursor methods
async getCursorForTable(table: string): Promise<number> {
  const key = `cursor:${table}` as SyncKey;
  const row = await this.getValue(key);
  return row ? parseInt(row, 10) : 0;
}

async saveCursorForTable(table: string, cursorMs: number): Promise<void> {
  const key = `cursor:${table}` as SyncKey;
  await this.setValue(key, String(cursorMs));
}
```

---

### Bug 6: `lastSyncedAt` Is In-Memory Only

```ts
// sync-engine.ts
let _lastSyncedAt: number | null = null; // ← module-level variable

export function getLastSyncedAt(): number | null {
  return _lastSyncedAt;
}
```

This is a module-level variable — **lost on every app restart**. After a restart, `getLastSyncedAt()` returns `null` even if sync succeeded 2 minutes ago.

`SYNC_KEYS.LAST_SYNC_AT` is defined in sync-keys but never written.

**Fix:**

```ts
// After sync completes:
_lastSyncedAt = Date.now();
await syncStateRepository.setValue(
  SYNC_KEYS.LAST_SYNC_AT,
  String(_lastSyncedAt),
);

// On app startup, restore from DB:
const stored = await syncStateRepository.getValue(SYNC_KEYS.LAST_SYNC_AT);
if (stored) _lastSyncedAt = parseInt(stored, 10);
```

---

### Bug 7: `tables: 'routes'` Hardcoded in HTTP Request

```ts
// sync-engine.ts line 182-183 — CURRENT
params: {
  cursor,
  storeId: storeGuuid,
  tables: 'routes',   // ← hardcoded string, not from SYNC_KEYS
},
```

Should send all registered sync tables:

```ts
tables: Object.keys(TABLE_SYNC_HANDLERS).join(','),
// → 'routes,stores,status,entity_permissions,tax_rate_master'
```

---

### Bug 8: `clearByType` + `saveAll` Not in a Transaction in `syncLookups`

```ts
// sync-lookups.ts lines 108-109 — CURRENT
await lookupRepository.clearByType(type); // ← step 1: delete
await lookupRepository.saveAll(type, rows); // ← step 2: insert
// If app crashes between these two, lookup table is EMPTY for this type
```

Fix: wrap in a transaction (covered in `DATABASE_LAYER_AUDIT.md` Issue 6).

---

## What the Complete Sync Architecture Should Look Like

### Sync Coverage Target

| Table                   | Sync Method                  | Cursor Key              | When               |
| ----------------------- | ---------------------------- | ----------------------- | ------------------ |
| `routes`                | Cursor-based incremental     | `cursor:routes`         | Every reconnect    |
| `stores`                | Cursor-based incremental     | `cursor:stores`         | Every reconnect    |
| `status`                | Cursor-based incremental     | `cursor:status`         | Every reconnect    |
| `entity_status_mapping` | Cursor-based incremental     | piggyback on `status`   | Every reconnect    |
| `store_operating_hours` | Cursor-based incremental     | `cursor:store_hours`    | Every reconnect    |
| `entity_permissions`    | Permission-snapshot endpoint | `cursor:permissions`    | On login + 403     |
| `tax_rate_master`       | Cursor-based incremental     | `cursor:tax_rates`      | Every reconnect    |
| `user_role_mapping`     | From auth response + refresh | —                       | On login/refresh   |
| `lookup`                | TTL full-replace             | `sync:lookupSyncedAt`   | 24h TTL            |
| `state`                 | One-time load                | `sync:staticDataLoaded` | First install only |
| `district`              | One-time load                | `sync:staticDataLoaded` | First install only |
| `mutation_queue`        | PUSH outbox                  | —                       | Every reconnect    |
| `sync_state`            | Meta — never synced          | —                       | —                  |

---

### Sync State Visibility (How to Check If Synced)

Each table should be queryable for its sync status:

```ts
// How to check sync freshness for any table
async function getSyncStatus(): Promise<SyncStatus> {
  return {
    routes: {
      cursor: await syncStateRepository.getCursorForTable("routes"),
      isSynced: (await syncStateRepository.getCursorForTable("routes")) > 0,
    },
    lookup: {
      lastSyncedAt: await syncStateRepository.getValue(
        SYNC_KEYS.LOOKUP_SYNCED_AT,
      ),
      isStale: Date.now() - (lastSynced ?? 0) > 24 * 60 * 60 * 1000,
    },
    permissions: {
      cursor: await syncStateRepository.getCursorForTable("permissions"),
      isSynced:
        (await syncStateRepository.getCursorForTable("permissions")) > 0,
    },
    pendingMutations: await mutationQueueRepository.countByStatus("pending"),
    quarantined: await mutationQueueRepository.countByStatus("quarantined"),
  };
}
```

---

### Correct `pullChanges()` Structure

```ts
// sync-engine.ts — target architecture
const TABLE_HANDLERS: Record<
  string,
  (data: Record<string, unknown>, op: string, id: number) => Promise<void>
> = {
  routes: handleRouteChange,
  stores: handleStoreChange,
  status: handleStatusChange,
  entity_permissions: handlePermissionChange,
  tax_rate_master: handleTaxRateChange,
  store_operating_hours: handleOperatingHoursChange,
};

async function pullChanges(storeGuuid: string): Promise<void> {
  const tables = Object.keys(TABLE_HANDLERS);

  // Per-table cursors — use the minimum as the starting point
  const cursors = await Promise.all(
    tables.map((t) => syncStateRepository.getCursorForTable(t)),
  );
  const minCursor = Math.min(...cursors);

  let cursor = minCursor;

  while (true) {
    const res = await API.get<ChangesResponse>("/sync/changes", {
      params: { cursor, storeId: storeGuuid, tables: tables.join(",") },
    });

    for (const change of res.data.changes) {
      const handler = TABLE_HANDLERS[change.table];
      if (handler) {
        await handler(change.data ?? {}, change.operation, change.id);
        // Save per-table cursor as each table's changes are applied
        await syncStateRepository.saveCursorForTable(
          change.table,
          res.data.nextCursor,
        );
      }
    }

    if (!res.data.hasMore) break;
    cursor = res.data.nextCursor;
  }
}
```

---

## Fix Priority Order

```
WEEK 1 — Correctness:
  □ Bug 4: Use idempotency_key as clientId in PushOperation              (30min)
  □ Bug 3: Set status='quarantined' instead of hard delete               (1h)
  □ Bug 2: Use row.max_retries instead of constant MAX_RETRIES           (30min)
  □ Bug 8: Wrap clearByType+saveAll in a transaction                     (30min)

SPRINT 1 — Coverage:
  □ Bug 1: Add table dispatch switch in pullChanges()                    (2h)
  □ Bug 5: Switch to per-table cursors                                   (1h)
  □ Bug 6: Persist lastSyncedAt to sync_state DB                        (30min)
  □ Bug 7: Send all table names in tables= param                         (30min)
  □ Add sync for: stores, status, entity_permissions, tax_rate_master    (4h)
  □ Add sync for: store_operating_hours, state, district                 (2h)

SPRINT 2 — Observability:
  □ Add getSyncStatus() utility for UI sync indicator                    (1h)
  □ Add mutation count badge (pending + quarantined)                     (1h)
  □ Add per-table stale detection (warn if cursor > 1h old)             (1h)
```

---

## What Is Working Correctly ✅

| Feature                                    | Assessment                                            |
| ------------------------------------------ | ----------------------------------------------------- |
| `routes` cursor-based incremental sync     | ✅ Correct pattern                                    |
| `saveCursor` after each page (not at end)  | ✅ Crash-safe — partially synced pages are re-fetched |
| `lookup` 24h TTL + Promise.allSettled      | ✅ Partial failure tolerant                           |
| FIFO push queue (`ORDER BY id ASC`)        | ✅ Operations arrive at server in creation order      |
| Exponential backoff in `incrementRetry()`  | ✅ 30s → 2min → 8min → 32min → 128min                 |
| Offline session sent with push             | ✅ Server can re-validate HMAC on receive             |
| Operation signing SHA256-HMAC              | ✅ Server can detect tampered operations              |
| `_syncing` flag prevents concurrent runs   | ✅ No double-sync on network flap                     |
| 25s timeout (5s margin before backend 30s) | ✅ Correct timeout strategy                           |
| `clearAllTables()` on logout               | ✅ No cross-user data leakage                         |

---

_Document generated from live codebase analysis — April 2026_
