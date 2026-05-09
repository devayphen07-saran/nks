# Sync Write Contract (Phase 6)

**Status:** Phase 6 — Web Write-Path Conformance

This document specifies the contract that ALL web/admin writes on syncable tables MUST follow for mobile offline-first sync to work correctly.

---

## Overview

Syncable tables are those that:
1. Have `...syncColumns()` in schema (version, createdByDevice)
2. Have `...auditFields()` in schema (createdBy, createdAt, modifiedBy, updatedAt, deletedBy, deletedAt, isActive)
3. Will be edited offline on mobile and need to sync with the server

Current syncable tables (planned):
- products
- customers
- sales, sale_items
- payments
- stock_movements
- categories

Reference tables (read-only, NOT syncable):
- users, roles, permissions
- stores
- tax_*
- lookups

---

## Write Contract

### On CREATE

When a web/admin user creates a row:

```
version: 1                              ← Start at 1
created_by_device: NULL                 ← Web origin (not device)
created_by: current_user_id             ← Who created
created_at: NOW()                       ← When created
modified_by: current_user_id            ← Same as creator
updated_at: NOW()                       ← For pull cursor ordering
is_active: true                         ← Default active
deleted_at: NULL                        ← Not deleted
```

**Code Pattern:**
```typescript
// Repository
return this.insertOneSync(schema.table, data, userId, tx);

// Automatically sets: version=1, createdByDevice=null, createdBy, createdAt, modifiedBy, updatedAt
```

### On UPDATE

When a web/admin user updates a row:

```
version: version + 1                    ← Increment for conflict detection
modified_by: current_user_id            ← Who modified
updated_at: NOW()                       ← Pull cursor updates
```

**All other fields remain as-is.** Do NOT change created_by, created_at, or created_by_device.

**Code Pattern:**
```typescript
// Repository
return this.updateOneSync(schema.table, data, where, userId, tx);

// Automatically sets: version++, modifiedBy, updatedAt
// Current version is fetched from DB before update (for increment)
```

### On DELETE

When a web/admin user deletes a row: **SOFT DELETE ONLY. No hard DELETE.**

```
deleted_at: NOW()                       ← Soft delete marker
deleted_by: current_user_id             ← Who deleted
is_active: false                        ← Status flag
version: version + 1                    ← Increment (marks as modified)
modified_by: current_user_id            ← Track the delete
updated_at: NOW()                       ← Pull cursor sees as modified
```

**Code Pattern:**
```typescript
// Repository
return this.softDeleteSync(schema.table, where, userId, tx);

// Automatically sets: deletedAt, deletedBy, isActive=false, version++, modifiedBy, updatedAt
```

---

## Why Version Matters

Mobile clients detect conflicts using version:

1. **Offline edit** on mobile: product.version = 1
2. **Server receives push** from mobile with `expected_version: 1`
3. **Server applies** the change successfully: version = 2
4. **Mobile pulls** the updated row: sees version = 2 (conflict resolved ✅)

But if:

1. **Web updates** the same row while mobile is offline: version = 2
2. **Mobile tries to push** with `expected_version: 1`
3. **Server rejects** (version mismatch): conflict status returned (409 Conflict)
4. **Mobile fetches** server_state from response, user resolves manually

**Without version tracking, silent conflicts occur.**

---

## Database Requirements

Every syncable table MUST have:

1. **Sync columns** (spread `...syncColumns()`):
   - `version INTEGER NOT NULL DEFAULT 1`
   - `created_by_device TEXT` (nullable, for attribution)

2. **Audit columns** (spread `...auditFields()`):
   - `created_by BIGINT FK users.id` (who created)
   - `created_at TIMESTAMPTZ` (when created)
   - `modified_by BIGINT FK users.id` (last editor)
   - `updated_at TIMESTAMPTZ` (last edit time)
   - `deleted_by BIGINT FK users.id` (who deleted, nullable)
   - `deleted_at TIMESTAMPTZ` (soft delete time, nullable)
   - `is_active BOOLEAN DEFAULT true` (soft delete flag)

3. **Compound index for pull cursor**:
   ```sql
   CREATE INDEX <table>_updated_at_id_idx ON <table>(updated_at ASC, id ASC);
   ```
   This enables efficient compound cursor pagination without row skipping.

---

## Repository Implementation

For all syncable tables:

**Extend SyncBaseRepository, not BaseRepository:**
```typescript
import { SyncBaseRepository } from '../../../../core/database/sync-base.repository';

@Injectable()
export class MyTableRepository extends SyncBaseRepository {
  // ... queries remain unchanged ...

  async create(data, userId, tx?) {
    return this.insertOneSync(schema.myTable, data, userId, tx);
  }

  async update(id, data, userId, tx?) {
    return this.updateOneSync(schema.myTable, data, where, userId, tx);
  }

  async delete(id, userId, tx?) {
    return this.softDeleteSync(schema.myTable, where, userId, tx);
  }
}
```

**Key rules:**
- All write methods return the updated row (or null if not found)
- All write methods accept `tx` for transaction support
- All write methods require `userId` for audit trail
- Query methods are unchanged (use standard Drizzle queries)

---

## API Endpoint Pattern

Endpoints follow standard NestJS patterns, with one rule:

**DELETE endpoint must call soft delete, never hard delete:**

```typescript
// ✅ CORRECT: Soft delete
@Delete(':id')
async deleteProduct(@Param('id') id: string, @CurrentUser() user: SessionUser) {
  const result = await this.service.delete(id, user.activeStoreId, user.userId);
  if (!result) throw new NotFoundException();
}

// Service.delete calls repo.softDeleteSync() — row is marked deleted, not removed
```

**❌ DO NOT:**
```typescript
// Hard delete is FORBIDDEN
@Delete(':id')
async deleteProduct(@Param('id') id: string) {
  await this.db.delete(schema.product).where(eq(schema.product.id, id));
  // ❌ This breaks mobile sync! Deleted row must remain in DB with deleted_at set
}
```

---

## Updating PATCH Endpoints

PATCH endpoints can optionally validate version (for future client-side conflict detection):

```typescript
// Optional: Include version in update DTO for explicit conflict checking
export class UpdateProductDto {
  name?: string;
  version?: number;  // Client's expected version
}

// Service: Validate if provided
async update(id: string, dto: UpdateProductDto, storeId: number, userId: number) {
  const current = await this.repo.findById(id, storeId);
  
  // Optional version validation (for future web conflict UI)
  if (dto.version && dto.version !== current.version) {
    throw new ConflictException({
      reason: 'Version mismatch',
      serverVersion: current.version,
      serverState: current,
    });
  }

  return this.repo.update(id, dto, userId);
}
```

**Web doesn't need version checking (online-only).** This is for future extensibility.

---

## Audit Trail

Every write creates audit entries:

| Operation | created_by | created_at | modified_by | updated_at | deleted_by | deleted_at | is_active |
|-----------|-----------|-----------|-----------|-----------|-----------|-----------|-----------|
| CREATE | ✅ | ✅ | ✅ | ✅ | NULL | NULL | true |
| UPDATE | (unchanged) | (unchanged) | ✅ | ✅ | NULL | NULL | true |
| DELETE | (unchanged) | (unchanged) | ✅ | ✅ | ✅ | ✅ | false |

This enables full audit history: who created, when; who last modified, when; who deleted, when.

---

## Migration Checklist

For each syncable table:

- [ ] Schema includes `...syncColumns()` and `...auditFields()`
- [ ] Migration includes compound index: `(updated_at ASC, id ASC)`
- [ ] For existing tables: backfill version=1, createdByDevice=null
- [ ] Repository extends SyncBaseRepository
- [ ] create() → insertOneSync()
- [ ] update() → updateOneSync()
- [ ] delete() → softDeleteSync()
- [ ] All writes pass userId
- [ ] DELETE endpoint calls soft delete
- [ ] Response DTO includes version field
- [ ] Tests verify version increments

---

## Testing

### Unit Tests
```typescript
it('should create with version=1', async () => {
  const row = await repo.create(data, userId);
  expect(row.version).toBe(1);
  expect(row.createdByDevice).toBeNull();
  expect(row.createdBy).toBe(userId);
});

it('should increment version on update', async () => {
  const created = await repo.create(data, userId);
  const updated = await repo.update(created.id, { name: 'new' }, userId);
  expect(updated.version).toBe(2);
});

it('should soft delete with version++', async () => {
  const created = await repo.create(data, userId);
  const deleted = await repo.delete(created.id, userId);
  expect(deleted.deletedAt).not.toBeNull();
  expect(deleted.isActive).toBe(false);
  expect(deleted.version).toBe(2);
});
```

### Integration Tests
- Create row → pull → version=1 ✅
- Update row → pull → version=2, updated_at updated ✅
- Delete row → pull → operation=delete returned ✅

---

## SyncBaseRepository Methods

Located at: `src/core/database/sync-base.repository.ts`

### insertOneSync(table, values, userId, tx?)
Creates a row with version=1, createdByDevice=null, audit columns set.

```typescript
const row = await repo.insertOneSync(schema.product, 
  { name: 'Widget', price: 99.99, storeFk: 1 }, 
  userId
);
// row: { id, version: 1, createdByDevice: null, createdBy: userId, createdAt, modifiedBy, updatedAt, ... }
```

### updateOneSync(table, set, where, userId, tx?)
Updates a row, incrementing version, setting updated_at=NOW(), modifiedBy=userId.

```typescript
const row = await repo.updateOneSync(schema.product,
  { name: 'Updated Widget' },
  eq(schema.product.id, 'abc-123'),
  userId
);
// row: { ...prev, version: (prev.version + 1), modifiedBy: userId, updatedAt: NOW(), ... }
// Returns null if WHERE matches nothing
```

### softDeleteSync(table, where, userId, tx?)
Soft deletes a row: sets deletedAt, isActive=false, increments version.

```typescript
const row = await repo.softDeleteSync(schema.product,
  eq(schema.product.id, 'abc-123'),
  userId
);
// row: { ...prev, deletedAt: NOW(), deletedBy: userId, isActive: false, version: (prev.version + 1), ... }
// Returns null if WHERE matches nothing
```

---

## Common Mistakes

1. **Using BaseRepository instead of SyncBaseRepository** → Version not auto-incremented
2. **Hard DELETE in endpoints** → Breaks mobile sync (row must stay in DB with deleted_at)
3. **Forgetting to pass userId** → Audit trail incomplete (modified_by = NULL)
4. **Creating rows with version != 1** → Mobile detects wrong initial state
5. **Not having compound index** → Pull queries slow or incorrect
6. **Updating created_by or created_at** → Breaks audit trail
7. **Not marking rows as version=1 in backfill** → Mobile sees inconsistent state

---

## Future Extensions (After Phase 6)

**Phase 7+ (Mobile):**
- Mobile sends `expected_version` on push
- Server validates: if mismatch → 409 Conflict with server_state
- Mobile UI shows conflict, user picks one

**Phase 6+ (CI):**
- Add static check: flag any UPDATE/DELETE not using sync methods
- Enforce: all writes include userId
- Enforce: DELETE endpoint must be soft delete

---

## References

- **SyncBaseRepository:** `src/core/database/sync-base.repository.ts`
- **Implementation Template:** `PHASE6_IMPLEMENTATION_TEMPLATE.md` (when written)
- **Sync Plan:** `future-implementation/sync-implementation-plan.md`
- **Phase 6 Guide:** `PHASE6_WEB_WRITE_CONFORMANCE.md`
