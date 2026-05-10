import { ConfigService } from '@nestjs/config';
import { KeyRotationScheduler } from './key-rotation-scheduler';
import { JWTConfigService } from '../../../../../config/jwt.config';
import { KeyRotationAlertService } from './key-rotation-alert.service';

/**
 * Multi-pod safety regression: when two pods run a rotation tick at the
 * same instant, only one pod must perform the rotation.
 *
 * The real safety relies on Postgres' `pg_try_advisory_lock` being
 * session-scoped, which we can't fully exercise without a real DB. This
 * spec instead verifies the *contract*:
 *
 *   - When `pg_try_advisory_lock` returns `got = true`, performKeyRotation
 *     is invoked.
 *   - When `pg_try_advisory_lock` returns `got = false`, performKeyRotation
 *     is NOT invoked, and the scheduler logs a "lock held by another pod"
 *     skip.
 *   - Two parallel ticks against a stub that simulates the lock (granting it
 *     to exactly one caller at a time) result in exactly one rotation.
 */
describe('KeyRotationScheduler — multi-pod rotation safety', () => {
  let perform: jest.Mock;

  // Build a scheduler with mocked deps and a configurable lock backend.
  function buildScheduler(opts: {
    grantLockTo: 'first' | 'all' | 'none';
    initialLastRotation?: Date | null;
  }) {
    const lockState = { granted: 0, total: 0 };
    const stored: { value: string | null } = {
      value: opts.initialLastRotation?.toISOString() ?? null,
    };

    // The SQL templates Drizzle builds aren't easy to introspect, so we
    // dispatch on a stringified shape that includes both literal chunks
    // and a few well-known fragments. This keeps the test independent of
    // Drizzle internals.
    const matchSql = (query: unknown, needle: string): boolean => {
      try {
        return JSON.stringify(query).includes(needle);
      } catch {
        return false;
      }
    };

    const db = {
      execute: jest.fn(async (query: unknown) => {
        if (matchSql(query, 'pg_try_advisory_lock')) {
          lockState.total += 1;
          let got = false;
          if (opts.grantLockTo === 'all') got = true;
          else if (opts.grantLockTo === 'none') got = false;
          else if (opts.grantLockTo === 'first') {
            got = lockState.granted === 0;
            if (got) lockState.granted += 1;
          }
          return { rows: [{ got }] };
        }
        if (matchSql(query, 'pg_advisory_unlock')) {
          return { rows: [{ pg_advisory_unlock: true }] };
        }
        if (matchSql(query, 'SELECT value FROM system_config')) {
          return { rows: stored.value ? [{ value: stored.value }] : [] };
        }
        if (matchSql(query, 'INSERT INTO system_config')) {
          stored.value = new Date().toISOString();
          return { rows: [] };
        }
        return { rows: [] };
      }),
    } as unknown as ConstructorParameters<typeof KeyRotationScheduler>[2];

    const jwtConfig = {
      getCurrentKid: jest.fn().mockReturnValue('kid-old-1234567890abcdef'),
      archiveCurrentKeyAsFallback: jest.fn(),
      installNewKeyPair: jest.fn(),
    } as unknown as JWTConfigService;

    const alertService = {
      alertRotationSuccess: jest.fn().mockResolvedValue(undefined),
      alertRotationFailure: jest.fn().mockResolvedValue(undefined),
    } as unknown as KeyRotationAlertService;

    const config = {
      get: (key: string, fallback: unknown) => {
        if (key === 'JWT_KEY_ROTATION_ENABLED') return true;
        if (key === 'JWT_KEY_ROTATION_INTERVAL_DAYS') return 30;
        // Window covers the current time so isInMaintenanceWindow() returns true.
        if (key === 'JWT_ROTATION_WINDOW_START') return '00:00';
        if (key === 'JWT_ROTATION_WINDOW_DURATION') return 60 * 24; // 24h
        return fallback;
      },
    } as unknown as ConfigService;

    const scheduler = new KeyRotationScheduler(jwtConfig, alertService, db, config);

    // Spy on performKeyRotation so we can count invocations without actually
    // generating RSA keys.
    perform = jest.spyOn(scheduler, 'performKeyRotation').mockResolvedValue(undefined) as unknown as jest.Mock;

    return { scheduler, lockState, stored };
  }

  it('runs the rotation when the advisory lock is acquired', async () => {
    const { scheduler } = buildScheduler({ grantLockTo: 'all' });

    await scheduler.tick();

    expect(perform).toHaveBeenCalledTimes(1);
    expect(perform).toHaveBeenCalledWith('scheduled');
  });

  it('skips the rotation when the advisory lock is held by another pod', async () => {
    const { scheduler } = buildScheduler({ grantLockTo: 'none' });

    await scheduler.tick();

    expect(perform).not.toHaveBeenCalled();
  });

  it('two concurrent ticks acquiring the same lock result in exactly one rotation', async () => {
    // `grantLockTo: 'first'` simulates Postgres handing the advisory lock to
    // exactly one of the racing connections. The second call sees got=false
    // and short-circuits.
    const { scheduler } = buildScheduler({ grantLockTo: 'first' });

    await Promise.all([scheduler.tick(), scheduler.tick()]);

    expect(perform).toHaveBeenCalledTimes(1);
  });

  it('does not rotate again on the next tick if rotation was already done within the interval', async () => {
    // Lock would be granted, but `isRotationDue()` should short-circuit
    // because system_config already has a recent lastRotationAt.
    const recent = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
    const { scheduler } = buildScheduler({ grantLockTo: 'all', initialLastRotation: recent });

    await scheduler.tick();

    expect(perform).not.toHaveBeenCalled();
  });
});
