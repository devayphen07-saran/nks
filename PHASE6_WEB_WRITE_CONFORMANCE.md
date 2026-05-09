# Phase 6: Web Write-Path Conformance

**Status:** In Progress (Implementation Started 2026-05-04)

## Overview

Every web/admin write on syncable tables must maintain sync metadata:
- `version` — incremented on every write (for optimistic concurrency)
- `updated_at` — set to NOW() (for pull cursor ordering)
- `created_by_device` — always NULL for web writes (attribution)
- `modified_by` — set to current user (via audit columns)
- `deleted_at` — set to NOW() on soft deletes

This ensures mobile clients can safely pull changes and detect conflicts.

---

## Core Contract

### On Create
```typescript
version: 1                           // Start at 1
created_by_device: null             // Web origin (not device)
created_by: current_user_id         // Via audit column
created_at: NOW()                   // Via audit column
updated_at: NOW()                   // Required for pull ordering
modified_by: current_user_id        // Via audit column
```

### On Update
```typescript
version: version + 1                // Increment
updated_at: NOW()                   // Update cursor
modified_by: current_user_id        // Attribution
```

### On Delete (Soft Delete Only)
```typescript
deleted_at: NOW()                   // Soft delete marker
deleted_by: current_user_id         // Who deleted
is_active: false                    // Status flag
version: version + 1                // Increment
updated_at: NOW()                   // Pull sees as modified
modified_by: current_user_id        // Final editor
```

---

## Implementation Pattern

### 1. Extend SyncBaseRepository (New Base Class)

Repositories writing to syncable tables should extend `SyncBaseRepository` instead of `BaseRepository`.

**SyncBaseRepository provides:**
- `insertOneSync(table, values, userId, tx)` — creates with version=1
- `updateOneSync(table, set, where, userId, tx)` — increments version
- `softDeleteSync(table, where, userId, tx)` — soft deletes with version++

**Location:** `src/core/database/sync-base.repository.ts`

### 2. Update Repositories

For each syncable table repository:

```typescript
import { SyncBaseRepository } from '../../../../core/database/sync-base.repository';
import { eq } from 'drizzle-orm';
import * as schema from '../../../../core/database/schema';

@Injectable()
export class ProductRepository extends SyncBaseRepository {
  // Use inherited methods instead of BaseRepository's insertOneAudited, etc.
  
  async create(data: NewProduct, userId: number, tx?: DbTransaction) {
    return this.insertOneSync(schema.product, data, userId, tx);
  }

  async update(id: string, data: Partial<Product>, userId: number, tx?: DbTransaction) {
    return this.updateOneSync(
      schema.product,
      data,
      eq(schema.product.id, id),
      userId,
      tx
    );
  }

  async delete(id: string, userId: number, tx?: DbTransaction) {
    return this.softDeleteSync(
      schema.product,
      eq(schema.product.id, id),
      userId,
      tx
    );
  }
}
```

**Key Changes:**
- Extend `SyncBaseRepository` not `BaseRepository`
- Use `insertOneSync()` instead of `insertOneAudited()`
- Use `updateOneSync()` to auto-increment version
- Use `softDeleteSync()` for deletions (never hard DELETE)
- Pass `userId` to all methods (for audit trail)

### 3. PATCH Endpoints (Version in Body)

For PATCH endpoints, accept `version` in the request body for conflict detection:

```typescript
@Patch(':id')
async update(
  @Param('id') id: string,
  @Body() dto: UpdateProductDto,  // includes { version: number, ...fields }
  @CurrentUser() user: SessionUser,
): Promise<ProductResponseDto> {
  const product = await this.service.update(id, dto, user.userId);
  
  if (!product) {
    throw new NotFoundException('Product not found');
  }
  
  return ProductMapper.toDto(product);
}
```

Then in the service, fetch current version and check:

```typescript
async update(id: string, dto: UpdateProductDto, userId: number) {
  const current = await this.repo.findById(id);
  
  if (!current) {
    return null; // Controller handles 404
  }

  // Optional: validate version if provided (for eventual conflict detection)
  // For now, web doesn't use versioning for conflicts
  // Mobile will use it to detect stale updates

  return this.repo.update(id, dto, userId);
}
```

### 4. DELETE Endpoints (Soft Delete Only)

Change all DELETE operations to soft deletes:

```typescript
@Delete(':id')
async delete(
  @Param('id') id: string,
  @CurrentUser() user: SessionUser,
): Promise<void> {
  const result = await this.service.delete(id, user.userId);
  
  if (!result) {
    throw new NotFoundException('Product not found');
  }
}
```

Service:
```typescript
async delete(id: string, userId: number) {
  return this.repo.delete(id, userId); // calls softDeleteSync
}
```

---

## Syncable Tables (Phase 6 Scope)

Determine which tables are syncable by checking:
1. Have `syncColumns()` spread into schema? → Syncable
2. Will mobile offline-edit this table? → Syncable
3. Is this master data (products, customers, sales)? → Syncable

**Confirmed Syncable:**
- `sales` (and `sale_items`)
- `customers`
- `payments`
- `products`
- `categories`
- `stock_movements`

**Reference/Config (Not Syncable):**
- `users`, `roles`, `permissions` (user management, web-only)
- `stores` (shared config, changes rare)
- `tax_*` (tax config, read-only on mobile)
- `lookups` (read-only)

---

## Audit Checklist

For each syncable table, verify:

- [ ] Schema includes `...syncColumns()` (version, created_by_device)
- [ ] Schema includes `...auditFields()` (created_by, created_at, modified_by, updated_at, deleted_by, deleted_at, is_active)
- [ ] Schema includes compound index: `(updated_at ASC, id ASC)`
- [ ] Repository extends `SyncRepository` (not `BaseRepository`)
- [ ] `create()` calls `insertOneSync()` (sets version=1, created_by_device=null)
- [ ] `update()` calls `updateOneSync()` (increments version)
- [ ] `delete()` calls `softDeleteSync()` (soft delete with version++)
- [ ] Service passes `userId` to all repository writes (for audit trail)
- [ ] PATCH endpoint validates version (optional, for future use)
- [ ] DELETE endpoint calls delete (soft delete, not hard delete)

---

## Implementation Steps

### Step 1: Verify SyncRepository
- ✅ Created at `src/core/database/sync.repository.ts`
- Provides `insertOneSync()`, `updateOneSync()`, `softDeleteSync()`

### Step 2: Audit Repositories
1. Find all syncable table repositories
2. Check which currently extend `BaseRepository`
3. Change to extend `SyncRepository` instead
4. Update `create()`, `update()`, `delete()` methods to use sync variants

### Step 3: Audit Write Services
1. Check that all write methods pass `userId` to repository
2. Verify no hard deletes (all DELETE → soft delete)
3. Add transaction support where writes are grouped

### Step 4: Update API Endpoints
1. PATCH endpoints: already accept bodies, no change needed
2. DELETE endpoints: already mapped to service delete, no change needed
3. Test: verify version increments on each write

### Step 5: Database Migrations
1. For each syncable table:
   - Add sync columns if not present: `version`, `created_by_device`
   - Add compound index: `(updated_at, id)`
   - Backfill `version = 1` for all existing rows
   - Backfill `created_by_device = null` (web origin)

### Step 6: Documentation
1. Update CLAUDE.md with sync write contract
2. Add schema comment blocks to each syncable table
3. Add JSDoc to sync repository methods

---

## Testing Strategy

### Unit Tests
- `SyncRepository.insertOneSync()` sets version=1, created_by_device=null
- `SyncRepository.updateOneSync()` increments version correctly
- `SyncRepository.softDeleteSync()` sets deleted_at, increments version

### Integration Tests
- Write to syncable table → version=1, updated_at=NOW()
- Update row → version=2, updated_at updated
- Delete row → deleted_at=NOW(), is_active=false, version++

### Mobile/Pull Tests
- Pull endpoint returns changed rows ordered by (updated_at, id)
- Deleted rows show up in pull with operation='delete'
- Mobile detects changes via cursor

---

## Breaking Changes

None. Web clients don't inspect `version`. Mobile clients will validate version on push, but Phase 6 is backend-only (web-writing).

---

## Future Extensions

**Phase 6+ (Mobile):**
- Mobile sends `expected_version` on update/delete
- Backend rejects with 409 if version mismatch
- Mobile resolves conflict via server_state

**Phase 6+ (CI):**
- Add check: find all UPDATE/DELETE queries
- Ensure they set version, updated_at, modified_by
- Flag hardcoded DELETE without soft-delete wrapper

---

## Files Modified / Created

### Created
- `src/core/database/sync.repository.ts` — Base class for sync-aware repositories

### To Modify (Later Steps)
- All syncable table repositories (extend SyncRepository)
- All write services (use sync methods)
- Migrations (add sync columns, indexes)
- CLAUDE.md (sync write contract documentation)
