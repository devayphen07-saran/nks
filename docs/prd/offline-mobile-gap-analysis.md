# NKS Mobile — Offline-First Gap Analysis
**What currently exists vs. what must be built**
Dated: 2026-03-20

---

## What Already Exists (Do Not Rebuild)

| Area | What's Built | File(s) |
|---|---|---|
| API client | Axios with 401 refresh, 429 backoff, 5xx retry | `libs-mobile/mobile-utils/src/network/api-client.ts` |
| Auth tokens | SecureStore get/set/clear (access + refresh) | `libs-mobile/mobile-utils/src/storage/auth-storage.ts` |
| Connectivity | `useIsOffline`, `checkIsOnline` via NetInfo | `libs-mobile/mobile-utils/src/network/network.ts` |
| Secure storage | expo-secure-store + AsyncStorage fallback | `libs-mobile/mobile-utils/src/storage/secure-store.ts` |
| Theme system | Light/dark, design tokens, typography | `libs-mobile/mobile-theme/` |
| UI components | 40+ reusable components | `libs-mobile/mobile-ui-components/` |
| Haptics | Light, medium, heavy, success, error | `libs-mobile/mobile-utils/src/device/haptics.ts` |
| Auth routes | Login, register, OTP-based | `apps/nks-mobile/app/(auth)/` |
| Providers | Theme, i18n, SafeArea in root layout | `apps/nks-mobile/app/_layout.tsx` |
| Auth gate | Token check → redirect on boot | `apps/nks-mobile/app/index.tsx` |

---

## Critical Problem: Connectivity Detection

**Current:** `useIsOffline` uses `@react-native-community/netinfo` — returns `isConnected: true` even on WiFi with no internet.

**Required:** Replace with server health probe. Drop NetInfo for connectivity decisions entirely.

```
libs-mobile/mobile-utils/src/network/network.ts  ← REPLACE this file
```

New implementation must probe `HEAD /api/health` every 10 seconds with a 3-second timeout and return one of 4 states: `ONLINE | DEGRADED | OFFLINE | SYNCING`. See `offline-first-sync-architecture.md` Part 8 for full spec.

---

## Gap 1 — Local Database (Highest Priority)

**Nothing exists.** No SQLite, no WatermelonDB, no local models, no schema.

### Install

```bash
pnpm --filter nks-mobile add @nozbe/watermelondb @nozbe/with-observables
pnpm --filter nks-mobile add react-native-quick-sqlite
# babel plugin (mandatory for decorators)
pnpm --filter nks-mobile add -D @babel/plugin-proposal-decorators
```

Add to `apps/nks-mobile/app.json` plugins: `"expo-sqlite"` (fallback if not using JSI).

### Create these files (in order)

```
apps/nks-mobile/database/
├── schema.ts          ← 6-table WatermelonDB schema with correct indexes
├── migrations.ts      ← empty migration scaffold for v1
├── index.ts           ← Database instance (jsi: true)
└── models/
    ├── Sale.ts
    ├── SaleItem.ts
    ├── OutboxEvent.ts
    ├── ProductCache.ts
    ├── InventoryCache.ts
    └── SyncState.ts
```

Schema specification: See `offline-first-sync-architecture.md` Part 3 (all 6 tables with exact column types and indexes).

**Critical flags on the database instance:**
- `jsi: true` — synchronous SQLite via JSI, 10× faster than bridge. Non-negotiable for POS.
- `dbName: 'nks_pos'`
- `onSetUpError` handler

### Add `DatabaseProvider` to `_layout.tsx`

```tsx
// apps/nks-mobile/app/_layout.tsx — wrap existing providers
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { database } from '../database';

// Add inside RootLayout:
<DatabaseProvider database={database}>
  {/* existing providers */}
</DatabaseProvider>
```

---

## Gap 2 — Outbox Writer (Checkout Transaction)

**Nothing exists.** The checkout flow has no atomic write, no outbox, and no queue.

### Create

```
apps/nks-mobile/services/checkout.ts
```

This is the single most critical function in the app. All 4 database operations for a sale (INSERT sales, INSERT sale_items, UPDATE inventory_cache, INSERT outbox_events) must happen inside **one `database.write()` call**. If any step fails, everything rolls back. A sale never half-exists.

The function signature:
```ts
writeCheckout(payload: CheckoutPayload): Promise<string>  // returns saleId
```

After `database.write()` commits, show receipt immediately. No network call. No waiting.

Five outbox events per sale (in order): `SALE_CREATED → SALE_ITEMS_ADDED → INVENTORY_DEDUCTED → PAYMENT_PROCESSED → INVOICE_GENERATED`. Each gets its own UUID as the idempotency key. That UUID never changes on retry.

Full spec: See `offline-first-sync-architecture.md` Parts 4–5.

---

## Gap 3 — Queue Worker (Background Sync Engine)

**Nothing exists.** No background worker, no drain loop, no retry scheduling.

### Create

```
apps/nks-mobile/services/queue-worker.ts
```

- Polls every 100ms when ONLINE, 500ms when DEGRADED, paused when OFFLINE
- Picks up to 5 distinct sale IDs with PENDING events
- Groups all events per sale, sends as one `POST /api/sync/events`
- On 200: marks SYNCED, stamps `server_received_at`
- On failure: schedules retry with exponential backoff (0s → 5s → 30s → 5m → 30m → 1h cap → 24h → DEAD at attempt 10)
- Jitter: `base * (0.8 + Math.random() * 0.4)` to prevent thundering herd

Retry delays: `[0, 5000, 30000, 300000, 1800000, 3600000, 3600000, 3600000, 3600000, 86400000]`

Exports needed:
- `drainQueue()` — triggered on reconnect, recurses until queue empty
- `pendingCount()` — returns count of PENDING+SYNCING+FAILED events (used by UI and shift-close guard)

---

## Gap 4 — Delta Pull (Server → Device Sync)

**Nothing exists.** No mechanism to pull updated products, prices, or inventory from server.

### Create

```
apps/nks-mobile/services/delta-pull.ts
```

```ts
pullDelta(storeId: string): Promise<void>
```

Calls `GET /api/sync/delta?since=<last_pull_at>&storeId=<id>`. Upserts products and inventory into local cache tables. Updates `last_pull_at` in `sync_state` table. Run immediately after `drainQueue()` completes.

TTLs to enforce locally:
- `products_cache`: 4 hours (price changes)
- `inventory_cache`: 4 hours
- Show stale banner if TTL expired and delta pull failed

---

## Gap 5 — Connectivity State Machine (Replace Current)

**Current is wrong.** `useIsOffline` uses NetInfo — unreliable.

### Replace `libs-mobile/mobile-utils/src/network/network.ts` with:

```
apps/nks-mobile/services/connectivity.ts
```

Exports `useConnectivity(): ConnectivityState` where state is `'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'SYNCING'`.

Implementation: `HEAD /api/health` with `AbortController` timeout of 3 seconds every 10 seconds. Latency < 500ms = ONLINE, < 3s = DEGRADED, timeout = OFFLINE.

Wire into `_layout.tsx`: when connectivity transitions from OFFLINE to anything else, immediately call `drainQueue()`.

---

## Gap 6 — Route Restructure (POS Domain Routes)

**Current routes are generic.** `(tabs)/` has a generic home tab and settings. POS needs domain-specific routes.

### Required route structure

```
apps/nks-mobile/app/
├── (auth)/             ← keep as-is
├── (pos)/
│   ├── _layout.tsx     ← POS layout with sync status header
│   ├── index.tsx       ← checkout / cart screen (main POS)
│   ├── scanner.tsx     ← barcode + QR scan
│   └── receipt/[saleId].tsx
├── (shift)/
│   ├── open.tsx        ← open shift + opening cash count
│   └── close.tsx       ← close shift (BLOCKED if pendingCount > 0)
├── (reports)/
│   └── index.tsx
└── (settings)/
    └── index.tsx
```

Remove or repurpose current `(tabs)/index.tsx` and `(tabs)/settings.tsx`.

---

## Gap 7 — Sync Status UI (Persistent Header)

**Nothing exists.** Staff must always see sync state.

### Create

```
apps/nks-mobile/components/SyncStatusBar.tsx
```

Reads `pendingCount()` reactively from WatermelonDB observable. Shows:
- Green dot — ONLINE, queue empty
- Amber dot + "X pending" — PENDING or DEGRADED
- Red dot — OFFLINE, X sales pending sync
- Progress bar — SYNCING state

Must appear in `(pos)/_layout.tsx` header. Non-negotiable — this is an operational visibility requirement, not a nice-to-have.

---

## Gap 8 — Shift Close Guard

**Nothing exists.** Shift close must block if queue is not empty.

### In `(shift)/close.tsx`

```ts
const pending = await pendingCount();
if (pending > 0) {
  // Block: "X sales still syncing. Please wait before closing shift."
}
```

Shift close button disabled + explanation shown until `pendingCount() === 0`.

---

## Gap 9 — Server-Side Requirements (Backend Team)

These are **blockers** for the mobile sync to work. Backend must build:

| Endpoint | What it does |
|---|---|
| `POST /api/sync/events` | Receives batched outbox events for one sale. Checks idempotency key, runs unseal() 7-guard pipeline, processes business logic |
| `GET /api/sync/delta` | Returns changed products + inventory since `?since=` timestamp |
| `HEAD /api/health` | Connectivity probe — returns 200 immediately, no auth required |
| `POST /devices/register` | Registers device public key (ECDSA) for HMAC/signature verification |

Server-side tables needed:
- `idempotency_store` — prevents duplicate processing on retry
- `device_key_registry` — stores device public keys + kid + last_seq
- `audit_log` — append-only, DB-level REVOKE UPDATE/DELETE
- `inventory_alerts` — negative stock, reorder alerts

Full server-side spec: See `offline-first-sync-architecture.md` Parts 12, 16, 17.

---

## Gap 10 — Security Envelope (Phase 2, post-MVP)

Not required for MVP but must be designed in from the start so it can be added without a rewrite.

The `seal()` function wraps every outbox payload before it's written to SQLite. The `unseal()` pipeline runs on the server before any event is processed.

See `offline-first-sync-architecture.md` Part 16 for the complete spec including ECDSA Secure Enclave key generation, AES-256-GCM encryption, anti-replay sequence counter, and the 7-guard server verification pipeline.

**For MVP:** At minimum, use HMAC-SHA256 with `device_secret` from SecureStore as the signature. Upgrade to Secure Enclave ECDSA in Phase 2.

---

## Implementation Order

Build in this exact order. Each step is a hard dependency for the next.

| # | What | File(s) | Blocks |
|---|---|---|---|
| 1 | Install WatermelonDB + react-native-quick-sqlite + Babel plugin | `package.json`, `babel.config.js` | Everything |
| 2 | DB schema (6 tables, correct indexes) | `database/schema.ts` | 3, 4, 5 |
| 3 | DB models (6 model classes) | `database/models/*.ts` | 4, 5 |
| 4 | Database instance (jsi: true) | `database/index.ts` | 5, 6, 7 |
| 5 | Wire `DatabaseProvider` in layout | `app/_layout.tsx` | All DB queries |
| 6 | Replace connectivity with server probe | `services/connectivity.ts` | 7, 8 |
| 7 | `writeCheckout()` outbox writer | `services/checkout.ts` | Core POS flow |
| 8 | `drainQueue()` queue worker | `services/queue-worker.ts` | Background sync |
| 9 | `pullDelta()` delta pull | `services/delta-pull.ts` | Price/stock freshness |
| 10 | Wire connectivity → `drainQueue()` on reconnect | `app/_layout.tsx` | Auto-sync |
| 11 | Restructure routes to POS domain | `app/(pos)/`, `app/(shift)/` | POS UX |
| 12 | `SyncStatusBar` component | `components/SyncStatusBar.tsx` | Operational visibility |
| 13 | Shift-close guard | `app/(shift)/close.tsx` | Safe shift management |
| 14 | Backend sync endpoints | Server team | End-to-end sync |
| 15 | Security envelope (HMAC MVP → ECDSA Phase 2) | `services/seal.ts` | Production security |

---

## Summary of What Needs to Be Added vs Changed

| Category | Action | Priority |
|---|---|---|
| `database/` directory | Create from scratch | P0 |
| `services/connectivity.ts` | Create (replaces NetInfo usage) | P0 |
| `services/checkout.ts` | Create | P0 |
| `services/queue-worker.ts` | Create | P0 |
| `services/delta-pull.ts` | Create | P0 |
| `network/network.ts` | Replace NetInfo with server probe | P0 |
| `app/_layout.tsx` | Add `DatabaseProvider` + `QueryClientProvider` + drain trigger | P0 |
| Route structure `(pos)/`, `(shift)/` | Create | P1 |
| `components/SyncStatusBar.tsx` | Create | P1 |
| Shift-close guard | Create | P1 |
| `services/seal.ts` (HMAC) | Create | P2 (before production) |
| TanStack Query | Install + wire QueryClientProvider | P1 |
| `@tanstack/react-query` | Install | P1 |

**Nothing in the existing codebase needs to be deleted** — the API client, auth storage, secure store, haptics, and UI components are all correct and will be used. The only file that needs replacing logic is `network.ts` (connectivity detection approach).
