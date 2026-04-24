import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JWTConfigService } from '../../../../../config/jwt.config';
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
 * Automated JWT Key Rotation Scheduler
 *
 * Responsibilities:
 * - Schedule automatic key rotation at configured intervals
 * - Perform zero-downtime key rotation (archive old key, generate new one)
 * - Alert on rotation success/failure
 * - Provide manual rotation trigger for emergency key compromise
 *
 * Strategy:
 * 1. Active key: Used for new token signatures
 * 2. Fallback keys: Kept for 30 days (grace period for offline clients)
 * 3. Rotation: Every 30 days (configurable)
 * 4. Zero-downtime: Old key kept in fallback array, new key becomes active
 * 5. Alerts: Success/failure notifications via structured pino logs and Slack (email not implemented)
 *
 * Configuration (env vars):
 * - JWT_KEY_ROTATION_ENABLED=true
 * - JWT_KEY_ROTATION_INTERVAL_DAYS=30
 * - JWT_ROTATION_WINDOW_START=02:00 (UTC)
 * - JWT_ROTATION_WINDOW_DURATION=60
 */
@Injectable()
export class KeyRotationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KeyRotationScheduler.name);
  private rotationInterval: ReturnType<typeof setInterval> | null = null;
  private lastRotationTime: Date | null = null;
  private readonly config: KeyRotationConfig;

  constructor(
    private readonly jwtConfig: JWTConfigService,
    private readonly alertService: KeyRotationAlertService,
    configService: ConfigService,
  ) {
    this.config = {
      enabled: configService.get('JWT_KEY_ROTATION_ENABLED', true),
      scheduleIntervalDays: configService.get('JWT_KEY_ROTATION_INTERVAL_DAYS', 30),
      maintenanceWindowStart: configService.get('JWT_ROTATION_WINDOW_START', '02:00'),
      maintenanceWindowDuration: configService.get('JWT_ROTATION_WINDOW_DURATION', 60),
    };
  }

  /**
   * Initialize scheduler on module startup
   */
  async onModuleInit() {
    if (!this.config.enabled) {
      this.logger.log('Key rotation scheduler is disabled');
      return;
    }

    this.logger.log(
      `Key rotation scheduler initialized (interval: ${this.config.scheduleIntervalDays} days)`,
    );

    // Start the rotation scheduler
    this.startScheduler();
  }

  /**
   * Clean up scheduler on module destroy
   */
  onModuleDestroy() {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.logger.log('Key rotation scheduler stopped');
    }
  }

  /**
   * Start the automatic rotation scheduler
   * Runs a check every hour to see if rotation is needed
   */
  private startScheduler() {
    // Check every hour if we need to rotate
    this.rotationInterval = setInterval(async () => {
      await this.checkAndRotateIfNeeded();
    }, 60 * 60 * 1000); // 1 hour

    // Also run check on startup (in case server was down)
    this.checkAndRotateIfNeeded().catch((error) => {
      this.logger.error('Initial rotation check failed', error);
    });
  }

  /**
   * Check if rotation is needed based on schedule and maintenance window.
   * Performs rotation if conditions are met.
   *
   * MULTI-POD WARNING: This check runs independently on every pod via setInterval.
   * `lastRotationTime` is in-process — two pods that both pass `isRotationDue()`
   * in the same maintenance window will both call `performKeyRotation()`, potentially
   * writing two different new keys simultaneously (split-brain).
   *
   * Mitigation path: add a distributed lock (Redis SET rotationLock EX 3600 NX)
   * at the top of this method — skip the rotation if the lock cannot be acquired.
   * Until that is implemented, ensure only ONE replica has JWT_KEY_ROTATION_ENABLED=true
   * via a Kubernetes leader-election init container or equivalent.
   */
  private async checkAndRotateIfNeeded(): Promise<void> {
    // Check if we're in maintenance window
    if (!this.isInMaintenanceWindow()) {
      return;
    }

    // Check if enough time has passed since last rotation
    if (!this.isRotationDue()) {
      return;
    }

    // Perform rotation
    await this.performKeyRotation('scheduled');
  }

  /**
   * Check if current time is within maintenance window
   * Prevents rotation during peak traffic hours
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
      return true; // Always rotate on first check
    }

    const intervalMs = this.config.scheduleIntervalDays * 24 * 60 * 60 * 1000;
    const timeSinceLastRotation = Date.now() - this.lastRotationTime.getTime();
    return timeSinceLastRotation >= intervalMs;
  }

  /**
   * Perform key rotation
   * 1. Archive current key as fallback
   * 2. Generate new RSA key pair
   * 3. Update JWTConfigService with new key
   * 4. Alert success/failure
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
      // Step 1: Archive the current active key as fallback
      this.jwtConfig.archiveCurrentKeyAsFallback();

      // Step 2: Generate new RSA key pair
      // Currently returns null — key generation must be done externally via HSM/KMS.
      // When ready, implement generateNewKeyPair() to call your key management service.
      const newKeyPair = await this.generateNewKeyPair();
      if (!newKeyPair) {
        this.logger.warn(
          'Key generation not yet implemented — rotate keys manually: ' +
          '1) Generate new PEM files via HSM/KMS, ' +
          '2) Replace secrets/jwt_rsa_*.pem, ' +
          '3) Restart the service.',
        );
        throw new InternalServerException(errPayload(ErrorCode.INTERNAL_SERVER_ERROR));
      }

      const newKid = this.jwtConfig.getCurrentKid();
      const duration = Date.now() - startTime;

      this.lastRotationTime = new Date();

      this.logger.log(
        `✅ Key rotation completed in ${duration}ms (old: ${oldKid.substring(0, 8)}... → new: ${newKid.substring(0, 8)}...)`,
      );

      // Alert success
      await this.alertService.alertRotationSuccess({
        oldKid,
        newKid,
        reason,
        durationMs: duration,
        rotatedAt: this.lastRotationTime,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `❌ Key rotation FAILED after ${duration}ms: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );

      // Alert failure (critical!)
      await this.alertService.alertRotationFailure({
        oldKid,
        reason,
        error: error instanceof Error ? error.message : String(error),
        durationMs: duration,
        timestamp: new Date(),
      });

      // Re-throw to trigger application-level alerting
      throw error;
    }
  }

  // Key generation is intentionally not implemented — use HSM/KMS externally.
  // To rotate: replace secrets/jwt_rsa_*.pem and restart the service.
  private async generateNewKeyPair(): Promise<{
    privateKey: string;
    publicKey: string;
  } | null> {
    this.logger.warn(
      'Key generation not implemented in application (use HSM/KMS in production)',
    );
    return null;
  }

  /**
   * Manual trigger for emergency key rotation
   * Use only if current key is compromised
   *
   * Call via admin endpoint: POST /admin/auth/rotate-keys-emergency
   */
  async rotateKeysEmergency(): Promise<{
    success: boolean;
    oldKid: string;
    newKid: string;
    message: string;
  }> {
    const oldKid = this.jwtConfig.getCurrentKid();
    await this.performKeyRotation('emergency');
    const newKid = this.jwtConfig.getCurrentKid();
    return {
      success: true,
      oldKid,
      newKid,
      message: 'Emergency key rotation completed successfully',
    };
  }

  /**
   * Get current rotation status
   */
  getRotationStatus(): {
    enabled: boolean;
    currentKid: string;
    lastRotation: Date | null;
    nextRotationWindow: {
      start: string;
      duration: number;
    };
    fallbackKeysCount: number;
    activeKeys: Array<{
      kid: string;
      type: 'active' | 'fallback';
      expiresAt?: string;
    }>;
  } {
    return {
      enabled: this.config.enabled,
      currentKid: this.jwtConfig.getCurrentKid(),
      lastRotation: this.lastRotationTime,
      nextRotationWindow: {
        start: this.config.maintenanceWindowStart,
        duration: this.config.maintenanceWindowDuration,
      },
      fallbackKeysCount: this.jwtConfig.listActiveKeys().filter((k) => k.type === 'fallback')
        .length,
      activeKeys: this.jwtConfig.listActiveKeys(),
    };
  }
}
