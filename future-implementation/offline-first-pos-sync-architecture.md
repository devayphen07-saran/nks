# Offline-First POS Sync Architecture

**Stack:** React Native (Expo) mobile app + NestJS backend
**Use case:** Mobile POS that must work fully offline and reconcile with the server when connectivity returns.

**Version:** 4.0 — fixes cursor capture timing bug, pagination cursor advancement, idempotency retention bump to 90 days, cascading rejection section, `syncing` state clarification, `sequence` generation hardening, tombstone note, `expected_version` removed from create example, KDS polling caveat.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Mobile Database Schema](#3-mobile-database-schema)
4. [Backend Database Schema](#4-backend-database-schema)
5. [Write Path — Offline Data Capture](#5-write-path--offline-data-capture)
6. [Push Flow — Mobile → Backend](#6-push-flow--mobile--backend)
7. [Pull Flow — Backend → Mobile](#7-pull-flow--backend--mobile)
8. [Sync Scheduling and Triggers](#8-sync-scheduling-and-triggers)
9. [Conflict Resolution](#9-conflict-resolution)
10. [Failure Handling and Recovery](#10-failure-handling-and-recovery)
11. [End-to-End Example: 1000 Queued Operations](#11-end-to-end-example-1000-queued-operations)
12. [NestJS Backend Structure](#12-nestjs-backend-structure)
13. [Mobile Sync Manager Structure](#13-mobile-sync-manager-structure)
14. [Monitoring and Observability](#14-monitoring-and-observability)
15. [Checklist Before Going Live](#15-checklist-before-going-live)
16. [Adding a Web Client](#16-adding-a-web-client)

---

## 1. Design Principles

These principles drive every decision in the architecture:

1. **Local-first UI** — the app only ever reads from and writes to the local SQLite database. The network is a background detail.
2. **Outbox pattern for writes** — every local mutation also writes a row to a `sync_queue` table in the same transaction. The queue is the source of truth for "what still needs to be sent."
3. **Delta pull for reads** — the server exposes a single endpoint that returns "everything changed since timestamp X."
4. **Idempotency on every write** — every operation has a `client_op_id` (UUID). Retries are safe; duplicates are impossible.
5. **UUIDs everywhere** — primary keys are UUIDs generated on the device, never auto-increment integers. This allows offline creation with stable IDs.
6. **Push before pull** — always drain the outbox before pulling server changes, so local pending work is never overwritten.
7. **Server time is authoritative** — all sync cursors use the server's clock, never the device's.
8. **Nothing is destructive until confirmed** — queue rows are only marked `done` after the server acknowledges them.
9. **Local unsynced edits always win during pull** — pull never overwrites a row whose `sync_status` is `pending`, `syncing`, or `failed`. The push cycle is the only path that reconciles such rows with the server.

---

## 2. High-Level Architecture

```
┌────────────────────────────────────────────────────────────┐
│                   MOBILE (React Native)                    │
│                                                            │
│   UI Screens  ──reads/writes──▶  SQLite (local DB)         │
│                                   ├── domain tables        │
│                                   ├── sync_queue (outbox)  │
│                                   └── sync_metadata        │
│                                                            │
│                  ┌──────────────────────┐                  │
│                  │   Sync Manager       │                  │
│                  │   ├── Push worker    │                  │
│                  │   ├── Pull worker    │                  │
│                  │   └── Scheduler      │                  │
│                  └──────────┬───────────┘                  │
└──────────────────────────────┼─────────────────────────────┘
                               │ HTTPS (when online)
                               │
           ┌───────────────────┼───────────────────┐
           │                                       │
           ▼                                       ▼
   POST /sync/push                         GET /sync/pull
   (batched mutations)                (delta changes since X)
           │                                       │
           └───────────────────┬───────────────────┘
                               ▼
┌────────────────────────────────────────────────────────────┐
│                    BACKEND (NestJS)                        │
│                                                            │
│   SyncController  ──▶  SyncService                         │
│                         ├── Idempotency check              │
│                         ├── Dispatch by entity             │
│                         └── Build delta responses          │
│                                                            │
│                  PostgreSQL                                │
│                    ├── domain tables                       │
│                    ├── processed_operations (idempotency)  │
│                    └── tombstones (soft deletes)           │
└────────────────────────────────────────────────────────────┘
```

Two independent flows:

- **Push flow** — drains the local outbox to the server.
- **Pull flow** — fetches server changes since the last cursor.

Each runs on its own trigger and schedule.

---

## 3. Mobile Database Schema

Use `expo-sqlite` directly, or with an ORM like `drizzle-orm` or WatermelonDB.

### 3.1 Domain tables

Every domain table (e.g., `sales`, `sale_items`, `customers`, `products`, `payments`) includes these sync-aware columns:

| Column | Type | Purpose |
|---|---|---|
| `id` | TEXT (UUID) | Primary key, generated on device |
| `updated_at` | DATETIME | Local timestamp of last change |
| `deleted_at` | DATETIME NULL | Soft delete marker |
| `sync_status` | TEXT | `pending` / `syncing` / `synced` / `failed` |
| `version` | INTEGER | Incremented on every update, used for conflict detection |
| `server_version` | INTEGER NULL | Last version confirmed by the server |

**`sync_status` lifecycle:**
- `pending` — local change not yet sent to server
- `syncing` — domain row is actively being pushed (set when its queue op transitions to `in_progress`; useful for "uploading…" UI indicators). Reset to `pending` on app launch if stuck.
- `synced` — server has confirmed the latest local version
- `failed` — server rejected or returned a conflict; needs resolution

> **Important:** `syncing` must actually be written to the domain row when its queue op is marked `in_progress` — otherwise the state is declared but never set, which causes confusion. The push algorithm should update the domain row alongside the queue row at the same moment.

**The pull worker treats `pending`, `syncing`, and `failed` as "do not overwrite."** Only `synced` (or absent) rows can be replaced by server data.

### 3.2 Sync queue (outbox)

```sql
CREATE TABLE sync_queue (
  id              TEXT PRIMARY KEY,        -- uuid
  client_op_id    TEXT UNIQUE NOT NULL,    -- idempotency key
  entity_type     TEXT NOT NULL,           -- 'sale' | 'customer' | 'product' | ...
  entity_id       TEXT NOT NULL,           -- FK to the domain row
  operation       TEXT NOT NULL,           -- 'create' | 'update' | 'delete'
  payload         TEXT NOT NULL,           -- JSON snapshot of the change
  sequence        INTEGER NOT NULL,        -- monotonic ordering
  priority        INTEGER NOT NULL DEFAULT 0, -- higher = sync first
  status          TEXT NOT NULL DEFAULT 'pending', -- pending|in_progress|done|failed
  retry_count     INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  next_retry_at   DATETIME,                -- for exponential backoff
  created_at      DATETIME NOT NULL,
  synced_at       DATETIME
);

CREATE INDEX idx_queue_status_seq ON sync_queue(status, sequence);
CREATE INDEX idx_queue_next_retry ON sync_queue(next_retry_at) WHERE status = 'pending';
```

> **Note on `sequence` generation:** The write path uses `SELECT COALESCE(MAX(sequence), 0) + 1 FROM sync_queue` inside a transaction. This is **safe in SQLite** only when there is a single writer process — which `expo-sqlite` guarantees in a standard app. However, if you ever add a background task, notification handler, or second SQLite connection that can write to the queue concurrently, this breaks silently. Cheap insurance now: make `sequence` an `INTEGER PRIMARY KEY AUTOINCREMENT` on a dedicated counter table, or use a ULID. Either costs nothing to add early and prevents a hard-to-debug ordering bug later.

### 3.3 Sync metadata

```sql
CREATE TABLE sync_metadata (
  entity_type     TEXT PRIMARY KEY,
  last_pulled_at  DATETIME,       -- server's timestamp from last successful pull
  last_pushed_at  DATETIME,       -- server's timestamp from last successful push cycle
  last_full_sync  DATETIME        -- server's timestamp from last successful push+pull
);
```

**How each column is updated:**

- `last_pulled_at` — set per-entity at the end of a successful pull for that entity (using `server_time` from the response).
- `last_pushed_at` — set per-entity at the end of a successful push cycle, after all queue rows for that entity have been drained or marked `done` / `failed`.
- `last_full_sync` — set when a push+pull cycle completes for that entity with no errors.

These are used by the UI ("last synced 2 minutes ago") and by telemetry ("which devices haven't pushed in 24h").

### 3.4 Failed operations (dead-letter)

```sql
CREATE TABLE failed_operations (
  id              TEXT PRIMARY KEY,
  client_op_id    TEXT,
  entity_type     TEXT,
  payload         TEXT,
  error           TEXT,
  failed_at       DATETIME,
  resolved        BOOLEAN DEFAULT 0
);
```

Any operation that fails more than N retries or is explicitly rejected by the server (e.g., invalid data, permission denied) moves here for manual review.

---

## 4. Backend Database Schema

### 4.1 Domain tables (PostgreSQL)

Every syncable table has:

| Column | Purpose |
|---|---|
| `id` (UUID PK) | Same UUID as the mobile row |
| `updated_at` (TIMESTAMPTZ) | Set to `NOW()` on every write, indexed |
| `deleted_at` (TIMESTAMPTZ NULL) | Soft delete |
| `version` (INTEGER) | Incremented on every update |
| `created_by_device` (TEXT) | Which device originated the row |
| `tenant_id` / `store_id` | Multi-tenant isolation |

Add an index on `updated_at` per table. Without it, delta queries get slow as data grows.

### 4.2 Idempotency table

```sql
CREATE TABLE processed_operations (
  client_op_id    UUID PRIMARY KEY,
  device_id       TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  result          JSONB NOT NULL,
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_processed_device ON processed_operations(device_id, processed_at);
```

This is what makes retries safe. Before processing any operation, the server checks this table. If the `client_op_id` exists, it returns the cached `result` instead of re-processing.

Retention: keep rows for **90 days**, then archive or delete. The v2 spec said 30 days, but a rural POS offline for 30+ days is a realistic scenario (see the 10-day example in §11). At 30-day retention, retries from such a device hit a server that has forgotten the `client_op_id`. UUID-based creates will produce a duplicate-row error (not a silent double-write), but `update` and `delete` operations may be re-applied incorrectly. 90 days covers the realistic tail while keeping the table manageable.

### 4.3 Tombstones (deletions)

For hard deletes (rare) you need a tombstone table so pull-sync can propagate them:

```sql
CREATE TABLE tombstones (
  id              UUID PRIMARY KEY,
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  deleted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id       UUID NOT NULL
);

CREATE INDEX idx_tomb_entity_time ON tombstones(entity_type, deleted_at);
```

Prefer **soft deletes** (`deleted_at` on the row itself) whenever possible — they're simpler to sync.

> **Note:** With soft deletes used everywhere in this architecture, this table is reserved for future hard-delete cases (e.g., a GDPR erasure request). It is not used by the current pull flow, which detects deletes via `deleted_at IS NOT NULL` on the domain row itself.

---

## 5. Write Path — Offline Data Capture

When the cashier performs any action (new sale, edit customer, etc.), regardless of network state:

### 5.1 Steps

1. **Generate a UUID** for the new entity on the device.
2. **Open a SQLite transaction.**
3. **Write to the domain table** with `sync_status = 'pending'`, set `updated_at = now()`, `version = 1` (or `version + 1` for updates).
4. **Write to `sync_queue`** with:
   - A fresh `client_op_id` (UUID) — the idempotency key.
   - `sequence = MAX(sequence) + 1` — preserves order.
   - A JSON snapshot of the full payload.
5. **Commit the transaction.**
6. **Update the UI** immediately — the sale appears as complete.
7. **Trigger the sync manager** (debounced; it'll push if online, do nothing if not).

### 5.2 Why domain write + queue write must be one transaction

If you write the sale but crash before writing the queue row, the sale exists locally but will never sync — a silent data loss. One transaction guarantees both or neither.

### 5.3 Pseudo-code

```typescript
async function createSale(saleData: SaleInput) {
  const saleId = uuid();
  const opId = uuid();
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    // 1. Write domain row
    await tx.execute(
      `INSERT INTO sales (id, customer_id, total, created_at, updated_at,
                           sync_status, version)
       VALUES (?, ?, ?, ?, ?, 'pending', 1)`,
      [saleId, saleData.customerId, saleData.total, now, now]
    );

    // 2. Write sale_items (each also with its own UUID)
    for (const item of saleData.items) {
      await tx.execute(
        `INSERT INTO sale_items (id, sale_id, product_id, qty, price,
                                  updated_at, sync_status, version)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', 1)`,
        [uuid(), saleId, item.productId, item.qty, item.price, now]
      );
    }

    // 3. Write outbox row — one op for the whole sale
    // SAFE in SQLite due to single-writer serialization.
    const nextSeq = await tx.queryOne(
      `SELECT COALESCE(MAX(sequence), 0) + 1 AS seq FROM sync_queue`
    );

    await tx.execute(
      `INSERT INTO sync_queue (id, client_op_id, entity_type, entity_id,
                               operation, payload, sequence, priority,
                               status, created_at)
       VALUES (?, ?, 'sale', ?, 'create', ?, ?, 10, 'pending', ?)`,
      [uuid(), opId, saleId, JSON.stringify(saleData), nextSeq.seq, now]
    );
  });

  // 4. Nudge the sync manager (async, non-blocking)
  syncManager.requestSync();

  return saleId;
}
```

---

## 6. Push Flow — Mobile → Backend

### 6.1 Single endpoint, chunked batches

The app uses **one batch endpoint** (`POST /sync/push`) but calls it **many times with small chunks**. One endpoint does NOT mean one giant request.

For 1000 queued operations:

```
POST /sync/push  with items 1–50     ✅
POST /sync/push  with items 51–100   ✅
...
POST /sync/push  with items 951–1000 ✅
```

20 small, fast, recoverable requests instead of one fragile giant one.

### 6.2 Request shape

```json
POST /sync/push
Authorization: Bearer <token>
X-Device-Id: abc-123

{
  "device_id": "abc-123",
  "client_time": "2026-04-19T10:12:45Z",
  "operations": [
    {
      "client_op_id": "9b5a-...-op1",
      "sequence": 101,
      "entity": "customer",
      "operation": "create",
      "client_id": "cust-uuid-a",
      "payload": { "name": "Ravi", "phone": "9876543210" },
      "client_timestamp": "2026-04-19T10:12:03Z"
    },
    {
      "client_op_id": "9b5a-...-op2",
      "sequence": 102,
      "entity": "sale",
      "operation": "create",
      "client_id": "sale-uuid-b",
      "payload": {
        "customer_id": "cust-uuid-a",
        "items": [ { "product_id": "p1", "qty": 2, "price": 150 } ],
        "total": 300,
        "paid_at": "2026-04-19T10:12:45Z"
      },
      "client_timestamp": "2026-04-19T10:12:45Z"
    }
  ]
}
```

### 6.3 Response shape

```json
{
  "server_time": "2026-04-19T10:15:00Z",
  "results": [
    {
      "client_op_id": "9b5a-...-op1",
      "status": "ok",
      "server_id": "cust-uuid-a",
      "version": 1
    },
    {
      "client_op_id": "9b5a-...-op2",
      "status": "conflict",
      "reason": "version_mismatch",
      "server_state": { "id": "sale-uuid-b", "version": 2, "...": "..." }
    }
  ]
}
```

Possible `status` values:

| Status | Meaning | Mobile action |
|---|---|---|
| `ok` | Server applied the change | Mark queue row `done`, update domain row `sync_status = 'synced'` |
| `duplicate` | Already processed (idempotent hit) | Same as `ok` — use cached result |
| `conflict` | Server has newer version | Mark queue row `failed`, set domain `sync_status = 'failed'`, run conflict resolution |
| `rejected` | Invalid data, permission denied | Move to `failed_operations`, set domain `sync_status = 'failed'`, notify user |
| `error` | Transient server error | Keep as `pending`, retry with backoff |

### 6.4 Chunking rules

- **Chunk size:** 50 operations OR 500 KB of payload, whichever is smaller.
- **Order preserved:** send in ascending `sequence`. Dependencies (e.g., customer before the sale that references it) are respected.
- **Sequential, not parallel:** one chunk at a time per device. Parallel chunks break ordering guarantees.
- **Mutex:** only one push cycle runs at a time per device.

### 6.5 Mobile-side push algorithm

```
acquire push_mutex
entities_touched = empty set
try:
  while true:
    batch = SELECT * FROM sync_queue
            WHERE status = 'pending'
              AND (next_retry_at IS NULL OR next_retry_at <= NOW())
            ORDER BY priority DESC, sequence ASC
            LIMIT 50

    if batch is empty: break

    UPDATE sync_queue SET status = 'in_progress'
      WHERE id IN batch.ids

    try:
      response = POST /sync/push { operations: batch }
    except NetworkError:
      UPDATE sync_queue SET status = 'pending' WHERE id IN batch.ids
      break   # leave it for the next sync cycle

    server_time = response.server_time

    for result in response.results:
      row = find queue row by client_op_id
      entities_touched.add(row.entity_type)

      switch result.status:
        case 'ok', 'duplicate':
          UPDATE sync_queue SET status='done', synced_at=now() WHERE id=row.id
          UPDATE <entity> SET sync_status='synced', server_version=result.version
            WHERE id=row.entity_id
        case 'conflict':
          UPDATE sync_queue SET status='failed', last_error=result.reason
            WHERE id=row.id
          UPDATE <entity> SET sync_status='failed' WHERE id=row.entity_id
          save result.server_state, trigger conflict resolver
        case 'rejected':
          UPDATE <entity> SET sync_status='failed' WHERE id=row.entity_id
          move row to failed_operations, notify user
        case 'error':
          UPDATE sync_queue
            SET status='pending',
                retry_count = retry_count + 1,
                next_retry_at = now() + backoff(retry_count),
                last_error = result.reason
            WHERE id=row.id

  # End of push cycle: record last_pushed_at per entity touched
  for entity in entities_touched:
    UPDATE sync_metadata
      SET last_pushed_at = server_time
      WHERE entity_type = entity
finally:
  release push_mutex
```

> **Note:** `last_pushed_at` uses the **server's `server_time`** from the most recent push response, never the device clock. This keeps it comparable with `last_pulled_at`, which also comes from the server.

### 6.6 Exponential backoff

```
backoff(retry) = min(30 * 60, 2 ^ retry) seconds + random jitter
# 2s, 4s, 8s, 16s, 32s, 64s, 128s, ... capped at 30 minutes
```

After N retries (e.g., 10), move the operation to `failed_operations` and notify the user.

---

## 7. Pull Flow — Backend → Mobile

### 7.1 Single delta endpoint (one entity per request)

```
GET /sync/pull?since=2026-04-19T08:00:00Z&entity=products&limit=500
```

| Query param | Purpose |
|---|---|
| `since` | ISO timestamp — the server's `updated_at` cursor from the last pull for this entity. `null` for initial sync. |
| `entity` | Single entity type to pull (e.g., `products`, `customers`). |
| `limit` | Max rows per response page (pagination). |
| `cursor` | Optional opaque cursor for continuing a paginated pull. |

> **Why one entity per request (not a comma-separated list):**
> - Aligns with the per-entity cursor model — each entity has its own `last_pulled_at` that advances independently.
> - Pagination semantics are clean: one entity, one `has_more`, one `next_cursor`.
> - A multi-entity batch endpoint requires per-entity pagination state, which complicates both server and client. The marginal round-trip savings aren't worth the complexity for a typical POS catalog.
> - If you genuinely need a batch endpoint later, add it as `/sync/pull-batch` without removing this one.

### 7.2 Response shape

```json
{
  "server_time": "2026-04-19T10:15:00Z",
  "entity": "products",
  "upserted": [
    { "id": "p1", "name": "Coffee 250ml", "price": 40, "version": 3, "updated_at": "..." }
  ],
  "deleted": ["p99"],
  "has_more": false,
  "next_cursor": null
}
```

### 7.3 Mobile-side pull algorithm

```
acquire pull_mutex
try:
  for entity in ['products', 'customers', 'categories', 'taxes']:
    cursor = read last_pulled_at from sync_metadata for this entity
    has_more = true
    # Capture server_time ONCE at the start of this entity's pull.
    # Do NOT update it per-page — if writes happen during a long paginated
    # pull, using a freshly captured server_time per page can produce an
    # inconsistent cursor. Hold one value for the entire entity loop.
    entity_server_time = null

    while has_more:
      response = GET /sync/pull?since=cursor&entity=entity&limit=500

      if entity_server_time is null:
        entity_server_time = response.server_time   # captured once, first page only

      for upserted_row in response.upserted:
        # CRITICAL: do not overwrite local rows that have unsynced work.
        existing = SELECT sync_status, version
                   FROM <entity>
                   WHERE id = upserted_row.id

        if existing AND existing.sync_status IN ('pending', 'syncing', 'failed'):
          # Local edit/queue-row wins until push reconciles it with the server.
          # Optionally stash upserted_row.version somewhere for conflict UI.
          continue   # SKIP this row

        # Safe to overwrite: row is either absent or already 'synced'.
        INSERT OR REPLACE INTO <entity>
          (...columns..., sync_status, server_version)
          VALUES (..., 'synced', upserted_row.version)

      for deleted_id in response.deleted:
        existing = SELECT sync_status FROM <entity> WHERE id = deleted_id
        if existing AND existing.sync_status IN ('pending', 'syncing', 'failed'):
          # Local has unsynced work on a row the server says is deleted —
          # treat as conflict. Don't auto-delete.
          UPDATE <entity> SET sync_status = 'failed' WHERE id = deleted_id
          flag for conflict resolution
        else:
          UPDATE <entity> SET deleted_at = now(), sync_status = 'synced'
            WHERE id = deleted_id

      has_more = response.has_more
      cursor = response.next_cursor   # advance page cursor within this entity

    # Only advance last_pulled_at when the entity is fully drained (has_more = false).
    # Use the server_time captured on the first page, not the last response.
    UPDATE sync_metadata SET last_pulled_at = entity_server_time
      WHERE entity_type = entity
finally:
  release pull_mutex
```

### 7.4 Critical rules

- **Use `server_time` from the response as the next cursor.** Never use the device clock.
- **Pagination is mandatory.** First-ever sync might return 50k products; looping with `has_more` prevents memory blow-ups.
- **Never overwrite local pending changes during pull.** Rows with `sync_status` of `pending`, `syncing`, or `failed` are skipped. The push cycle is the only path that reconciles those rows. This applies to both upserts and server-side deletions.
- **Deletions must check local status too.** A server-deleted row that has local pending edits is a conflict, not a silent overwrite.

### 7.5 Per-entity cursor trade-off

Each entity advances its `last_pulled_at` cursor independently, **as soon as that entity finishes pulling**. This has a known trade-off:

**Pro:** If the pull loop is interrupted between entities (crash, network drop, app backgrounded), entities that completed keep their progress. The next pull starts from where each one left off.

**Con:** The cursors can drift. If `products` finishes at `T1` but `customers` is interrupted at `T0`, the next pull for `customers` re-fetches everything since `T0`, including some rows already pulled for `products` in the same time window. No data is lost — just a small amount of redundant work.

**Why this is the right choice for a POS:**
- Catalogs (products) are typically much larger than transactional reference data (customers, taxes). You'd rather refetch a few customer rows than refetch 50,000 products because the loop crashed on the last entity.
- The redundant fetches are bounded — at most one entity's worth, and only between cursor saves.
- The alternative (a single global cursor saved only after the entire loop completes) means all entities re-sync from the old cursor on any interruption, which is much worse.

If you need to track "fully consistent through" for the UI or telemetry, write `sync_metadata.last_full_sync` only at the end of a clean push+pull cycle, separately from the per-entity cursors.

### 7.6 Initial sync vs. incremental

| | Initial sync | Incremental sync |
|---|---|---|
| `since` | `null` | last `server_time` |
| Size | Large (entire catalog) | Small (recent changes) |
| Frequency | Once, after login | Every sync cycle |
| UI | Progress bar, "Loading your store data…" | Silent background |

---

## 8. Sync Scheduling and Triggers

Multiple overlapping triggers — no single one is enough.

### 8.1 Triggers

| Trigger | What runs | Why |
|---|---|---|
| **App launch / foreground** | Push + Pull | Get back in sync after any time away |
| **Network reconnect** (NetInfo listener) | Push + Pull | Drain the queue as soon as possible |
| **After local mutation** (debounced 2–3s) | Push only | Keep server near-live when online |
| **Periodic timer** (every 5–10 min while app open) | Pull only | Catch catalog/price changes |
| **Pull-to-refresh** on list screens | Pull only | User-initiated |
| **Before day-close / Z-report** | Push (forced, blocking) | Guarantee day's data is on server before closing |
| **Background fetch** (best-effort) | Push + Pull | Nice-to-have; don't rely on it |

### 8.2 Order in a full sync cycle

```
1. Push all pending operations (drain the outbox)
   - On success, update sync_metadata.last_pushed_at per entity
2. Pull deltas for all entities (one entity per request)
   - On each entity finishing, update sync_metadata.last_pulled_at
3. If both phases completed cleanly, update sync_metadata.last_full_sync per entity
```

**Push always before pull.** Pulling first risks overwriting local pending changes.

### 8.3 Debouncing

After a local mutation, don't push immediately — wait 2–3 seconds in case more mutations follow (cashier adding line items one by one). The debounce timer resets on each new mutation.

### 8.4 Background sync (Expo specifics)

- iOS: `expo-background-fetch` runs at most every 15 min, not guaranteed.
- Android: more reliable with `expo-task-manager`.
- Treat background sync as bonus, not primary. Foreground triggers must be enough on their own.

---

## 9. Conflict Resolution

### 9.1 Where conflicts happen

| Entity | Conflict likelihood | Strategy |
|---|---|---|
| Sales, payments | Near-zero (always new, UUID-based) | Accept all |
| Inventory stock levels | High (multi-device) | Store deltas, not absolutes |
| Product price / tax | Low (admin-only) | Server wins |
| Customer edits | Medium | Last-write-wins with version check |
| Settings | Low | Server wins |

### 9.2 Append-only wins

For sales and payments, just accept. New rows don't conflict.

### 9.3 Inventory: use stock movements, not absolute counts

**Wrong:**
```
products.stock = 9  (from device A)
products.stock = 9  (from device B, both started at 10)
Result: stock is 9, but two units were sold.
```

**Right:**
```
stock_movements table:
- movement {id: m1, product: p, delta: -1, device: A, ts: ...}
- movement {id: m2, product: p, delta: -1, device: B, ts: ...}
Server aggregates: current_stock = sum of deltas.
Result: stock is 8. Correct.
```

Movements are append-only; they never conflict.

### 9.4 Version-based optimistic concurrency

For mutable records (customer, product), include `expected_version` in the push operation:

```json
{
  "operation": "update",
  "entity": "customer",
  "client_id": "cust-uuid-a",
  "expected_version": 3,
  "payload": { "name": "New Name" }
}
```

Server logic:
```
if server.version != op.expected_version:
  return { status: 'conflict', server_state: current_row }
else:
  apply update, bump version, return ok
```

### 9.5 Resolving conflicts on the mobile side

When a conflict comes back:

1. The queue row is marked `failed`. The domain row is marked `sync_status = 'failed'`.
2. Store the server's state locally (e.g., in a `conflict_snapshots` table or a JSON column).
3. **Pull will continue to skip this row** because its `sync_status` is `failed` — server changes won't silently overwrite the user's pending edit.
4. Show a UI prompt: "This customer was updated on another device. Keep your changes / Use server / Merge manually."
5. After the user decides, create a new queue operation with the resolved state and the latest known server `version` as `expected_version`. Reset the domain row's `sync_status` to `pending`.

For non-interactive conflicts (e.g., product price pushed by a cashier when admin changed it), the policy can be "server wins": discard the local pending edit, refresh from server state, and clear the queue row.

---

## 10. Failure Handling and Recovery

### 10.1 What "stops in the middle" actually looks like

A sync cycle can fail at many points. Each has a safe outcome:

| Failure point | What's on the device | What's on the server | Recovery |
|---|---|---|---|
| Network drops mid-request | Queue rows still `in_progress` | Nothing received | On next sync, reset `in_progress` → `pending`, retry |
| Server saved but response lost | Queue rows `in_progress` | Operation processed, cached in `processed_operations` | Retry sends same `client_op_id`, server returns cached result |
| App crashes mid-sync | Queue rows `in_progress` | Partial | On app launch, reset `in_progress` → `pending`, retry |
| Auth token expired | Queue rows `in_progress` | Nothing | Refresh token, retry chunk |
| One op has bad data | Other ops succeed, bad op gets `rejected` | Valid ops applied | Bad op → `failed_operations`, surface to user |
| Server down | Push returns 5xx | Nothing | Exponential backoff, retry later |
| Pull interrupted between entities | Some entities advanced their cursor, others not | Unchanged | Per-entity cursor — finished entities keep progress, unfinished ones resume from old cursor |

**In no scenario is data lost**, provided:

- Queue is in SQLite (durable across crashes).
- Rows are only marked `done` after server confirmation.
- App-launch recovery resets stuck `in_progress` rows.
- Idempotency keys are used on every operation.
- Pull skips local rows with unsynced status.

### 10.2 App-launch recovery

On every app start, before any other sync activity:

```sql
UPDATE sync_queue
SET status = 'pending'
WHERE status = 'in_progress';
```

Any rows stuck because the app was killed mid-sync are re-enqueued.

### 10.3 Dead-letter queue

After N retries (e.g., 10) OR an explicit `rejected` from the server, move the row to `failed_operations`. A UI screen shows "Unsynced items" with a count badge — the cashier/admin can review, fix, or delete them.

### 10.4 Partial-success in a batch

Critical: a batch push is **not** all-or-nothing. If the batch has 50 ops and op #23 is a conflict, ops #1–22 and #24–50 still succeed. The server processes each op in its own transaction.

### 10.5 Cascading rejections

When a parent op is rejected, dependent ops in the same or subsequent batch will also fail with a different error (e.g., FK violation, `product_not_available`). Both end up in the dead-letter queue with unrelated-looking errors, making the root cause hard to diagnose.

Two mitigations:

- **`dependency_failed` status** — the server can detect "this op failed because a prior op in this batch was rejected" and return a distinct status so the mobile UI groups them: "Sale failed because customer creation was rejected."
- **At minimum, document the pattern** — when the cashier reviews failed ops, show them in `sequence` order so the root cause (the first rejection) is visible before its dependents.

If your entity dependency graph is shallow (customer → sale is the main one), the second option is usually sufficient.

---

## 11. End-to-End Example: 1000 Queued Operations

Scenario: A village shop's POS was offline for 10 days. 1000 operations piled up in the queue. Internet comes back.

### 11.1 Timeline

**T+0s** — NetInfo listener fires `connected = true`. Sync manager starts.

**T+0.1s** — Push worker acquires mutex, queries first 50 pending ops ordered by `sequence ASC`.

**T+0.2s** — Marks them `in_progress`, sends `POST /sync/push` with 50 ops (~200 KB).

**T+2.5s** — Server responds: 48 ok, 1 conflict (customer edit clashed), 1 rejected (product reference no longer exists).

**T+2.6s** —
- 48 rows → `done`, domain rows → `synced`
- 1 conflict row → `failed`, domain row → `failed`, server_state saved
- 1 rejected row → moved to `failed_operations`, domain row → `failed`

**T+2.7s** — Loop continues. Next 50 ops fetched. `POST /sync/push` again.

**T+65s** — Approximately 20 batches completed, most of the 1000 ops processed.

**T+66s** — Queue is nearly empty. `sync_metadata.last_pushed_at` updated for every entity touched. Push mutex released.

**T+66.5s** — Pull worker starts. First entity:
`GET /sync/pull?since=<10 days ago>&entity=products&limit=500`.

**T+68s** — 230 product updates received. Pull algorithm checks each row's local `sync_status`; none have local pending edits, so all are upserted. `last_pulled_at` for products is set to the response's `server_time`.

**T+68.5s** — Next entity: customers. The conflicted customer from step T+2.6 has `sync_status = 'failed'` locally — pull **skips** it, preserving the local edit for the user to resolve.

**T+69.5s** — categories, then taxes. Each completes and updates its own cursor.

**T+70s** — Pull mutex released. `last_full_sync` updated for entities with no errors.

**T+70.5s** — UI shows: "Sync complete. 998 synced, 2 need attention." User taps to review the 2 failures.

### 11.2 What if the internet drops at T+30s?

- 15 batches already `done`, with `last_pushed_at` updated for each entity touched so far.
- Batch in flight is marked back to `pending` when the request errors out.
- Remaining ~4 batches untouched.
- Queue state: ~250 rows done, ~750 pending.
- When internet returns, the loop picks up exactly where it left off. The 15 completed batches are NOT re-sent.

### 11.3 What if the app is force-killed at T+30s?

- 15 batches `done`, 1 batch stuck as `in_progress`, rest `pending`.
- On next launch, the recovery step resets `in_progress` → `pending`.
- Sync restarts. The stuck batch is retried; the server returns cached results via idempotency, so no duplicates.

### 11.4 What if the pull is interrupted between products and customers?

- Products finished cleanly at, say, `server_time = T_products`. Its `last_pulled_at` is updated.
- Customers loop never started (or started and was killed mid-page).
- On next pull: products resumes from `T_products` (only fetches what's new since then), customers resumes from its old cursor (re-fetches everything since the previous successful customers pull).
- No data lost. Some redundant customer fetches — acceptable trade-off.

---

## 12. NestJS Backend Structure

### 12.1 Module layout

```
src/
├── sync/
│   ├── sync.module.ts
│   ├── sync.controller.ts          # POST /sync/push, GET /sync/pull
│   ├── sync.service.ts
│   ├── idempotency.service.ts      # checks processed_operations
│   ├── dispatcher.service.ts       # routes op → entity service
│   └── dto/
│       ├── push-request.dto.ts
│       └── pull-query.dto.ts
├── sales/
│   ├── sales.service.ts
│   └── sales-sync.service.ts       # applyRemoteOperation, getChangesSince
├── customers/
│   └── customers-sync.service.ts
├── products/
│   └── products-sync.service.ts
└── auth/
    └── device-auth.guard.ts        # validates JWT + device_id
```

### 12.2 Push controller skeleton

```typescript
@Controller('sync')
@UseGuards(DeviceAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('push')
  async push(
    @Body() body: PushRequestDto,
    @CurrentDevice() device: DeviceContext,
  ): Promise<PushResponseDto> {
    const results = [];
    for (const op of body.operations) {
      const result = await this.syncService.applyOperation(op, device);
      results.push(result);
    }
    return {
      server_time: new Date().toISOString(),
      results,
    };
  }

  @Get('pull')
  async pull(
    @Query() query: PullQueryDto,            // { entity, since, limit, cursor }
    @CurrentDevice() device: DeviceContext,
  ): Promise<PullResponseDto> {
    return this.syncService.pullEntity(query, device);
  }
}
```

### 12.3 Operation processing with idempotency

```typescript
async applyOperation(op: Operation, device: DeviceContext): Promise<OpResult> {
  // 1. Idempotency check
  const cached = await this.idempotency.find(op.client_op_id);
  if (cached) {
    return cached.result;   // safe retry
  }

  // 2. Dispatch to the right service, inside a transaction
  let result: OpResult;
  try {
    result = await this.dataSource.transaction(async (tx) => {
      switch (op.entity) {
        case 'sale':     return this.salesSync.apply(op, device, tx);
        case 'customer': return this.customersSync.apply(op, device, tx);
        case 'product':  return this.productsSync.apply(op, device, tx);
        default: throw new BadRequestException(`Unknown entity ${op.entity}`);
      }
    });
  } catch (err) {
    result = { client_op_id: op.client_op_id, status: 'error', reason: err.message };
    // don't save errors to idempotency table — allow retry
    return result;
  }

  // 3. Store result for idempotent retry (only ok/conflict/rejected, not errors)
  await this.idempotency.save(op.client_op_id, device.id, op.entity, result);
  return result;
}
```

### 12.4 Pull service pattern (one entity per request)

```typescript
@Injectable()
export class SyncService {
  async pullEntity(
    query: PullQueryDto,
    device: DeviceContext,
  ): Promise<PullResponseDto> {
    const { entity, since, limit = 500 } = query;
    const service = this.dispatcher.getEntityService(entity);

    // Capture server_time BEFORE the query runs, inside the same transaction.
    // If captured after, a row committed between query-end and new Date() will
    // have updated_at < server_time but be missed by the next pull that uses
    // server_time as its since cursor. In Postgres, NOW() returns transaction
    // start time — use that to get a consistent snapshot boundary.
    const { serverTime, upserted, deleted, hasMore, nextCursor } =
      await this.dataSource.transaction(async (tx) => {
        const serverTime = await tx
          .query('SELECT NOW() AS now')
          .then((r: any[]) => r[0].now as Date);

        const result = await service.getChangesSince(
          since ? new Date(since) : null,
          device.storeId,
          limit,
          tx,
        );
        return { serverTime, ...result };
      });

    return {
      server_time: serverTime.toISOString(),
      entity,
      upserted,
      deleted,
      has_more: hasMore,
      next_cursor: nextCursor,
    };
  }
}
```

### 12.5 Entity sync service pattern

```typescript
@Injectable()
export class SalesSyncService {
  async apply(op: Operation, device: DeviceContext, tx: EntityManager) {
    if (op.operation === 'create') {
      const existing = await tx.findOne(Sale, { where: { id: op.client_id }});
      if (existing) {
        return { client_op_id: op.client_op_id, status: 'duplicate',
                 server_id: existing.id, version: existing.version };
      }
      const sale = tx.create(Sale, {
        id: op.client_id,
        ...op.payload,
        version: 1,
        created_by_device: device.id,
      });
      await tx.save(sale);
      return { client_op_id: op.client_op_id, status: 'ok',
               server_id: sale.id, version: sale.version };
    }
    // update, delete ...
  }

  async getChangesSince(since: Date | null, storeId: string, limit: number) {
    const qb = this.repo.createQueryBuilder('s')
      .where('s.store_id = :storeId', { storeId })
      .orderBy('s.updated_at', 'ASC')
      .limit(limit + 1);   // fetch one extra to detect has_more

    if (since) qb.andWhere('s.updated_at > :since', { since });

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].updated_at.toISOString() : null;

    const upserted = page.filter(r => !r.deleted_at);
    const deleted = page.filter(r => r.deleted_at).map(r => r.id);
    return { upserted, deleted, hasMore, nextCursor };
  }
}
```

### 12.6 Auth

- JWT per user, refreshed via refresh token.
- Each request includes `X-Device-Id`.
- Device must be registered to the user's store/tenant.
- Token expiry during a long sync → mobile refreshes and retries chunk automatically.

---

## 13. Mobile Sync Manager Structure

### 13.1 Module layout

```
src/
├── db/
│   ├── schema.ts
│   └── database.ts               # expo-sqlite / drizzle setup
├── sync/
│   ├── SyncManager.ts            # public API: requestSync(), forceSync()
│   ├── PushWorker.ts
│   ├── PullWorker.ts
│   ├── SyncQueue.ts              # reads/writes sync_queue table
│   ├── ConflictResolver.ts
│   ├── Backoff.ts
│   └── NetworkMonitor.ts         # NetInfo wrapper
├── api/
│   └── SyncApiClient.ts          # axios instance w/ auth interceptor
└── screens/
    └── SyncStatusScreen.tsx      # pending count, failures, retry button
```

### 13.2 Sync manager public API

```typescript
class SyncManager {
  // Debounced; call freely after any mutation
  requestSync(): void;

  // Runs immediately, returns when queue is drained or network fails
  async forceSync(): Promise<SyncResult>;

  // Called before day-close; throws if queue isn't empty after retries
  async ensureEmptyQueue(timeoutMs: number): Promise<void>;

  // Observable sync state for UI
  subscribe(listener: (state: SyncState) => void): Unsubscribe;
}

type SyncState = {
  status: 'idle' | 'pushing' | 'pulling' | 'offline' | 'error';
  pendingCount: number;
  failedCount: number;
  lastSyncAt: Date | null;
  currentProgress?: { done: number; total: number };
};
```

### 13.3 UI indicators

- Header icon: cloud with checkmark / cloud with arrows / cloud with warning.
- Badge on "Unsynced" screen if `failedCount > 0`.
- Toast on reconnect: "Back online — syncing 43 items."
- Progress bar during long syncs: "Syncing 450 of 1000…"

---

## 14. Monitoring and Observability

### 14.1 Backend metrics

- Requests per minute for `/sync/push` and `/sync/pull`
- p50/p95/p99 latency per endpoint
- Operations per batch (avg, p95)
- Conflict rate per entity
- Idempotency hit rate (high hit rate = many retries = client-side issue)
- Delta query time per entity

### 14.2 Per-device metrics (reported by the app)

- Queue depth (how many pending ops)
- Oldest pending op age
- `last_pushed_at` per entity (server time)
- `last_pulled_at` per entity (server time)
- `last_full_sync` per entity (server time)
- Failed op count

Ship these to your backend so you can answer "Which stores haven't synced in 3 days?"

### 14.3 Alerting

- Any device with queue depth > 500 for > 24h
- Any device whose `last_pushed_at` is more than 24h behind `now()`
- Server push error rate > 1%
- Pull latency p95 > 2s

---

## 15. Checklist Before Going Live

Data model:
- [ ] All PKs are UUIDs generated on the device
- [ ] Every syncable table has `updated_at`, `deleted_at`, `version`, `sync_status`
- [ ] Indexes on `updated_at` on the backend
- [ ] Stock changes use movement deltas, not absolute values

Push flow:
- [ ] Domain write and queue write happen in one SQLite transaction
- [ ] Every op has a `client_op_id`
- [ ] Server has a `processed_operations` table with unique index on `client_op_id`
- [ ] Batches are chunked (50 ops OR 500 KB max)
- [ ] Sequence order is preserved within a batch
- [ ] Exponential backoff with jitter and max cap
- [ ] Dead-letter queue for poisoned operations
- [ ] `last_pushed_at` updated per entity at end of push cycle (using server's `server_time`)

Pull flow:
- [ ] Single `/sync/pull` endpoint, one entity per request
- [ ] Cursor uses server time, not device time
- [ ] Pagination via `has_more` / `next_cursor`
- [ ] **Pull skips local rows with `sync_status` in (`pending`, `syncing`, `failed`)** — both for upserts and deletions
- [ ] Per-entity `last_pulled_at` updated only when that entity finishes successfully

Scheduling:
- [ ] Foreground trigger
- [ ] Network reconnect trigger
- [ ] Debounced after-mutation trigger
- [ ] Periodic pull timer
- [ ] Pull-to-refresh
- [ ] Forced sync before day-close

Reliability:
- [ ] App-launch recovery resets `in_progress` → `pending`
- [ ] Only ONE push cycle runs at a time (mutex)
- [ ] Only ONE pull cycle runs at a time (mutex)
- [ ] Push always before pull
- [ ] Conflict resolution UI for interactive conflicts
- [ ] Schema version field in sync payloads for forward compatibility

Observability:
- [ ] Queue depth telemetry per device
- [ ] `last_pushed_at` / `last_pulled_at` / `last_full_sync` per entity in telemetry
- [ ] Server-side latency and error dashboards
- [ ] Alerting on stale devices

Security:
- [ ] JWT auth + device ID on every sync request
- [ ] Tenant isolation on every query
- [ ] Rate limiting on sync endpoints
- [ ] Payload size limit enforced server-side

---

## Summary Decision Table

| Question | Answer |
|---|---|
| Multiple APIs or single API for push? | **Single endpoint**, chunked batches of 50 |
| Multiple APIs or single API for pull? | **Single endpoint, one entity per request** |
| What if offline for 10 days with 1000 ops? | ~20 chunked batches, resumable, no data loss |
| What if sync stops mid-way? | Completed ops stay done, rest stay `pending`, retried next cycle |
| How often to sync? | On foreground, on reconnect, debounced after mutations, every 5–10 min for pull |
| Push first or pull first? | **Always push first**, then pull |
| How to prevent duplicates on retry? | `client_op_id` + server-side `processed_operations` table |
| How to detect conflicts? | `version` field + optimistic concurrency check |
| How to handle inventory? | Stock **movements** (deltas), not absolute counts |
| Where is the source of truth on mobile? | Local SQLite; `sync_queue` is the outbox |
| Where is the sync cursor time from? | Server's clock, returned in every pull response |
| What stops pull from clobbering local edits? | Pull skips rows where `sync_status ∈ {pending, syncing, failed}` |
| How is cursor drift handled? | Per-entity cursors; redundant fetches accepted as the trade-off for resumability |

---

## Changelog from v3

- **Cursor capture timing fixed** (§12.4) — `server_time` is now captured via `SELECT NOW()` at the start of the query transaction, not after it. Prevents a window where a row committed between query-end and `new Date()` gets silently skipped by the next pull.
- **Pagination cursor advancement fixed** (§7.3) — `entity_server_time` is captured once on the first page and held for the entire entity loop. `last_pulled_at` only advances when `has_more` is finally false, preventing inconsistent cursors during writes-while-pulling.
- **`expected_version` removed from create example** (§6.2) — creates have no prior version; the field is only meaningful on updates. The dispatcher correctly handles creates by checking existence, not version.
- **Cascading rejections documented** (§10.5) — parent rejection causes dependent ops to also fail. Introduces `dependency_failed` as an optional distinct status, and recommends displaying failed ops in sequence order so the root cause is visible.
- **Idempotency retention bumped to 90 days** (§4.2) — 30 days is insufficient for a rural POS that can realistically be offline for 30+ days. Update and delete retries after 30-day expiry could re-apply incorrectly.
- **`syncing` state clarified** (§3.1) — must actually be written to the domain row when the queue op transitions to `in_progress`; was declared but never set in the original push algorithm.
- **`sequence` generation hardened** (§3.2) — strengthened warning: any second SQLite connection (background task, notification handler) breaks the single-writer assumption. Recommend AUTOINCREMENT counter or ULID now rather than later.
- **Tombstone table annotated** (§4.3) — marked as reserved for future hard-delete (GDPR erasure) cases; not used by the current soft-delete pull flow.
- **KDS polling caveat added** (§16.6 and §16.11) — 30-second polling is insufficient for Kitchen Display System / live order screens; those require WebSocket or SSE.

---

## Changelog from v2

- **Section 16 added — web client architecture** (16.1–16.12). Covers dual API surface, shared domain services, corrected DB columns, web conflict handling, NestJS module restructure, authentication differences, and three non-negotiable rules.
- **Column recommendations corrected** — previous v2 draft over-specified four columns (`created_by_source`, `last_modified_by_source`, `last_modified_at`, `last_modified_by_user_id`). Correct minimal set is two: `created_by_user_id` + `last_modified_by_user_id`. Source tracking handled by `created_by_device IS NULL` (existing) or `audit_log` table (new).
- **`audit_log` table introduced** (Section 16.2) as the correct solution for full audit trail — replaces scattered source columns on domain rows.
- **Cross-client conflict scenario C documented** (Section 16.9) — web deletes a product that mobile is using offline; requires validation in `SalesSyncService.apply`.

---

## Changelog from v1

- **Pull algorithm now guards against overwriting unsynced local rows** (Section 7.3). Before upserting any server row, the pull worker checks the local row's `sync_status`; if it's `pending`, `syncing`, or `failed`, the server row is skipped. The same guard applies to server-side deletions.
- **`sync_metadata.last_pushed_at` is now wired up** at the end of the push cycle (Section 6.5), using the server's `server_time` from the most recent push response.
- **Pull endpoint changed to one-entity-per-request** (Section 7.1) to align with the per-entity cursor model. The previous comma-separated `entities` parameter is removed; the algorithm and endpoint now agree.
- **Per-entity cursor trade-off documented** (Section 7.5) — explains why each entity's cursor advances independently and what the cost is.
- **SQLite single-writer assumption noted** for the `MAX(sequence) + 1` pattern (Section 3.2 and 5.3).
- **Section 1 adds a 9th principle** making the "local unsynced edits win during pull" rule explicit.
- **Failure table extended** with the "pull interrupted between entities" case (Section 10.1, 11.4).
- **Conflict resolution flow updated** to mark the domain row's `sync_status = 'failed'` so subsequent pulls don't overwrite the user's pending edit (Section 9.5).

---

## 16. Adding a Web Client

### 16.1 Mental Model Shift

The backend currently serves one type of client:

- **Mobile** — offline-first, outbox pattern, talks to `/sync/push` and `/sync/pull`.

Adding:

- **Web** — always online, no outbox, no local DB. Talks to standard REST/CRUD endpoints.

**Key insight: the web client is not a sync client.** It is a normal online app talking to a normal online API. The two clients use different API surfaces but the same database and same domain logic.

```
┌─────────────┐         ┌─────────────┐
│  Mobile App │         │   Web App   │
│ (offline)   │         │  (online)   │
└──────┬──────┘         └──────┬──────┘
       │                        │
       │ /sync/push             │ /api/v1/customers (CRUD)
       │ /sync/pull             │ /api/v1/sales
       │                        │ /api/v1/products
       ▼                        ▼
┌─────────────────────────────────────┐
│         NestJS Backend              │
│  ┌────────────┐    ┌─────────────┐  │
│  │ SyncModule │    │  ApiModule  │  │
│  └─────┬──────┘    └──────┬──────┘  │
│        │                   │        │
│        └────────┬──────────┘        │
│                 ▼                   │
│        Shared Domain Services       │
│        (SalesService, etc.)         │
│                 │                   │
│                 ▼                   │
│           PostgreSQL                │
└─────────────────────────────────────┘
```

Both clients hit the same domain services under the hood. Only the API layer differs.

---

### 16.2 Database Columns — Minimal, Justified

**Do not add** `created_by_source`, `last_modified_by_source`, or `last_modified_at` — they are either inferable from existing columns or duplicates of `updated_at`.

**Add these two columns to every domain table:**

| Column | Type | Purpose |
|---|---|---|
| `created_by_user_id` | UUID FK → users | Who created the row |
| `last_modified_by_user_id` | UUID FK → users | Who last edited the row |

Keep `created_by_device` (already exists) — `NULL` means the row came from web; set means mobile.

**Do not change:** `version`, `updated_at`, `deleted_at`, `tenant_id`/`store_id`, `processed_operations` (mobile-only).

**If full audit is needed — build one `audit_log` table, not scattered columns:**

```sql
CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     TEXT NOT NULL,       -- 'customer', 'product', 'sale'
  entity_id       UUID NOT NULL,
  action          TEXT NOT NULL,       -- 'create', 'update', 'delete'
  actor_user_id   UUID NOT NULL,
  actor_source    TEXT NOT NULL,       -- 'mobile', 'web', 'system'
  actor_device_id TEXT,                -- set if mobile
  changes         JSONB,               -- { before: {...}, after: {...} }
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id       UUID NOT NULL
);

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id, created_at);
CREATE INDEX idx_audit_actor  ON audit_log(actor_user_id, created_at);
```

Write to `audit_log` inside the same transaction as every domain change. Use a TypeORM subscriber/listener so it is automatic — not manual in every service.

This gives full history, before/after diffs, and filterable reports without polluting every domain row.

---

### 16.3 The Critical Rule: Web Must Bump `updated_at` and `version`

Every web write must:

1. Set `updated_at = NOW()`
2. Increment `version` by 1
3. Set `last_modified_by_user_id = <user>`

**Why:** the mobile pull API uses `updated_at` as its cursor. If a web edit does not bump `updated_at`, mobile devices will never see the change — silently out of sync forever.

The safest approach: route both web and mobile writes through the same domain service. The version increment and timestamp update live in one place.

```typescript
// shared service used by BOTH sync and CRUD modules
@Injectable()
export class CustomersService {
  async update(
    id: string,
    payload: Partial<Customer>,
    expectedVersion: number,
    actor: { source: 'mobile' | 'web'; userId: string; deviceId?: string },
  ): Promise<Customer> {
    return this.dataSource.transaction(async (tx) => {
      const current = await tx.findOne(Customer, { where: { id } });
      if (!current) throw new NotFoundException();

      if (current.version !== expectedVersion) {
        throw new ConflictException({ server_state: current });
      }

      const updated = {
        ...current,
        ...payload,
        version: current.version + 1,
        updated_at: new Date(),
        last_modified_by_user_id: actor.userId,
      };
      await tx.save(Customer, updated);
      return updated;
    });
  }
}
```

- Web controller calls `customersService.update(id, body, body.version, { source: 'web', userId: req.user.id })`.
- Mobile sync handler calls the same method with `{ source: 'mobile', userId: ..., deviceId: ... }`.

---

### 16.4 New Web CRUD Endpoints

Web needs a standard REST API. Do not route it through `/sync/push` — that endpoint is designed for mobile's batching, idempotency, and ordering requirements. Web has none of those problems.

**Resources (per entity: customers, products, categories, taxes, payment methods):**

```
GET    /api/v1/<resource>        # list, paginated, filterable
GET    /api/v1/<resource>/:id    # single record
POST   /api/v1/<resource>        # create
PATCH  /api/v1/<resource>/:id    # update with version check
DELETE /api/v1/<resource>/:id    # soft delete
```

**Sales (mostly read-only from web):**

```
GET    /api/v1/sales
GET    /api/v1/sales/:id
POST   /api/v1/sales/:id/refund
POST   /api/v1/sales/:id/void
```

**Inventory:**

```
GET    /api/v1/inventory
GET    /api/v1/inventory/movements
POST   /api/v1/inventory/adjustments
POST   /api/v1/inventory/transfers
```

**Reports (web-only):**

```
GET    /api/v1/reports/daily-sales
GET    /api/v1/reports/sales-by-product
GET    /api/v1/reports/sales-by-cashier
GET    /api/v1/reports/inventory-valuation
GET    /api/v1/reports/tax-summary
GET    /api/v1/reports/end-of-day/:date
```

**Admin / Settings (web-only):**

```
GET    /api/v1/users
POST   /api/v1/users
PATCH  /api/v1/users/:id
GET    /api/v1/devices
POST   /api/v1/devices/:id/revoke
GET    /api/v1/sync-status
GET    /api/v1/audit-log
```

`/api/v1/sync-status` is especially valuable — shows the manager which devices have pending queues, last synced time, and failure counts.

**PATCH request/response shape:**

```json
PATCH /api/v1/customers/cust-uuid-a
{ "version": 3, "name": "Ravi Kumar", "phone": "9876543210" }

→ 200: { "id": "cust-uuid-a", "version": 4, "name": "Ravi Kumar", "updated_at": "..." }
→ 409: { "error": "version_mismatch", "server_state": { "version": 5, ... } }
```

---

### 16.5 How Mobile Picks Up Web Changes

No changes needed to the existing pull flow — it just works.

1. Web: `PATCH /api/v1/products/p1` → backend bumps `updated_at`, increments `version`.
2. Mobile next pull: `GET /sync/pull?since=<last_pulled_at>&entity=products` — server returns the row because `updated_at > since`.
3. Mobile applies the update (skipping it if there is a local pending edit on that row).

The pull endpoint does not care which client created the change.

---

### 16.6 How Web Picks Up Mobile Changes

No mechanism needed. Web is always online and stateless.

1. Mobile pushes 50 offline sales via `/sync/push`.
2. Manager opens web dashboard → `GET /api/v1/sales?date=...` → sees all 50 immediately.

**Optional real-time:** if the web dashboard needs to update live without a reload, add a WebSocket / SSE channel:

```
WS /api/v1/realtime?store_id=...
  → { type: 'sale.created', data: {...} }
  → { type: 'product.updated', data: {...} }
```

For most POS dashboards (sales history, inventory levels, reports) a 30-second auto-refresh is sufficient and simpler. **Exception:** if you add a Kitchen Display System (KDS) or a live order queue screen, 30-second polling is too slow — those screens need a WebSocket or SSE connection to be usable.

---

### 16.7 NestJS Module Restructure

```
src/
├── sync/                           # Mobile-only API
│   ├── sync.module.ts
│   ├── sync.controller.ts          # POST /sync/push, GET /sync/pull
│   ├── sync.service.ts
│   └── idempotency.service.ts
│
├── api/                            # Web-only REST API
│   ├── api.module.ts
│   ├── customers.controller.ts
│   ├── sales.controller.ts
│   ├── products.controller.ts
│   ├── inventory.controller.ts
│   ├── reports.controller.ts
│   ├── admin.controller.ts
│   └── realtime.gateway.ts         # optional WebSocket
│
├── domain/                         # Shared business logic
│   ├── customers/
│   │   └── customers.service.ts    # called by BOTH sync and api
│   ├── sales/
│   │   └── sales.service.ts
│   ├── products/
│   │   └── products.service.ts
│   └── inventory/
│       └── inventory.service.ts
│
└── auth/
    ├── mobile-jwt.guard.ts         # /sync/* — mobile JWT + device_id
    └── web-jwt.guard.ts            # /api/v1/* — web JWT, HttpOnly cookie
```

`domain/*` services are the only place that touches the database. Both `sync/*` and `api/*` are thin translation layers. Business rules (price calculation, inventory deduction, tax) live in one place and cannot diverge.

---

### 16.8 Authentication — Two Flows, One Signing Key

| | Mobile | Web |
|---|---|---|
| Token type | Long-lived JWT + refresh token | Short-lived JWT, refresh via cookie |
| Identifier | User + `device_id` | User + browser session |
| Storage | Secure storage (Keychain / Keystore) | HttpOnly cookie |
| Audience (`aud`) | `'mobile'` | `'web'` |
| Typical role | Cashier | Manager / Admin |

Same JWT signing key, different `aud` claims. Each guard validates its own audience.

```typescript
@Controller('sync')
@UseGuards(MobileJwtGuard, DeviceContextGuard)
export class SyncController { ... }

@Controller('api/v1')
@UseGuards(WebJwtGuard, RolesGuard)
export class CustomersController { ... }
```

---

### 16.9 Cross-Client Conflict Scenarios

**A. Web edits while mobile is offline** ✅ Already handled

Mobile pushes with `expected_version = 3`, server is at `version = 4` (web edit). Returns `conflict`. Mobile shows conflict UI.

**B. Mobile pushes a sale, web sees it instantly** ✅ Trivially works

Both clients share the same DB. No extra work needed.

**C. Web deletes a product mobile is using offline** ⚠️ New — needs explicit handling

Mobile pushes a sale referencing a product that was soft-deleted on web. Add validation in `SalesSyncService.apply`: verify all referenced products exist and `deleted_at IS NULL`. If not: return `rejected` with reason `product_not_available`. Mobile moves the sale to `failed_operations` and alerts the cashier.

**D. Web changes price while mobile has unsynced sales** ✅ Safe by design

Sale line items must store `price_at_time_of_sale` — a copied value, never a live FK to the current product price. Web price changes do not retroactively rewrite historical sales. If your schema does not do this, fix it before launch: retroactive price rewrites are a financial reporting disaster.

---

### 16.10 Updated Architecture Diagram

```
┌──────────────────┐         ┌──────────────────┐
│   Mobile App     │         │     Web App      │
│  (React Native)  │         │  (React / Next)  │
│  Offline-first   │         │   Online-only    │
└────────┬─────────┘         └────────┬─────────┘
         │                            │
         │ /sync/push                 │ /api/v1/*
         │ /sync/pull                 │ (REST CRUD)
         │ (chunked, idempotent)      │ optional: WS /realtime
         ▼                            ▼
┌──────────────────────────────────────────────┐
│              NestJS Backend                  │
│                                              │
│   ┌────────────┐         ┌─────────────┐    │
│   │   Sync     │         │     API     │    │
│   │  Module    │         │   Module    │    │
│   │ (mobile)   │         │   (web)     │    │
│   └─────┬──────┘         └──────┬──────┘    │
│         └────────────┬──────────┘            │
│                      ▼                       │
│           ┌─────────────────────┐            │
│           │   Domain Services   │            │
│           │  Customers, Sales,  │            │
│           │ Products, Inventory │            │
│           └──────────┬──────────┘            │
│                      ▼                       │
│                 PostgreSQL                   │
│           - domain tables                    │
│             (created_by_user_id,             │
│              last_modified_by_user_id)       │
│           - processed_operations (mobile)    │
│           - audit_log                        │
└──────────────────────────────────────────────┘
```

---

### 16.11 Summary Decision Table

| Question | Answer |
|---|---|
| Does web use `/sync/push` and `/sync/pull`? | No. Web uses standard REST CRUD. |
| Does mobile change at all? | No. Mobile sync flow stays exactly as designed. |
| New DB columns needed? | `created_by_user_id` + `last_modified_by_user_id` only. |
| What about source tracking (`mobile`/`web`)? | Infer from `created_by_device IS NULL`. Build `audit_log` if you need full history. |
| Does web need an outbox? | No. Web is online-only; writes go straight to the API. |
| How does mobile pick up web changes? | Existing `/sync/pull`. Web bumps `updated_at`; mobile sees it next pull. |
| How does web pick up mobile changes? | Just queries the DB. Mobile-pushed rows are immediately visible. |
| Do mobile and web share business logic? | Yes — domain services called by both layers. |
| Real-time on web? | Optional WebSocket / SSE. 30-second polling is fine for sales/inventory/reports. Required for KDS / live order screens. |
| Authentication? | Same signing key, different `aud`. Mobile: long-lived JWT + device_id. Web: short-lived + cookie. |
| New conflict scenario? | Web-deletes-product-mobile-uses → add validation in `SalesSyncService.apply`. |
| Most critical rule? | Web writes must always bump `updated_at` + `version` via shared domain service. |

---

### 16.12 The Three Non-Negotiable Rules

1. **Both clients write through the same domain services.** Never let the web bypass logic that mobile sync relies on. A web endpoint that updates a row without incrementing `version` or touching `updated_at` will silently break mobile pull.

2. **Every web write bumps `updated_at` and `version`.** This is the mechanism that makes the existing mobile pull cursor work. Miss this once and that device drifts out of sync with no error, no alert, and no easy way to detect it.

3. **Sale line items store price-at-time-of-sale, never a live FK to current product price.** Web price changes must not retroactively rewrite historical sales. This is both a data integrity rule and a regulatory requirement for any POS that issues receipts.
