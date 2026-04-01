# Pending Sync Table Design
## Senior Architect Framework Analysis

**Document Version:** 1.0
**Date:** 2026-04-01
**Scope:** Mobile offline-first sync queue table design
**Owner:** Mobile Team

---

## I. INTENT AUDIT

### A. Problem Space & Business Value

**Core Problem:**
Mobile app must create orders, sync data, and manage inventory **offline** without network connectivity. When network returns, all offline operations must sync reliably to backend without data loss or duplication.

**Users & Personas:**
- **Field Sales**: On-site at stores, intermittent connectivity
- **Store Managers**: Manage inventory in low-signal areas
- **Delivery Staff**: Route through areas with spotty coverage
- **POS Operators**: Operate offline during network outages

**Business Value:**
- 🎯 Zero data loss during offline operations
- 🎯 Seamless sync without user intervention
- 🎯 Reliable audit trail of all offline actions
- 🎯 Ability to detect and resolve conflicts
- 🎯 Better UX (no "your order failed" messages)

**Success Criteria:**
1. ✅ 100% of offline operations queued successfully
2. ✅ 99.9% sync success rate (batch retry on failure)
3. ✅ Zero duplicate orders after sync
4. ✅ Sync completes within 5 minutes of network recovery
5. ✅ Users can see pending operation count
6. ✅ Operations retain order (FIFO processing)

---

## II. THE AMBIGUITY FILTER

### A. Gaps & Contradictions

**Decision Table:**

| Ambiguity | Options | Recommended | Tradeoff |
|-----------|---------|-------------|----------|
| **Queue Strategy** | FIFO only, Priority-based, Dependency-aware | Dependency-aware (Order → OrderItems → Payment) | Complexity vs reliability |
| **Retry Strategy** | Fixed delay, Exponential backoff, No retry | Exponential backoff (2s → 4s → 8s → 16s → 32s) | Simple vs resilient |
| **Max Retries** | 3, 5, 10, unlimited | 5 retries (max 2 minutes total backoff) | Data loss vs resource waste |
| **Payload Format** | Full request, Delta (changes only), Compressed | Full request (simple reconciliation) | Size vs reliability |
| **Deduplication** | None, Hash-based, Request ID | Request ID + endpoint hash | Simple vs duplicate-proof |
| **Error Handling** | Silent fail, Quarantine, User notification | Quarantine (user can retry/delete) | UX simplicity vs transparency |
| **Sync Trigger** | Network change, Timer, Manual, Hybrid | Network change + timer fallback (30s) | User control vs automation |
| **Conflict Resolution** | Last-write-wins, Abort, Merge | Abort with user notification | Data integrity vs permissiveness |
| **Offline Indicator** | Item-level, Batch-level, Global flag | Item-level status field | Granularity vs query cost |
| **Cleanup** | Immediate delete, Archive, Soft-delete | Soft-delete (keep audit trail 30 days) | Storage vs auditability |

### B. Edge Cases & Decisions

**Edge Case 1: User Creates Order Offline, Internet Dies Before Sync Starts**
- Scenario: Order created at 2:00 PM, user closes app, internet still down at 5:00 PM
- Current Behavior: Order stuck in pending_sync table
- Decision: ✅ Keep in queue indefinitely; retry when internet returns (no TTL)
- Implementation: `expiresAt` field set to null for indefinite retention

**Edge Case 2: User Creates Order, Sync Fails, User Modifies Order, Sync Succeeds**
- Scenario: Order 123 offline → sync fails → user updates order 123 → sync retries
- Current Behavior: Original version sent to backend
- Decision: ✅ Abort sync; show "Order modified, please retry sync"
- Implementation: Add `dataHash` field to detect modifications; compare before sync

**Edge Case 3: User Creates Two Orders Offline, Network Returns, Backend Crashes**
- Scenario: Orders queued → sync starts → backend 500 error after 1 order
- Current Behavior: Second order never sent
- Decision: ✅ Retry both operations; use idempotency keys to prevent duplicates
- Implementation: Add `idempotencyKey` field; backend returns 409 if already processed

**Edge Case 4: Sync Operation Takes Too Long, User Closes App**
- Scenario: Sync in progress → user force-closes app → sync incomplete
- Current Behavior: Unknown if operation succeeded on backend
- Decision: ✅ Resume sync on app restart; use idempotency keys
- Implementation: Mark as `in_progress` status; auto-resume on next app start

**Edge Case 5: User Deletes Draft Order, Then Closes App**
- Scenario: Draft order in pending_sync → user deletes it → no network
- Current Behavior: Delete operation never synced
- Decision: ✅ Queue delete operation; send DELETE request on sync
- Implementation: Support DELETE actions in pending_sync (not just POST/PATCH)

**Edge Case 6: Concurrent Sync and Offline Operations**
- Scenario: Sync running for Order 1 → User creates Order 2 offline
- Current Behavior: Race condition possible
- Decision: ✅ Queue Order 2; don't start new sync until current completes
- Implementation: Global `isSyncing` flag; queue all new operations while syncing

**Edge Case 7: Backend Rejects Order (Validation Error)**
- Scenario: Order created offline (valid locally) → Backend says "store closed"
- Current Behavior: Sync fails; user doesn't know why
- Decision: ✅ Quarantine in `failed` status with error reason; show to user
- Implementation: Store `errorMessage` and `errorCode` fields; show in UI

**Edge Case 8: Network Returns After 48 Hours; Data Stale**
- Scenario: Order created 48h ago offline → stores closed → prices changed
- Current Behavior: Sync sends outdated data
- Decision: ✅ Warn user before syncing; allow retry/discard
- Implementation: Add `createdAt`; warn if > 24h old before syncing

---

## III. INDUSTRY BENCHMARKING: 2026 GOLD STANDARDS

### A. Applicable Patterns

**Pattern 1: Event Sourcing + Outbox Pattern**
- **Use Case**: Ensure every offline operation is immutable record
- **Pros**: Perfect audit trail, easy replay, no data loss
- **Cons**: More storage, more complex queries
- **Recommended**: Use outbox pattern (pending_sync IS the outbox)
- **Alternative**: Message queue (RabbitMQ) if need pub/sub

**Pattern 2: Idempotency Keys**
- **Use Case**: Prevent duplicate operations if sync retries
- **Pros**: Safe to retry indefinitely
- **Cons**: Need backend support, requires tracking
- **Recommended**: ✅ Use UUID-based idempotency keys
- **Alternative**: Timestamp + user_id (less reliable)

**Pattern 3: Exponential Backoff with Jitter**
- **Use Case**: Retry failed sync operations gracefully
- **Pros**: Reduces thundering herd after network recovery
- **Cons**: Longer time to eventual sync
- **Recommended**: ✅ Exponential backoff (2, 4, 8, 16, 32 seconds)
- **Alternative**: Linear backoff (simpler, less optimal)

**Pattern 4: Soft Deletes + Audit Trail**
- **Use Case**: Keep history for debugging, compliance
- **Pros**: Never lose data, can rollback
- **Cons**: More storage (mitigated with TTL archive)
- **Recommended**: ✅ Soft delete (mark deleted_at, keep 30 days)
- **Alternative**: Hard delete (faster, less auditable)

**Pattern 5: Dependency Graph**
- **Use Case**: Ensure Order syncs before OrderItems
- **Pros**: Prevents foreign key violations on backend
- **Cons**: Complex queue logic
- **Recommended**: ✅ Implement dependency DAG for complex operations
- **Alternative**: Strict FIFO (simpler, less optimal)

**Pattern 6: Conflict Resolution**
- **Use Case**: Handle concurrent modifications (rare but possible)
- **Pros**: Deterministic outcome
- **Cons**: User might lose changes
- **Recommended**: ✅ Abort on conflict; notify user to retry
- **Alternative**: Last-write-wins (dangerous)

---

## IV. STRATEGIC DESIGN CONSTRAINTS

### A. The "Must-Have" Pillar

#### 1. **Data Integrity**

**Source of Truth:** Backend database (not mobile)
- Offline queue is transient staging area
- Backend is source of truth for reconciliation
- Mobile syncs to backend, never overrides

**Concurrency Model:** Pessimistic locking + conflict detection
- Each operation gets unique `idempotencyKey`
- Backend validates: "Is this operation already processed?"
- Mobile detects: "Did data change since I queued this?"

**Conflict Resolution:**
```
IF backend returns 409 Conflict:
  → Quarantine operation (mark as `failed`)
  → Show user: "Another user modified this. Review and retry?"
  → User can retry, discard, or resolve manually

IF data hash differs from when queued:
  → Don't sync (data was modified locally)
  → Notify user: "This operation was modified. Please re-create it."
  → Delete from queue
```

#### 2. **Security Posture**

**Authentication:** Every sync request must include valid JWT
- Idempotency key is **not** secret (just prevents duplicates)
- JWT expires during offline → still queue locally → retry on new token
- Sync validates JWT before processing any queued operation

**Authorization:** Backend validates user owns all resources
```
For each operation in sync batch:
  ✅ Verify user owns the store
  ✅ Verify user owns the order (if updating)
  ✅ Verify user has permission for action (POST, PATCH, DELETE)
  ✅ Log audit trail: "user_id=123 synced order_id=456 at 2:30 PM"
```

**Data Isolation:** No cross-tenant leakage
- User can only sync operations for their stores
- Backend validates store_id belongs to user
- Never trust client-provided ownership info

**Audit Trail:** Every queued operation is logged
- What: action, endpoint, payload
- Who: user_id (at time of queuing)
- When: createdAt, syncedAt timestamps
- Result: success, error message, HTTP status

#### 3. **Performance Constraints**

**Latency Target:**
- Queue write: < 50ms (local SQLite insert)
- Sync batch: < 5 seconds per 10 operations
- Retry decision: < 1 second

**Throughput:**
- Support 100+ pending operations in queue
- Sync in batches of 10-20 per request
- Never block UI while syncing

**Network Usage:**
- Batch operations to reduce requests
- Use JSON compression if payload > 10KB
- Limit batch size to prevent 400 errors

**Storage:**
- Keep operations ≤ 1MB per record
- Archive after 30 days soft-delete
- Target: < 50MB total queue storage

#### 4. **Availability**

**Uptime SLA:** Mobile app works offline 100% (by design)

**Fallback Behavior:**
- Network error → Queue locally ✅
- Sync error → Retry with backoff ✅
- Quota exceeded → Queue, notify user ✅
- Authentication expired → Pause, resume after re-auth ✅

**Offline Capability:** Core feature, not fallback

### B. The "Anti-Pattern" Guardrail

**Anti-Pattern 1: Trusting Client Timestamps**
- ❌ Mobile sends timestamp to backend
- ✅ Backend generates timestamp
- Why: Client clock can drift, be manipulated

**Anti-Pattern 2: Storing Secrets in Queue**
- ❌ Store password, API key, or token in pending_sync payload
- ✅ Only store user_id, store_id, resource_id
- Why: Queue is local SQLite (less protected than keychain)

**Anti-Pattern 3: Sync Without Idempotency**
- ❌ Retry same operation without idempotency key
- ✅ Every operation has idempotencyKey UUID
- Why: Network can duplicate requests; backend needs deduplication

**Anti-Pattern 4: Blocking UI During Sync**
- ❌ Disable all buttons while syncing
- ✅ Show sync progress indicator; allow user to continue
- Why: Users get frustrated if app freezes

**Anti-Pattern 5: Deleting Failed Operations**
- ❌ Remove from queue after first failure
- ✅ Keep in queue with `failed` status; manual user action to delete
- Why: Automatic deletion causes silent data loss

**Anti-Pattern 6: Unlimited Retries**
- ❌ Retry forever
- ✅ Max 5 retries, then quarantine
- Why: Some errors won't recover (invalid data, auth failed)

**Anti-Pattern 7: FIFO Without Dependencies**
- ❌ Process operations in strict order (Order before OrderItems)
- ✅ Understand operation dependencies; queue accordingly
- Why: Backend FK constraints might cause rejection

---

## V. OPERATIONAL EXCELLENCE STRATEGY

### A. Data Integrity Framework

**State Flow Diagram:**

```
┌─────────────────────────────────────────────────────────────┐
│                    USER ACTION (OFFLINE)                     │
│                   "Create Order with Items"                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│          MOBILE LOCAL STATE UPDATE (Optimistic)              │
│  • Add Order to local orders table                           │
│  • Queue: POST /orders (with idempotencyKey)                │
│  • Queue: POST /order-items (linked to order)               │
│  Status: pending, retries: 0                                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│           USER SEES ORDER IN LIST (Local Data)               │
│     "Order created! Syncing when network available..."       │
└────────────────────────┬──────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
          ▼ (No Network)      ▼ (Network Returns)
    ┌──────────────┐        ┌──────────────────────┐
    │  Keep Queue  │        │  Start Sync (Batch)  │
    │  Indefinite  │        │  Max 20 ops/request  │
    │   Retries    │        │ Send batch + JWTs    │
    └──────────────┘        └────────┬─────────────┘
                                     │
                                     ▼
                    ┌────────────────────────────────┐
                    │ BACKEND VALIDATION + DB TXN    │
                    │  1. Verify JWT + permissions   │
                    │  2. Check idempotency key      │
                    │  3. Validate business logic    │
                    │  4. Execute DB transaction     │
                    │  5. Log audit trail            │
                    └────────────┬────────────────────┘
                                 │
                 ┌───────────────┼───────────────┐
                 │               │               │
                 ▼ SUCCESS       ▼ CONFLICT      ▼ ERROR
         ┌─────────────┐  ┌──────────────┐  ┌──────────┐
         │ 200 OK      │  │ 409 Conflict │  │ 4xx/5xx  │
         │ Delete from │  │ Quarantine   │  │ Retry    │
         │ queue       │  │ Notify user  │  │ Backoff  │
         └──────┬──────┘  └──────┬───────┘  └────┬─────┘
                │                │              │
                ▼                ▼              ▼
         ┌─────────────┐  ┌──────────────┐  ┌──────────┐
         │ Sync next   │  │ Next sync: in│  │ Retry:   │
         │ operation   │  │ 30s + show   │  │ 2^n secs │
         │ if more     │  │ error to user│  │ Max 5x   │
         └─────────────┘  └──────────────┘  └──────────┘
                │                │              │
                └────────┬───────┴──────────────┘
                         │
                         ▼
            ┌───────────────────────────────┐
            │ ALL OPS SYNCED OR FAILED      │
            │ Show sync complete / errors   │
            │ Update local UI with results  │
            └───────────────────────────────┘
```

### B. Security Posture

**Zero Trust Checklist for Sync:**

**Backend receives sync batch:**
```
FOR EACH operation in batch:
  ✅ Step 1: Authenticate
     - Verify JWT signature
     - Check not expired
     - Extract user_id

  ✅ Step 2: Authorize
     - Verify user owns store in operation
     - Verify user has permission (edit_order, create_order, etc)
     - Reject if unauthorized → 403 Forbidden

  ✅ Step 3: Validate Idempotency
     - Check: Is idempotencyKey already processed?
     - If yes: Return 200 (already done, no duplicate)
     - If no: Proceed to validation

  ✅ Step 4: Validate Data
     - Business logic validation (store open, stock available, etc)
     - Foreign key validation (customer exists, product exists)
     - Reject if invalid → 400 Bad Request

  ✅ Step 5: Execute Transaction
     - BEGIN TRANSACTION
     - Insert/update/delete records
     - Log audit entry
     - Mark idempotency key as processed
     - COMMIT TRANSACTION

  ✅ Step 6: Audit Log
     - Log: {user_id, action, resource_id, timestamp, result}
     - Example: "user_456 created order_789 at 2:30:45 PM"
```

**Mobile receives response:**
```
IF status === 200:
  → Delete from pending_sync
  → Show success toast

IF status === 409:
  → Mark as failed (not auto-retry)
  → Show error: "Changes conflict; review and try again"
  → User manually reviews and retries

IF status === 400:
  → Mark as failed
  → Show error: "Invalid data: {errorMessage}"
  → User fixes data or deletes operation

IF status === 401/403:
  → Pause sync queue
  → Refresh JWT
  → Resume sync after auth

IF status === 500/502:
  → Retry with exponential backoff
  → Max 5 retries over ~30 seconds
  → Then quarantine and notify user
```

### C. Observability & Monitoring

**Logging Points:**

```
Mobile Side:
  ✅ [QUEUE] operation_type={POST|PATCH|DELETE},
     endpoint={/orders|/customers},
     idempotencyKey={uuid}

  ✅ [SYNC_START] pending_count=15,
     batch_size=10,
     retry_count={retries_so_far}

  ✅ [SYNC_RESULT] status=200|409|500,
     operations_synced=9,
     operations_failed=1,
     duration_ms=1250

  ✅ [ERROR] operation_type=POST,
     endpoint=/orders,
     error_code=409,
     error_message="Order already exists",
     action={quarantine|retry}

Backend Side:
  ✅ [SYNC_RECEIVED] user_id=123,
     batch_size=10,
     timestamp=2026-04-01T10:30:00Z

  ✅ [OPERATION_PROCESSED] idempotencyKey=uuid,
     endpoint=/orders,
     resource_id=order_456,
     status=success|conflict|error

  ✅ [AUDIT_LOG] user_id=123,
     action=create_order,
     resource_id=order_456,
     timestamp=2026-04-01T10:30:02Z

  ✅ [IDEMPOTENCY_HIT] idempotencyKey=uuid,
     operation=create_order,
     result=duplicate_prevented
```

**Alerting Rules:**

| Alert | Condition | Action |
|-------|-----------|--------|
| High Failed Sync Rate | > 5% of syncs failing | Page oncall; investigate network/backend |
| Large Pending Queue | > 100 operations queued | Investigate why sync isn't running |
| Sync Timeout | Sync takes > 10 seconds | Check network latency, backend load |
| Idempotency Duplicates | > 10 duplicate attempts/hour | Check if mobile is retrying too aggressively |
| Stale Pending Ops | Operations > 48h old in queue | Alert user to sync or discard |

---

## VI. TABLE SCHEMA DESIGN

### A. Complete Column Specification

```sql
CREATE TABLE pending_sync (
  -- Primary Key
  id TEXT PRIMARY KEY,              -- UUID, immutable identifier

  -- Operation Details
  action TEXT NOT NULL,             -- 'POST', 'PATCH', 'DELETE'
  endpoint TEXT NOT NULL,           -- '/orders', '/customers', etc
  idempotencyKey TEXT NOT NULL,     -- UUID for dedup (backend tracks this)
  payload TEXT NOT NULL,            -- JSON string of full request body

  -- State & Status
  status TEXT NOT NULL,             -- 'pending', 'in_progress', 'synced', 'failed', 'quarantined'
  dataHash TEXT,                    -- SHA256 of payload (detect local changes)

  -- Retry Logic
  retries INT DEFAULT 0,            -- Number of attempts so far
  maxRetries INT DEFAULT 5,         -- Max retries allowed
  nextRetryAt TIMESTAMP,            -- When to next attempt (backoff timing)
  lastErrorCode INT,                -- HTTP status code of last failure
  lastErrorMessage TEXT,            -- Error reason from backend

  -- Timestamps
  createdAt TIMESTAMP NOT NULL,     -- When operation was queued (device time)
  syncedAt TIMESTAMP,               -- When sync succeeded (device time)
  failedAt TIMESTAMP,               -- When marked as failed (device time)
  expiresAt TIMESTAMP,              -- When to archive/delete (30 days default)

  -- Metadata
  userId TEXT NOT NULL,             -- User who queued it
  storeId INT,                      -- Store context (nullable for customer actions)
  deviceId TEXT NOT NULL,           -- Which device queued it

  -- Soft Delete
  deletedAt TIMESTAMP,              -- Soft delete timestamp (if user discards)

  -- Audit
  syncAttempts INT DEFAULT 0,       -- Total sync attempts (for analytics)

  -- Indexes for performance
  UNIQUE(idempotencyKey, endpoint), -- Prevent duplicate queuing
  INDEX(status),                    -- Query by status quickly
  INDEX(nextRetryAt),               -- Find operations due for retry
  INDEX(userId),                    -- List user's pending ops
  INDEX(storeId),                   -- List store's pending ops
  INDEX(createdAt)                  -- Time-based queries
);
```

### B. Sample Records

**Example 1: Pending Order Creation (No Network Yet)**
```json
{
  "id": "sync_f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "action": "POST",
  "endpoint": "/orders",
  "idempotencyKey": "order_f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "payload": "{\"storeId\": 1, \"customerId\": 5, \"totalAmount\": 1500, \"discountAmount\": 0, \"taxAmount\": 150, \"netAmount\": 1500, \"paymentMethod\": \"cash\", \"items\": [{\"productId\": 10, \"quantity\": 2, \"unitPrice\": 500, \"taxAmount\": 100}]}",
  "status": "pending",
  "dataHash": "abc123def456...",
  "retries": 0,
  "maxRetries": 5,
  "nextRetryAt": null,
  "lastErrorCode": null,
  "lastErrorMessage": null,
  "createdAt": "2026-04-01T10:30:00Z",
  "syncedAt": null,
  "failedAt": null,
  "expiresAt": "2026-05-01T10:30:00Z",
  "userId": "user_123",
  "storeId": 1,
  "deviceId": "device_xyz",
  "deletedAt": null,
  "syncAttempts": 0
}
```

**Example 2: Failed Sync (Retrying with Backoff)**
```json
{
  "id": "sync_b47ac10b-58cc-4372-a567-0e02b2c3d480",
  "action": "POST",
  "endpoint": "/customers",
  "idempotencyKey": "customer_b47ac10b-58cc-4372-a567-0e02b2c3d480",
  "payload": "{\"storeId\": 1, \"name\": \"John Doe\", \"phoneNumber\": \"+1234567890\"}",
  "status": "pending",
  "dataHash": "xyz789abc123...",
  "retries": 2,
  "maxRetries": 5,
  "nextRetryAt": "2026-04-01T10:32:00Z",
  "lastErrorCode": 500,
  "lastErrorMessage": "Database temporarily unavailable",
  "createdAt": "2026-04-01T10:30:00Z",
  "syncedAt": null,
  "failedAt": null,
  "expiresAt": "2026-05-01T10:30:00Z",
  "userId": "user_123",
  "storeId": 1,
  "deviceId": "device_xyz",
  "deletedAt": null,
  "syncAttempts": 2
}
```

**Example 3: Conflict (Quarantined)**
```json
{
  "id": "sync_c47ac10b-58cc-4372-a567-0e02b2c3d481",
  "action": "PATCH",
  "endpoint": "/orders/order_456",
  "idempotencyKey": "update_order_c47ac10b-58cc-4372-a567",
  "payload": "{\"status\": \"completed\", \"paymentStatus\": \"paid\"}",
  "status": "quarantined",
  "dataHash": "def456ghi789...",
  "retries": 1,
  "maxRetries": 5,
  "nextRetryAt": null,
  "lastErrorCode": 409,
  "lastErrorMessage": "Order was modified by another user at 10:29 AM",
  "createdAt": "2026-04-01T10:28:00Z",
  "syncedAt": null,
  "failedAt": "2026-04-01T10:29:00Z",
  "expiresAt": "2026-05-01T10:28:00Z",
  "userId": "user_123",
  "storeId": 1,
  "deviceId": "device_xyz",
  "deletedAt": null,
  "syncAttempts": 1
}
```

---

## VII. IMPLEMENTATION ROADMAP

| Phase | Duration | Tasks | Acceptance Criteria |
|-------|----------|-------|---------------------|
| **Foundation** | Week 1 | 1. Define schema<br>2. Create WatermelonDB model<br>3. Implement queue write (persist locally)<br>4. Write unit tests for queueing | Orders can be created offline and queued locally without errors |
| **Integration** | Week 2 | 1. Implement sync engine<br>2. Add retry logic + backoff<br>3. Implement idempotency checking<br>4. Add error handling/quarantine<br>5. Integrate with Redux store | Sync batches operations, retries on failure, prevents duplicates |
| **Polish** | Week 3 | 1. Add observability (logging)<br>2. Implement cleanup/archival<br>3. Add UI indicators<br>4. Load testing<br>5. E2E testing offline scenarios | Sync visible in UI, operations complete reliably, < 5 min sync time |

---

## VIII. SUCCESS METRICS

| Metric | Target | Measurement | Tool |
|--------|--------|-------------|------|
| **Queue Success Rate** | 100% | Operations successfully persisted / total created | Sentry + logs |
| **Sync Success Rate** | 99.5% | Operations synced without error / total | Backend logs |
| **Duplicate Prevention** | 100% | Zero duplicate orders on backend / total | Audit logs |
| **Retry Effectiveness** | > 95% | Operations recovered after retry / total failed | Backend logs |
| **Sync Duration** | < 5 sec (p95) | Time from network recovery to complete sync | APM (Datadog/New Relic) |
| **Queue Size** | < 50MB | Storage used by pending_sync table | SQLite stats |
| **User Awareness** | 100% | Users see pending operation count | Telemetry |
| **Time to Sync** | < 2 min | User notification time from "network back" to "synced" | Frontend logs |

---

## IX. RISK REGISTER

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|-----------|
| **Data Loss on App Crash** | CRITICAL | Medium | Implement transaction-level consistency; test crash scenarios |
| **Duplicate Orders** | HIGH | Medium | Idempotency keys + backend dedup validation |
| **Stale Data Synced** | HIGH | Low | Add data hash; detect & quarantine if changed |
| **Sync Storms** | MEDIUM | Low | Exponential backoff + jitter; rate limiting |
| **Quota Exhaustion** | MEDIUM | Low | Batch operations; warn user if queue > 100 items |
| **Auth Expired During Sync** | MEDIUM | Medium | Detect 401 errors; pause sync; auto-resume after re-auth |
| **Network Flapping** | LOW | High | Debounce sync triggers; use stable network detection |

---

## X. IMPLEMENTATION CHECKLIST

**Before Coding:**
- [x] Intent is clear (offline-first sync queue)
- [x] Ambiguities documented (retry strategy, conflict handling, etc)
- [x] Industry patterns chosen (idempotency keys, exponential backoff)
- [x] Must-have pillars defined (Data Integrity, Security, Performance)
- [x] Anti-patterns identified (no unlimited retries, auth validation)
- [x] Concurrency model defined (pessimistic + conflict detection)
- [x] Security validation points set (JWT + authorization)
- [x] Logging/monitoring strategy outlined
- [x] Roadmap created
- [x] Success metrics defined
- [x] Risks identified and mitigated

**During Implementation:**
- [ ] Follow chosen architecture patterns
- [ ] Validate security constraints at every step
- [ ] Add logging for observability
- [ ] Handle all edge cases from Ambiguity Filter
- [ ] Test concurrent scenarios
- [ ] Implement error handling per design
- [ ] Add unit tests for queue logic
- [ ] Add integration tests for sync flow

**After Implementation:**
- [ ] Review against must-have pillars
- [ ] Verify no anti-patterns introduced
- [ ] Audit security validation points
- [ ] Validate success metrics
- [ ] Load test queue with 1000+ operations
- [ ] Test offline/online transitions
- [ ] Create operational runbook

---

## APPENDIX: Related Tables

**pending_sync works with these tables:**

| Table | Relationship | Why |
|-------|-------------|-----|
| `orders` | Queue stores order creation actions | Parent data |
| `order_items` | Queue stores order item actions | Child data (dependency) |
| `customers` | Queue stores customer creation/updates | Referenced data |
| `cache_metadata` | Tracks when pending operations expire | TTL management |
| `users` | Who queued the operation | Audit trail |

**Backend tables (for reference):**
- `user_sessions` — Tracks JWT + idempotency keys
- `sync_audit_log` — Permanent record of all synced operations

---

## SUMMARY

This **pending_sync** table is the heart of offline-first architecture:
- ✅ Reliable queue for offline operations
- ✅ Idempotent, safe-to-retry design
- ✅ Conflict detection + quarantine
- ✅ Full audit trail
- ✅ Smart retry logic (exponential backoff)
- ✅ Zero data loss by design

**Key Differentiators:**
1. **Idempotency keys** prevent duplicates
2. **Data hash** detects local modifications
3. **Soft deletes** preserve audit trail
4. **Quarantine state** vs auto-delete (safer UX)
5. **Dependency awareness** respects FK constraints

**Production-ready**: Yes, assuming proper backend integration with idempotency key tracking and conflict detection.

---

**Protocol Owner:** Senior Architect
**Document Date:** 2026-04-01
**Next Review:** After first production sync event
