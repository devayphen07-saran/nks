# Offline-First Sync Architecture

**ADR-002** | **Status:** Accepted | **Date:** 2026-04-17
**Platform:** React Native Expo (SQLite + Drizzle) ↔ NestJS API (Postgres)

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Pull Sync](#pull-sync)
3. [Push Sync](#push-sync)
4. [Offline Queue System](#offline-queue-system)
5. [Table-Level Sync State](#table-level-sync-state)
6. [Change Tracking](#change-tracking)
7. [Conflict Resolution](#conflict-resolution)
8. [Sync Triggering](#sync-triggering)
9. [Database Design](#database-design)
10. [Scalability](#scalability)
11. [Production Architecture](#production-architecture)
12. [Trade-off Summary](#trade-off-summary)
13. [Action Items](#action-items)

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          MOBILE CLIENT                                        │
│                                                                               │
│  ┌─────────────┐   write    ┌──────────────────┐   findBatch   ┌──────────┐ │
│  │  UI Screen  │──────────▶ │  mutation_queue   │◀────────────  │  Push    │ │
│  └─────────────┘            │  (SQLite outbox)  │               │  Engine  │ │
│         │                   └──────────────────┘               └────┬─────┘ │
│         │ assertWriteAllowed()                                       │ POST  │
│         ▼                                                            ▼       │
│  ┌──────────────┐           ┌──────────────────┐         ┌──────────────┐   │
│  │ write-guard  │           │   sync_state      │         │ /sync/push   │   │
│  │ permissions? │           │  cursor:routes=T  │         └──────────────┘   │
│  │ JWKS fresh?  │           │  cursor:perms=0   │                            │
│  │ token valid? │           │  LAST_FULL_SYNC   │         ┌──────────────┐   │
│  └──────────────┘           └──────────────────┘         │/sync/changes │   │
│                                      ▲                    └──────┬───────┘   │
│                              advance │                           │ GET       │
│                                      │                    ┌──────▼───────┐   │
│  ┌─────────────────────────────────────────────────────┐  │  Pull Engine │   │
│  │              SQLite (Drizzle ORM + SQLCipher)        │  └──────────────┘   │
│  │  routes │ stores │ entity_permissions │ tax_rate ... │                     │
│  └─────────────────────────────────────────────────────┘                     │
└──────────────────────────────────────────────────────────────────────────────┘
                          ▲  GET               POST  ▲
                          │                          │
┌──────────────────────────────────────────────────────────────────────────────┐
│                          BACKEND API                                          │
│                                                                               │
│  GET  /sync/changes?storeId=X&cursor=Y&tables=a,b&limit=200                 │
│       → { changes[], nextCursor, hasMore }                                   │
│                                                                               │
│  POST /sync/push  { operations[], offlineSession }                           │
│       → { processed: N, rejected: M }                                        │
│                                                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Postgres: change_log(table, row_id, op, data, updated_at, store_id)  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Role |
|---|---|
| `lib/sync/sync-engine.ts` | `runSync / runPullOnly / runPushOnly / initializeSyncEngine` |
| `lib/sync/sync-table-handlers.ts` | Per-table upsert/delete handlers + API→DB row mappers |
| `lib/sync/sync-status.ts` | `isTableSynced / getSyncStatus / isReadyForOffline` |
| `lib/sync/sync-lookups.ts` | TTL-based full-replacement for lookup tables |
| `lib/database/repositories/sync-state.repository.ts` | Per-table cursor read/write |
| `lib/database/repositories/mutation-queue.repository.ts` | Full queue lifecycle |
| `lib/utils/write-guard.ts` | `assertWriteAllowed()` — gate before every offline write |

---

## Pull Sync

### Strategy: Per-Table Cursor-Based Incremental Sync

Every synced table has its own Unix-millisecond cursor stored in `sync_state`:

```
sync_state (key-value table)
──────────────────────────────────────────
key                      │ value
──────────────────────────────────────────
cursor:routes            │ 1714050000000   ← last applied updatedAt
cursor:stores            │ 1714050000000
cursor:entity_permissions│ 0               ← never synced
cursor:tax_rate_master   │ 1714000000000   ← synced, but stale
cursor:status            │ 1714050000000
LAST_FULL_SYNC_AT        │ 1714050000000
LAST_SYNC_AT             │ 1714052000000
LOOKUP_SYNCED_AT         │ 1714000000000
```

> The cursor value = `updated_at` of the **last successfully applied change** for that table.

### Why Per-Table Cursors — Not One Global Cursor

**Problem with a single global cursor:**

```
Global cursor = 1714050000  (synced 2 hours ago)
You add entity_permissions table to codebase.
Client sends: cursor=1714050000
Server returns: only changes AFTER that timestamp
entity_permissions never gets its initial data ← BOOTSTRAP FAILURE
```

**Per-table cursor solution — the MIN window:**

```typescript
// Read all per-table cursors
const tableCursors: Record<string, number> = {};
await Promise.all(
  SYNC_TABLES.map(async (table) => {
    tableCursors[table] = await syncStateRepository.getCursorForTable(table);
  })
);

// Send the minimum — catches any table not yet synced
const minCursor = Math.min(...Object.values(tableCursors));
// routes=1714050000, entity_permissions=0 → sends 0
// Server returns everything since T=0
// entity_permissions gets full bootstrap
// routes cursor only advances when routes changes are applied — no duplicate data
```

New tables added to `TABLE_HANDLERS` automatically bootstrap on the next sync without any special-case code.

### Pull Request Flow

```
Client                                         Server
  │                                               │
  │  1. Compute per-table cursors                 │
  │     routes=1714050000, perms=0 → min=0        │
  │                                               │
  │  GET /sync/changes                            │
  │  ?cursor=0                                    │
  │  &storeId=abc-123-def-456                     │
  │  &tables=routes,stores,entity_permissions,... │
  │  &limit=200                                   │
  │ ─────────────────────────────────────────────▶│
  │                                               │
  │  ◀── {                                        │
  │    changes: [                                 │
  │      { table: "entity_permissions", id: 12,   │
  │        op: "upsert", data: {...},             │
  │        updatedAt: 1714049000000 },            │
  │      { table: "routes", id: 3,                │
  │        op: "upsert", data: {...},             │
  │        updatedAt: 1714050100000 }             │
  │    ],                                         │
  │    nextCursor: 1714050100000,                 │
  │    hasMore: true                              │
  │  }                                            │
  │                                               │
  │  2. Dispatch each change via TABLE_HANDLERS   │
  │     change.table → handler.onUpsert(id, data) │
  │     or handler.onDelete(id)                   │
  │                                               │
  │  3. Advance only changed tables' cursors      │
  │     entity_permissions: 0 → 1714049000000     │
  │     routes: 1714050000 → 1714050100000        │
  │     ← saved to SQLite after EACH page         │
  │                                               │
  │  4. hasMore=true → loop                       │
  │  GET /sync/changes?cursor=1714050100000       │
  │ ─────────────────────────────────────────────▶│
```

### Incremental vs Full Sync Decision Table

| Situation | Cursor Sent | Result |
|---|---|---|
| Fresh install | 0 for all tables | Full bootstrap for everything |
| Normal startup | Per-table cursors | Delta only for each table |
| New table added | 0 for that table | Bootstrap that table only |
| `resetCursorForTable('routes')` | 0 for routes only | Re-sync routes, others untouched |
| Schema migration | Reset affected tables | Targeted re-bootstrap |
| Manual "force full sync" | Reset all cursors | Complete re-download |

### Pagination Safety

Cursors are persisted to SQLite **after each page completes**, not at the end of the full pull. If the app crashes on page 3 of 5, the next startup resumes from page 3.

```typescript
// After applying all changes on this page:
await Promise.all(
  Object.entries(newTableCursors).map(([table, cursor]) => {
    if (cursor !== tableCursors[table]) {  // only write if advanced
      return syncStateRepository.saveCursorForTable(table, cursor);
    }
  })
);
// THEN advance to next page
currentCursor = response.nextCursor;
```

### Cursor Regression Protection

`saveCursorForTable()` silently ignores any attempt to go backwards:

```typescript
async saveCursorForTable(table: string, cursorMs: number): Promise<void> {
  const current = await this.getCursorForTable(table);
  if (cursorMs <= current) return; // never go backwards
  // ... upsert
}
```

---

## Push Sync

### Outbox Pattern — Not `isDirty` Flags

```
Traditional isDirty approach (fragile):
  1. Write invoice to SQLite
  2. Set invoice.isDirty = true           ← separate step
  3. App crashes between 2 and 3          ← LOST CHANGE
  4. Query isDirty=true rows              ← no type safety
  5. Push them

Outbox pattern (this codebase):
  1. Write invoice to SQLite
  2. INSERT into mutation_queue           ← atomic with step 1
     (or wrap both in one transaction)
  3. Queue row IS the dirty state
  4. Each queued item has type, status, retry, backoff, audit trail
```

### Push Sequence

```
Offline write happens:
  mutationQueueRepository.enqueue('CREATE', 'invoices', { total: 450 })
  → { id: 42, idempotency_key: "018f4a2c-...", status: "pending", retries: 0 }

[Connectivity returns → runSync() or runPushOnly()]

Engine:
  1. findBatch(50)           → pending rows where backoff elapsed (FIFO)
  2. markInProgress([42])    → status='in_progress' (crash recovery marker)
  3. Build PushOperation:
     {
       id:        "018f4a2c-...",   ← STABLE KEY (never changes across retries)
       clientId:  "018f4a2c-...",   ← same key
       table:     "invoices",
       op:        "CREATE",
       opData:    { total: 450 },
       signature: SHA256(signingKey:CREATE:invoices:{"total":450})
     }
  4. POST /sync/push { operations: [...], offlineSession: { ... } }
  5a. Success → markSynced([42]) → DELETE row
  5b. Auth error (401/403) → resetToRetry([42]) → stop cycle
  5c. Network error → incrementRetry(42) → exponential backoff
  5d. Max retries exceeded → markQuarantined(42, 0, "Max retries")
```

### Why `idempotency_key` — Not `id`

```typescript
// WRONG — id is SQLite autoincrement, changes after clearAllTables / reinstall
clientId: String(item.id)

// CORRECT — uuidv7 set once at enqueue time, persists through all retries
clientId: item.idempotency_key  // "018f4a2c-1234-7abc-def0-1234567890ab"
```

If a push succeeds server-side but the network dies before the 200 ACK reaches the client, the client retries with the same `idempotency_key`. The server has already processed this key and returns success without double-applying.

### Server Response Contract

```typescript
interface PushResponse {
  processed: number;  // first N operations in the batch were applied
  rejected?: number;  // next M operations were hard-rejected
  // any ops at positions processed+rejected..end are soft failures
  // client resets those to pending (not quarantine)
}

// Batch of 10, server returns { processed: 6, rejected: 2 }:
// [0..5]  → markSynced()      → deleted
// [6..7]  → markQuarantined() → kept forever, error=400
// [8..9]  → resetToRetry()    → back to pending, no backoff
//         → return early (don't fetch next batch this cycle)
```

---

## Offline Queue System

### Queue Schema

```sql
CREATE TABLE mutation_queue (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  idempotency_key  TEXT    NOT NULL UNIQUE,   -- uuidv7, stable across retries
  operation        TEXT    NOT NULL,           -- CREATE | UPDATE | DELETE
  entity           TEXT    NOT NULL,           -- table name
  payload          TEXT    NOT NULL,           -- JSON string
  status           TEXT    NOT NULL DEFAULT 'pending',
  retries          INTEGER NOT NULL DEFAULT 0,
  max_retries      INTEGER NOT NULL DEFAULT 5,
  next_retry_at    INTEGER,                    -- Unix ms, NULL = ready now
  last_error_msg   TEXT,
  last_error_code  INTEGER,
  device_id        TEXT,
  created_at       INTEGER NOT NULL,
  synced_at        INTEGER                     -- set before delete (audit)
);

CREATE INDEX idx_mq_ready ON mutation_queue(status, next_retry_at);
```

### Status State Machine

```
enqueue()
    │
    ▼
┌─────────┐  findBatch()          ┌─────────────┐
│ pending │  backoff elapsed ────▶│ in_progress  │
└─────────┘                       └──────┬───────┘
    ▲                                     │
    │                     ┌───────────────┼──────────────────┐
    │                  success       auth error         net error
    │                     │              │                   │
    │                     ▼              ▼                   │
    │               markSynced()   resetToRetry()            │
    │                     │              │                   │
    │                     ▼              └───────────────────┤
    │               ┌─────────┐                 incrementRetry()
    │               │ synced  │──▶ DELETE              │
    │               └─────────┘             retries < max
    │                                             │
    └─────────────────────────────────────────────┘
                                        retries >= max
                                             │
                                             ▼
                                       markQuarantined()
                                             │
                                             ▼
                                     ┌─────────────┐
                                     │ quarantined │ ← kept forever (audit)
                                     └─────────────┘
```

### Exponential Backoff

```typescript
const BACKOFF_MS = [30_000, 120_000, 480_000, 1_920_000, 7_200_000];
//                   30s      2min     8min     32min      120min

// retry 1 → next_retry_at = now + 30s
// retry 2 → next_retry_at = now + 2min
// retry 3 → next_retry_at = now + 8min
// retry 4 → next_retry_at = now + 32min
// retry 5 → quarantine (default max_retries = 5)
```

`findBatch()` SQL filter:
```sql
WHERE status = 'pending'
  AND (next_retry_at IS NULL OR next_retry_at <= <now_ms>)
ORDER BY id ASC   -- FIFO
LIMIT 50
```

### Corrupted Payload Guard

`findBatch()` auto-quarantines unparse-able rows so they never block the queue:

```typescript
for (const row of rows) {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(row.payload);
  } catch {
    await this.markQuarantined(row.id, 0, 'Corrupted JSON payload');
    continue;  // skip — don't add to batch, don't crash
  }
  items.push({ ...row, payload });
}
```

### Partial Failure Handling

```
Batch sent: [A, B, C, D, E]
Server:     { processed: 2, rejected: 1 }

[A, B]  → markSynced()       → deleted
[C]     → markQuarantined()  → quarantined, error=400
[D, E]  → resetToRetry()     → pending, no backoff
        → return early — stop processing queue this cycle
        → D and E will retry on next sync cycle
```

The early return prevents charging ahead when the tail of a batch is in an uncertain state.

---

## Table-Level Sync State

### What "Synced" Means

```typescript
cursor === 0           → 'never_synced'   (no data for this table)
Date.now() - cursor < 1h → 'synced'      (fresh data)
Date.now() - cursor ≥ 1h → 'stale'       (data exists but old)
```

### Full Status Snapshot

```typescript
const status = await getSyncStatus();
// {
//   tables: {
//     routes:             { cursor: 1714050000, isSynced: true,  health: 'synced' },
//     stores:             { cursor: 1714050000, isSynced: true,  health: 'synced' },
//     entity_permissions: { cursor: 0,          isSynced: false, health: 'never_synced' },
//     tax_rate_master:    { cursor: 1710000000, isSynced: true,  health: 'stale' },
//   },
//   queue: {
//     pending: 3, inProgress: 0, failed: 0, quarantined: 1, total: 4
//   },
//   lastFullSyncAt: 1714050000000,
//   isLookupStale: false
// }
```

### Offline Readiness Gate

Before entering offline POS mode, all critical tables must have `cursor > 0`:

```typescript
const CRITICAL_TABLES = [
  'routes',
  'stores',
  'entity_permissions',  // must exist before any permission check
  'tax_rate_master',     // must exist before any sale
  'status',
];

const { ready, missing } = await isReadyForOffline();
// ready=false, missing=['entity_permissions'] → block offline mode
```

### sync_state Key Taxonomy

| Key | Purpose |
|---|---|
| `cursor:{tableName}` | Per-table incremental sync position (Unix ms) |
| `LAST_FULL_SYNC_AT` | Timestamp when last complete pull+push cycle finished |
| `LAST_SYNC_AT` | Timestamp when last pull finished (may be pull-only) |
| `LOOKUP_SYNCED_AT` | Timestamp for TTL-based lookup table refresh |

---

## Change Tracking

### Server Side — Two Backend Patterns

**Pattern A: Query by `updated_at`** (simpler, works with soft deletes)

```sql
SELECT 'routes' AS table_name, id,
  CASE WHEN deleted_at IS NOT NULL THEN 'delete' ELSE 'upsert' END AS operation,
  CASE WHEN deleted_at IS NOT NULL THEN NULL ELSE row_to_json(routes) END AS data,
  GREATEST(updated_at, COALESCE(deleted_at, '1970-01-01')) AS updated_at
FROM routes
WHERE store_id = $storeId
  AND GREATEST(updated_at, COALESCE(deleted_at, '1970-01-01')) > $cursor
UNION ALL
-- ... repeat per table
ORDER BY updated_at ASC
LIMIT $limit
```

**Pattern B: Dedicated `change_log` table** ← recommended for production

```sql
CREATE TABLE change_log (
  id         BIGSERIAL    PRIMARY KEY,
  table_name TEXT         NOT NULL,
  row_id     INTEGER      NOT NULL,
  operation  TEXT         NOT NULL,   -- 'upsert' | 'delete'
  data       JSONB,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  store_id   UUID
);

CREATE INDEX idx_change_log_cursor ON change_log(store_id, updated_at);

-- Populated by Postgres trigger on INSERT/UPDATE/DELETE
CREATE OR REPLACE FUNCTION record_change() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO change_log(table_name, row_id, operation, store_id)
    VALUES (TG_TABLE_NAME, OLD.id, 'delete', OLD.store_id);
  ELSE
    INSERT INTO change_log(table_name, row_id, operation, data, store_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'upsert', row_to_json(NEW), NEW.store_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

Pattern B advantages: handles hard deletes, one query instead of N UNIONs, decouples sync API from table schema.

### Client Side — Outbox (No `isDirty` Flags)

```
User creates sale → enqueue('CREATE', 'sales', data)
User edits sale   → enqueue('UPDATE', 'sales', { id, ...changes })
User cancels sale → enqueue('DELETE', 'sales', { id })
```

The queue is FIFO by `id`. A DELETE after a CREATE on the same row is safe — CREATE is always processed first.

### Soft Deletes

All server-owned tables have `deleted_at` and `is_active`. Physical DELETE on the server generates a `delete` change log entry; the client handler calls `repository.delete(id)`. Soft-delete on the server generates an `upsert` with `deleted_at` set; the client stores the row with `deleted_at` populated.

---

## Conflict Resolution

### Strategy Matrix

| Data Type | Strategy | Reasoning |
|---|---|---|
| Reference data (routes, permissions, tax rates) | **Server authoritative** | Server owns this; client never mutates it |
| POS transactions (sales, payments) | **Last-write-wins + version check** | Isolated sessions; financial data needs audit |
| Lookup/reference lists | **Full replacement (TTL)** | Entire table replaced; no partial conflict |

### Version-Based Conflict Detection

```typescript
// Client stores the server's version at time of last sync
interface InvoiceRow {
  id:      number;
  total:   number;
  version: number;  // incremented server-side on every write
}

// Push payload includes the version the client was editing:
{
  op: 'UPDATE',
  table: 'invoices',
  opData: {
    id: 5,
    total: 500,
    base_version: 3   // "I was editing version 3"
  }
}

// Server: if current.version !== base_version → conflict → reject
// Server: if current.version === base_version → apply, increment to 4
```

### Conflict Outcomes

| Strategy | When to Use | Result |
|---|---|---|
| **Hard reject → quarantine** | Financial records | Human resolves; full audit trail |
| **Server wins** | Non-critical settings | Server value overwrites; silent |
| **Last-write-wins** | Non-overlapping POS sessions | `updated_at` timestamp decides |
| **Field-level merge** | Profile/config | Server applies only non-null incoming fields |

---

## Sync Triggering

### Complete Trigger Map

```typescript
// 1. App Launch — store/initialize-auth.ts
await initializeDatabase();
await initializeSyncEngine();            // resetStuck() + restore lastSyncedAt
syncLookups(dispatch).catch(() => {});   // TTL-based lookup refresh

// 2. After Successful Login — store/persist-login.ts
await runSync(activeStore.guuid);

// 3. Network Reconnect — NetInfo listener
NetInfo.addEventListener(state => {
  if (state.isConnected && state.isInternetReachable) {
    const jitter = Math.random() * 15_000;  // prevent sync storm
    setTimeout(() => runSync(storeGuuid).catch(() => {}), jitter);
  }
});

// 4. App Foregrounded — AppState listener
AppState.addEventListener('change', nextState => {
  if (nextState === 'active') {
    const last = getLastSyncedAt();
    const MIN_INTERVAL = 5 * 60 * 1000;
    if (!last || Date.now() - last > MIN_INTERVAL) {
      runSync(storeGuuid).catch(() => {});
    }
  }
});

// 5. After Offline Write — best-effort immediate push
async function enqueueAndPush(op: string, entity: string, payload: object) {
  await mutationQueueRepository.enqueue(op, entity, payload);
  runPushOnly().catch(() => {});  // fails silently if offline
}

// 6. Manual Pull-to-Refresh — in screen component
const onRefresh = async () => {
  setRefreshing(true);
  await runSync(storeGuuid);
  setRefreshing(false);
};
```

### Sync Guard (Debounce + Timeout)

```typescript
let _syncing = false;

export async function runSync(storeGuuid: string): Promise<void> {
  if (_syncing) {
    log.debug('Sync already in progress — skipping');
    return;  // All concurrent triggers collapse into the running sync
  }
  _syncing = true;

  try {
    await Promise.race([
      _syncWork(storeGuuid),
      _timeout(25_000, 'Sync timed out after 25s'),  // 5s margin before backend 30s limit
    ]);

    _lastSyncedAt = Date.now();
    await syncStateRepository.setValue(SYNC_KEYS.LAST_FULL_SYNC_AT, String(_lastSyncedAt));
  } finally {
    _syncing = false;  // always release, even on error or timeout
  }
}
```

---

## Database Design

### Full Local Schema

```sql
-- ─── Sync Metadata ─────────────────────────────────────────────────────────────
CREATE TABLE sync_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Keys: cursor:{table}, LAST_FULL_SYNC_AT, LAST_SYNC_AT, LOOKUP_SYNCED_AT

-- ─── Mutation Outbox ───────────────────────────────────────────────────────────
CREATE TABLE mutation_queue (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  idempotency_key  TEXT    NOT NULL UNIQUE,
  operation        TEXT    NOT NULL,
  entity           TEXT    NOT NULL,
  payload          TEXT    NOT NULL,
  status           TEXT    NOT NULL DEFAULT 'pending',
  retries          INTEGER NOT NULL DEFAULT 0,
  max_retries      INTEGER NOT NULL DEFAULT 5,
  next_retry_at    INTEGER,
  last_error_msg   TEXT,
  last_error_code  INTEGER,
  device_id        TEXT,
  created_at       INTEGER NOT NULL,
  synced_at        INTEGER
);
CREATE INDEX idx_mq_ready ON mutation_queue(status, next_retry_at);

-- ─── Server-Owned Reference Tables (pull-only) ─────────────────────────────────
CREATE TABLE routes (
  id               INTEGER PRIMARY KEY,
  guuid            TEXT    NOT NULL,
  route_name       TEXT    NOT NULL,
  route_path       TEXT    NOT NULL,
  full_path        TEXT    NOT NULL,
  parent_route_fk  INTEGER,
  route_type       TEXT    NOT NULL,
  route_scope      TEXT    NOT NULL,
  is_public        INTEGER NOT NULL DEFAULT 0,
  is_active        INTEGER NOT NULL DEFAULT 1,
  updated_at       TEXT    NOT NULL,
  deleted_at       TEXT
);

CREATE TABLE entity_permissions (
  id           INTEGER PRIMARY KEY,
  role_code    TEXT    NOT NULL,
  entity_code  TEXT    NOT NULL,
  store_guuid  TEXT,              -- NULL = global permission
  can_view     INTEGER NOT NULL DEFAULT 0,
  can_create   INTEGER NOT NULL DEFAULT 0,
  can_edit     INTEGER NOT NULL DEFAULT 0,
  can_delete   INTEGER NOT NULL DEFAULT 0,
  deny         INTEGER NOT NULL DEFAULT 0,
  UNIQUE (role_code, entity_code, store_guuid)  -- prevents duplicate syncs
);

CREATE TABLE tax_rate_master (
  id                INTEGER PRIMARY KEY,
  guuid             TEXT    NOT NULL,
  store_fk          INTEGER NOT NULL,
  commodity_code_fk INTEGER NOT NULL,
  base_tax_rate     REAL    NOT NULL,
  component1_rate   REAL,     -- CGST
  component2_rate   REAL,     -- SGST
  component3_rate   REAL,     -- IGST
  additional_rate   REAL    NOT NULL DEFAULT 0,
  effective_from    TEXT    NOT NULL,
  effective_to      TEXT,
  is_active         INTEGER NOT NULL DEFAULT 1,
  updated_at        TEXT    NOT NULL,
  deleted_at        TEXT
);

-- ─── Client-Created Data (goes through mutation queue) ─────────────────────────
CREATE TABLE invoices (
  id          TEXT    PRIMARY KEY,  -- client-generated UUIDv7
  store_guuid TEXT    NOT NULL,
  total       REAL    NOT NULL,
  status_code TEXT    NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  synced_at   INTEGER,              -- NULL = not yet confirmed by server
  deleted_at  INTEGER
);
```

### Key Design Decisions

| Choice | Reason |
|---|---|
| `sync_state` as key-value | New tables need no schema change — just add a `cursor:` key |
| No `isDirty` flag on data rows | Outbox IS the dirty state — atomic, auditable, typed |
| Soft-delete on synced tables | Server controls lifecycle; `deleted_at` comes from server pull |
| `idempotency_key UNIQUE` | DB-level guarantee: same key can't be queued twice |
| SQLCipher on entire database | One key from device keychain; no per-column complexity |
| Per-table cursor keys | New tables bootstrap automatically without migration to sync state |
| `UNIQUE(role_code, entity_code, store_guuid)` | Prevents duplicates on repeated entity_permissions syncs |

---

## Scalability

### Handling Large Initial Bootstrap

```
Page 1: cursor=0,    limit=200 → 200 changes, hasMore=true,  nextCursor=T1
Page 2: cursor=T1,   limit=200 → 200 changes, hasMore=true,  nextCursor=T2
Page N: cursor=T(N), limit=200 → 47  changes, hasMore=false

Total: 447 changes across N pages
Each page: SQLite upserts in a transaction → ~50ms per page
Per-page cursor persistence → crash-safe at any point
```

### Batch Size Tuning

| Operation | Recommended Size | Reasoning |
|---|---|---|
| Pull page | 200 rows | ~50KB JSON; completes in < 2s on 3G |
| Push batch | 50 operations | Fits comfortably in one POST body |
| Queue fetch (`findBatch`) | 50 rows | Avoids loading thousands into memory |
| SQLite upsert transaction | Per pull page | Wrap each page → 25× faster than individual upserts |

### Sync Storm Prevention

```typescript
// Client: random jitter on network reconnect
const jitter = Math.random() * 15_000;  // 0..15s
setTimeout(() => runSync(storeGuuid), jitter);

// Client: minimum interval between syncs
const MIN_INTERVAL = 30_000;
if (Date.now() - _lastSyncAttempt < MIN_INTERVAL) return;

// Client: isSyncing() guard collapses concurrent triggers
if (_syncing) return;
```

```typescript
// Server: per-store rate limit (NestJS ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60000 } })  // 10 req/min per store
@Get('changes')
async getChanges() { ... }
```

### Critical Backend Index

```sql
-- Without this index: 1M row pull = ~800ms table scan
-- With this index:    1M row pull = ~3ms index scan
CREATE INDEX idx_change_log_cursor
  ON change_log(store_id, updated_at)
  INCLUDE (table_name, row_id, operation);
```

---

## Production Architecture

### Startup Sequence

```
App Launch
    │
    ▼
initializeDatabase()
    ← open SQLite with SQLCipher key from device keychain
    ← run Drizzle migrations (idempotent)
    │
    ▼
initializeSyncEngine()
    ← restore _lastSyncedAt from sync_state into module memory
    ← resetStuck(): flip all 'in_progress' mutations → 'pending'
      (crash recovery: safe because server uses idempotency_key for dedup)
    │
    ▼
JWTManager.hydrate()
    ← load access token, offline token, JWKS from SecureStore
    │
    ▼
tokenManager.loadSession()
    ← validate stored AuthResponse structure
    │
    ├── [no session / invalid] → setUnauthenticated() → Login screen
    │
    └── [valid session]
          │
          ▼
        setCredentials(authResponse)
          │
          ▼
        syncLookups()              ← fire-and-forget TTL refresh
          │
          ▼
        offlineSession.load()      ← HMAC-verify offline session
          │
          ▼
        [if stale] dispatch(refreshSession)
          │
          ▼
        App ready — offline capable if critical tables synced
```

### Write Guard — Check Order

```typescript
export async function assertWriteAllowed(requiredRoles?: string[]): Promise<void> {
  // 1. Permissions data must exist
  //    Without entity_permissions, every can() check silently returns false.
  //    Surface a clear error instead.
  const permissionsLoaded = await arePermissionsLoaded();
  if (!permissionsLoaded) throw new PermissionsNotLoadedError();

  // 2. JWKS cache must be fresh enough to verify the offline token
  if (!JWTManager.isJwksFresh()) throw new JwksUnavailableError();

  // 3. Offline token must not be expired
  const status = JWTManager.getOfflineStatus();
  if (status.mode === 'offline_expired') throw new OfflineSessionExpiredError();

  // 4. Role check (HMAC-verified session, tamper-resistant)
  if (requiredRoles?.length) {
    const session = await offlineSession.load();
    if (!session) throw new InsufficientRoleError(requiredRoles);
    const hasRole = requiredRoles.some(r => session.roles.includes(r));
    if (!hasRole) throw new InsufficientRoleError(requiredRoles);
  }
}
```

### Operation Signing

```typescript
// Client signs each push operation:
const canonical = `${op}:${table}:${JSON.stringify(opData)}`;
const signature  = SHA256(`${signingKey}:${canonical}`);

// Server verifies (exact mirror):
const expected = SHA256(`${session.signature}:${op}:${table}:${JSON.stringify(opData)}`);
if (sig !== expected) throw new UnauthorizedException('Invalid operation signature');
```

Tampered payloads are rejected individually — a compromised client cannot forge arbitrary operations.

### Backend API Contracts

```typescript
// ── Pull ──────────────────────────────────────────────────────────────────────
// GET /sync/changes
interface PullRequest {
  cursor:  number;   // min(all client table cursors), Unix ms
  storeId: string;   // UUID — scopes response to this store
  tables:  string;   // comma-separated table names
  limit:   number;   // default 200, max 500
}

interface SyncChange {
  table:     string;
  id:        number;
  operation: 'upsert' | 'delete';
  data:      Record<string, unknown> | null;
  updatedAt: number;  // client advances per-table cursor to this value
}

interface PullResponse {
  changes:    SyncChange[];
  nextCursor: number;   // max(updatedAt) across returned changes
  hasMore:    boolean;
}

// ── Push ──────────────────────────────────────────────────────────────────────
// POST /sync/push
interface PushOperation {
  id:        string;   // idempotency_key — server deduplicates on this
  clientId:  string;   // same as id
  table:     string;
  op:        string;   // CREATE | UPDATE | DELETE
  opData:    Record<string, unknown>;
  signature: string;   // SHA256(signingKey:op:table:JSON(opData))
}

interface PushRequest {
  operations:    PushOperation[];
  offlineSession: {
    userId:            string;
    storeId:           string;
    roles:             string[];
    offlineValidUntil: number;
    signature:         string;
    deviceId?:         string;
    offlineToken?:     string;
  };
}

interface PushResponse {
  processed: number;   // first N ops succeeded
  rejected?: number;   // next M ops hard-rejected (after processed)
  // positions processed+rejected..end → client requeues
}
```

### Recommended Folder Structure

```
lib/
├── sync/
│   ├── sync-engine.ts          ← runSync / runPullOnly / runPushOnly
│   │                             isSyncing / getLastSyncedAt
│   │                             initializeSyncEngine / resetSyncState
│   ├── sync-table-handlers.ts  ← TABLE_HANDLERS registry + API→DB row mappers
│   │                             SYNC_TABLES = Object.keys(TABLE_HANDLERS)
│   ├── sync-status.ts          ← isTableSynced / getTableHealth
│   │                             getSyncStatus / isReadyForOffline
│   │                             arePermissionsLoaded
│   ├── sync-lookups.ts         ← TTL-based full-replacement for lookup tables
│   └── index.ts                ← re-exports all public API
│
├── database/
│   ├── connection.ts           ← SQLCipher init, Drizzle instance
│   ├── constants/
│   │   └── sync-keys.ts        ← typed SyncKey union type
│   ├── schema/                 ← Drizzle table defs (one file per table)
│   │   ├── sync-state.schema.ts
│   │   ├── mutation-queue.schema.ts
│   │   ├── routes.schema.ts
│   │   └── ...
│   ├── repositories/           ← one class per table, all DB access here
│   │   ├── sync-state.repository.ts
│   │   ├── mutation-queue.repository.ts
│   │   ├── routes.repository.ts
│   │   └── ...
│   └── index.ts
│
├── utils/
│   └── write-guard.ts          ← assertWriteAllowed()
│
└── auth/
    ├── offline-session.ts      ← load/save/clear HMAC session
    └── jwt-manager.ts          ← isJwksFresh / getOfflineStatus / hydrate

store/
├── initialize-auth.ts          ← calls initializeSyncEngine() on startup
├── logout-thunk.ts             ← calls resetSyncState() + clearAllTables()
└── persist-login.ts            ← calls runSync() after successful login
```

---

## Trade-off Summary

| Decision | Chosen | Alternative | Why |
|---|---|---|---|
| Change source | Per-table cursors | Global cursor | New tables auto-bootstrap; no code changes needed |
| Client change tracking | Outbox queue | `isDirty` flags | Atomic, auditable, typed, crash-safe |
| Conflict strategy | Server authoritative + quarantine | Silent merge | Financial data needs human review, not silent overwrite |
| Delete approach | Soft delete (`deleted_at`) | Hard delete in change_log | Simpler client query model; history preserved |
| Operation auth | HMAC per operation | JWT per request | Per-operation tamper detection; compromised token can't forge payloads |
| Queue storage | SQLite row per mutation | In-memory array | Survives app kill, background eviction, OS restart |
| Sync debounce | Module-level `_syncing` bool | Semaphore | Sufficient for single-user mobile; avoids dependency |
| Pull pagination | hasMore loop with per-page cursor save | Single large request | Crash-safe at any page; manageable memory footprint |

---

## Action Items

- [ ] Add `UNIQUE(role_code, entity_code, store_guuid)` constraint to `entity_permissions` + migration
- [ ] Wrap each pull page's upserts in a SQLite transaction (25× performance gain for initial bootstrap)
- [ ] Add jitter (0..15s) + minimum interval (30s) guard to NetInfo reconnect handler
- [ ] Wrap `sync-lookups.ts` `clearByType` + `saveAll` in a single transaction (atomic replacement)
- [ ] Fix `persist-login.ts` role filtering — scope by `activeStoreId` before storing in offline session
- [ ] Implement backend `GET /sync/changes` using `change_log` trigger pattern (Pattern B)
- [ ] Add `Retry-After` header on server 429 responses for sync storm protection
- [ ] Add per-store rate limiting (10 req/min) on `/sync/changes` endpoint
- [ ] Add backend index: `CREATE INDEX idx_change_log_cursor ON change_log(store_id, updated_at)`
- [ ] Implement version-based conflict detection for financial records (invoices, payments)
