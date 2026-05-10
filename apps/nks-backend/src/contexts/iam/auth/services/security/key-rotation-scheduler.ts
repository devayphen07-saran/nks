import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../../../core/database/schema';
import { InjectDb } from '../../../../../core/database/inject-db.decorator';
import { JWTConfigService } from '../../../../../config/jwt.config';
import { RSAKeyManager } from '../../../../../core/crypto/rsa-keys';
import { KeyRotationAlertService } from './key-rotation-alert.service';
import { InternalServerException } from '../../../../../common/exceptions';
import { ErrorCode, errPayload } from '../../../../../common/constants/error-codes.constants';

export interface KeyRotationConfig {
  enabled: boolean;
  scheduleIntervalDays: number; // How often to rotate (e.g., 30 days)
  maintenanceWindowStart: string; // HH:mm UTC (e.g., "02:00")
  maintenanceWindowDuration: number; // Minutes (e.g., 60)
}

/**
 * `system_config.key` we use to persist the last successful rotation time.
 * Persisted because `lastRotationTime` must be visible to every pod, otherwise
 * pod B's in-memory clock will say "rotation due" right after pod A rotated.
 */
const LAST_ROTATION_KEY = 'jwt.last_rotation_at';

/**
 * Stable 64-bit key for `pg_try_advisory_lock`. Computed via `hashtext` of a
 * fixed namespaced string at SQL time, so every pod hashes to the same lock
 * id. Two-arg form (`hashtext, 0`) widens to bigint.
 */
const ROTATION_LOCK_NAMESPACE = 'nks:jwt_rotation';

/**
 * Automated JWT Key Rotation Scheduler
 *
 * Multi-pod safety:
 * - Postgres advisory lock (pg_try_advisory_lock) ensures only one pod
 *   performs rotation at a time. Lock is released at end of session.
 * - lastRotationTime is persisted to `system_config` so every pod sees the
 *   same "rotation done" timestamp — not just the pod that rotated.
 *
 * Strategy:
 * 1. Active key: Used for new token signatures
 * 2. Fallback keys: Kept for 30 days (grace period for offline clients)
 * 3. Rotation: Every 30 days (configurable)
 * 4. Zero-downtime: Old key kept in fallback array, new key becomes active
 * 5. Alerts: Success/failure notifications via structured pino logs and Slack
 *
 * Configuration (env vars):
 * - JWT_KEY_ROTATION_ENABLED=true
 * - JWT_KEY_ROTATION_INTERVAL_DAYS=30
 * - JWT_ROTATION_WINDOW_START=02:00 (UTC)
 * - JWT_ROTATION_WINDOW_DURATION=60
 */
@Injectable()
export class KeyRotationScheduler implements OnModuleInit {
  private readonly logger = new Logger(KeyRotationScheduler.name);
  private readonly config: KeyRotationConfig;
  private lastRotationTime: Date | null = null;

  constructor(
    private readonly jwtConfig: JWTConfigService,
    private readonly alertService: KeyRotationAlertService,
    @InjectDb() private readonly db: NodePgDatabase<typeof schema>,
    configService: ConfigService,
  ) {
    this.config = {
      enabled: configService.get('JWT_KEY_ROTATION_ENABLED', true),
      scheduleIntervalDays: configService.get('JWT_KEY_ROTATION_INTERVAL_DAYS', 30),
      maintenanceWindowStart: configService.get('JWT_ROTATION_WINDOW_START', '02:00'),
      maintenanceWindowDuration: configService.get('JWT_ROTATION_WINDOW_DURATION', 60),
    };
  }

  async onModuleInit() {
    if (!this.config.enabled) {
      this.logger.log('Key rotation scheduler is disabled');
      return;
    }

    // Hydrate lastRotationTime from system_config so a freshly-started pod
    // doesn't think rotation is due immediately when another pod rotated
    // five minutes ago.
    this.lastRotationTime = await this.loadLastRotationTime();

    this.logger.log(
      `Key rotation scheduler initialized (interval: ${this.config.scheduleIntervalDays} days, last rotation: ${this.lastRotationTime?.toISOString() ?? 'never'})`,
    );

    // Run a tick on startup so a server that came up inside the maintenance
    // window doesn't have to wait for the cron to fire.
    await this.tick().catch((error) => {
      this.logger.error(
        { err: error instanceof Error ? error.message : String(error) },
        'Initial rotation tick failed',
      );
    });
  }

  /**
   * Hourly tick. Replaces the prior `setInterval` for consistency with the
   * rest of the codebase (every other scheduler uses @Cron / @nestjs/schedule).
   */
  @Cron(CronExpression.EVERY_HOUR)
  async tick(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      await this.checkAndRotateIfNeeded();
      await this.checkRotationOverdue();
    } catch (error) {
      this.logger.error(
        { err: error instanceof Error ? error.message : String(error) },
        'Key rotation scheduler tick failed',
      );
    }
  }

  /**
   * Liveness check: alert if rotation hasn't happened in 2× the configured interval.
   *
   * The hourly tick already self-heals when it lands inside the maintenance window.
   * This guard catches the failure mode where rotation kept silently throwing OR
   * the maintenance window has been mis-configured to never trigger.
   */
  private async checkRotationOverdue(): Promise<void> {
    if (!this.lastRotationTime) return;
    const intervalMs = this.config.scheduleIntervalDays * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - this.lastRotationTime.getTime();
    if (elapsed > intervalMs * 2) {
      const overdueDays = Math.floor(elapsed / (24 * 60 * 60 * 1000));
      this.logger.error(
        { lastRotation: this.lastRotationTime.toISOString(), overdueDays },
        `Key rotation overdue by ${overdueDays}d — investigate scheduler`,
      );
      await this.alertService.alertRotationFailure({
        oldKid: this.jwtConfig.getCurrentKid(),
        reason: 'scheduled',
        error: `Rotation overdue by ${overdueDays} days (last: ${this.lastRotationTime.toISOString()})`,
        durationMs: 0,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Check if rotation is needed based on schedule and maintenance window.
   * Performs rotation if conditions are met.
   *
   * Multi-pod safety: rotation is gated by a Postgres advisory lock —
   * `pg_try_advisory_lock(hashtext('nks:jwt_rotation'))`. Two pods that
   * both pass the maintenance-window and is-due checks in the same hour
   * will race for the lock; the loser short-circuits without rotating.
   * lastRotationTime is then re-read from `system_config` so the loser
   * picks up the winner's timestamp on its next tick.
   */
  private async checkAndRotateIfNeeded(): Promise<void> {
    if (!this.isInMaintenanceWindow()) {
      return;
    }

    // Refresh from DB before deciding — another pod may have rotated since
    // our last tick. Without this, two pods that started within the same
    // window would both pass `isRotationDue()` (both seeing the stale
    // in-memory timestamp) and race for the lock.
    this.lastRotationTime = await this.loadLastRotationTime();

    if (!this.isRotationDue()) {
      return;
    }

    await this.withRotationLock(async () => {
      // Re-check inside the lock — another pod may have rotated between
      // our check above and our lock acquisition.
      this.lastRotationTime = await this.loadLastRotationTime();
      if (!this.isRotationDue()) {
        this.logger.log('Rotation no longer due (another pod rotated) — skipping');
        return;
      }
      await this.performKeyRotation('scheduled');
    });
  }

  /**
   * Acquire the Postgres advisory lock for the rotation scope. Returns true
   * if the lock was acquired (and the work was run); false if another pod
   * holds it. Lock is released regardless of success/failure of the work.
   *
   * `pg_try_advisory_lock` is non-blocking — we want skip-if-busy semantics
   * here, not wait. The lock is session-scoped, so it auto-releases if the
   * pod crashes mid-rotation.
   */
  private async withRotationLock(work: () => Promise<void>): Promise<boolean> {
    const acquireRows = (await this.db.execute(
      sql`SELECT pg_try_advisory_lock(hashtext(${ROTATION_LOCK_NAMESPACE})) AS got`,
    )) as unknown as { rows: Array<{ got: boolean }> };
    const acquired = acquireRows.rows?.[0]?.got === true;

    if (!acquired) {
      this.logger.log(
        'Rotation lock held by another pod — skipping this tick',
      );
      return false;
    }

    try {
      await work();
      return true;
    } finally {
      await this.db
        .execute(
          sql`SELECT pg_advisory_unlock(hashtext(${ROTATION_LOCK_NAMESPACE}))`,
        )
        .catch((err) => {
          // Lock auto-releases at session end, so failure here is non-fatal.
          this.logger.warn(
            { err: err instanceof Error ? err.message : String(err) },
            'Failed to release rotation advisory lock (session-end fallback applies)',
          );
        });
    }
  }

  /**
   * Check if current time is within maintenance window
   */
  private isInMaintenanceWindow(): boolean {
    const now = new Date();
    const [windowHour, windowMinute] = this.config.maintenanceWindowStart
      .split(':')
      .map(Number);

    const windowStart = new Date(now);
    windowStart.setUTCHours(windowHour, windowMinute, 0, 0);

    const windowEnd = new Date(windowStart);
    windowEnd.setUTCMinutes(windowEnd.getUTCMinutes() + this.config.maintenanceWindowDuration);

    return now >= windowStart && now < windowEnd;
  }

  /**
   * Check if rotation interval has elapsed since last rotation
   */
  private isRotationDue(): boolean {
    if (!this.lastRotationTime) {
      return true;
    }

    const intervalMs = this.config.scheduleIntervalDays * 24 * 60 * 60 * 1000;
    const timeSinceLastRotation = Date.now() - this.lastRotationTime.getTime();
    return timeSinceLastRotation >= intervalMs;
  }

  /**
   * Read persisted lastRotationTime from `system_config`. Returns null when
   * the row is missing (first ever rotation) or the value is unparseable.
   */
  private async loadLastRotationTime(): Promise<Date | null> {
    const result = (await this.db.execute(
      sql`SELECT value FROM system_config WHERE key = ${LAST_ROTATION_KEY} LIMIT 1`,
    )) as unknown as { rows: Array<{ value: string }> };
    const value = result.rows?.[0]?.value;
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  /**
   * Persist lastRotationTime so other pods see it on their next tick.
   */
  private async saveLastRotationTime(when: Date): Promise<void> {
    await this.db.execute(
      sql`
        INSERT INTO system_config (guuid, key, value, description, is_active, is_secret, created_at, updated_at)
        VALUES (gen_random_uuid(), ${LAST_ROTATION_KEY}, ${when.toISOString()}, 'Timestamp of last successful JWT key rotation (set by KeyRotationScheduler)', true, false, NOW(), NOW())
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = NOW()
      `,
    );
  }

  /**
   * Perform key rotation.
   * Caller is responsible for holding the advisory lock.
   *
   * 1. Archive current key as fallback
   * 2. Generate new RSA key pair
   * 3. Update JWTConfigService with new key
   * 4. Persist lastRotationTime
   * 5. Alert success/failure
   *
   * Zero-downtime: Old key remains valid in JWKS for 30 days
   */
  async performKeyRotation(reason: 'scheduled' | 'emergency'): Promise<void> {
    const startTime = Date.now();
    const oldKid = this.jwtConfig.getCurrentKid();

    this.logger.log(
      `Starting ${reason} key rotation (current kid: ${oldKid.substring(0, 8)}...)`,
    );

    try {
      this.jwtConfig.archiveCurrentKeyAsFallback();

      const newKeyPair = await this.generateNewKeyPair();
      if (!newKeyPair) {
        throw new InternalServerException(errPayload(ErrorCode.INTERNAL_SERVER_ERROR));
      }

      const newKid = this.jwtConfig.getCurrentKid();
      const duration = Date.now() - startTime;

      const rotatedAt = new Date();
      this.lastRotationTime = rotatedAt;
      await this.saveLastRotationTime(rotatedAt);

      this.logger.log(
        `✅ Key rotation completed in ${duration}ms (old: ${oldKid.substring(0, 8)}... → new: ${newKid.substring(0, 8)}...)`,
      );

      await this.alertService.alertRotationSuccess({
        oldKid,
        newKid,
        reason,
        durationMs: duration,
        rotatedAt,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `❌ Key rotation FAILED after ${duration}ms: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );

      await this.alertService.alertRotationFailure({
        oldKid,
        reason,
        error: error instanceof Error ? error.message : String(error),
        durationMs: duration,
        timestamp: new Date(),
      });

      throw error;
    }
  }

  /**
   * Generate a new RSA-2048 keypair, atomically replace the on-disk PEM files,
   * and install the new pair as the active signing key in JWTConfigService.
   *
   * The caller has already invoked `jwtConfig.archiveCurrentKeyAsFallback()`,
   * so the previous public key remains in JWKS for the grace period — JWTs
   * signed before this rotation continue to verify cleanly until expiry.
   *
   * For HSM/KMS-backed deployments, replace this method with one that calls
   * the key management service: generate inside the HSM, fetch the public key
   * for JWKS, and configure JWT signing to call HSM `Sign` instead of using a
   * local private PEM. The public method shape stays the same.
   */
  private async generateNewKeyPair(): Promise<{
    privateKey: string;
    publicKey: string;
  }> {
    const newKeyPair = RSAKeyManager.generateAndRotateKeys();
    this.jwtConfig.installNewKeyPair(newKeyPair.privateKey, newKeyPair.publicKey);
    return newKeyPair;
  }
}
