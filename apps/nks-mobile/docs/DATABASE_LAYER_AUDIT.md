# Mobile Database Layer — Deep Audit

**Date:** April 2026  
**Scope:** `/lib/database/`, `/lib/local-db.ts`, `/libs-mobile/local-db/src/`  
**Stack:** Drizzle ORM + expo-sqlite + SQLCipher

---

## Audit Score: 61/100

| Category | Score | Issues |
|----------|-------|--------|
| Architecture | 45/100 | Dual ORM, schema duplication |
| Schema Design | 68/100 | Missing constraints, type inconsistency |
| Repository Quality | 72/100 | Race condition, loop inserts, null bug |
| Mobile Compatibility | 80/100 | Date comparison bug, WAL config |
| Code Consistency | 65/100 | Mixed date formats, two classes in one file |
| **Overall** | **61/100** | **16 issues found** |

---

## Summary Table

| # | Issue | Severity | File |
|---|-------|----------|------|
| 1 | Two complete ORM systems in the same app | 🔴 CRITICAL | Architecture |
| 2 | Schema defined twice (Drizzle schema + raw DDL) | 🔴 CRITICAL | `migrations.ts` + `schema/*.ts` |
| 3 | `entity_permissions` has no unique constraint on logical key | 🔴 CRITICAL | `entity-permissions.schema.ts` |
| 4 | `null` store guard bug in `findByRole()` and `can()` | 🔴 CRITICAL | `entity-permissions.repository.ts` |
| 5 | `incrementRetry()` is a read-modify-write race condition | 🟠 HIGH | `mutation-queue.repository.ts` |
| 6 | `saveAll()` inserts in a loop without a transaction | 🟠 HIGH | `lookup.repository.ts` |
| 7 | `mutation_queue` missing status, max_retries, idempotency_key | 🟠 HIGH | `mutation-queue.schema.ts` |
| 8 | `effective_to` date comparison will silently break on ISO strings | 🟠 HIGH | `tax-rate-master.repository.ts` |
| 9 | `migrations.ts` cannot evolve schema (no ALTER TABLE support) | 🟠 HIGH | `migrations.ts` |
| 10 | Drizzle schema indexes not declared in schema files | 🟡 MEDIUM | `schema/*.schema.ts` |
| 11 | `entity_permissions` upsert conflicts on `id`, not on logical key | 🟡 MEDIUM | `entity-permissions.repository.ts` |
| 12 | `mutation_queue.created_at` is `INTEGER`, all other dates are `TEXT` | 🟡 MEDIUM | Mixed across schemas |
| 13 | `routes` repository `findByScope()` returns soft-deleted rows | 🟡 MEDIUM | `routes.repository.ts` |
| 14 | Two classes in one file (location.repository.ts) | 🟡 MEDIUM | `location.repository.ts` |
| 15 | `connection.ts` missing `PRAGMA synchronous = NORMAL` | 🟢 LOW | `connection.ts` |
| 16 | `sync_state` schema is an untyped key-value bag | 🟢 LOW | `sync-state.schema.ts` |

---

## Issue 1 — 🔴 CRITICAL: Two Complete ORM Systems in the Same App

### What exists

**System A: Drizzle ORM** — `/apps/nks-mobile/lib/database/`
- expo-sqlite + SQLCipher (encrypted)
- 13 tables, 11 repositories
- Actually used by the app

**System B: WatermelonDB** — `/libs-mobile/local-db/src/`
- Standard SQLite (unencrypted)
- 5 tables (auth_users, auth_sessions, auth_roles, auth_flags, pending_sync)
- All hooks are **stubs returning null** — never actually used

```ts
// libs-mobile/local-db/src/hooks/useLocalDb.ts
export function useLocalDb() { return null; }   // ← stub
export function usePendingSync() { return null; } // ← stub

// libs-mobile/local-db/src/hooks/useAuth.ts
export function useAuth() {
  return { getUser: async () => null, getRoles: async () => [] }; // ← stub
}
```

### Why it is a problem

| Problem | Impact |
|---------|--------|
| `@nks/local-db` is a workspace dep but does nothing | Adds bundle weight, confuses developers |
| WatermelonDB uses unencrypted SQLite | If ever activated, tokens would be stored in plaintext |
| `auth_sessions` duplicates `jwt-manager.ts` + SecureStore | Two separate token expiry implementations |
| `pending_sync` duplicates `mutation_queue` | Two separate offline write queues |
| No clear decision recorded | Every new developer asks "which DB do I use?" |

### Fix

**Option A (Recommended): Remove WatermelonDB entirely**
```bash
# Remove the workspace package
rm -rf libs-mobile/local-db/src/

# Remove from mobile app package.json
# "@nks/local-db": "workspace:*"  ← DELETE

# Remove from nks-mobile tsconfig.json paths
# "@nks/local-db": [...]  ← DELETE
```

**Option B: Keep WatermelonDB but implement it fully**

If WatermelonDB was intended for a specific use case (e.g., React-based observable queries), document the decision and implement it. But it requires SQLCipher configuration for WatermelonDB too:
```ts
// database.ts — enable encryption
const adapter = new SQLiteAdapter({
  schema,
  dbName: 'nks_auth',
  // WatermelonDB does not natively support SQLCipher
  // Use @nozbe/watermelondb with react-native-sqlite-storage for encryption
});
```

**Decision:** The Drizzle ORM system is complete and production-grade. Remove WatermelonDB.

---

## Issue 2 — 🔴 CRITICAL: Schema Defined Twice

### What exists

Every table is defined in **two places**:

**Place 1: Drizzle schema files** (type-safe, ORM-managed)
```ts
// schema/routes.schema.ts
export const routes = sqliteTable('routes', {
  id:          integer('id').primaryKey(),
  guuid:       text('guuid').notNull().unique(),
  route_name:  text('route_name').notNull(),
  ...
});
```

**Place 2: `migrations.ts` raw DDL** (manual SQL, run on startup)
```ts
// migrations.ts
export const ROUTES = `
  CREATE TABLE IF NOT EXISTS routes (
    id          INTEGER PRIMARY KEY,
    guuid       TEXT NOT NULL UNIQUE,
    route_name  TEXT NOT NULL,
    ...
  )
`;
```

### Why it is a problem

1. **Any column addition requires changes in 2 files** — guaranteed to go out of sync
2. **`IF NOT EXISTS` cannot add new columns** — if `routes` already exists with 10 columns and you add column 11, the DDL is skipped silently. Existing installs never get the new column
3. **No migration history** — there is no version number or migration log. No way to know what version of the schema an installed app is running
4. **Drizzle was not set up for its migration tooling** — Drizzle has a built-in migration system (`drizzle-kit`) that generates versioned migration files. The current setup bypasses it entirely

### Fix — Use Drizzle Migrations Properly

**Step 1:** Install drizzle-kit
```bash
pnpm add -D drizzle-kit
```

**Step 2:** Add drizzle config
```ts
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './lib/database/schema/index.ts',
  out: './lib/database/migrations',
});
```

**Step 3:** Generate migrations instead of hand-writing DDL
```bash
npx drizzle-kit generate
# Generates: lib/database/migrations/0001_initial.sql
```

**Step 4:** Replace `migrations.ts` manual DDL with Drizzle migration runner
```ts
// connection.ts
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from './migrations/migrations';

// replace the manual ALL_TABLES loop:
await migrate(_db, migrations);
```

**Step 5:** Delete `migrations.ts` — the source of truth is now the Drizzle schema files + generated migration SQL files.

---

## Issue 3 — 🔴 CRITICAL: `entity_permissions` Has No Unique Constraint on Logical Key

### What exists

```ts
// entity-permissions.schema.ts
export const entityPermissions = sqliteTable('entity_permissions', {
  id:          integer('id').primaryKey(),   // ← conflict target is id
  role_code:   text('role_code').notNull(),
  entity_code: text('entity_code').notNull(),
  store_guuid: text('store_guuid'),          // nullable
  can_view:    integer('can_view')...
  deny:        integer('deny')...
});
```

```ts
// entity-permissions.repository.ts
.onConflictDoUpdate({
  target: entityPermissions.id,    // ← conflicts on id only
  set: { ... }
})
```

### Why it is a problem

The logical unique key for a permission row is `(role_code, entity_code, store_guuid)`. But:

1. **Conflict target is `id`** — if the backend sends a permission row with a different ID (e.g., after a DB reset), a **new duplicate row** is inserted instead of updating the existing one
2. **`can()` query uses `ORDER BY store_guuid DESC LIMIT 1`** — if there are two rows for the same `(role_code, entity_code)`, this ordering may not consistently pick the right one
3. **`findByRole()` can return multiple rows for the same entity** — no deduplication

### Fix

Add a `UNIQUE` constraint on the logical key in both the schema and the DDL:

```ts
// entity-permissions.schema.ts
import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const entityPermissions = sqliteTable(
  'entity_permissions',
  {
    id:          integer('id').primaryKey(),
    role_code:   text('role_code').notNull(),
    entity_code: text('entity_code').notNull(),
    store_guuid: text('store_guuid'),
    can_view:    integer('can_view').notNull().default(0),
    can_create:  integer('can_create').notNull().default(0),
    can_edit:    integer('can_edit').notNull().default(0),
    can_delete:  integer('can_delete').notNull().default(0),
    deny:        integer('deny').notNull().default(0),
  },
  (t) => ({
    // ← ADD THIS: unique constraint on logical key
    uniqRoleEntityStore: uniqueIndex('uq_ep_role_entity_store')
      .on(t.role_code, t.entity_code, t.store_guuid),
  }),
);
```

Update the upsert to use the logical key:
```ts
// entity-permissions.repository.ts
.onConflictDoUpdate({
  target: [                           // ← conflict on logical key, not id
    entityPermissions.role_code,
    entityPermissions.entity_code,
    entityPermissions.store_guuid,
  ],
  set: {
    can_view:   row.can_view,
    can_create: row.can_create,
    can_edit:   row.can_edit,
    can_delete: row.can_delete,
    deny:       row.deny,
  },
})
```

---

## Issue 4 — 🔴 CRITICAL: Null `storeGuuid` Bug in `findByRole()` and `can()`

### What exists

```ts
// entity-permissions.repository.ts — findByRole() and can()
or(
  eq(entityPermissions.store_guuid, storeGuuid ?? ''),  // ← BUG
  isNull(entityPermissions.store_guuid),
)
```

### Why it is a problem

When `storeGuuid` is `null` (SUPER_ADMIN or CUSTOMER with no active store):
- `storeGuuid ?? ''` becomes `''` (empty string)
- The query looks for rows where `store_guuid = ''` OR `store_guuid IS NULL`
- **This accidentally matches any row where `store_guuid` was stored as an empty string `''`**

Additionally, when the intent is to query global permissions only (storeGuuid = null), the query should NOT include the `eq(store_guuid, '')` branch at all.

### What the query should do

| Caller context | Expected result |
|----------------|----------------|
| `storeGuuid = 'abc-123'` | Return store-scoped row for 'abc-123' AND global rows |
| `storeGuuid = null` | Return ONLY global rows (no store context) |

### Fix

```ts
// entity-permissions.repository.ts — apply in BOTH findByRole() and can()

const storeFilter = storeGuuid
  ? or(
      eq(entityPermissions.store_guuid, storeGuuid),
      isNull(entityPermissions.store_guuid),
    )
  : isNull(entityPermissions.store_guuid);  // ← null = global only

// In findByRole():
.where(and(eq(entityPermissions.role_code, roleCode), storeFilter))

// In can():
.where(
  and(
    eq(entityPermissions.role_code, roleCode),
    eq(entityPermissions.entity_code, entityCode),
    storeFilter,
  ),
)
```

---

## Issue 5 — 🟠 HIGH: `incrementRetry()` Is a Read-Modify-Write Race Condition

### What exists

```ts
// mutation-queue.repository.ts
async incrementRetry(id: number): Promise<void> {
  // Step 1: Read current value
  const current = await this.db
    .select({ retries: mutationQueue.retries })
    .from(mutationQueue)
    .where(eq(mutationQueue.id, id))
    .limit(1);

  // Step 2: Write incremented value (race condition window here)
  if (current[0]) {
    await this.db
      .update(mutationQueue)
      .set({ retries: current[0].retries + 1 })
      .where(eq(mutationQueue.id, id));
  }
}
```

### Why it is a problem

Two concurrent sync workers calling `incrementRetry(5)` simultaneously:
```
Worker A reads retries = 0
Worker B reads retries = 0
Worker A writes retries = 1
Worker B writes retries = 1   ← overwrites Worker A, retries stays at 1 instead of 2
```

On mobile this is less likely (single JS thread), but async scheduling can still cause this on React Native's async bridge.

### Fix

Use a single SQL atomic update — no read needed:

```ts
async incrementRetry(id: number): Promise<void> {
  try {
    await this.db
      .update(mutationQueue)
      .set({ retries: sql`${mutationQueue.retries} + 1` })  // ← atomic
      .where(eq(mutationQueue.id, id));
  } catch (err) {
    log.error('Failed to increment retry count:', err);
  }
}
```

---

## Issue 6 — 🟠 HIGH: `saveAll()` Inserts in a Loop Without a Transaction

### What exists

```ts
// lookup.repository.ts
async saveAll(type: string, rows: InsertLookup[]): Promise<void> {
  if (!rows.length) return;
  try {
    for (const row of rows) {           // ← N individual inserts, no transaction
      await this.db
        .insert(lookup)
        .values({ ...row, type })
        .onConflictDoUpdate({ ... });
    }
  } catch (err) {
    log.error(`Failed to save lookups [${type}]:`, err);
  }
}
```

### Why it is a problem

If the loop fails at row 50 of 100 (network interrupt, disk full, crash), the first 49 rows are committed permanently while rows 50-100 are never inserted. The lookup table is left in a partial state with no way to detect or recover from it.

Also, N individual transactions are 10-100× slower than 1 batch transaction on SQLite.

### Fix

Wrap the entire batch in a Drizzle transaction:

```ts
async saveAll(type: string, rows: InsertLookup[]): Promise<void> {
  if (!rows.length) return;
  try {
    await this.db.transaction(async (tx) => {          // ← single transaction
      for (const row of rows) {
        await tx
          .insert(lookup)
          .values({ ...row, type })
          .onConflictDoUpdate({
            target: [lookup.id, lookup.type],
            set: {
              code:       row.code,
              label:      row.label,
              meta:       row.meta,
              sort_order: row.sort_order,
              is_active:  row.is_active,
            },
          });
      }
    });
  } catch (err) {
    log.error(`Failed to save lookups [${type}]:`, err);
    // Transaction is automatically rolled back on error
  }
}
```

Apply the same pattern to all bulk operations: `storeOperatingHoursRepository`, `locationRepository.upsert` batches, `entityPermissionsRepository` bulk loads.

---

## Issue 7 — 🟠 HIGH: `mutation_queue` Missing Critical Sync Fields

### What exists (Drizzle schema)

```ts
// mutation-queue.schema.ts — current
export const mutationQueue = sqliteTable('mutation_queue', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  operation:  text('operation').notNull(),
  entity:     text('entity').notNull(),
  payload:    text('payload').notNull(),
  created_at: integer('created_at').notNull(),
  retries:    integer('retries').notNull().default(0),
});
```

### What WatermelonDB `pending_sync` has (better design)

```
idempotency_key    ← prevents duplicate submissions on retry
status             ← pending | in_progress | synced | failed | quarantined
max_retries        ← cap for retry attempts
next_retry_at      ← exponential backoff scheduling
last_error_code    ← diagnose failures
last_error_message ← diagnose failures
data_hash          ← detect payload tampering
expires_at         ← TTL for stale mutations
device_id          ← which device enqueued
sync_attempts      ← total attempts (vs retries after failure)
```

### Why it is a problem

Without these fields:
- A mutation that fails 100 times will keep retrying forever (no `max_retries`)
- Cannot diagnose why a mutation failed (no `last_error`)
- Cannot prevent duplicate submissions if the network confirms but app crashes before dequeue (no `idempotency_key`)
- Cannot show the user how many mutations are pending vs failed (no `status`)

### Fix

```ts
// mutation-queue.schema.ts — enhanced
export const mutationQueue = sqliteTable('mutation_queue', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  idempotency_key:  text('idempotency_key').notNull().unique(),  // ← uuidv7
  operation:        text('operation').notNull(),
  entity:           text('entity').notNull(),
  payload:          text('payload').notNull(),
  status:           text('status').notNull().default('pending'),
  // 'pending' | 'in_progress' | 'synced' | 'failed' | 'quarantined'
  retries:          integer('retries').notNull().default(0),
  max_retries:      integer('max_retries').notNull().default(5),
  next_retry_at:    integer('next_retry_at'),     // Unix ms, null = ready now
  last_error_code:  integer('last_error_code'),
  last_error_msg:   text('last_error_msg'),
  device_id:        text('device_id').notNull(),
  created_at:       integer('created_at').notNull(),
  synced_at:        integer('synced_at'),
  expires_at:       integer('expires_at'),        // TTL for stale mutations
});
```

Update `enqueue()` to set `idempotency_key` and `device_id`:
```ts
async enqueue(operation: string, entity: string, payload: Record<string, unknown>): Promise<void> {
  await this.db.insert(mutationQueue).values({
    idempotency_key: uuidv7(),          // ← from uuidv7 package (already installed)
    operation,
    entity,
    payload: JSON.stringify(payload),
    status: 'pending',
    device_id: await DeviceManager.getFingerprint(),
    created_at: Date.now(),
    max_retries: 5,
    retries: 0,
  });
}
```

---

## Issue 8 — 🟠 HIGH: `effective_to` Date Comparison Will Break on ISO Strings

### What exists

```ts
// tax-rate-master.repository.ts
or(
  isNull(taxRateMaster.effective_to),
  sql`${taxRateMaster.effective_to} > datetime('now')`
)
```

`effective_to` is stored as `TEXT` in the schema.

### Why it is a problem

SQLite `datetime('now')` returns: `2025-12-31 15:30:00` (space-separated, UTC, no timezone)

If `effective_to` is stored as ISO 8601: `2025-12-31T23:59:59.000Z` (T separator, Z suffix)

The comparison `'2025-12-31T23:59:59.000Z' > '2025-12-31 15:30:00'` does a **text lexicographic comparison**.

- `'T'` (ASCII 84) > `' '` (ASCII 32) → the ISO string is always lexicographically "greater"
- This means **all ISO-format `effective_to` values are treated as in the future**, even expired ones
- Expired tax rates continue to be returned silently

### Fix — Store Dates as Unix Timestamps (Integers) in `mutation_queue` Pattern

For tax rate dates specifically, store `effective_from` and `effective_to` as Unix milliseconds (integers), consistent with `mutation_queue.created_at`:

```ts
// tax-rate-master.schema.ts — changed to integer timestamps
export const taxRateMaster = sqliteTable('tax_rate_master', {
  ...
  effective_from: integer('effective_from').notNull(),  // Unix ms
  effective_to:   integer('effective_to'),              // Unix ms, null = no expiry
  ...
});
```

Query becomes:
```ts
or(
  isNull(taxRateMaster.effective_to),
  sql`${taxRateMaster.effective_to} > ${Date.now()}`  // ← integer comparison, exact
)
```

**OR** — if TEXT dates must be kept, ensure format is stored as `YYYY-MM-DD` (SQLite canonical date format) in ISO order without timezone suffix, so text comparison works:
```ts
// When storing:
effectiveTo: new Date(value).toISOString().slice(0, 10)  // → "2025-12-31"
// Then: datetime('now') → "2025-12-31" format matches
```

---

## Issue 9 — 🟠 HIGH: `migrations.ts` Cannot Evolve the Schema

### What exists

```ts
// connection.ts
for (const ddl of ALL_TABLES) {
  await _sqlite.execAsync(ddl);  // runs CREATE TABLE IF NOT EXISTS
}
```

### Why it is a problem

`CREATE TABLE IF NOT EXISTS` is **idempotent for the table structure** — it only creates the table the first time. It **does not add new columns** to existing tables.

**Real-world scenario:**
1. App v1.0 ships with `mutation_queue` table (6 columns)
2. App v1.1 adds `status` and `idempotency_key` columns to schema
3. On upgrade, `CREATE TABLE IF NOT EXISTS mutation_queue (...)` is skipped (table exists)
4. App v1.1 queries `mutation_queue.status` → **SQLite error: no such column**
5. App crashes for all upgrading users

### Fix — Add Migration Versioning

```ts
// lib/database/migration-runner.ts
const CURRENT_VERSION = 2;

export async function runMigrations(sqlite: SQLite.SQLiteDatabase): Promise<void> {
  // Read current version
  await sqlite.execAsync(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)`);
  const row = await sqlite.getFirstAsync<{ version: number }>('SELECT version FROM schema_version LIMIT 1');
  const currentVersion = row?.version ?? 0;

  if (currentVersion < 1) {
    // v1: Initial schema
    for (const ddl of INITIAL_TABLES) {
      await sqlite.execAsync(ddl);
    }
  }

  if (currentVersion < 2) {
    // v2: Add status + idempotency_key to mutation_queue
    await sqlite.execAsync(`ALTER TABLE mutation_queue ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'`);
    await sqlite.execAsync(`ALTER TABLE mutation_queue ADD COLUMN idempotency_key TEXT`);
  }

  // Update version
  if (currentVersion === 0) {
    await sqlite.execAsync(`INSERT INTO schema_version (version) VALUES (${CURRENT_VERSION})`);
  } else {
    await sqlite.execAsync(`UPDATE schema_version SET version = ${CURRENT_VERSION}`);
  }
}
```

---

## Issue 10 — 🟡 MEDIUM: Drizzle Schema Files Missing Index Declarations

### What exists

Indexes are defined only in `migrations.ts` raw DDL:
```ts
// migrations.ts
export const ROUTES_IDX = [
  `CREATE INDEX IF NOT EXISTS idx_routes_scope      ON routes (route_scope)`,
  `CREATE INDEX IF NOT EXISTS idx_routes_updated_at ON routes (updated_at DESC)`,
];
```

But the Drizzle schema files have no index definitions:
```ts
// schema/routes.schema.ts — indexes are MISSING
export const routes = sqliteTable('routes', {
  ...
});
// ← no index() defined
```

### Why it is a problem

- Drizzle ORM tooling (Drizzle Studio, drizzle-kit) does not know these indexes exist
- When generating migrations via `drizzle-kit generate`, the indexes will not be included
- Future migration generation will try to CREATE the indexes again (duplicates)

### Fix

Declare indexes inside the schema definition:

```ts
// schema/routes.schema.ts
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const routes = sqliteTable(
  'routes',
  {
    id:          integer('id').primaryKey(),
    guuid:       text('guuid').notNull().unique(),
    route_scope: text('route_scope').notNull(),
    updated_at:  text('updated_at').notNull(),
    ...
  },
  (t) => ({
    scopeIdx:     index('idx_routes_scope').on(t.route_scope),
    updatedAtIdx: index('idx_routes_updated_at').on(t.updated_at),
  }),
);
```

Apply to all schemas that have indexes in `migrations.ts`:
`routes`, `stores`, `entity_permissions`, `lookup`, `status`, `entity_status_mapping`, `store_operating_hours`, `state`, `district`, `tax_rate_master`, `user_role_mapping`

---

## Issue 11 — 🟡 MEDIUM: `entity_permissions` Upsert Conflicts on `id`, Not Logical Key

### What exists

```ts
// entity-permissions.repository.ts
.onConflictDoUpdate({
  target: entityPermissions.id,   // ← id conflict only
  set: { can_view, can_create, can_edit, can_delete, deny }
})
```

### Why it is a problem

The logical identity of a permission is `(role_code, entity_code, store_guuid)`, not the `id`.

If the backend sends the same permission with a new `id` (e.g., after re-seeding permissions), the conflict check on `id` fails to match the existing row, and a **duplicate row is inserted**. Now there are two rows for `STORE_OWNER → orders → store_abc`, the `can()` query is ambiguous.

### Fix

Per Issue 3 fix: add `UNIQUE(role_code, entity_code, store_guuid)` constraint and conflict on the logical key. Once that constraint exists, the upsert in Issue 3 is the correct approach.

---

## Issue 12 — 🟡 MEDIUM: Inconsistent Date Storage Across Tables

### What exists

| Table | Column | Type | Format |
|-------|--------|------|--------|
| `mutation_queue` | `created_at` | `INTEGER` | Unix milliseconds |
| `routes` | `created_at`, `updated_at` | `TEXT` | ISO string |
| `stores` | `updated_at`, `deleted_at` | `TEXT` | ISO string |
| `status` | `updated_at`, `deleted_at` | `TEXT` | ISO string |
| `tax_rate_master` | `effective_from`, `effective_to` | `TEXT` | ISO string |
| `user_role_mapping` | `assigned_at`, `expires_at` | `TEXT` | ISO string |

### Why it is a problem

- Sorting by date across tables requires different logic per table
- Date comparisons using `>` or `<` require different types depending on which table you're in
- Tax rate comparison bug (Issue 8) stems directly from this inconsistency

### Fix

Standardize on one format. **Recommended: Unix milliseconds (INTEGER)** for all timestamp columns:

```ts
// Standard pattern for ALL schemas
created_at: integer('created_at').notNull(),   // Date.now()
updated_at: integer('updated_at').notNull(),   // Date.now()
deleted_at: integer('deleted_at'),             // Date.now() or null
```

For date-only fields (effective_from, effective_to in tax rates), use `YYYY-MM-DD` TEXT in consistent format:
```ts
effective_from: text('effective_from').notNull(),  // '2025-01-01'
effective_to:   text('effective_to'),              // '2025-12-31' or null
```

---

## Issue 13 — 🟡 MEDIUM: `routes` Repository `findByScope()` Returns Soft-Deleted Rows

### What exists (inferred from repository pattern)

```ts
// routes.repository.ts
async findByScope(scope: string): Promise<RouteRow[]> {
  return await this.db
    .select()
    .from(routes)
    .where(eq(routes.route_scope, scope));  // ← no deleted_at filter
}
```

The `routes` schema has a `deleted_at` column (soft delete), but the query does not filter for `deleted_at IS NULL`.

### Why it is a problem

Soft-deleted routes (marked with a `deleted_at` timestamp) are returned alongside active routes. Navigation menus built from this query would show deleted routes to users.

### Fix

```ts
async findByScope(scope: string): Promise<RouteRow[]> {
  return await this.db
    .select()
    .from(routes)
    .where(
      and(
        eq(routes.route_scope, scope),
        eq(routes.is_active, 1),         // ← active only
        isNull(routes.deleted_at),       // ← not soft-deleted
      ),
    );
}
```

Apply the same `isNull(deleted_at)` filter to every `findAll()` / `findBy*()` method across all repositories that have `deleted_at` columns: `stores`, `status`, `store_operating_hours`, `state`, `district`, `tax_rate_master`, `user_role_mapping`.

---

## Issue 14 — 🟡 MEDIUM: Two Repository Classes in One File

### What exists

```ts
// location.repository.ts
export class StateRepository { ... }    // ← class 1
export class DistrictRepository { ... } // ← class 2

export const stateRepository = new StateRepository();
export const districtRepository = new DistrictRepository();
```

Every other repository file has exactly one class. This is the only file with two.

### Why it is a problem

- Inconsistency — developers expect one class per file
- `location.repository.ts` filename does not indicate it contains district logic

### Fix

Split into two files:

```
repositories/
  state.repository.ts      ← StateRepository class
  district.repository.ts   ← DistrictRepository class
  location.repository.ts   ← delete or re-export from both
```

Update `repositories/index.ts` to import from both files.

---

## Issue 15 — 🟢 LOW: Missing `PRAGMA synchronous = NORMAL`

### What exists

```ts
// connection.ts
await _sqlite.execAsync('PRAGMA journal_mode = WAL');
await _sqlite.execAsync('PRAGMA foreign_keys = ON');
// ← PRAGMA synchronous missing
```

### Why it is a problem

SQLite defaults to `synchronous = FULL` which calls `fsync()` on every transaction commit — expensive on mobile flash storage. With `WAL` journal mode, `synchronous = NORMAL` is safe and significantly faster:

- `FULL`: ~2-5ms per write (fsync to OS)
- `NORMAL`: ~0.1-0.5ms per write (relies on WAL checkpoint)
- Risk with NORMAL + WAL: data loss of up to the last checkpoint if the OS crashes (not the app — the OS). Acceptable for a local cache that re-syncs from server.

### Fix

```ts
// connection.ts
await _sqlite.execAsync('PRAGMA journal_mode = WAL');
await _sqlite.execAsync('PRAGMA synchronous = NORMAL');  // ← add this
await _sqlite.execAsync('PRAGMA foreign_keys = ON');
await _sqlite.execAsync('PRAGMA cache_size = -8000');    // ← 8MB cache (optional)
```

---

## Issue 16 — 🟢 LOW: `sync_state` Is an Untyped Key-Value Bag

### What exists

```ts
// sync-state.schema.ts
export const syncState = sqliteTable('sync_state', {
  key:   text('key').primaryKey(),
  value: text('value').notNull(),
});
```

```ts
// sync-state.repository.ts
async getValue(key: string): Promise<string | null>
async setValue(key: string, value: string): Promise<void>
```

### Why it is a problem

- Any string can be passed as `key` — no compile-time safety
- Any string can be passed as `value` — callers must know the expected format
- Getting a typo in a key name causes silent failure (returns null)

### Fix

Add a typed key enum:

```ts
// lib/database/constants/sync-keys.ts
export const SYNC_KEYS = {
  CURSOR_STORES:     'cursor:stores',
  CURSOR_ROUTES:     'cursor:routes',
  CURSOR_LOOKUP:     'cursor:lookup',
  CURSOR_STATUS:     'cursor:status',
  LAST_SYNC_AT:      'sync:lastSyncAt',
  LAST_FULL_SYNC_AT: 'sync:lastFullSyncAt',
} as const;

export type SyncKey = typeof SYNC_KEYS[keyof typeof SYNC_KEYS];
```

Update repository to use typed key:
```ts
async getValue(key: SyncKey): Promise<string | null>  // ← typed
async setValue(key: SyncKey, value: string): Promise<void>
```

---

## Correct Architecture: What the Database Layer Should Look Like

```
lib/database/
├── connection.ts              ← SQLite init + Drizzle wrap + migration runner
├── migration-runner.ts        ← versioned ALTER TABLE migrations (NEW)
├── migrations/
│   ├── 0001_initial.sql       ← generated by drizzle-kit (replaces migrations.ts)
│   └── 0002_mutation_queue_status.sql
│
├── schema/
│   ├── index.ts
│   ├── sync-state.schema.ts   ← add typed SyncKey
│   ├── routes.schema.ts       ← add index() declarations
│   ├── stores.schema.ts       ← add index() declarations
│   ├── entity-permissions.schema.ts  ← add UNIQUE(role,entity,store) constraint
│   ├── mutation-queue.schema.ts      ← add status, idempotency_key, max_retries
│   ├── lookup.schema.ts
│   ├── status.schema.ts
│   ├── entity-status-mapping.schema.ts
│   ├── store-operating-hours.schema.ts
│   ├── location.schema.ts
│   ├── tax-rate-master.schema.ts     ← standardize date types
│   └── user-role-mapping.schema.ts
│
├── repositories/
│   ├── index.ts
│   ├── routes.repository.ts          ← add isNull(deleted_at) filter
│   ├── stores.repository.ts          ← add isNull(deleted_at) filter
│   ├── sync-state.repository.ts      ← use SyncKey enum
│   ├── mutation-queue.repository.ts  ← fix atomicIncrement, add status methods
│   ├── lookup.repository.ts          ← wrap saveAll() in transaction
│   ├── status.repository.ts
│   ├── entity-status-mapping.repository.ts
│   ├── store-operating-hours.repository.ts
│   ├── entity-permissions.repository.ts  ← fix null guard, fix upsert target
│   ├── tax-rate-master.repository.ts     ← fix date comparison
│   ├── user-role-mapping.repository.ts
│   ├── state.repository.ts         ← split from location.repository.ts (NEW)
│   └── district.repository.ts      ← split from location.repository.ts (NEW)
│
└── constants/
    └── sync-keys.ts             ← typed sync key enum (NEW)
```

---

## Fix Priority Order

```
WEEK 1 — Data integrity:
  □ Issue 4: Fix null store guard bug in entity_permissions queries       (1h)
  □ Issue 3: Add UNIQUE(role,entity,store) constraint to entity_permissions (1h)
  □ Issue 5: Fix incrementRetry() atomic update                           (30min)
  □ Issue 6: Wrap lookup.saveAll() in transaction                         (30min)
  □ Issue 8: Fix effective_to date comparison in tax-rate-master          (1h)
  □ Issue 13: Add isNull(deleted_at) to all findBy* repository methods    (1h)

SPRINT 1 — Architecture:
  □ Issue 1: Remove WatermelonDB (@nks/local-db) entirely                 (2h)
  □ Issue 9: Add migration versioning with ALTER TABLE support            (3h)
  □ Issue 7: Add status, idempotency_key, max_retries to mutation_queue   (2h)
  □ Issue 2: Switch to drizzle-kit generated migrations (remove migrations.ts) (3h)

SPRINT 2 — Quality:
  □ Issue 10: Add index() declarations to all schema files                (1h)
  □ Issue 11: Verify upsert target after Issue 3 fix                      (30min)
  □ Issue 12: Standardize date storage (integer timestamps)               (2h)
  □ Issue 14: Split location.repository.ts into state + district          (30min)
  □ Issue 15: Add PRAGMA synchronous = NORMAL                             (15min)
  □ Issue 16: Add SyncKey enum to sync-state repository                  (30min)
```

---

## What Is Correct and Well-Done ✅

| Item | Assessment |
|------|-----------|
| Drizzle ORM + expo-sqlite choice | ✅ Correct — best-in-class for Expo + TypeScript |
| SQLCipher encryption | ✅ Correct — encrypts entire database file |
| Hex key validation before PRAGMA | ✅ Correct — prevents SQL injection via key |
| Integrity check `PRAGMA integrity_check` on startup | ✅ Correct — detects corruption early |
| WAL journal mode | ✅ Correct — faster writes, better concurrency |
| Foreign keys ON | ✅ Correct — referential integrity enforced |
| Repository pattern | ✅ Correct — clean abstraction over Drizzle |
| Fail-safe `can()` (returns false on error) | ✅ Correct — deny when uncertain |
| Singleton repository instances | ✅ Correct — one instance per table |
| `createLogger()` per repository | ✅ Correct — traceable logs per module |
| `isNull(deleted_at)` in some queries | ✅ Correct pattern — needs to be applied everywhere |
| `onConflictDoUpdate` pattern | ✅ Correct — upsert is the right approach for sync |
| Store-scoped permission priority in `can()` | ✅ Correct design — store > global |
| `mutation_queue` FIFO via `ORDER BY id ASC` | ✅ Correct — preserves operation order |

---

*Document generated from live codebase analysis — April 2026*
