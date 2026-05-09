# Offline-First POS Sync Architecture

**Stack:** React Native (Expo) mobile app + NestJS backend
**Use case:** Mini billing POS that works fully offline and syncs when connectivity returns.

**Version:** 5.0

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

1. **Local-first UI** — the app reads from and writes to local SQLite only. The network is a background detail.
2. **Outbox pattern for writes** — every local mutation also writes a row to a `sync_queue` table in the same transaction. The queue is the source of truth for "what still needs to be sent."
3. **Delta pull for reads** — the server returns "everything changed since cursor X."
4. **Idempotency on every write** — every operation has a `client_op_id` (UUID). Retries are safe.
5. **UUIDs everywhere** — primary keys are UUIDs generated on the device. No auto-increment.
6. **Push before pull** — always drain the outbox before pulling server changes, so local pending work is never overwritten.
7. **Server time is authoritative** — all sync cursors use the server's clock, never the device's.
8. **Nothing is destructive until confirmed** — queue rows are only marked `done` after the server acknowledges them.
9. **Local unsynced edits always win during pull** — pull never overwrites a row whose `sync_status` is `pending`, `syncing`, or `failed`.

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
           ┌───────────────────┼───────────────────┐
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
│                    ├── domain tables (soft deletes)        │
│                    └── processed_operations (idempotency)  │
└────────────────────────────────────────────────────────────┘
```

---

## 3. Mobile Database Schema

### 3.1 Domain tables

Every domain table (e.g., `sales`, `sale_items`, `customers`, `products`, `payments`) includes:

| Column           | Type          | Purpose                                                  |
| ---------------- | ------------- | -------------------------------------------------------- |
| `id`             | TEXT (UUID)   | Primary key, generated on device                         |
| `updated_at`     | DATETIME      | Local timestamp of last change                           |
| `deleted_at`     | DATETIME NULL | Soft delete marker                                       |
| `sync_status`    | TEXT          | `pending` / `syncing` / `synced` / `failed`              |
| `version`        | INTEGER       | Incremented on every update, used for conflict detection |
| `server_version` | INTEGER NULL  | Last version confirmed by the server                     |

**`sync_status` lifecycle:**

- `pending` — local change not yet sent to server.
- `syncing` — actively being pushed (set when its queue op transitions to `in_progress`). Reset to `pending` on app launch if stuck.
- `synced` — server has confirmed the latest local version.
- `failed` — server rejected or returned a conflict; needs resolution.

**The pull worker treats `pending`, `syncing`, and `failed` as "do not overwrite."** Only `synced` (or absent) rows can be replaced by server data.

> **Important:** `syncing` must actually be written to the domain row when its queue op is marked `in_progress`. The push algorithm should update both the domain row and queue row at the same moment.

### 3.2 Sync queue (outbox)

```sql
CREATE TABLE sync_queue (
  id              TEXT PRIMARY KEY,
  client_op_id    TEXT UNIQUE NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  operation       TEXT NOT NULL,           -- 'create' | 'update' | 'delete'
  payload         TEXT NOT NULL,           -- JSON snapshot
  sequence        INTEGER NOT NULL,        -- monotonic ordering
  priority        INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending',
  retry_count     INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  next_retry_at   DATETIME,
  created_at      DATETIME NOT NULL,
  synced_at       DATETIME
);

CREATE INDEX idx_queue_status_seq ON sync_queue(status, sequence);
CREATE INDEX idx_queue_next_retry ON sync_queue(next_retry_at) WHERE status = 'pending';
```

> **Note on `sequence` generation:** `SELECT COALESCE(MAX(sequence), 0) + 1 FROM sync_queue` inside a transaction is safe in SQLite with a single writer (which `expo-sqlite` guarantees). If you ever add a background task or second connection, switch to `INTEGER PRIMARY KEY AUTOINCREMENT` on a dedicated counter table.

### 3.3 Sync metadata

```sql
CREATE TABLE sync_metadata (
  entity_type     TEXT PRIMARY KEY,
  last_pulled_at  TEXT,            -- compound cursor from last pull (e.g. "1700000000000:42")
  last_pushed_at  DATETIME,        -- server timestamp from last push cycle
  last_full_sync  DATETIME         -- server timestamp from last clean push+pull
);
```

### 3.4 Failed operations (dead-letter)

```sql
CREATE TABLE failed_operations (
  id              TEXT PRIMARY KEY,
  client_op_id    TEXT,
  entity_type     TEXT,
  entity_id       TEXT,
  payload         TEXT,
  error           TEXT,
  failed_at       DATETIME,
  resolved        BOOLEAN DEFAULT 0
);
```

---

## 4. Backend Database Schema

### 4.1 Domain tables (PostgreSQL)

Every syncable table has:

| Column                     | Purpose                                   |
| -------------------------- | ----------------------------------------- |
| `id` (UUID PK)             | Same UUID as the mobile row               |
| `updated_at` (TIMESTAMPTZ) | Set to `NOW()` on every write, **indexed** |
| `deleted_at` (TIMESTAMPTZ) | Soft delete                               |
| `version` (INTEGER)        | Incremented on every update               |
| `created_by_device` (TEXT) | Which device originated the row           |
| `store_id` (UUID)          | Tenant isolation                          |

**Required index on every syncable table:**

```sql
CREATE INDEX idx_<table>_sync ON <table>(updated_at ASC, id ASC);
```

This compound index is what makes the pull cursor work efficiently.

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
CREATE INDEX idx_processed_expires ON processed_operations(processed_at);
```

**Retention:** 90 days, then delete. A rural POS offline for 30+ days is realistic. UUID-based creates would produce a duplicate-row error on retry (safe), but update/delete retries after expiry could re-apply incorrectly. 90 days covers the realistic tail.

**Cleanup:** run daily:

```sql
DELETE FROM processed_operations WHERE processed_at < NOW() - INTERVAL '90 days';
```

**Critical rule: only save ok/conflict/rejected results. Never save errors.** If the handler threw an exception or returned a transient error, do NOT write to this table — the client must be able to retry.

### 4.3 Tombstone garbage collection

Soft-deleted rows accumulate forever without cleanup. Define a GC horizon:

```sql
-- Run weekly or nightly
DELETE FROM products WHERE deleted_at < NOW() - INTERVAL '90 days';
DELETE FROM customers WHERE deleted_at < NOW() - INTERVAL '90 days';
-- ... per syncable table
```

**Client contract:** if a device hasn't synced in more than 90 days, it must do a full re-bootstrap (wipe local DB, pull everything). The tombstone horizon and the idempotency retention should match.

---

## 5. Write Path — Offline Data Capture

When the cashier performs any action, regardless of network state:

### 5.1 Steps

1. **Generate a UUID** for the new entity on the device.
2. **Open a SQLite transaction.**
3. **Write to the domain table** with `sync_status = 'pending'`, `version = 1` (or `version + 1` for updates).
4. **Write to `sync_queue`** with a fresh `client_op_id`, `sequence = MAX(sequence) + 1`, and a JSON snapshot.
5. **Commit the transaction.**
6. **Update the UI** immediately.
7. **Trigger the sync manager** (debounced).

### 5.2 Why one transaction

If you write the sale but crash before writing the queue row, the sale exists locally but will never sync — silent data loss. One transaction guarantees both or neither.

### 5.3 Pseudo-code

```typescript
async function createSale(saleData: SaleInput) {
  const saleId = uuid();
  const opId = uuid();
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    await tx.execute(
      `INSERT INTO sales (id, customer_id, total, created_at, updated_at,
                           sync_status, version)
       VALUES (?, ?, ?, ?, ?, 'pending', 1)`,
      [saleId, saleData.customerId, saleData.total, now, now],
    );

    for (const item of saleData.items) {
      await tx.execute(
        `INSERT INTO sale_items (id, sale_id, product_id, qty, price,
                                  updated_at, sync_status, version)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', 1)`,
        [uuid(), saleId, item.productId, item.qty, item.price, now],
      );
    }

    const nextSeq = await tx.queryOne(
      `SELECT COALESCE(MAX(sequence), 0) + 1 AS seq FROM sync_queue`,
    );

    await tx.execute(
      `INSERT INTO sync_queue (id, client_op_id, entity_type, entity_id,
                               operation, payload, sequence, priority,
                               status, created_at)
       VALUES (?, ?, 'sale', ?, 'create', ?, ?, 10, 'pending', ?)`,
      [uuid(), opId, saleId, JSON.stringify(saleData), nextSeq.seq, now],
    );
  });

  syncManager.requestSync();
  return saleId;
}
```

---

## 6. Push Flow — Mobile → Backend

### 6.1 Chunked batches

One endpoint (`POST /sync/push`), many small requests. For 1000 queued ops:

```
POST /sync/push  with items 1–50
POST /sync/push  with items 51–100
...
POST /sync/push  with items 951–1000
```

20 small, fast, recoverable requests.

### 6.2 Request shape

```json
POST /sync/push
Authorization: Bearer <token>
X-Device-Id: abc-123

{
  "device_id": "abc-123",
  "operations": [
    {
      "client_op_id": "op-uuid-1",
      "sequence": 101,
      "entity": "customer",
      "operation": "create",
      "client_id": "cust-uuid-a",
      "payload": { "name": "Ravi", "phone": "9876543210" }
    },
    {
      "client_op_id": "op-uuid-2",
      "sequence": 102,
      "entity": "sale",
      "operation": "create",
      "client_id": "sale-uuid-b",
      "payload": {
        "customer_id": "cust-uuid-a",
        "items": [{ "product_id": "p1", "qty": 2, "price": 150 }],
        "total": 300,
        "paid_at": "2026-04-19T10:12:45Z"
      }
    },
    {
      "client_op_id": "op-uuid-3",
      "sequence": 103,
      "entity": "customer",
      "operation": "update",
      "client_id": "cust-uuid-a",
      "payload": {
        "name": "Ravi Kumar",
        "phone": "9876543210",
        "expected_version": 1
      }
    }
  ]
}
```

**Note on `expected_version`:** this field lives **inside `payload`**, not at the operation level. Creates don't include it (no prior version). Updates and deletes must include it for conflict detection. The server handler reads it from `payload.expected_version`.

### 6.3 Response shape

```json
{
  "server_time": "2026-04-19T10:15:00Z",
  "results": [
    {
      "client_op_id": "op-uuid-1",
      "status": "ok",
      "server_id": "cust-uuid-a",
      "version": 1
    },
    {
      "client_op_id": "op-uuid-2",
      "status": "ok",
      "server_id": "sale-uuid-b",
      "version": 1
    },
    {
      "client_op_id": "op-uuid-3",
      "status": "conflict",
      "reason": "version_mismatch",
      "server_state": { "id": "cust-uuid-a", "version": 2, "name": "..." }
    }
  ]
}
```

| Status      | Meaning                     | Mobile action                                                             |
| ----------- | --------------------------- | ------------------------------------------------------------------------- |
| `ok`        | Server applied the change   | Mark queue row `done`, domain row → `synced`                              |
| `duplicate` | Already processed           | Same as `ok` — use cached result                                          |
| `conflict`  | Server has newer version    | Queue row → `failed`, domain row → `failed`, run conflict resolution      |
| `rejected`  | Invalid data, perm denied   | Move to `failed_operations`, domain row → `failed`, notify user           |
| `error`     | Transient server error      | Keep as `pending`, retry with backoff                                     |

### 6.4 Chunking rules

- **Chunk size:** 50 operations OR 500 KB, whichever is smaller.
- **Order preserved:** ascending `sequence`. Dependencies (customer before the sale referencing it) are respected.
- **Sequential, not parallel:** one chunk at a time. Parallel chunks break ordering.
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

    # Mark queue rows AND their domain rows
    for row in batch:
      UPDATE sync_queue SET status = 'in_progress' WHERE id = row.id
      UPDATE <row.entity_type> SET sync_status = 'syncing' WHERE id = row.entity_id

    try:
      response = POST /sync/push { operations: batch }
    except NetworkError:
      for row in batch:
        UPDATE sync_queue SET status = 'pending' WHERE id = row.id
        UPDATE <row.entity_type> SET sync_status = 'pending' WHERE id = row.entity_id
      break

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
          save result.server_state for conflict UI

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
          UPDATE <entity> SET sync_status='pending' WHERE id=row.entity_id

  for entity in entities_touched:
    UPDATE sync_metadata SET last_pushed_at = server_time
      WHERE entity_type = entity
finally:
  release push_mutex
```

### 6.6 Exponential backoff

```
backoff(retry) = min(30 * 60, 2^retry) seconds + random jitter
```

After 10 retries, move to `failed_operations` and notify the user.

### 6.7 Cross-chunk cascading failures

If a customer-create is the last op in chunk 1 and gets `rejected`, a sale referencing that customer in chunk 2 will fail with a FK violation. The errors look unrelated.

**Mitigation:** after processing each chunk's results, scan remaining pending ops. If any `rejected` op's `entity_id` is referenced by later ops (simple check: `entity_id` appears in another op's `payload` JSON), preemptively mark those as `failed` with `last_error = 'dependency_failed: <parent_op_id>'` before sending the next chunk.

For a small POS where the dependency graph is shallow (customer → sale is the main one), showing failed ops in `sequence` order in the UI is usually sufficient — the root cause (first rejection) is visible before its dependents.

---

## 7. Pull Flow — Backend → Mobile

### 7.1 Single delta endpoint (one entity per request)

```
GET /sync/pull?entity=products&cursor=1700000000000:42&limit=500
```

| Query param | Purpose |
| ----------- | ------- |
| `entity`    | Single entity type to pull |
| `cursor`    | Compound cursor `<updated_at_ms>:<id>`. Empty or absent for initial sync. |
| `limit`     | Max rows per page |

**Why compound cursor, not bare timestamp:** if 1000 rows share the same `updated_at` and your limit is 500, a bare `updated_at > :since` skips the other 500 forever. The compound `(updated_at, id)` cursor produces a total order with zero gaps.

**Why one entity per request:** aligns with per-entity cursors. Pagination is clean — one entity, one `has_more`, one `next_cursor`. A multi-entity batch adds complexity that isn't worth it for a small app.

### 7.2 Response shape

```json
{
  "server_time": "2026-04-19T10:15:00.000Z",
  "entity": "products",
  "changes": [
    {
      "id": "p1",
      "operation": "upsert",
      "data": { "id": "p1", "name": "Coffee 250ml", "price": 40, "version": 3 }
    },
    {
      "id": "p99",
      "operation": "delete",
      "data": null
    }
  ],
  "has_more": false,
  "next_cursor": "1700000060000:55"
}
```

**Delete changes include the `id`.** Without it the client doesn't know which local row to remove. `data` is null for deletes (no need to send the full row).

### 7.3 Mobile-side pull algorithm

```
acquire pull_mutex
try:
  for entity in ['products', 'customers', 'categories', 'taxes']:
    cursor = read last_pulled_at from sync_metadata for this entity
    has_more = true
    entity_server_time = null    # captured ONCE on first page

    while has_more:
      response = GET /sync/pull?entity=entity&cursor=cursor&limit=500

      if entity_server_time is null:
        entity_server_time = response.server_time

      for change in response.changes:
        existing = SELECT sync_status FROM <entity> WHERE id = change.id

        if existing AND existing.sync_status IN ('pending', 'syncing', 'failed'):
          if change.operation == 'delete':
            # Server deleted a row we have local edits on — conflict
            UPDATE <entity> SET sync_status = 'failed' WHERE id = change.id
            flag for conflict resolution
          else:
            # Local edit wins until push reconciles
            continue
        else:
          if change.operation == 'delete':
            UPDATE <entity> SET deleted_at = now(), sync_status = 'synced'
              WHERE id = change.id
          else:
            # UPSERT — use ON CONFLICT UPDATE, not INSERT OR REPLACE
            INSERT INTO <entity> (id, ...columns..., sync_status, server_version)
              VALUES (change.id, ...data..., 'synced', change.data.version)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              price = excluded.price,
              ...
              sync_status = 'synced',
              server_version = excluded.server_version

      has_more = response.has_more
      cursor = response.next_cursor

    # Advance cursor only when fully drained
    UPDATE sync_metadata SET last_pulled_at = response.next_cursor
      WHERE entity_type = entity
finally:
  release pull_mutex
```

**Why `INSERT ... ON CONFLICT UPDATE` instead of `INSERT OR REPLACE`:** `INSERT OR REPLACE` deletes the existing row and inserts a new one. Any local-only columns not in the server response (cached UI state, computed fields) are destroyed. `ON CONFLICT UPDATE` preserves columns not in the SET clause.

### 7.4 Critical rules

- **Compound cursor.** `next_cursor` is `<updated_at_ms>:<id>`, not a bare timestamp.
- **`server_time` captured once per entity.** On the first page only. Do NOT update it per-page — if writes happen during a long paginated pull, a fresh `server_time` per page produces an inconsistent cursor.
- **Never overwrite local pending changes.** Rows with `sync_status` of `pending`, `syncing`, or `failed` are skipped on upserts. Server-side deletions of locally-pending rows are conflicts, not silent overwrites.
- **Advance `last_pulled_at` only when `has_more` is false.** If the pull is interrupted mid-page, the cursor stays where it was.

### 7.5 Per-entity cursor trade-off

Each entity advances its cursor independently. If the pull loop crashes between entities, completed ones keep their progress. The cost: cursors can drift and cause some redundant fetches on the next pull. This is the right trade-off — refetching a few customer rows is far cheaper than refetching 50,000 products.

### 7.6 Initial sync vs incremental

| | Initial sync | Incremental sync |
|---|---|---|
| `cursor` | absent / empty | last `next_cursor` |
| Size | Large (entire catalog) | Small (recent changes) |
| UI | Progress bar | Silent background |

### 7.7 Full re-bootstrap triggers

The client must wipe its local DB and do a full initial sync when:

- User logs out and logs back in.
- Local SQLite DB is corrupted.
- Device hasn't synced in more than the tombstone horizon (90 days).
- App update includes a breaking schema change that can't be migrated additively.
- Device is transferred to a different store.

---

## 8. Sync Scheduling and Triggers

| Trigger | What runs | Why |
| ------- | --------- | --- |
| App launch / foreground | Push + Pull | Catch up after any time away |
| Network reconnect | Push + Pull | Drain queue ASAP |
| After local mutation (debounced 2–3s) | Push only | Keep server near-live |
| Periodic timer (every 5 min) | Pull only | Catch catalog/price changes |
| Pull-to-refresh on list screens | Pull only | User-initiated |
| Before day-close / Z-report | Push (forced, blocking) | Guarantee day's data is on server |

### 8.1 Order in a full sync cycle

```
1. Push all pending operations (drain the outbox)
2. Pull deltas for all entities
3. If both phases completed cleanly, update last_full_sync
```

**Push always before pull.**

### 8.2 Debouncing

After a local mutation, wait 2–3 seconds before pushing. The timer resets on each new mutation. This batches rapid-fire line item additions.

---

## 9. Conflict Resolution

### 9.1 Strategy per entity

| Entity | Conflict likelihood | Strategy |
| ------ | ------------------- | -------- |
| Sales, payments | Near-zero (new rows, UUID) | Accept all |
| Inventory stock | High (multi-device) | Store deltas, not absolutes |
| Product price / tax | Low (admin-only) | Server wins |
| Customer edits | Medium | Version check + conflict UI |

### 9.2 Inventory: use stock movements, not absolute counts

**Wrong:** Two devices both read stock=10, both write stock=9. Result: 9 (lost a unit).

**Right:** Each device writes a movement `{delta: -1}`. Server aggregates: `current_stock = SUM(deltas)`. Result: 8. Correct.

### 9.3 Version-based optimistic concurrency

For updates, `payload` includes `expected_version`:

```json
{
  "operation": "update",
  "entity": "customer",
  "client_id": "cust-uuid-a",
  "payload": { "name": "New Name", "expected_version": 3 }
}
```

Server:

```
current = SELECT * FROM customer WHERE id = op.client_id FOR UPDATE
if current.version != payload.expected_version:
  return { status: 'conflict', server_state: current }
else:
  apply update, version = version + 1, return ok
```

### 9.4 Resolving conflicts on mobile

1. Queue row → `failed`. Domain row → `sync_status = 'failed'`.
2. Store `server_state` locally (JSON column or a `conflict_snapshots` table).
3. Pull skips this row (because `sync_status = 'failed'`).
4. Show UI: "Customer updated on another device. Keep yours / Use server's."
5. After resolution, create a new queue op with `expected_version` set to the server's current version. Reset `sync_status` to `pending`.

For non-interactive conflicts (product price changed by admin), policy is "server wins": discard local edit, apply server state, clear queue row.

---

## 10. Failure Handling and Recovery

### 10.1 Failure matrix

| Failure | Device state | Server state | Recovery |
| ------- | ------------ | ------------ | -------- |
| Network drops mid-request | Queue rows `in_progress` | Nothing | Reset → `pending`, retry |
| Server saved, response lost | Queue rows `in_progress` | Cached in `processed_operations` | Retry → server returns cached result |
| App killed mid-sync | Queue rows `in_progress` | Partial | App-launch recovery resets → `pending` |
| One op bad data | Other ops succeed | Bad op rejected | Bad op → `failed_operations` |
| Server down | Push returns 5xx | Nothing | Backoff, retry later |

**No data is lost** as long as: queue is in SQLite, rows only marked `done` after confirmation, app-launch recovery runs, idempotency keys used everywhere.

### 10.2 App-launch recovery

On every app start, before any sync:

```sql
-- Reset stuck queue rows
UPDATE sync_queue SET status = 'pending' WHERE status = 'in_progress';
-- Reset stuck domain rows
UPDATE sales SET sync_status = 'pending' WHERE sync_status = 'syncing';
UPDATE customers SET sync_status = 'pending' WHERE sync_status = 'syncing';
-- ... per domain table
```

### 10.3 Dead-letter queue

After 10 retries OR an explicit `rejected` from the server, move to `failed_operations`. Show a "Unsynced items" screen with a count badge.

### 10.4 Partial success

A batch push is **not** all-or-nothing. Op #23 can conflict while #1–22 and #24–50 succeed. The server processes each op in its own transaction.

### 10.5 Cascading rejections

See §6.7.

---

## 11. End-to-End Example: 1000 Queued Operations

A village shop's POS was offline for 10 days. 1000 ops queued. Internet returns.

**T+0s** — NetInfo fires `connected`. Sync manager starts.

**T+0.2s** — Push: first 50 ops → `in_progress` → POST /sync/push.

**T+2.5s** — Server: 48 ok, 1 conflict (customer edit), 1 rejected (deleted product).

**T+2.6s** — 48 → `done`/`synced`. 1 → `failed` (conflict UI). 1 → `failed_operations`.

**T+2.7s** — Next 50 ops. Loop continues.

**T+65s** — ~20 batches done. Queue nearly empty. `last_pushed_at` updated.

**T+66s** — Pull starts. `GET /sync/pull?entity=products&cursor=<10 days ago>&limit=500`.

**T+68s** — 230 product updates received. All local rows are `synced` → upserted.

**T+68.5s** — Customers pull. Conflicted customer has `sync_status = 'failed'` → skipped.

**T+70s** — All entities done. UI: "998 synced, 2 need attention."

### What if internet drops at T+30s?

~750 pending ops stay in the queue. Next reconnect picks up where it left off. The 250 already-done ops are NOT re-sent.

### What if app is killed at T+30s?

App-launch recovery resets `in_progress` → `pending`. Stuck batch retried. Server returns cached results via idempotency. No duplicates.

---

## 12. NestJS Backend Structure

### 12.1 Module layout

```
src/
├── sync/
│   ├── sync.module.ts
│   ├── sync.controller.ts          # POST /sync/push, GET /sync/pull
│   ├── sync.service.ts
│   ├── idempotency.service.ts
│   ├── dispatcher.service.ts       # routes op → entity service
│   └── dto/
│       ├── push-request.dto.ts
│       └── pull-query.dto.ts
├── domain/
│   ├── sales/
│   │   ├── sales.service.ts        # shared business logic
│   │   └── sales-sync.service.ts   # applyRemoteOperation, getChangesSince
│   ├── customers/
│   │   ├── customers.service.ts
│   │   └── customers-sync.service.ts
│   └── products/
│       ├── products.service.ts
│       └── products-sync.service.ts
└── auth/
    └── device-auth.guard.ts
```

### 12.2 Push controller

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
    @Query() query: PullQueryDto,
    @CurrentDevice() device: DeviceContext,
  ): Promise<PullResponseDto> {
    return this.syncService.pullEntity(query, device);
  }
}
```

### 12.3 Operation processing with idempotency

```typescript
async applyOperation(op: Operation, device: DeviceContext): Promise<OpResult> {
  // 1. Check idempotency cache
  const cached = await this.idempotency.find(op.client_op_id);
  if (cached) {
    return cached.result;
  }

  // 2. Dispatch inside a transaction
  let result: OpResult;
  try {
    result = await this.dataSource.transaction(async (tx) => {
      const handler = this.dispatcher.getHandler(op.entity);
      if (!handler) {
        // Unknown entity — do NOT save to idempotency table.
        // Client can retry after server update.
        return {
          client_op_id: op.client_op_id,
          status: 'error',
          reason: `Unknown entity: ${op.entity}`,
        };
      }
      return handler.apply(op, device, tx);
    });
  } catch (err) {
    // Transient error — do NOT save to idempotency table. Allow retry.
    return {
      client_op_id: op.client_op_id,
      status: 'error',
      reason: err.message,
    };
  }

  // 3. Save to idempotency ONLY for terminal results (ok, conflict, rejected)
  if (result.status !== 'error') {
    await this.idempotency.save(op.client_op_id, device.id, op.entity, result);
  }

  return result;
}
```

**Why the idempotency save is conditional:** if you save `error` or `unknown entity` results, the client can never retry successfully — the operation is permanently dead-keyed. This is a known anti-pattern (documented by Stripe and Brandur Leach). Only terminal, correct results get cached.

### 12.4 Pull service — compound cursor + REPEATABLE READ

```typescript
async pullEntity(
  query: PullQueryDto,
  device: DeviceContext,
): Promise<PullResponseDto> {
  const { entity, cursor, limit = 500 } = query;
  const handler = this.dispatcher.getHandler(entity);

  // Parse compound cursor
  let cursorTs = new Date(0);
  let cursorId = '00000000-0000-0000-0000-000000000000';
  if (cursor) {
    const [tsStr, idStr] = cursor.split(':');
    cursorTs = new Date(parseInt(tsStr, 10));
    cursorId = idStr;
  }

  // REPEATABLE READ ensures all queries in this tx see the same snapshot.
  // server_time captured via NOW() at transaction start.
  const result = await this.dataSource.manager.transaction(
    'REPEATABLE READ',
    async (tx) => {
      const serverTime: Date = await tx
        .query('SELECT NOW() AS now')
        .then((r: any[]) => r[0].now);

      const changes = await handler.getChangesSince(
        cursorTs, cursorId, device.storeId, limit, tx,
      );

      return { serverTime, ...changes };
    },
  );

  return {
    server_time: result.serverTime.toISOString(),
    entity,
    changes: result.changes,
    has_more: result.hasMore,
    next_cursor: result.nextCursor,
  };
}
```

### 12.5 Entity sync service — compound cursor query

```typescript
@Injectable()
export class ProductsSyncService {
  async apply(op: Operation, device: DeviceContext, tx: EntityManager) {
    if (op.operation === 'create') {
      // Check for existing row (UUID collision = duplicate)
      const existing = await tx.findOne(Product, { where: { id: op.client_id } });
      if (existing) {
        return {
          client_op_id: op.client_op_id,
          status: 'duplicate',
          server_id: existing.id,
          version: existing.version,
        };
      }

      const product = tx.create(Product, {
        id: op.client_id,
        ...op.payload,
        version: 1,
        store_id: device.storeId,
        created_by_device: device.id,
        updated_at: new Date(),
      });
      await tx.save(product);
      return {
        client_op_id: op.client_op_id,
        status: 'ok',
        server_id: product.id,
        version: product.version,
      };
    }

    if (op.operation === 'update') {
      const current = await tx.findOne(Product, {
        where: { id: op.client_id },
        lock: { mode: 'pessimistic_write' },  // SELECT FOR UPDATE
      });
      if (!current) {
        return { client_op_id: op.client_op_id, status: 'rejected', reason: 'not_found' };
      }
      if (current.version !== op.payload.expected_version) {
        return {
          client_op_id: op.client_op_id,
          status: 'conflict',
          server_state: current,
        };
      }

      Object.assign(current, op.payload);
      current.version += 1;
      current.updated_at = new Date();
      await tx.save(current);
      return {
        client_op_id: op.client_op_id,
        status: 'ok',
        server_id: current.id,
        version: current.version,
      };
    }

    if (op.operation === 'delete') {
      const current = await tx.findOne(Product, {
        where: { id: op.client_id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!current) {
        return { client_op_id: op.client_op_id, status: 'ok', version: 0 };
      }
      if (current.version !== op.payload.expected_version) {
        return {
          client_op_id: op.client_op_id,
          status: 'conflict',
          server_state: current,
        };
      }

      current.deleted_at = new Date();
      current.version += 1;
      current.updated_at = new Date();
      await tx.save(current);
      return {
        client_op_id: op.client_op_id,
        status: 'ok',
        server_id: current.id,
        version: current.version,
      };
    }

    return { client_op_id: op.client_op_id, status: 'rejected', reason: 'invalid_operation' };
  }

  async getChangesSince(
    cursorTs: Date,
    cursorId: string,
    storeId: string,
    limit: number,
    tx: EntityManager,
  ) {
    // Compound cursor query — no rows are ever skipped
    const rows = await tx
      .createQueryBuilder(Product, 'p')
      .where('p.store_id = :storeId', { storeId })
      .andWhere(
        `(p.updated_at > :cursorTs OR (p.updated_at = :cursorTs AND p.id > :cursorId))`,
        { cursorTs, cursorId },
      )
      .orderBy('p.updated_at', 'ASC')
      .addOrderBy('p.id', 'ASC')
      .limit(limit + 1)     // fetch one extra to detect has_more
      .getMany();

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const nextCursor = page.length > 0
      ? `${page[page.length - 1].updated_at.getTime()}:${page[page.length - 1].id}`
      : `${cursorTs.getTime()}:${cursorId}`;   // no rows = cursor stays

    const changes = page.map((row) => ({
      id: row.id,
      operation: row.deleted_at ? 'delete' : 'upsert',
      data: row.deleted_at ? null : this.toWireFormat(row),
    }));

    return { changes, hasMore, nextCursor };
  }
}
```

**Key details:**

- **`limit + 1`** — fetch one extra row. If you get `limit + 1` rows, there's more. If not, this is the last page. Without this, there's no reliable way to know if you're done.
- **Compound cursor** — `(updated_at > X) OR (updated_at = X AND id > Y)`. This produces a total order. No rows are skipped even when thousands share the same `updated_at`.
- **Soft-deleted rows are included.** The mapper turns them into `{operation: 'delete', data: null}`. The `id` is always present so the client knows which row to remove locally.
- **REPEATABLE READ** on the pull transaction ensures all queries see the same snapshot. Without it, `server_time` and the actual data can be inconsistent.

### 12.6 Auth

- JWT per user, refreshed via refresh token.
- Each request includes `X-Device-Id`.
- Device must be registered to the user's store.
- Token expiry during sync → mobile refreshes and retries automatically.

---

## 13. Mobile Sync Manager Structure

### 13.1 Module layout

```
src/
├── db/
│   ├── schema.ts
│   └── database.ts
├── sync/
│   ├── SyncManager.ts
│   ├── PushWorker.ts
│   ├── PullWorker.ts
│   ├── SyncQueue.ts
│   ├── ConflictResolver.ts
│   └── NetworkMonitor.ts
├── api/
│   └── SyncApiClient.ts
└── screens/
    └── SyncStatusScreen.tsx
```

### 13.2 Public API

```typescript
class SyncManager {
  requestSync(): void;                                    // debounced
  async forceSync(): Promise<SyncResult>;                 // immediate
  async ensureEmptyQueue(timeoutMs: number): Promise<void>; // before day-close
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

- Header: cloud icon (synced / syncing / warning).
- Badge on "Unsynced" screen if `failedCount > 0`.
- Toast on reconnect: "Back online — syncing 43 items."
- Progress bar during long syncs.

---

## 14. Monitoring and Observability

### 14.1 Backend metrics

- Push/pull requests per minute, p50/p95/p99 latency.
- Conflict rate per entity.
- Idempotency hit rate (high = many retries = investigate).
- `processed_operations` table size.

### 14.2 Per-device metrics (reported by the app)

- Queue depth (pending ops).
- Oldest pending op age.
- `last_pushed_at`, `last_pulled_at` per entity.
- Failed op count.

### 14.3 Alerting

- Device queue depth > 500 for > 24h.
- Device `last_pushed_at` > 24h behind.
- Server push error rate > 1%.

---

## 15. Checklist Before Going Live

**Data model:**

- [ ] All PKs are UUIDs generated on device.
- [ ] Every syncable table has `updated_at`, `deleted_at`, `version`, `sync_status`.
- [ ] Compound index `(updated_at, id)` on backend tables.
- [ ] Stock changes use movement deltas, not absolute values.
- [ ] Sale line items store `price_at_time_of_sale`, not a live FK.

**Push flow:**

- [ ] Domain + queue write in one SQLite transaction.
- [ ] Every op has a `client_op_id`.
- [ ] Server has `processed_operations` with unique index on `client_op_id`.
- [ ] Idempotency only caches terminal results (ok/conflict/rejected), never errors.
- [ ] Batches chunked (50 ops / 500 KB).
- [ ] Sequence order preserved.
- [ ] Exponential backoff with jitter.
- [ ] Dead-letter queue for poisoned ops.
- [ ] `syncing` actually written to domain rows during push.

**Pull flow:**

- [ ] Compound cursor `(updated_at, id)`, not bare timestamp.
- [ ] `server_time` captured once per entity (first page), not per page.
- [ ] `limit + 1` fetch for `has_more` detection.
- [ ] `REPEATABLE READ` on pull transaction.
- [ ] Pull skips rows where `sync_status ∈ {pending, syncing, failed}`.
- [ ] Deletions include the `id` in the response.
- [ ] `INSERT ON CONFLICT UPDATE`, not `INSERT OR REPLACE`.
- [ ] Per-entity cursor advanced only when fully drained.

**Scheduling:**

- [ ] App foreground trigger.
- [ ] Network reconnect trigger.
- [ ] Debounced after-mutation trigger.
- [ ] Periodic pull timer.
- [ ] Forced push before day-close.

**Reliability:**

- [ ] App-launch recovery resets `in_progress` → `pending` (queue AND domain rows).
- [ ] Push mutex. Pull mutex.
- [ ] Push always before pull.
- [ ] Tombstone GC with documented horizon (90 days).
- [ ] Full re-bootstrap contract for stale devices.

**Security:**

- [ ] JWT auth + device ID on every sync request.
- [ ] Store/tenant isolation on every query.
- [ ] Rate limiting on sync endpoints.
- [ ] Payload size limit enforced server-side.

---

## 16. Adding a Web Client

### 16.1 Mental model

The web client is **not** a sync client. It's a normal online app talking to normal REST endpoints. Two API surfaces, one shared domain layer.

```
┌─────────────┐         ┌─────────────┐
│  Mobile App │         │   Web App   │
│  (offline)  │         │  (online)   │
└──────┬──────┘         └──────┬──────┘
       │ /sync/push             │ /api/v1/* (REST CRUD)
       │ /sync/pull             │
       ▼                        ▼
┌─────────────────────────────────────┐
│         NestJS Backend              │
│  ┌────────────┐   ┌──────────────┐ │
│  │ SyncModule │   │  ApiModule   │ │
│  └─────┬──────┘   └──────┬───────┘ │
│        └───────┬──────────┘         │
│                ▼                    │
│       Domain Services               │
│       (shared by both)              │
│                │                    │
│           PostgreSQL                │
└─────────────────────────────────────┘
```

### 16.2 The three non-negotiable rules

1. **Both clients write through the same domain services.** A web endpoint that skips the version increment silently breaks mobile pull.

2. **Every web write bumps `updated_at` and `version`.** This is the mechanism that makes the mobile pull cursor work. Miss this once → that device drifts out of sync with no error.

3. **Sale line items store price-at-time-of-sale.** Web price changes must not retroactively rewrite historical sales.

### 16.3 Web CRUD endpoints

```
GET    /api/v1/<resource>          # list
GET    /api/v1/<resource>/:id      # single
POST   /api/v1/<resource>          # create
PATCH  /api/v1/<resource>/:id      # update (with version)
DELETE /api/v1/<resource>/:id      # soft delete
```

PATCH includes `version` for conflict detection:

```json
PATCH /api/v1/customers/cust-uuid-a
{ "version": 3, "name": "Ravi Kumar" }

→ 200: { "id": "cust-uuid-a", "version": 4 }
→ 409: { "error": "version_mismatch", "server_state": { "version": 5, ... } }
```

### 16.4 How mobile picks up web changes

No changes needed. Web bumps `updated_at` → mobile's next pull returns the row. The pull endpoint doesn't care which client made the change.

### 16.5 Cross-client conflicts

**Web edits while mobile offline:** mobile pushes with stale `expected_version` → `conflict`. Handled by existing flow.

**Web deletes product mobile is using:** add validation in the sales sync handler — verify all referenced products exist and `deleted_at IS NULL`. Return `rejected` with reason `product_not_available`.

### 16.6 Additional DB columns for web

Add to every domain table:

| Column | Type | Purpose |
|--------|------|---------|
| `created_by_user_id` | UUID FK → users | Who created |
| `last_modified_by_user_id` | UUID FK → users | Who last edited |

Keep existing `created_by_device` — `NULL` means the row came from web.

If you need full audit trail later, add an `audit_log` table. Don't scatter audit columns across domain tables.

---

## Summary Decision Table

| Question | Answer |
| -------- | ------ |
| Push API | Single endpoint, chunked batches of 50 |
| Pull API | Single endpoint, one entity per request |
| Cursor format | Compound: `<updated_at_ms>:<id>` |
| Offline for 10 days, 1000 ops? | ~20 chunked batches, resumable, no data loss |
| How to prevent duplicates? | `client_op_id` + `processed_operations` (only caches terminal results) |
| How to detect conflicts? | `version` + `expected_version` in payload |
| Inventory? | Stock movements (deltas), not absolutes |
| What stops pull from clobbering local edits? | `sync_status` check before overwrite |
| Push or pull first? | Always push first |
| Web client? | Separate REST API, same domain services |

---

## Changelog from v4

- **Compound cursor replaces bare timestamp** (§7.1, §7.2, §7.3, §12.4, §12.5). Pull now uses `<updated_at_ms>:<id>` instead of bare `since` timestamp. Fixes silent row skipping when multiple rows share the same `updated_at`. Backend query uses `(updated_at > X) OR (updated_at = X AND id > Y)` for gap-free pagination.
- **Idempotency dead-key fix** (§12.3). `processed_operations` only stores terminal results (`ok`, `conflict`, `rejected`). Transient errors and unknown-entity errors are NOT cached — the client can retry. Fixes the known anti-pattern where a failed op is permanently dead-keyed.
- **`INSERT ON CONFLICT UPDATE` replaces `INSERT OR REPLACE`** (§7.3). Prevents destruction of local-only columns not present in the server response.
- **`REPEATABLE READ` on pull transaction** (§12.4). All queries in a pull see the same Postgres snapshot, making `server_time` consistent with the actual data returned.
- **`limit + 1` for `has_more` detection** (§12.5). Fetch one extra row to reliably detect whether more pages exist. Fixes previous approach where `has_more` couldn't be derived.
- **Delete changes include `id`** (§7.2). Client needs to know which row was deleted. Previous response shape had `deleted: ["id"]` — now unified under `changes` array with `operation: 'delete'` and `id` field.
- **Tombstone GC documented** (§4.3). Soft-deleted rows older than 90 days are hard-deleted. Devices offline longer than the horizon must full-re-bootstrap.
- **Full re-bootstrap triggers documented** (§7.7). Lists the five scenarios where the client must wipe local DB and pull from scratch.
- **`expected_version` location clarified** (§6.2). Explicitly documented as inside `payload`, not at the operation level. Creates don't include it; only updates and deletes.
- **Cross-chunk cascading failures addressed** (§6.7). After a chunk with rejections, scan remaining pending ops for dependencies on rejected entities.
- **`syncing` status actively written** (§6.5). Push algorithm now explicitly sets `sync_status = 'syncing'` on domain rows when marking queue rows `in_progress`, and resets on network error.
- **App-launch recovery covers domain rows** (§10.2). Resets `syncing` → `pending` on domain tables too, not just queue rows.
- **Unified changes response** (§7.2). Pull response uses a single `changes` array with `{id, operation, data}` instead of separate `upserted`/`deleted` arrays. Cleaner for compound cursor advancement.
- **Backend module structure includes shared domain layer** (§12.1). Domain services separated from sync services, ready for web client (§16).
