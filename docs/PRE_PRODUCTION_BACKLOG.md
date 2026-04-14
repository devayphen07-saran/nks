# Pre-Production Hardening Backlog

Items that are **not runtime blockers** but should be addressed before production launch.

---

## 1. PostgreSQL Row-Level Security (RLS)

**Priority**: MEDIUM | **Effort**: 1-2 days | **Category**: Defense-in-depth

**Current state**: Tenant isolation relies entirely on application-layer `storeFk` scoping in repository queries and `user.activeStoreId` checks in sync push.

**Risk**: A single missing WHERE clause in any new query exposes cross-tenant data.

**Fix**:
1. Enable RLS on all tenant-scoped tables (`stores`, `store_user_mapping`, `roles`, etc.)
2. Create policies that enforce `storeFk = current_setting('app.current_store_id')::bigint`
3. Set `app.current_store_id` in a transaction-level GUC from the authenticated user context
4. Test with cross-tenant query attempts to verify enforcement

**When**: Before first multi-tenant store onboarding.

---

## 2. Offline Window Validation

**Priority**: LOW | **Effort**: 0.5 day (config) + ongoing monitoring | **Category**: Product decision

**Current state**: Offline JWT TTL is `3d` (hardcoded in `jwt.config.ts:123`).

**Risk**: Rural field service users may exceed 3 days offline, causing locked-out devices and support calls.

**Fix**:
1. Move `3d` to an env var (`OFFLINE_JWT_TTL=3d`)
2. Add telemetry: track last-sync timestamps per device
3. After launch, analyze actual offline durations from telemetry
4. Adjust TTL based on P95 offline duration + buffer

**When**: Before onboarding users outside urban delivery use case.

---

## 3. Background Sync / Queue Management

**Priority**: MEDIUM | **Effort**: 1-2 days | **Category**: Resilience

**Current state**: PowerSync connector does simple queue drain — `getNextCrudTransaction()` then POST all ops. No batch size limits, no partial sync, no queue size monitoring.

**Risk**: Intermittent connectivity (1 bar of signal) causes queue buildup. Thousands of queued ops could fail on reconnect due to timeout or payload size.

**Fix**:
1. Add batch size limit to `uploadData()` (e.g., 50 ops per push, loop until drained)
2. Add queue size monitoring (log warning at 100+ pending ops)
3. Implement priority queue: financial transactions (sales, payments) sync before inventory updates
4. Add exponential backoff on repeated upload failures
5. Consider background fetch (Expo TaskManager) for opportunistic sync during brief connectivity

**When**: Before onboarding users with unreliable connectivity (rural areas, basements).

---

## Review Schedule

- **Pre-launch**: Items #1 (RLS) and #3 (sync queue) — both are infrastructure hardening
- **Post-launch (Week 2-4)**: Item #2 (offline window) — requires real usage data
