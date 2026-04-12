# NKS Mobile POS — Offline Architecture Plan

> India-specific POS app. Shop owners and cashiers must bill customers even when internet is unavailable.

---

## Current State (Already Implemented)

| Component                                                         | Status |
| ----------------------------------------------------------------- | ------ |
| Phone OTP login (MSG91)                                           | Done   |
| Dual token: sessionToken (1h) + jwtToken (1h) + refreshToken (7d) | Done   |
| SecureStore persistence (Keychain/Keystore)                       | Done   |
| Session restore on app restart                                    | Done   |
| Axios interceptor with refresh queue                              | Done   |
| Network error does NOT logout                                     | Done   |
| Refresh token rotation (rolling 7-day window)                     | Done   |
| JWKS endpoint (RS256 public key)                                  | Done   |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                     UI Layer                          │
│  Reads from Local DB (offline) or API (online)        │
└──────────────┬───────────────────────┬───────────────┘
               │                       │
     ┌─────────▼─────────┐   ┌────────▼────────┐
     │   Local SQLite     │   │   Remote API     │
     │   (always works)   │   │   (needs internet)│
     │                    │   │                   │
     │  products          │   │  POST /invoices   │
     │  customers         │   │  GET /products    │
     │  tax_rates         │   │  GET /customers   │
     │  outbox_queue      │   │  POST /sync       │
     └─────────┬──────────┘   └────────▲──────────┘
               │                       │
         ┌─────▼───────────────────────┴─────┐
         │           Sync Engine              │
         │  Online: delta sync every 5 min    │
         │  Offline: queue writes in outbox   │
         │  Reconnect: drain outbox + sync    │
         └───────────────────────────────────┘
```

---

## Token Lifetimes

| Token          | Lifetime | Purpose                                      |
| -------------- | -------- | -------------------------------------------- |
| sessionToken   | 1 hour   | Online API calls (short = secure)            |
| jwtToken       | 1 hour   | Verifiable locally with cached JWKS          |
| refreshToken   | 7 days   | Silent rotation when online (rolling window) |
| offlineSession | 7 days   | Client-side POS trust (no server involved)   |

The `offlineSession` is NOT a token. It is a local policy stored in SecureStore that says "this device was authenticated within the last 7 days — allow local POS operations."

---

## Offline Session

### Schema

```typescript
interface OfflineSession {
  userId: number;
  storeId: number;
  storeName: string;
  roles: string[];
  offlineValidUntil: number; // Date.now() + 7 * 24 * 60 * 60 * 1000
  lastSyncedAt: number; // last successful data sync timestamp
  jwksPublicKey: string; // cached RSA public key
}
```

### Lifecycle

```
Login (online, required):
  → OTP verified → auth response received
  → Tokens stored in SecureStore (existing)
  → OfflineSession created in SecureStore:
      userId, storeId, roles from auth response
      offlineValidUntil = now + 7 days
      jwksPublicKey fetched from GET /.well-known/jwks.json
  → Initial data sync triggered (products, customers, tax_rates → SQLite)

Online operation:
  → sessionToken (1h) used for API calls
  → Expires → interceptor refreshes silently
  → On successful refresh → offlineValidUntil reset to now + 7 days
  → On successful sync → lastSyncedAt updated

Offline operation:
  → API call fails (network error)
  → Check: offlineValidUntil > Date.now()?
      YES → offline mode:
        Identity from OfflineSession (userId, storeId, roles)
        Reads from local SQLite
        Writes to outbox queue in SQLite
        UI shows "Offline Mode" banner
      NO → offline session expired:
        Block POS operations
        Show "Connect to internet to continue"

Internet returns:
  → Refresh token rotates → new session
  → offlineValidUntil resets to +7 days
  → Outbox drains (invoices sync to server)
  → SQLite syncs latest data
  → Banner disappears
```

---

## Local Database (SQLite)

### Tables

| Table           | Sync strategy                         | Offline use                       |
| --------------- | ------------------------------------- | --------------------------------- |
| `products`      | Full on login, delta every 5 min      | Lookup, barcode scan, price check |
| `customers`     | Full on login, delta every 5 min      | Lookup, balance check             |
| `tax_rates`     | Full on login, rarely changes         | Tax calculation                   |
| `outbox_queue`  | Write-only offline, drain when online | Pending invoices/sales            |
| `invoices`      | Write locally, sync when online       | View today's sales offline        |
| `invoice_items` | Write locally, sync when online       | Invoice line items                |
| `sync_metadata` | Local only                            | Track cursors, sync state         |

### Schema: `outbox_queue`

```typescript
interface OutboxEntry {
  id: string; // UUID
  idempotencyKey: string; // UUID — safe to retry
  entityType: string; // "invoice" | "invoice_item" | "customer"
  entityId: string;
  operation: "CREATE" | "UPDATE" | "DELETE";
  payload: string; // JSON stringified
  createdAt: number;
  retryCount: number;
  nextRetryAt: number;
  status: "pending" | "processing" | "failed";
  offlineSessionId: string; // links to the offline session that created it
}
```

### Schema: `sync_metadata`

```typescript
interface SyncMetadata {
  tableName: string; // "products" | "customers" | "tax_rates"
  lastSyncedAt: string; // ISO timestamp cursor for delta sync
  recordCount: number;
  syncStatus: "idle" | "syncing" | "error";
}
```

### Delta Sync Protocol

```
Client → Server:
  GET /sync/products?since=2026-04-08T10:00:00Z

Server → Client:
  {
    data: Product[],           // created or updated since cursor
    deletedIds: string[],      // soft-deleted since cursor
    serverTime: "2026-04-09T...",  // new cursor
    hasMore: boolean
  }

Client:
  → Upsert data[] into local SQLite
  → Delete deletedIds from local SQLite
  → Store serverTime as new cursor in sync_metadata
  → If hasMore → fetch next page
```

---

## Outbox Drain Protocol

When internet returns:

```
1. Read all outbox entries WHERE status = "pending" ORDER BY createdAt ASC
2. For each entry:
   a. Set status = "processing"
   b. POST to server with idempotencyKey header
   c. Server responds:
      201 Created → delete from outbox
      409 Conflict (duplicate idempotencyKey) → delete from outbox (already synced)
      400 Validation error → set status = "failed", increment retryCount
      5xx / network error → set status = "pending", set nextRetryAt with backoff
3. Backoff: 1s → 2s → 4s → 16s → 60s → max 5 min
4. Max retries: 10 (then status = "failed", needs manual resolution)
```

---

## Offline Mode Rules

- Read from local DB + write to outbox only
- No admin operations offline (no role changes, no store setup, no staff invites)
- All offline-created invoices tagged with `createdOffline: true`
- Conflict resolution: **server-wins** for financial data (invoices, payments)
- Maximum outbox size: 500 entries (prevent unbounded growth)
- If outbox full → block new invoices → show "Sync required" message

---

## Security

| Concern                   | Approach                                                           |
| ------------------------- | ------------------------------------------------------------------ |
| OfflineSession storage    | Encrypted in SecureStore (Keychain/Keystore)                       |
| JWT verification offline  | Cached JWKS public key verifies RS256 signature locally            |
| Offline invoice audit     | Each invoice has userId + offlineSessionId                         |
| Remote wipe               | Push notification → clear OfflineSession + SQLite + SecureStore    |
| Client can't extend trust | offlineValidUntil only resets on successful server refresh         |
| Outbox tampering          | Idempotency keys prevent replay; server validates all data on sync |

---

## UI Components

| Component      | When shown                                                                 |
| -------------- | -------------------------------------------------------------------------- |
| Offline banner | "Offline Mode" at top of screen when no internet + offline session valid   |
| Sync indicator | "3 invoices pending sync" in drawer/header                                 |
| Last synced    | "Last synced: 5 min ago" in settings/drawer                                |
| Expired screen | Full-screen "Connect to internet to continue" when offline session expired |
| Sync progress  | Progress bar during outbox drain                                           |

---

## Files to Create/Modify

### New Files

| File                                    | Purpose                                                       |
| --------------------------------------- | ------------------------------------------------------------- |
| `lib/offline-session.ts`                | OfflineSession CRUD in SecureStore                            |
| `lib/network-state.ts`                  | `useNetworkState()` hook using NetInfo                        |
| `lib/offline-mode.ts`                   | `useOfflineMode()` — combines network state + offline session |
| `lib/jwks-cache.ts`                     | Fetch and cache JWKS public key                               |
| `lib/sync-service.ts`                   | Delta sync for products/customers/tax_rates                   |
| `lib/outbox-service.ts`                 | Outbox queue drain with retry/backoff                         |
| `lib/local-db.ts`                       | expo-sqlite setup, migrations, table definitions              |
| `components/feedback/OfflineBanner.tsx` | Global offline mode banner                                    |
| `components/feedback/SyncIndicator.tsx` | Pending sync count badge                                      |

### Modified Files

| File                                  | Change                                        |
| ------------------------------------- | --------------------------------------------- |
| `lib/axios-interceptors.ts`           | Reset offlineValidUntil on successful refresh |
| `store/initializeAuth.ts`             | Restore OfflineSession on app launch          |
| `store/persistLogin.ts`               | Create OfflineSession after login             |
| `features/auth/hooks/useOtpVerify.ts` | Trigger initial sync after login              |
| `app/_layout.tsx`                     | Add OfflineBanner globally                    |

---

## Implementation Phases

### Phase 1: Offline Session (no local DB yet)

- Create `lib/offline-session.ts` — store/load/reset OfflineSession in SecureStore
- Create `lib/jwks-cache.ts` — fetch and cache JWKS public key on login
- Create `lib/network-state.ts` — `useNetworkState()` with NetInfo
- Create `lib/offline-mode.ts` — `useOfflineMode()` combining network + session
- Modify `store/persistLogin.ts` — create OfflineSession after login
- Modify `lib/axios-interceptors.ts` — reset offlineValidUntil on refresh
- Create `components/feedback/OfflineBanner.tsx`
- Add banner to `app/_layout.tsx`

**Result:** App knows when it's offline and whether the device is still trusted. No POS data yet — that's Phase 2.

### Phase 2: Local Database

- Setup expo-sqlite with tables: products, customers, tax_rates, sync_metadata
- Create `lib/local-db.ts` — database init, migrations, typed queries
- Create `lib/sync-service.ts` — delta sync with cursor tracking
- Sync on login (full) + periodic sync every 5 min (delta)
- POS read screens use local DB when offline, API when online

**Result:** Product lookup, customer lookup, and price checks work offline.

**Backend work needed:** Delta sync endpoints:

- `GET /sync/products?since=<cursor>`
- `GET /sync/customers?since=<cursor>`
- `GET /sync/tax-rates?since=<cursor>`

### Phase 3: Offline Invoice Creation

- Create outbox table in SQLite
- Create `lib/outbox-service.ts` — queue management, drain with retry/backoff
- Invoice creation writes to local invoices table + outbox queue
- Outbox drain when connectivity returns
- Idempotency keys per operation
- Create `components/feedback/SyncIndicator.tsx`

**Result:** Cashier can create invoices offline. They sync automatically when internet returns.

**Backend work needed:** Invoice creation endpoint with idempotency key support:

- `POST /invoices` with `Idempotency-Key` header
- Return 409 on duplicate key (already processed)

### Phase 4: Polish

- "Last synced" timestamp display
- Sync progress bar during outbox drain
- Full-screen "Connect to internet" when offline session expires
- Remote wipe via push notification
- Outbox size limit (500) with "Sync required" warning
- Error recovery for failed outbox entries

**Result:** Production-ready offline POS.

---

## Verification Checklist

| Scenario                                      | Expected behavior                                      |
| --------------------------------------------- | ------------------------------------------------------ |
| Login with OTP                                | OfflineSession created, initial sync runs              |
| Normal online use                             | API calls as usual, periodic sync updates local DB     |
| Internet drops mid-use                        | Banner appears, POS continues from local DB            |
| Create invoice offline                        | Saved to local DB + outbox, synced when online         |
| Internet returns                              | Banner disappears, outbox drains, data syncs           |
| App killed and reopened offline               | Auth restored from SecureStore, offline session valid  |
| Offline for 8 days                            | Offline session expired → "Connect to internet" screen |
| Two devices create invoices for same customer | Server-wins conflict resolution on sync                |
| Outbox reaches 500 entries                    | Block new invoices, show "Sync required"               |
| Push notification: remote wipe                | Clear all local data, force re-login                   |

---

## Critical Risk Areas

### Risk 1: Clock Skew

**Problem:** The device clock can drift or be set manually. `offlineValidUntil = Date.now() + 7 days` becomes exploitable if the user sets their system clock back.

**Solution:**
```
On every successful API response:
  → Server sends X-Server-Time header (Unix ms)
  → Client computes: clockOffset = serverTime - Date.now()
  → Store clockOffset in SecureStore

On every offline session check:
  → adjustedNow = Date.now() + clockOffset
  → Check: offlineValidUntil > adjustedNow

If |clockOffset| > 60 seconds:
  → Log "clock drift detected: {offset}ms"
  → Use adjusted time only (don't block — just correct)

If device time jumps back by > 1 hour while offline:
  → Short-circuit: treat session as expired
  → Require online re-auth
```

**Why this matters:** A cashier could set their clock back to extend offline access past 7 days. The server-anchored clock offset prevents this without network access.

---

### Risk 2: Atomic Outbox Drain

**Problem:** Draining the outbox is a multi-step operation (read → process → delete). A crash between steps creates duplicates or lost entries.

**Solution — SQLite transactions + status machine:**

```
States: pending → processing → done / failed

Rule: Only one drain process runs at a time (mutex lock in memory)

Drain procedure (atomic):
  BEGIN TRANSACTION
    SELECT top 10 WHERE status = "pending" AND nextRetryAt <= now
    UPDATE status = "processing"
  COMMIT

  For each entry:
    POST to server with Idempotency-Key header
    BEGIN TRANSACTION
      if 2xx or 409: DELETE from outbox
      if 4xx: UPDATE status="failed", retryCount++, nextRetryAt=null
      if 5xx/network: UPDATE status="pending", nextRetryAt=backoff(retryCount)
    COMMIT

App restart recovery:
  → On startup: UPDATE status="pending" WHERE status="processing"
    (processing entries were mid-flight at crash — reset and retry)
```

**Why this matters:** Without this, a crash after POST but before DELETE creates a duplicate invoice. The server's idempotency key (409 response) catches it, but the client must also handle the 409 as a "success" — not an error.

---

### Risk 3: Sync State Machine

**Problem:** Concurrent sync runs (background interval + foreground trigger) corrupt the cursor.

**Solution — explicit state machine in sync_metadata:**

```
States: idle → syncing → error → idle

Transition rules:
  idle → syncing: only one allowed at a time (check DB state before starting)
  syncing → idle: on success (update cursor + recordCount)
  syncing → error: on failure (keep old cursor, store errorMessage)
  error → syncing: on next trigger (retry from last valid cursor)

SQLite enforcement:
  UPDATE sync_metadata SET syncStatus="syncing" WHERE tableName=? AND syncStatus="idle"
  → If 0 rows updated: another sync is running → skip this trigger

Cursor safety:
  → New cursor ONLY committed after all pages fetched AND upserted successfully
  → Partial sync: keeps old cursor (will re-fetch on next run — idempotent upserts handle duplicates)
```

**Why this matters:** Without the state machine, two sync runs overlapping produce a torn cursor — the next sync skips records. Products or tax rates can silently go stale.

---

### Risk 4: Passive Revocation

**Problem:** If a device is stolen or a cashier is fired, their offline session remains valid for up to 7 days with no internet.

**Solution — multi-layer passive revocation:**

```
Layer 1: Refresh token check (online)
  → On every token refresh: server checks if refreshToken is revoked
  → Revoked → 401 → logout → OfflineSession cleared

Layer 2: JWKS rotation (passive, delayed up to 7 days)
  → If RS256 signing key is rotated on server:
    → Old key is removed from JWKS after 7 days (matches offline window)
    → Cached JWKS public key can no longer verify new tokens
    → Device must go online to fetch new JWKS → server can block

Layer 3: Push notification (active, immediate)
  → On staff termination/device theft: send push → "FORCE_LOGOUT"
  → Client: clear OfflineSession + SecureStore + SQLite → redirect to login

Layer 4: Short offline window
  → 7 days is the maximum POS-grade trust window
  → For high-security deployments: configure to 1 day (tradeoff: more online logins needed)

Outbox handling on revocation:
  → On Layer 1/3 logout: mark all "pending" outbox entries as "cancelled"
  → Do NOT drain on a revoked session (financial integrity)
```

**Why this matters:** Passive revocation is unavoidable for offline-capable apps. The answer is layers — immediate for connected devices (Layer 1 + 3), bounded-delay for offline devices (Layer 2 + 4).

---

### Risk 5: Conflict Resolution

**Problem:** Two devices (or an offline device + online change) modify the same record. The sync must produce a consistent, auditable result.

**Strategy: Server-wins with client audit trail**

```
Rule by entity type:

Invoices (financial records):
  → Never edited after creation (immutable)
  → Cancellations are new records, not updates
  → Conflict: impossible by design (client gets a new server-assigned invoiceNumber on sync)

Customers (shared reference data):
  → Last-write-wins by updatedAt timestamp
  → If client offline version is older than server: discard client changes
  → If client offline version is newer (rare): send as update, server applies it

Products / Tax Rates (master data):
  → Server-wins always (master data is admin-managed)
  → Client never writes to these — read-only for cashiers

Outbox entry conflicts:
  → Server sees: POST /invoices with same idempotencyKey from two devices
  → First one wins (201 Created)
  → Second one gets 409 (Conflict) → client treats as success, deletes outbox entry
  → Both cashiers see same invoice on next sync

Audit trail:
  → Every outbox entry records: deviceId, offlineSessionId, createdAt, userId
  → Server logs all conflict resolutions
  → Admin dashboard can review "offline invoices" tab
```

**Conflict resolution matrix:**

| Entity      | Strategy          | Rationale                                  |
| ----------- | ----------------- | ------------------------------------------ |
| Invoice     | Immutable + idempotency key | Financial data must be exact     |
| Customer    | Last-write-wins (by updatedAt) | Low conflict risk, recoverable  |
| Product     | Server-wins always | Master data, cashier has no write access  |
| Tax rate    | Server-wins always | Legal data, admin-only                    |
| Outbox dup  | First-wins (409 = success) | Idempotency key prevents double-billing |

---
