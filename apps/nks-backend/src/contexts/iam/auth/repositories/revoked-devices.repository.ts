import { Injectable, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, lt } from 'drizzle-orm';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import * as schema from '../../../../core/database/schema';

type Db = NodePgDatabase<typeof schema>;


/**
 * RevokedDevicesRepository
 *
 * Maintains the list of devices whose offline sync access has been revoked.
 * A device is revoked when its session is explicitly terminated (e.g., stolen
 * device) so that its still-valid 3-day offline HMAC cannot be used to push
 * mutations.
 *
 * Entries are automatically cleaned up after 3 days (the offline session TTL),
 * at which point the HMAC would be expired anyway.
 */
@Injectable()
export class RevokedDevicesRepository extends BaseRepository {
  private readonly logger = new Logger(RevokedDevicesRepository.name);

  constructor(@InjectDb() db: Db) { super(db); }

  /**
   * Record a device revocation.
   * Called when a session that carries a deviceId is terminated.
   *
   * @param userFk    - Owner of the device
   * @param deviceId  - Stable device identifier stored in user_session.device_id
   * @param revokedBy - Actor who triggered the revocation (null for self-initiated logout)
   */
  async revoke(
    userFk: number,
    deviceId: string,
    revokedBy?: number,
  ): Promise<void> {
    await this.db
      .insert(schema.revokedDevices)
      .values({ userFk, deviceId, revokedBy })
      .onConflictDoNothing(); // idempotent — duplicate revocations are fine
    this.logger.log(`Device revoked: user=${userFk} device=${deviceId} by=${revokedBy ?? 'self'}`);
  }

  /**
   * Check if a device is currently revoked.
   * Called by SyncService before accepting an offline push.
   *
   * @param userFk   - User claiming ownership of the device
   * @param deviceId - Device identifier from the offline session context
   */
  async isRevoked(userFk: number, deviceId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: schema.revokedDevices.id })
      .from(schema.revokedDevices)
      .where(
        and(
          eq(schema.revokedDevices.userFk, userFk),
          eq(schema.revokedDevices.deviceId, deviceId),
        ),
      )
      .limit(1);

    return row !== undefined;
  }

  /** Delete revocation entries older than `cutoff`. Called by SessionCleanupService. */
  async deleteExpired(cutoff: Date): Promise<void> {
    await this.db
      .delete(schema.revokedDevices)
      .where(lt(schema.revokedDevices.revokedAt, cutoff));
  }
}
