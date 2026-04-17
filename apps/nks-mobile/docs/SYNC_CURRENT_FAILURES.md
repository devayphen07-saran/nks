# Current Sync Failures & Test Scenarios

**Date:** 2026-04-17  
**Status:** Production Testing Blocked

---

## Test Scenario 1: User Creates a Sale Offline

### Setup
```
1. User is offline
2. Creates a sale: { items: [...], total: 450, storeId: 'abc-123' }
3. Operation queued: { op: 'CREATE', entity: 'sales', ... }
4. Queue shows: "1 pending"
```

### Expected Behavior
```
1. User comes online
2. Sync triggers
3. Mobile sends: POST /sync/push { operations: [{ op: 'CREATE', entity: 'sales', ... }] }
4. Server processes operation → inserts sale → returns { processed: 1 }
5. Mobile: markSynced() → deletes queue row
6. Sale appears in backend database ✅
```

### Actual Behavior
```
1. User comes online
2. Sync triggers
3. Mobile sends: POST /sync/push { operations: [{ op: 'CREATE', entity: 'sales', ... }] }
4. Server receives operation
5. processOperation() called with table='sales'
6. No handler found → logs warning → returns (no-op)
7. Server returns { processed: 0 }
8. Mobile: sees processed=0 → resetToRetry() → operation back to 'pending'
9. next_retry_at set to 30 seconds from now
10. Sale is NOT in backend database ❌
11. Next sync cycle: same operation sent again
12. Loop repeats forever — sale never synced
```

### Result
🔴 **FAILURE** — User's offline work is lost

---

## Test Scenario 2: Routes Not Syncing on Mobile

### Setup
```
1. Fresh app install
2. User logs in
3. Backend has 20 routes
4. sync-status: cursor:routes = 0 (never synced)
5. Call: isReadyForOffline() → includes routes in required list
```

### Expected Behavior
```
1. runSync() pulls changes
2. Dispatch routes changes to routesRepository.upsert()
3. Routes stored in SQLite
4. cursor:routes advances to latest timestamp
5. Routes available offline
6. isReadyForOffline() returns { ready: true }
7. User can enter offline POS mode ✅
```

### Actual Behavior
```
1. runSync() pulls changes
2. Server response: { changes: [{ table: 'routes', id: 1, ... }, ...] }
3. Mobile iterates: for (const change of changes) {
     dispatch to TABLE_HANDLERS[change.table]
   }
4. TABLE_HANDLERS['routes'] = undefined
5. No handler found → operation silently skipped
6. Routes are fetched but NOT stored in SQLite
7. cursor:routes stays = 0
8. SQLite routes table is empty
9. isReadyForOffline() returns { ready: false, missing: ['routes'] }
10. User is BLOCKED from offline POS mode ❌
```

### Result
🔴 **FAILURE** — Offline POS mode cannot engage

---

## Test Scenario 3: State Table Synced on Mobile, Not on Backend

### Setup
```
1. Mobile has handler for state ✅
2. Backend has query for routes ✅
3. Backend has NO query for state ❌
```

### Expected Behavior
```
1. Mobile: GET /sync/changes?tables=state,routes&cursor=0
2. Server returns state changes + route changes
3. Mobile stores both
4. State table and routes table populated ✅
```

### Actual Behavior
```
1. Mobile: GET /sync/changes?tables=state,routes&cursor=0
2. Server queries:
   - getRouteChanges() ✅
   - getStateChanges() → method doesn't exist ❌
3. Server returns only route changes (skips state)
4. Mobile stores routes ✅
5. Mobile stores no state (not in response) ❌
6. State table remains empty
7. Mobile handler for state never called
8. cursor:state = 0 forever
```

### Result
🔴 **FAILURE** — Reference data incomplete

---

## Test Scenario 4: Permission Check Blocks Offline Write

### Setup
```
1. User has role: CASHIER
2. Required permission: entity_permissions has no rows
   (permissions not synced or cursor:entity_permissions = 0)
3. User tries to create a sale offline
```

### Expected Behavior
```
1. assertWriteAllowed(['CASHIER']) called
2. Checks: arePermissionsLoaded() → returns true ✅
3. Checks: JWKS fresh → returns true ✅
4. Checks: offline token valid → returns true ✅
5. Checks: role CASHIER exists → found ✅
6. Write allowed → continue ✅
```

### Actual Behavior
```
1. assertWriteAllowed(['CASHIER']) called
2. Checks: arePermissionsLoaded()
   → queries: SELECT * FROM entity_permissions WHERE entity='sales' AND role='CASHIER'
   → table is empty (never synced)
   → returns false ❌
3. Throws: PermissionsNotLoadedError("Please sync first")
4. Write blocked ❌
5. User cannot work offline even though they should have permissions ❌
```

### Result
🔴 **FAILURE** — Offline work impossible even when permissions exist online

---

## Test Scenario 5: Tax Rates Missing for Offline POS

### Setup
```
1. User enters POS screen
2. Tries to create sale with tax calculation
3. Tax rates not synced (isReadyForOffline includes tax_rate_master)
```

### Expected Behavior
```
1. isReadyForOffline() checks critical tables
2. tax_rate_master in CRITICAL_TABLES
3. cursor:tax_rate_master should be > 0
4. If > 0: ready = true ✅
5. If = 0: ready = false, missing = ['tax_rate_master']
6. Show: "Please sync to enable offline mode"
```

### Actual Behavior
```
1. Backend has tax_rate_master table
2. Backend has NO sync query for tax rates
3. Mobile cannot request tax rate changes
4. cursor:tax_rate_master stays = 0
5. isReadyForOffline() returns false
6. User blocked from offline POS mode
7. Error message: "Missing: tax_rate_master"
```

### Result
🔴 **FAILURE** — Offline POS blocked indefinitely

---

## Test Scenario 6: Crash During Sync

### Setup
```
1. Device has 5 mutations in queue: { status: ['pending', 'pending', 'pending', 'in_progress', 'in_progress'] }
2. runSync() starts
3. Finds batch of 5 mutations
4. markInProgress([1,2,3,4,5])
5. Sends: POST /sync/push { operations: [...] }
6. Network timeout (socket disconnect) mid-transfer
7. Server never receives request
8. App crashes (killed by OS or user force-quit)
```

### Expected Behavior
```
1. App restarts
2. initializeSyncEngine() called
3. resetStuck() finds mutations with status='in_progress'
4. Flips back to 'pending': status='in_progress' → 'pending'
5. next_retry_at set to null (ready immediately)
6. Next sync cycle resends them
7. No data loss ✅
```

### Actual Behavior (Current)
```
1. App restarts
2. initializeSyncEngine() called ✅
3. resetStuck() called ✅
4. Mutations flipped back to 'pending' ✅
5. Next sync cycles and resends them ✅
6. BUT: operations still go to processOperation() stub
7. Server returns { processed: 0 } ❌
8. Operations stay in queue forever (backoff keeps escalating)
9. Max retries exceeded → marked quarantined
10. Data LOST in quarantine (never synced) ❌
```

### Result
🟡 **PARTIAL FAILURE** — Crash recovery works, but data still lost at server

---

## Test Scenario 7: Store Isolation Not Enforced

### Setup
```
1. User A: belongs to store A only
2. User B: belongs to store B only
3. User B offline, creates sale in store A (shouldn't be allowed)
```

### Expected Behavior
```
1. User B tries: enqueueAndPush('CREATE', 'sales', { storeId: 'store-a', ... })
2. Mobile assertWriteAllowed() checks
3. Server: POST /sync/push receives operation
4. Server calls: handleSalePush(op, userB, storeB)
5. Handler checks: op.storeId (store-a) !== userB.activeStoreId (store-b)
6. Rejects operation → quarantines
7. Sale not created in store A ✅
8. User B can only write to their own store ✅
```

### Actual Behavior
```
1. User B offline → creates operation
2. Mobile queues it (no validation, assumes online check will happen)
3. User goes online, syncs
4. POST /sync/push sent
5. handleSalePush() DOESN'T EXIST (stub)
6. Server returns { processed: 0 }
7. Operation stuck in queue forever
8. No security check happens (handler is missing)
9. Even if handler existed, timing attack possible: operation shows store-a ownership
```

### Result
🔴 **FAILURE** — No store isolation enforcement

---

## Test Scenario 8: Idempotency Verification

### Setup
```
1. Sale created offline: { clientId: 'abc-123', op: 'CREATE', ... }
2. First sync: POST /sync/push sent
3. Server processes it
4. Network timeout: socket closes before 200 ACK
5. Client doesn't see response
6. Next sync: resends same operation
```

### Expected Behavior
```
1. First sync:
   → Server: isAlreadyProcessed('abc-123-xyz') → false
   → Processes: INSERT sale
   → logIdempotencyKey('abc-123-xyz')
   → Returns { processed: 1 }
   
2. Second sync (after crash):
   → Server: isAlreadyProcessed('abc-123-xyz') → true (from step 1)
   → Skips processing
   → Returns { processed: 1 } (counted as success anyway)
   
3. Result: Sale appears once in database ✅
```

### Actual Behavior
```
1. First sync:
   → Server: idempotencyLog table has no entry
   → Server: no handler for 'sales' table
   → Skips processing, returns { processed: 0 }
   → Never writes to idempotencyLog
   
2. Second sync:
   → Server: isAlreadyProcessed('abc-123-xyz') → false (no log entry)
   → Skips processing again (no handler)
   → Returns { processed: 0 } again
   
3. Problem: Idempotency relies on processOperation() being called
   If there's no handler, the operation is never logged as processed
   Future resends won't be deduplicated
```

### Result
🔴 **FAILURE** — Idempotency doesn't protect against missing handlers

---

## Test Scenario 9: Offline Session Permissions Stale

### Setup
```
1. User logs in: receives offlineToken + offline session signed with HMAC
2. Valid for 3 days
3. Administrator revokes user's CASHIER role (Day 2)
4. User still has offline session in their app
5. User tries to create sale offline on Day 3
```

### Expected Behavior
```
1. assertWriteAllowed(['CASHIER']) called
2. Checks: arePermissionsLoaded()
3. Loads: SELECT * FROM entity_permissions WHERE role='CASHIER'
4. Table was synced with new roles (revoked)
5. CASHIER permission row doesn't exist
6. Returns false → throws PermissionsNotLoadedError
7. Write blocked ❌ (correct behavior)
```

### Actual Behavior (Current)
```
1. assertWriteAllowed(['CASHIER']) called
2. Checks: arePermissionsLoaded()
3. entity_permissions table never synced (cursor=0)
4. Table is empty
5. Returns false → throws PermissionsNotLoadedError
6. Write blocked ✅ (but for wrong reason: never synced, not revoked)
```

### Result
🟡 **PARTIAL SUCCESS** — User is blocked, but only because perms never synced, not because they were revoked

---

## Test Scenario 10: Multi-Store Role Bleed

### Setup
```
1. User A has roles:
   - store-1: ['CASHIER', 'MANAGER']
   - store-2: ['CASHIER']
2. User A syncs while logged into store-1 activeStoreId
3. Offline session saved with all roles
4. User switches to store-2 (different store, different permissions)
5. User tries to use MANAGER permission offline (shouldn't have it in store-2)
```

### Expected Behavior
```
1. offlineSession loaded
2. Session created for activeStoreId='store-1'
3. Roles saved: filter to only roles scoped to store-1 or global
4. Store-2 specific roles NOT included ✅
5. User A offline in store-2:
   → assertWriteAllowed(['MANAGER'])
   → loads session
   → MANAGER not in session.roles
   → throws InsufficientRoleError ✅
6. User blocked from using store-1 role in store-2 ✅
```

### Actual Behavior (Per SYNC_ARCHITECTURE_AUDIT.md — Issue #4)
```
1. offlineSession saved with:
   roles: authResponse.access.roles.map(r => r.roleCode)  // NO FILTERING
2. ALL roles included, regardless of store scope
3. User A offline in store-2:
   → assertWriteAllowed(['MANAGER'])
   → loads session
   → MANAGER IS in session.roles (from store-1)
   → Write allowed ❌ (privilege escalation!)
4. User can use store-1 permissions in store-2 ❌
5. SECURITY ISSUE: Multi-store role bleed
```

### Result
🔴 **FAILURE** — Privilege escalation across stores (security bug)

---

## Critical Issues Summary

| Scenario | Issue | Impact | Severity |
|---|---|---|---|
| 1. Sale offline | Push handler stub | Data loss | 🔴 CRITICAL |
| 2. Routes mobile | No handler | Offline mode blocked | 🔴 CRITICAL |
| 3. State backend | No pull query | Reference data missing | 🔴 CRITICAL |
| 4. Permissions unsynced | No pull query | Offline write blocked | 🔴 CRITICAL |
| 5. Tax rates missing | No pull query | Offline POS blocked | 🔴 CRITICAL |
| 6. Crash recovery | Handler stub | Data lost in quarantine | 🔴 CRITICAL |
| 7. Store isolation | No handler validation | Privilege escalation | 🔴 CRITICAL |
| 8. Idempotency | Relies on handler | Duplicate syncs possible | 🟡 HIGH |
| 9. Stale permissions | Never synced | User can't work offline | 🔴 CRITICAL |
| 10. Role bleed | Roles unfiltered | Multi-store escalation | 🔴 CRITICAL |

---

## What Cannot Be Tested Until Fixed

❌ Offline POS mode
```
→ Blocked by: routes, stores, permissions, tax rates not syncing
→ Fix: Implement all 9 table handlers (mobile) + 9 pull queries (backend)
```

❌ Sales syncing to server
```
→ Blocked by: POST /sync/push handler is stub
→ Fix: Implement operation handlers for all mutable tables
```

❌ Multi-store functionality
```
→ Blocked by: Role filtering bug in persist-login.ts
→ Fix: Filter roles by activeStoreId before storing offline session
```

❌ Permission-based access control offline
```
→ Blocked by: entity_permissions never synced (no backend pull query)
→ Fix: Add getEntityPermissionsChanges() to backend
```

❌ Tax calculations offline
```
→ Blocked by: tax_rate_master never synced (no backend pull query)
→ Fix: Add getTaxRateMasterChanges() to backend
```

❌ Crash recovery validation
```
→ Works locally ✅
→ Fails server-side ❌ (data lost because handler is stub)
→ Fix: Implement all operation handlers
```

---

## Production Readiness Checklist

- [ ] All 9 tables syncing (pull + push where applicable)
- [ ] Routes fully working
- [ ] Offline POS mode can engage
- [ ] User writes actually reach server
- [ ] Crash recovery tested and working
- [ ] Permissions enforced (not escalatable)
- [ ] Store isolation working
- [ ] Idempotency tested
- [ ] Initial sync of 10k+ records works
- [ ] No data loss scenarios
- [ ] All 10 test scenarios above passing

---

## Blocking vs Non-Blocking Issues

### Blocking: Cannot Ship Without Fixing

1. Push handler stub (all operations lost)
2. Routes handler missing (offline mode blocked)
3. Critical table pull queries missing (reference data missing)
4. Role filtering bug (privilege escalation)

### Blocking: Before Full Rollout

1. All 9 table handlers (mobile)
2. All 9 table operation handlers (backend)
3. Store isolation enforcement
4. Permission sync and validation

### Non-Blocking: Should Fix in Next Sprint

1. Transaction wrapping for perf
2. Backend index on change_log
3. Lookup sync transaction atomicity
4. UNIQUE constraint on entity_permissions

---

## Next Immediate Actions

### Today
1. Read this document (you are here) ✓
2. Read SYNC_IMPLEMENTATION_AUDIT.md (gap analysis)
3. Read SYNC_COMPLETION_ROADMAP.md (timeline)

### This Sprint
1. Fix role filtering bug in persist-login.ts
2. Implement routes handler (mobile)
3. Implement routes push handler (backend)
4. PR and merge

### This Week
1. Implement state + district pull (backend)
2. Implement remaining 6 table handlers (mobile)
3. Implement remaining table push handlers (backend)

### Next Week
1. End-to-end testing
2. Staging validation
3. Load testing (10k+ records)
