# Offline Sync Implementation: Quick Reference

**Date:** 2026-04-17 | **Status:** 18% Complete | **Docs:** 4 comprehensive guides

---

## The One-Sentence Problem

**Architecture is 100% documented and proven, but only 18% implemented.** Push handler is a stub, 7 of 9 table handlers missing, 8 of 9 backend pull queries missing.

---

## What's Implemented ✅

| Component | Status |
|---|---|
| Pull sync orchestration (GET /sync/changes framework) | ✅ Complete |
| Push sync orchestration (POST /sync/push framework) | ✅ Complete |
| Routes table pull (backend query) | ✅ Complete |
| State + District table handlers (mobile) | ✅ Complete |
| Offline session validation (HMAC + JWT) | ✅ Complete |
| Crash recovery (resetStuck) | ✅ Complete |
| Write guard (permission checks) | ✅ Complete |
| Sync status tracking | ✅ Complete |

---

## What's Missing ❌

| Layer | Component | Impact |
|---|---|---|
| **Backend Pull** | 8 table queries (stores, status, perms, tax, hours, state, district) | Reference data not synced |
| **Backend Push** | Operation handler (stub → no-op) | All offline writes lost |
| **Mobile Handlers** | 7 of 9 table handlers | Data fetched but not stored |
| **Mobile Bug** | Role filtering in persist-login.ts | Multi-store privilege escalation |

---

## Failure Scenarios

### User Creates Sale Offline
```
✅ Enqueued to local queue
❌ Sent to server POST /sync/push
❌ Server handler is stub (logs warning, skips)
❌ Sale NOT inserted into database
❌ Operation stuck in queue, retried forever
❌ USER DATA LOST
```

### Routes Sync to Mobile
```
✅ Backend fetches 20 routes
❌ Mobile has NO handler for 'routes' table
❌ Routes received but not stored in SQLite
❌ Routes table empty
❌ Offline POS mode blocked (missing critical tables)
```

### User Offline in Store B with Store A Role
```
✅ User A logs in, gets all roles (store A + store B)
❌ persist-login.ts doesn't filter by activeStoreId
❌ Offline session saved with BOTH store roles
❌ User offline in store B
❌ Can use store A's MANAGER permission in store B
❌ PRIVILEGE ESCALATION
```

---

## Critical Bugs

| Bug | Location | Fix | Risk |
|---|---|---|---|
| Push handler stub | `sync.service.ts` line 228-237 | Add operation handlers | 🔴 CRITICAL |
| Routes handler missing | `sync-table-handlers.ts` | Add routes handler | 🔴 CRITICAL |
| Role filtering missing | `persist-login.ts` | Filter by activeStoreId | 🔴 CRITICAL |
| Entity permissions never synced | `sync.repository.ts` | Add getEntityPermissionsChanges() | 🔴 CRITICAL |

---

## Files to Review

### Architecture Docs (Already Complete)
```
lib/database/docs/OFFLINE_SYNC_ARCHITECTURE.md
  ├─ 10-section complete architecture design
  ├─ Pull sync strategy (per-table cursors)
  ├─ Push sync with idempotency
  ├─ Offline queue system
  ├─ Conflict resolution
  ├─ Production deployment
  └─ Trade-off analysis
```

### Audit Docs (THIS SESSION)
```
lib/database/docs/SYNC_IMPLEMENTATION_AUDIT.md
  ├─ 18% complete assessment
  ├─ What's working
  ├─ What's missing
  ├─ Backend gaps
  ├─ Mobile gaps
  └─ 41-hour completion estimate

lib/database/docs/SYNC_CURRENT_FAILURES.md
  ├─ 10 test scenarios showing what breaks
  ├─ Expected vs actual behavior
  ├─ Data loss scenarios
  ├─ Security issues
  └─ Production blocking issues

lib/database/docs/SYNC_COMPLETION_ROADMAP.md
  ├─ 2-week timeline
  ├─ Priority order (routes first)
  ├─ Code locations to modify
  ├─ 39-hour effort breakdown
  └─ Validation checklist
```

---

## Implementation Priority

### Must Do First (Days 1-2)
1. **Routes handler (mobile)** — 2 hours
   - File: `lib/sync/sync-table-handlers.ts`
   - Add: `routes: { onUpsert, onDelete }`
   
2. **Fix role filtering (backend)** — 1 hour
   - File: `store/persist-login.ts`
   - Filter: `roles.filter(r => r.storeId === activeStoreId || r.storeId === null)`

3. **Routes push handler (backend)** — 3 hours
   - File: `src/modules/sync/sync.service.ts`
   - Add: `handleRoutePush()` method

### Then Do (Days 2-3)
4. **State + district pull (backend)** — 2 hours
   - File: `src/modules/sync/repositories/sync.repository.ts`
   - Add: `getStateChanges()`, `getDistrictChanges()`

5. **Entity permissions pull (backend)** — 1 hour
   - File: `sync.repository.ts`
   - Add: `getEntityPermissionsChanges()`

### Then Complete (Days 3-5)
6. **Remaining 6 tables** — 20 hours
   - Mobile handlers: stores, status, entity_status_mapping, tax_rate_master, store_operating_hours
   - Backend pull queries for same
   - Backend push handlers for mutable tables

7. **Optimization** — 4 hours
   - Transaction wrapping for upserts
   - Backend index creation
   - Lookup sync atomicity

8. **Testing** — 6 hours
   - End-to-end scenarios
   - Crash recovery
   - Large initial sync

---

## Quick Implementation Checklist

### Backend Pull (Add to sync.repository.ts)
```
❌ getRouteChanges()          ← Already exists
❌ getStateChanges()
❌ getDistrictChanges()
❌ getStoreChanges()
❌ getStatusChanges()
❌ getEntityStatusMappingChanges()
❌ getEntityPermissionsChanges()
❌ getTaxRateMasterChanges()
❌ getStoreOperatingHoursChanges()

Template:
async getXxxChanges(cursorMs: number, limit: number) {
  return this.db
    .select({ ... })
    .from(schema.xxx)
    .where(gt(schema.xxx.updatedAt, new Date(cursorMs)))
    .orderBy(schema.xxx.updatedAt)
    .limit(limit + 1);
}
```

### Mobile Handlers (Add to sync-table-handlers.ts)
```
❌ routes         ← HIGH PRIORITY
❌ stores
❌ status
❌ entity_status_mapping
❌ entity_permissions
❌ tax_rate_master
❌ store_operating_hours
✅ state
✅ district

Template:
tableName: {
  async onUpsert(id, data) {
    const row = {
      id,
      db_field: data.apiField,
      // ... map all fields
    };
    await repository.upsert(row);
  },
  async onDelete(id) {
    await repository.delete(id);
  }
}
```

### Backend Push Handlers (Add to sync.service.ts)
```
❌ handleRoutePush()
❌ handleStoresPush()
❌ handleStatusPush()
❌ handleEntityStatusMappingPush()
❌ handleEntityPermissionsPush()
❌ handleTaxRateMasterPush()
❌ handleStoreOperatingHoursPush()

Template:
private async handleXxxPush(
  op: SyncOperation,
  userId: number,
  activeStoreId: number,
  tx: Db
): Promise<void> {
  if (op.op === 'CREATE') {
    // validate, check permissions, INSERT
  } else if (op.op === 'UPDATE') {
    // check version, UPDATE, increment version
  } else if (op.op === 'DELETE') {
    // check permissions, DELETE or soft-delete
  }
}
```

---

## Testing Commands

### Verify Mobile Handler Exists
```bash
grep -n "routes:" lib/sync/sync-table-handlers.ts
# Should show routes handler in TABLE_HANDLERS
```

### Verify Backend Pull Query
```bash
grep -n "getRouteChanges\|getStateChanges" src/modules/sync/repositories/sync.repository.ts
# Should show both methods
```

### Verify Handler is Called
```bash
grep -n "processOperation" src/modules/sync/sync.service.ts | head -3
# Should NOT be: this.logger.warn("No handler registered...")
```

### Test Offline Write (End-to-End)
```
1. Mobile: enqueue('CREATE', 'routes', data)
2. Mobile: runSync(storeId)
3. Check: returns { processed: 1 }
4. Check: backend database has new route
5. Check: queue row marked as 'synced'
```

---

## Success Criteria

✅ **Sync works when:**
1. Routes sync both directions (pull + push)
2. State + district sync pull (backend)
3. Critical tables have pull queries (permissions, tax)
4. Operation handler is NOT a stub
5. User write → queue → server → database (end-to-end)
6. No data loss on crash (resetStuck works + operations process)
7. Offline POS mode can engage (all critical tables > 0)
8. No multi-store privilege escalation

---

## Key Files Reference

### Backend
```
src/modules/sync/sync.controller.ts          (HTTP routing) ✅
src/modules/sync/sync.service.ts             (50% complete) ⚠️
src/modules/sync/repositories/sync.repository.ts  (10% complete) ⚠️
```

### Mobile
```
lib/sync/sync-engine.ts                      (100% complete) ✅
lib/sync/sync-table-handlers.ts              (18% complete) ⚠️
lib/sync/sync-status.ts                      (100% complete) ✅
lib/utils/write-guard.ts                     (100% complete) ✅
store/persist-login.ts                       (has bug) ❌
```

---

## Why This Matters

**Current state:**
- Mobile appears to sync offline, but data disappears
- Users think they're working offline, but changes never reach the server
- Offline POS mode won't engage
- Privilege escalation possible across stores
- Production deployment blocked

**After completion:**
- True offline-first capability
- All offline writes sync reliably
- Multi-store data isolation enforced
- Crash-safe and resumable
- Production ready

---

## Questions to Ask Before Coding

1. **Do all repositories have .upsert() and .delete() methods?**
   - Check: `/lib/database/repositories/`

2. **What's the exact API response format for each table?**
   - Check: Backend DTOs in `sync/dto/responses/`

3. **Which tables are mutable (need push handlers) vs read-only?**
   - Likely mutable: routes, stores, tax_rate_master, store_operating_hours
   - Likely read-only: state, district, status, entity_permissions

4. **Are there version fields for conflict detection?**
   - Check: Backend schema files

5. **What's the store scoping rule for entity_permissions?**
   - Global (storeId = null) or per-store (storeId = value)?

---

## One More Thing: The Role Filtering Bug

**Current code (WRONG):**
```typescript
// persist-login.ts
roles: authResponse.access.roles.map((r) => r.roleCode)
```

**What it does:**
- Takes ALL roles from server response
- Stores in offline session
- User can use any role in any store

**What it should do:**
```typescript
// persist-login.ts (FIXED)
roles: authResponse.access.roles
  .filter(r => r.storeId === authResponse.access.activeStoreId || r.storeId === null)
  .map(r => r.roleCode)
```

**Why it matters:**
- Security: prevents privilege escalation across stores
- Correctness: matches actual user permissions
- Critical: must fix BEFORE going to production

---

## Document Guidance

1. **Start here** (you are reading it) — Quick overview
2. **Read SYNC_CURRENT_FAILURES.md** — Understand what breaks
3. **Read SYNC_IMPLEMENTATION_AUDIT.md** — Detailed gap analysis
4. **Read SYNC_COMPLETION_ROADMAP.md** — Timeline & implementation plan
5. **Reference OFFLINE_SYNC_ARCHITECTURE.md** — Full design details

---

## Effort Summary

| Phase | Days | Effort | Deliverable |
|---|---|---|---|
| Routes (both directions) | 2 | 8 hrs | Mobile offline writes working |
| State + District + Permissions | 1.5 | 4 hrs | Reference data syncing |
| Remaining 5 tables | 2.5 | 12 hrs | Full offline POS capability |
| Optimization + Testing | 2 | 11 hrs | Production ready |
| **TOTAL** | **8 days** | **~35 hrs** | **Fully functional offline-first POS** |

---

**Last Updated:** 2026-04-17  
**Next Review:** After first table is completed  
**Owner:** Mobile + Backend teams
