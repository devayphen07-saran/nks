# 📊 Database Reliability & Error Handling Guide

## Overview

This document covers the improvements made to handle database operation failures gracefully:

1. **Error Logging** - All DB failures are logged with context
2. **Retry Logic** - Automatic retries with exponential backoff
3. **Fire-and-Forget Operations** - Non-blocking background tasks with proper error tracking
4. **Observability** - Monitor failures via logs and metrics

---

## Problem: Silent Failures

### Before (Vulnerable)

```typescript
// ❌ Silent failure - no error tracking
this.db
  .delete(schema.userSession)
  .where(eq(schema.userSession.userId, userId))
  .catch(() => {}); // 😱 If this fails, nobody knows!
```

**Consequences:**
- Sessions not deleted → stale sessions persist
- No visibility into failures
- Data inconsistency grows silently
- Hard to debug production issues

### After (Robust)

```typescript
// ✅ Proper error handling with retries
fireAndForgetWithRetry(
  () =>
    this.db
      .delete(schema.userSession)
      .where(eq(schema.userSession.userId, userId)),
  {
    maxRetries: 3,
    initialDelayMs: 500,
    logger: this.logger,
    logLabel: `Delete sessions for user ${userId}`,
  },
);
```

**Benefits:**
- ✅ Automatic retries (transient failures recover)
- ✅ Proper error logging
- ✅ Exponential backoff (prevents hammering DB)
- ✅ Observable via logs

---

## Implementation

### 1. Retry Utility

**File:** `apps/nks-backend/src/common/utils/retry.ts`

Three functions for different scenarios:

#### A. Standard Retry (blocks operation)

```typescript
// For critical operations that must succeed
const result = await retryAsync(
  () => db.query(...),
  {
    maxRetries: 3,
    initialDelayMs: 1000,
    logger: this.logger,
    logLabel: 'Critical operation',
  },
);
```

**Use when:** Operation must complete before continuing (sync operations)

#### B. Fire-and-Forget Retry (non-blocking)

```typescript
// For background tasks
fireAndForgetWithRetry(
  () => db.update(...),
  {
    maxRetries: 3,
    initialDelayMs: 500,
    logger: this.logger,
    logLabel: 'Background task',
  },
);
// Continues immediately, retries happen in background
```

**Use when:** Operation is non-critical (logging, analytics, updating lastActiveAt)

#### C. Custom Backoff

```typescript
// For operations with custom retry logic
await retryWithBackoff(
  () => externalApi.call(),
  (error, attempt) => {
    if (error.message.includes('429')) return 5000; // Rate limit: wait 5s
    return 1000 * Math.pow(2, attempt - 1); // Exponential for others
  },
  3,
);
```

**Use when:** Different types of errors need different backoff strategies

### 2. Fixed Auth Guard

**File:** `apps/nks-backend/src/common/guards/auth.guard.ts`

#### Before:
```typescript
// ❌ Silent failure (line 129-132)
this.db
  .delete(schema.userSession)
  .where(eq(schema.userSession.userId, Number(u.id)))
  .catch(() => {});

// ❌ Silent failure (line 147-151)
this.db
  .update(schema.users)
  .set({ lastActiveAt: new Date() })
  .where(eq(schema.users.id, Number(user.id)))
  .catch(() => {});
```

#### After:
```typescript
// ✅ Proper error handling with retry logic
fireAndForgetWithRetry(
  () =>
    this.db
      .delete(schema.userSession)
      .where(eq(schema.userSession.userId, Number(u.id))),
  {
    maxRetries: 3,
    initialDelayMs: 500,
    logger: this.logger,
    logLabel: `Delete sessions for blocked user ${u.id}`,
  },
);

// ✅ Non-blocking update with error logging
fireAndForgetWithRetry(
  () =>
    this.db
      .update(schema.users)
      .set({ lastActiveAt: new Date() })
      .where(eq(schema.users.id, Number(user.id))),
  {
    maxRetries: 3,
    initialDelayMs: 500,
    logger: this.logger,
    logLabel: `Update lastActiveAt for user ${user.id}`,
  },
);
```

---

## Retry Behavior

### Exponential Backoff

By default, retries use exponential backoff with jitter:

```
Attempt 1: Immediate
Attempt 2: 1 second
Attempt 3: 2 seconds
Attempt 4: 4 seconds
Attempt 5: 8 seconds
```

**Formula:** `delayMs * Math.pow(2, attemptNumber - 1)`

This prevents:
- ✅ Database overwhelm
- ✅ Connection pool exhaustion
- ✅ Thundering herd problem

### When Retries Help

Retries automatically recover from:
- ✅ Connection pool temporarily exhausted
- ✅ Temporary network issues
- ✅ Brief database unavailability
- ✅ Lock contention

### When Retries Don't Help

Retries will eventually fail for:
- ❌ Invalid SQL (bad query)
- ❌ Permission denied
- ❌ Database down for extended period
- ❌ Resource exhausted (disk full)

---

## Observability

### Log Messages

#### Retry Attempt:
```
⚠️ Delete sessions for user 123 attempt 2/3 failed, retrying in 500ms
  error: "connection timeout"
  attempt: 2
  nextRetryMs: 500
```

#### Success After Retry:
```
✅ Delete sessions for user 123 succeeded on attempt 2/3
```

#### Final Failure:
```
❌ Delete sessions for user 123 failed after 3 attempts
  error: "database unavailable"
  attempt: 3
```

### Monitoring

Monitor these metrics:

```sql
-- Success rate (should be > 99%)
SELECT
  operation,
  COUNT(*) as total,
  SUM(CASE WHEN succeeded THEN 1 ELSE 0 END) as succeeded,
  100.0 * SUM(CASE WHEN succeeded THEN 1 ELSE 0 END) / COUNT(*) as success_rate
FROM db_operations_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY operation;

-- Retry rate (should be < 1%)
SELECT
  operation,
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE retry_attempt > 1) as retried,
  100.0 * COUNT(*) FILTER (WHERE retry_attempt > 1) / COUNT(*) as retry_rate
FROM db_operations_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY operation;

-- Latency impact (retries add latency)
SELECT
  operation,
  AVG(duration_ms) as avg_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_latency_ms
FROM db_operations_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY operation;
```

---

## Best Practices

### ✅ DO:

1. **Use retries for transient failures:**
   ```typescript
   // Database connections sometimes fail temporarily
   await retryAsync(() => db.query(...));
   ```

2. **Use fire-and-forget for non-critical ops:**
   ```typescript
   // Updating lastActiveAt is nice-to-have, not essential
   fireAndForgetWithRetry(() => db.update(...));
   ```

3. **Add meaningful labels:**
   ```typescript
   fireAndForgetWithRetry(fn, {
     logLabel: 'Delete sessions for blocked user 123',
   });
   ```

4. **Tune backoff for your use case:**
   ```typescript
   // Aggressive retry for critical ops
   await retryAsync(fn, { maxRetries: 5, initialDelayMs: 100 });

   // Conservative retry for non-critical
   fireAndForgetWithRetry(fn, { maxRetries: 2, initialDelayMs: 1000 });
   ```

### ❌ DON'T:

1. **Don't retry forever:**
   ```typescript
   // ❌ Will retry indefinitely
   while (true) {
     try {
       return await db.query(...);
     } catch {}
   }

   // ✅ Retry with limit
   await retryAsync(() => db.query(...), { maxRetries: 3 });
   ```

2. **Don't mix retries with timeouts:**
   ```typescript
   // ❌ Might timeout while retrying
   const promise = retryAsync(longOperation, { maxRetries: 5 });
   await Promise.race([promise, timeout(5000)]);

   // ✅ Calculate total timeout
   // 3 retries × 2s each = ~6s, so set timeout to 10s
   ```

3. **Don't retry deterministic failures:**
   ```typescript
   // ❌ Invalid query won't succeed on retry
   await retryAsync(
     () => db.query('INVALID SQL'),
     { maxRetries: 3 },
   );

   // ✅ Only retry transient failures
   if (error.message.includes('timeout')) {
     await retryAsync(fn);
   }
   ```

4. **Don't log sensitive data:**
   ```typescript
   // ❌ Logs user passwords
   logger.error('Login failed', { user, password });

   // ✅ Log safely
   logger.error('Login failed', { userId: user.id, error: error.message });
   ```

---

## Migration Checklist

- [x] Created retry.ts utility with three functions
- [x] Added Logger to AuthGuard
- [x] Fixed delete sessions (line 129-132)
- [x] Fixed lastActiveAt update (line 147-151)
- [ ] Search for other silent failures (`.catch(() => {})`)
- [ ] Add monitoring dashboard for retry metrics
- [ ] Train team on proper error handling
- [ ] Monitor in production for success rates

---

## Testing

### Unit Test: Retry Success After Transient Failure

```typescript
it('should succeed after transient failure', async () => {
  let attempts = 0;
  const fn = jest.fn().mockImplementation(() => {
    attempts++;
    if (attempts < 3) throw new Error('Transient');
    return 'success';
  });

  const result = await retryAsync(fn, { maxRetries: 3 });

  expect(result).toBe('success');
  expect(fn).toHaveBeenCalledTimes(3);
});
```

### Unit Test: Fire-and-Forget Returns Immediately

```typescript
it('should return immediately', (done) => {
  const fn = jest.fn();
  const start = Date.now();

  fireAndForgetWithRetry(
    async () => {
      await new Promise((r) => setTimeout(r, 1000));
      fn();
    },
  );

  const elapsed = Date.now() - start;
  expect(elapsed).toBeLessThan(100); // Returns almost immediately
  expect(fn).not.toHaveBeenCalled(); // Still running in background

  // After timeout, it should have completed
  setTimeout(() => {
    expect(fn).toHaveBeenCalled();
    done();
  }, 2000);
});
```

### Integration Test: Logs Error on Final Failure

```typescript
it('should log error after max retries', async () => {
  const logger = { error: jest.fn() };
  const fn = jest.fn().mockRejectedValue(new Error('Persistent failure'));

  await expect(
    retryAsync(fn, {
      maxRetries: 2,
      logger: logger as any,
      logLabel: 'Test operation',
    }),
  ).rejects.toThrow('Persistent failure');

  expect(logger.error).toHaveBeenCalledWith(
    expect.stringContaining('Test operation failed after 2 attempts'),
    expect.any(Object),
  );
});
```

---

## References

- [Retry Strategies](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- [Database Connection Pooling](https://github.com/brianc/node-postgres/tree/master/packages/pg-pool)
- [Drizzle ORM Error Handling](https://orm.drizzle.team/docs/goat/queries/error-handling)
- [NestJS Exception Filters](https://docs.nestjs.com/exception-filters)
