import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../core/database/schema';
import { deviceRegistration } from '../../../core/database/schema/devices';
import { eq, and } from 'drizzle-orm';
import type { DeviceContext } from '../types/device-context';

/**
 * DeviceAuthGuard validates and populates device context for sync requests.
 *
 * IMPORTANT: This guard depends on the global AuthGuard having already run.
 * AuthGuard populates req.user = { userId, activeStoreId, ... }.
 * DeviceAuthGuard reads req.user + X-Device-Id header, verifies the device
 * is registered to that user's active store, and attaches DeviceContext.
 *
 * If AuthGuard is ever removed or reordered, this guard will fail because
 * req.user won't be populated.
 *
 * Guard order:
 * 1. Global AuthGuard (all routes) — validates JWT, populates req.user
 * 2. DeviceAuthGuard (sync routes only) — validates device registration
 *
 * If either fails, the request is rejected with 403 Forbidden.
 */
@Injectable()
export class DeviceAuthGuard implements CanActivate {
  private readonly logger = new Logger(DeviceAuthGuard.name);

  constructor(@InjectDb() private readonly db: NodePgDatabase<typeof schema>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Extract device ID from header
    const deviceId = this.extractDeviceId(request);
    if (!deviceId) {
      throw new ForbiddenException('X-Device-Id header required');
    }

    // Extract authenticated user from global AuthGuard
    const userId = request.user?.userId;
    const activeStoreId = request.user?.activeStoreId;

    if (!userId || !activeStoreId) {
      throw new ForbiddenException('Auth context missing');
    }

    // Look up device registration. If missing, self-heal: AuthGuard has
    // already confirmed the user has live role access to activeStoreId
    // (otherwise that field is null), so the missing piece is just the
    // device row. Recreating it is not a privilege grant — it just records
    // an authorized device for access the user already has.
    //
    // The race between this UPSERT and another in-flight registration is
    // handled by the unique (device_id, user_fk, store_fk) constraint:
    // ON CONFLICT DO NOTHING means the loser is a no-op, and we re-read.
    const existing = await this.findDeviceRegistration(
      deviceId,
      userId,
      activeStoreId,
    );
    const registration =
      existing ??
      (await this.selfHealRegistration(deviceId, userId, activeStoreId));

    if (!registration) {
      throw new ForbiddenException('Device not registered to this store');
    }

    // Bump last_seen_at (fire-and-forget, don't block the request)
    this.bumpLastSeen(registration.id).catch(() => {
      // Silently ignore failure — bumping last_seen is best-effort
    });

    // Attach DeviceContext to request
    const deviceContext: DeviceContext = {
      deviceId,
      userId,
      storeId: activeStoreId,
    };
    request.deviceContext = deviceContext;

    return true;
  }

  /**
   * Insert the device row for this (deviceId, userId, storeId) triple if it
   * doesn't exist, then return whatever the current row is. AuthGuard has
   * already confirmed the user is authenticated and has access to this
   * store (otherwise activeStoreId would be null), so creating the row is
   * safe — we are not granting new access, only recording an authorized
   * device for the existing access.
   */
  private async selfHealRegistration(
    deviceId: string,
    userId: number,
    storeId: number,
  ) {
    try {
      const now = new Date();
      await this.db
        .insert(deviceRegistration)
        .values({
          deviceId,
          userId,
          storeId,
          lastSeenAt: now,
        })
        .onConflictDoNothing({
          target: [
            deviceRegistration.deviceId,
            deviceRegistration.userId,
            deviceRegistration.storeId,
          ],
        });
      this.logger.log(
        `Self-healed device registration for user ${userId} store ${storeId}`,
      );
    } catch (err) {
      this.logger.error(
        `Self-heal failed for user ${userId} store ${storeId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
    return this.findDeviceRegistration(deviceId, userId, storeId);
  }

  /**
   * Extract X-Device-Id header from request.
   *
   * Header name is case-insensitive (Node.js/Express normalizes).
   * Trims whitespace to handle common mistakes.
   *
   * @param request - Express request object
   * @returns Device ID or null if missing
   */
  private extractDeviceId(request: any): string | null {
    const headerValue = request.headers['x-device-id'];
    if (!headerValue) {
      return null;
    }

    const deviceId = String(headerValue).trim();
    return deviceId || null;
  }

  /**
   * Find device registration by device ID, user ID, and store ID.
   *
   * Unique constraint: (device_id, user_fk, store_fk).
   * If device is registered to user A but request comes from user B, rejected.
   * If device is registered to store X but user's active store is Y, rejected.
   *
   * @param deviceId - Stable device UUID
   * @param userId - Internal user ID
   * @param storeId - Active store ID
   * @returns Registration row or null
   */
  private async findDeviceRegistration(
    deviceId: string,
    userId: number,
    storeId: number,
  ) {
    const result = await this.db
      .select()
      .from(deviceRegistration)
      .where(
        and(
          eq(deviceRegistration.deviceId, deviceId),
          eq(deviceRegistration.userId, userId),
          eq(deviceRegistration.storeId, storeId),
        ),
      )
      .limit(1);

    return result[0] || null;
  }

  /**
   * Update last_seen_at to current time.
   *
   * Fire-and-forget: used for tracking active devices, doesn't block requests.
   *
   * @param registrationId - Registration ID to update
   */
  private async bumpLastSeen(registrationId: string | number): Promise<void> {
    await this.db
      .update(deviceRegistration)
      .set({ lastSeenAt: new Date() })
      .where(eq(deviceRegistration.id, registrationId as any))
      .execute();
  }
}
