# NKS Offline-First POS — Complete Implementation Spec

## The single rule that governs everything

Always write local first. Always queue. Never call the API directly. Whether the device is online, offline, or on a 2G connection — the code path is identical. This is non-negotiable.

"Online" is not binary. You can have WiFi with no internet, 2G with 800ms latency, or drop mid-request. If your API call is in-flight and the network dies after the server processes it but before your app gets the 200 OK, you have a ghost sale. The queue + idempotency key is the only safe solution.

---

## The 5 hard decisions

### Decision 1: Always queue, even online
The most important call in this architecture. You write one queue-drain worker and it handles all scenarios identically. No `if online → API, else → queue` branching. That branching is where bugs live.

### Decision 2: Batch by sale, parallel across sales
50 sales × 5 events each = 250 events. Group all events for sale #1 into one POST, sale #2 into another, then run 5 of those in parallel. Never send all 250 in one payload (fragile, can't partially retry) and never send 250 individual requests (10+ seconds). The sweet spot is 5 concurrent batches → 10 rounds → ~2 seconds total.

### Decision 3: Delta events, not state snapshots
The inventory outbox event stores `-2 qty` (what happened), not `48 qty` (the result). Two devices deducting simultaneously both get their delta applied correctly on sync. Snapshots from two devices conflict and one always loses data. Deltas always compose correctly regardless of order.

### Decision 4: Two timestamps on every record
`device_created_at` for the customer receipt (feels right). `server_received_at` for every report, every P&L, every tax filing. Your accountant only sees server time. Your customer only sees device time. Never mix them.

### Decision 5: Allow negative inventory, don't block the sale
A customer is standing at the counter. The last thing you do is reject their payment because your sync architecture has a race condition. Allow the sale, sync it, flag the negative stock, auto-generate a purchase order suggestion, alert the admin. A solved inventory problem is 100× better than a rejected customer at the point of sale.

---

## Local SQLite — 6 tables

Every write across all these tables for a single sale happens inside one `db.transaction()`. If anything fails, everything rolls back. A sale never half-exists.

### `sales`
Written instantly at checkout.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Client-generated |
| `store_id` | string | |
| `cashier_id` | string | |
| `shift_id` | string | |
| `total` | decimal | |
| `tax_amount` | decimal | |
| `discount` | decimal | |
| `sync_status` | enum | `LOCAL` \| `SYNCED` \| `CONFLICT` |
| `device_created_at` | timestamp | Device clock at moment of sale |

### `sale_items`
One row per line item.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `sale_id` | FK → sales | |
| `product_id` | string | |
| `qty` | integer | |
| `unit_price` | decimal | |
| `tax_rate` | decimal | |
| `discount_amount` | decimal | |

### `inventory_cache`
The local stock truth. TTL is 4 hours — after that the cache is stale and must pull from server before showing stock counts.

| Field | Type | Notes |
|---|---|---|
| `product_id` | PK | |
| `qty_available` | integer | |
| `qty_reserved` | integer | |
| `last_synced_at` | timestamp | |
| `ttl_expires_at` | timestamp | 4 hours from last sync |
| `server_version` | integer | For conflict detection |

### `products_cache`
Barcode-indexed for fast scan.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `name` | string | |
| `price` | decimal | |
| `barcode` | string | Indexed |
| `tax_rate` | decimal | |
| `category_id` | string | |
| `last_synced_at` | timestamp | |

### `outbox_events`
The queue. The `id` UUID doubles as the idempotency key.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Also the idempotency key |
| `event_type` | string | e.g. `SALE_CREATED` |
| `aggregate_type` | string | e.g. `sale` |
| `aggregate_id` | UUID | The sale UUID |
| `payload` | JSON | Full snapshot |
| `seq` | autoincrement | Global device sequence, ordering within aggregate |
| `status` | enum | `PENDING` → `SYNCING` → `SYNCED` \| `FAILED` \| `DEAD` |
| `attempts` | integer | |
| `last_attempt_at` | timestamp | |
| `next_retry_at` | timestamp | |
| `synced_at` | timestamp | |
| `server_received_at` | timestamp | Stamped by server on success |
| `error_message` | string | |
| `device_created_at` | timestamp | |
| `signature` | string | HMAC-SHA256 |

### `sync_state`
Key-value pairs.

| Key | Value |
|---|---|
| `last_push_at` | timestamp |
| `last_pull_at` | timestamp |
| `device_id` | string |
| `store_id` | string |

---

## The checkout write — 4 steps inside one transaction

```
1. INSERT into sales
2. INSERT into sale_items (one row per product)
3. UPDATE inventory_cache SET qty = qty - delta  (optimistic deduction)
4. INSERT into outbox_events with status PENDING
```

After the transaction commits, show the receipt. Done. No network call, no waiting.

---

## Outbox event structure

Every sale produces exactly 5 events in this order, each with its own row in `outbox_events`. Events within the same `aggregate_id` (sale UUID) must process in `seq` order. Events from different sales are completely independent and can process in parallel.

| seq | event_type | payload contains |
|---|---|---|
| 1 | `SALE_CREATED` | Sale header data |
| 2 | `SALE_ITEMS_ADDED` | All line items |
| 3 | `INVENTORY_DEDUCTED` | Delta: `-qty` per product |
| 4 | `PAYMENT_PROCESSED` | Method, amount, reference |
| 5 | `INVOICE_GENERATED` | PDF metadata, customer phone |

---

## The queue worker

Runs as a background service. Polls every 100ms when network state is `ONLINE` or `DEGRADED`. Pauses when `OFFLINE`.

```sql
SELECT aggregate_id, MIN(seq)
FROM outbox_events
WHERE status = 'PENDING'
  AND (next_retry_at IS NULL OR next_retry_at <= NOW())
GROUP BY aggregate_id
ORDER BY MIN(seq) ASC
LIMIT 5
```

Each of the 5 concurrent workers:
1. Locks its sale by setting `status = SYNCING`
2. Sends all events for that sale as one `POST /api/sync/events`
3. On `200`: marks all events `SYNCED`, stamps `server_received_at`
4. On failure: marks `FAILED`, schedules retry

**Why 5 and not 1 or 50:** Sequential = 10+ seconds for 50 sales. Unbounded parallel = hammers the server and triggers rate limiting. 5 concurrent = ~2 seconds for 50 sales at 200ms RTT.

---

## The 50-sale offline sync

When a device comes back online after 5 hours with 50 pending sales:

```
Round 1:  sales 1–5   → 5 parallel POST requests
Round 2:  sales 6–10  → 5 parallel POST requests
...
Round 10: sales 46–50 → 5 parallel POST requests

Total: 10 rounds × ~200ms = ~2 seconds
```

After pushing, immediately pull a delta from the server:

```
GET /api/sync/delta?since=<last_synced_at>&store_id=<id>
```

Response contains updated products, prices, customers, tax rates. Apply to local cache. Update `last_synced_at` in `sync_state`.

---

## Retry and dead-letter

Retry delays by attempt number:

| Attempt | Delay | With ±20% jitter |
|---|---|---|
| 1 | 0s | immediate |
| 2 | 5s | 4–6s |
| 3 | 30s | 24–36s |
| 4 | 5min | 4–6min |
| 5 | 30min | 24–36min |
| 6 | 1hr | 48–72min |
| 7+ | 24hr | 19–29hr |

Jitter prevents multiple devices hitting the server simultaneously after a shared outage.

After 10 failed attempts, `status` moves to `DEAD`. Dead events trigger an admin notification and are never retried automatically — they require manual resolution.

**What causes DEAD events in practice:**
- Product deleted on server while device was offline
- App version too old (schema mismatch)
- Offline token expired (device offline 30+ days)

---

## Idempotency — duplicate prevention

The UUID generated when the outbox event is created is the idempotency key. It never changes. The device can retry the same event 100 times safely.

**Server-side `idempotency_store` table:**

| Field | Notes |
|---|---|
| `key` | The outbox event UUID |
| `store_id` | |
| `processed_at` | |
| `result_code` | HTTP status cached |
| `result_body` | Response cached |

Before processing any event, the server checks this table:
- Key exists → return cached result immediately, no reprocessing
- Key absent → process inside a transaction that atomically inserts the idempotency record

Entries expire after 30 days, matching the offline token lifetime.

---

## Connectivity — 4 states, not 2

Never use `navigator.onLine`. It returns `true` even when WiFi is connected but there is no internet. Instead, probe your own server every 10 seconds:

```
HEAD /api/health  (3-second timeout)
```

| State | Condition | Worker poll | UI |
|---|---|---|---|
| `ONLINE` | Probe responds < 500ms | Every 100ms | Green dot |
| `DEGRADED` | Probe responds 500ms–3s | Every 500ms | Amber dot + slow-connection banner |
| `OFFLINE` | Probe times out | Paused | Red dot + pending count badge |
| `SYNCING` | Transition back online | — | Progress bar, shift-close blocked |

On transition from `OFFLINE` to any other state, immediately trigger `drainQueue()` before returning to normal polling.

---

## Delta events, not snapshots

The inventory outbox event stores what happened, not the resulting state.

```
WRONG: { product_id: "p1", qty: 1 }    ← snapshot, devices clobber each other
RIGHT: { product_id: "p1", delta: -2 } ← delta, always composes correctly
```

**Why it matters:** Two devices both offline, both selling 2 units of a product with 3 in stock. On sync, server applies both `-2` deltas. Result: `3 + (-2) + (-2) = -1`. This is correct — the server knows the real situation. A snapshot from Device A (`qty: 1`) followed by Device B (`qty: 1`) would silently lose one deduction.

---

## Negative inventory — allow, detect, resolve

Never block a sale because of a potential stock conflict. When negative inventory is detected on the server after sync:

1. Apply the delta (do not reject the synced sale)
2. `INSERT into inventory_alerts (product_id, qty, sale_id, 'NEGATIVE_STOCK')`
3. Push admin notification
4. Auto-generate a purchase order suggestion
5. Surface red badge on admin dashboard inventory section

**Soft cap for offline devices:** `soft_cap = current_qty ÷ active_device_count`. The device warns staff when approaching the soft cap but does not block the sale.

---

## Two timestamps on every record

| Timestamp | Set by | Used for |
|---|---|---|
| `device_created_at` | Device clock at moment of sale | Customer receipt display only |
| `server_received_at` | Server when sync event is processed | All reports, P&L, tax filings, shift totals |

Your accountant only sees server time. Your customer only sees device time. Never mix them.

**Clock drift detection:** Runs on every sync response. If `|device_time - server_time| > 5 minutes`, the device shows a banner telling staff to correct the device clock and logs an audit entry. Drift over 30 minutes triggers an admin alert.

**Shift total query always uses `server_received_at`:**

```sql
SELECT SUM(total) FROM sales
WHERE server_received_at BETWEEN :shift_start AND :shift_end
  AND store_id = :store_id
```

---

## Security model

### HMAC signing
Every outbox event is signed at creation time using `HMAC-SHA256(event_data, device_secret)`. The `device_secret` is derived from the JWT and `device_id` at login time and stored in iOS Keychain or Android Keystore — never in SQLite. The server verifies this signature on every sync request. A tampered payload produces a different hash and is rejected and flagged.

### Price validation
The server independently validates that the price in the synced payload matches the server's product price at `device_created_at` time. Discrepancy over 5% rejects the event and flags for audit.

### Device binding
The offline token is issued with a hardware device fingerprint. The sync endpoint verifies the fingerprint matches the token on every request. A stolen token used from a different device is rejected.

### Append-only audit log
The `audit_log` table on the server has no `UPDATE` and no `DELETE` permissions at the application level. Every event processed writes a permanent row. Corrections are new entries referencing the original. This is the forensic trail for every transaction ever made.

---

## UI requirements

A persistent indicator in the POS header always shows one of:
- Green dot — `ONLINE`
- Amber dot + count — `X pending, syncing`
- Red dot — `OFFLINE — X pending`

Staff can never close a shift while there are `PENDING` events in the queue. The shift-close button checks the queue count and blocks with a message if it is not zero.

---

## Build order

1. SQLite schema + WatermelonDB setup with all 6 tables
2. Outbox writer — the `db.transaction()` block that writes sale + items + inventory delta + outbox event atomically
3. Connectivity probe — the `setInterval` that probes `/api/health` and manages the 4 states
4. Queue worker — picks up `PENDING` events, groups by `aggregate_id`, runs 5 in parallel
5. Server sync endpoint — `POST /api/sync/events` with idempotency key table
6. Delta pull — pull changed products/prices/customers since `last_synced_at`
7. Negative inventory alerts + admin dashboard
8. HMAC signing + server verification
