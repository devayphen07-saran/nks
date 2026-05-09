# Sync Implementation Status — 2026-05-04

**Overall Progress:** Phases 1-5 COMPLETE, Phase 6 STARTED

---

## ✅ Phase 5: Auth / Device Integration — COMPLETE

**Files Created:**
- `src/contexts/iam/auth/repositories/devices.repository.ts` — Device CRUD
- `src/contexts/iam/auth/services/device/device-registration.service.ts` — Business logic
- `src/contexts/iam/auth/services/device/device-registration-flow.service.ts` — Orchestration
- `src/contexts/iam/auth/services/device/index.ts` — Barrel export

**Files Modified:**
- `src/contexts/iam/auth/controllers/auth.controller.ts` — Added login hook + POST /auth/switch-store
- `src/contexts/iam/auth/services/session/session-command.service.ts` — Added updateActiveStore()
- `src/contexts/iam/auth/services/session/session-query.service.ts` — Added findSessionByIdString()
- `src/contexts/iam/auth/auth.module.ts` — Added device services to providers

**Key Features:**
- Device registration as login side-effect (fire-and-forget)
- Store switch updates device registration (UPSERT pattern)
- X-Device-Id header support
- Session activeStoreFk tracking
- DeviceAuthGuard preparation (for Phase 4 finalization)

**TypeScript Status:** ✅ All errors resolved (3 pre-existing sync context errors remain)

---

## 🚀 Phase 6: Web Write-Path Conformance — IN PROGRESS

**Status:** Foundation layer complete. Ready for repository conversions.

### Completed (Step 1)

**File Created:**
- `src/core/database/sync-base.repository.ts` — Base class with sync-aware write methods

**Methods:**
- `insertOneSync(table, values, userId, tx)` — Creates with version=1, createdByDevice=null
- `updateOneSync(table, set, where, userId, tx)` — Increments version, sets updated_at=NOW()
- `softDeleteSync(table, where, userId, tx)` — Soft deletes with version++, increments version

**Documentation:**
- `PHASE6_WEB_WRITE_CONFORMANCE.md` — Complete implementation guide
- Full audit checklist
- Testing strategy
- Example code patterns

**TypeScript Status:** ✅ Compiles without errors

### Next Steps (Steps 2-6)

1. **Audit Repositories** — Find syncable tables and identify repositories
2. **Convert Repositories** — Extend SyncBaseRepository instead of BaseRepository
3. **Update Write Services** — Ensure userId passed to all writes
4. **Update API Endpoints** — Verify PATCH/DELETE are correct
5. **Database Migrations** — Add sync columns, indexes, backfill
6. **Documentation** — Update CLAUDE.md with sync write contract

### Syncable Tables (Identified)

**Confirmed Syncable** (from Phase 8 plan):
- sales, sale_items
- customers
- payments
- products
- categories
- stock_movements

**Not Syncable** (read-only or system tables):
- users, roles, permissions (user management)
- stores (shared config)
- tax_* (read-only reference)
- lookups (read-only)

---

## Architecture Overview

```
Mobile Push
  ↓
/sync/push (POST)
  ↓
DeviceAuthGuard (validates device registration for current store)
  ↓
SyncService.applyOperation()
  ↓
BaseSyncHandler (create/update/delete dispatch)
  ↓
Domain Sync Handler (product, sale, customer, etc.)
  ↓
Version check + apply in transaction
  ↓
Idempotency cache (save terminal result only)

Web Write
  ↓
API endpoint (POST /products, PATCH /products/:id, DELETE /products/:id)
  ↓
AuthGuard + permissions
  ↓
Service layer
  ↓
Repository.updateOneSync() [new]
  ↓
Increment version, set updated_at, set modified_by
  ↓
Database update

Mobile Pull
  ↓
/sync/pull (GET)
  ↓
DeviceAuthGuard
  ↓
SyncService.pullEntity()
  ↓
BaseSyncHandler.getChangesSince()
  ↓
Query: (updated_at > cursor OR (updated_at = cursor AND id > cursorId))
  ↓
Compound cursor pagination
  ↓
Returns changes + next_cursor
```

---

## Phase 6 Implementation Checklist

### Per-Table Tasks

For each syncable table:
- [ ] Schema uses `...syncColumns()` (version, createdByDevice)
- [ ] Schema uses `...auditFields()` (createdBy, createdAt, modifiedBy, updatedAt, deletedBy, deletedAt, isActive)
- [ ] Migration adds compound index: `(updated_at ASC, id ASC)`
- [ ] Repository extends `SyncBaseRepository`
- [ ] create() uses insertOneSync()
- [ ] update() uses updateOneSync()
- [ ] delete() uses softDeleteSync()
- [ ] Service passes userId to all writes
- [ ] DELETE endpoint calls delete (soft delete)

### Phase 6 Scope

**Syncable Tables to Convert:**
1. products
2. customers
3. sales + sale_items
4. payments
5. stock_movements
6. categories

---

## Files Modified/Created in Phase 6 (So Far)

### Created
- `src/core/database/sync-base.repository.ts` (180 lines)
- `PHASE6_WEB_WRITE_CONFORMANCE.md` (350+ lines)
- `SYNC_STATUS_2026-05-04.md` (this file)

### To Modify (Next)
- All syncable table repositories (extend SyncBaseRepository)
- All write services (use sync methods)
- Migrations (add sync columns, backfill)
- CLAUDE.md (sync write contract)

---

## Key Design Decisions

### Version Increments
- Every write increments version: (create → 1, update → 2, delete → 3, etc.)
- Mobile detects conflicts: if client's expected_version != server.version → 409 Conflict
- Web doesn't validate version (online-only, no conflicts)

### Soft Deletes Only
- No hard DELETE at application layer
- DELETE endpoint → soft delete (deleted_at=NOW(), is_active=false)
- Tombstone GC scheduler (Phase 2) hard-deletes after 90 days

### Audit Trail
- createdBy, createdAt — set at insert
- modifiedBy, updatedAt — set at every write
- deletedBy, deletedAt — set at soft delete
- All writes require userId for attribution

### Pull Cursor Ordering
- Compound cursor: `(updated_at ASC, id ASC)`
- Prevents skipping rows with same updated_at
- Mobile uses cursor to resume on reconnect

---

## Next Session Plan

1. **Identify all syncable tables** in codebase
2. **Convert 2-3 repositories** to SyncBaseRepository (e.g., products, customers)
3. **Test one full flow** — web write → version increment → mobile pull detects
4. **Generate migrations** for sync columns + indexes
5. **Document CLAUDE.md** with sync write contract

**Estimated Effort:** 2-3 hours for full Phase 6 (all 6 tables)

---

## References

- **Phase 6 Guide:** `PHASE6_WEB_WRITE_CONFORMANCE.md`
- **Sync Plan:** `future-implementation/sync-implementation-plan.md`
- **SyncBaseRepository:** `src/core/database/sync-base.repository.ts`
- **Previous Status:** `SYNC_COMPLETION_STATUS.md` (Phase 1-5)
