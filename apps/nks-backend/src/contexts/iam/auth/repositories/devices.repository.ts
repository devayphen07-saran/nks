import { Injectable } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import * as schema from '../../../../core/database/schema';
import type { DeviceRegistration, NewDeviceRegistration } from '../../../../core/database/schema/devices';
import type { DbTransaction } from '../../../../core/database/transaction.service';

type Db = NodePgDatabase<typeof schema>;

/**
 * DevicesRepository — CRUD operations for device registrations.
 *
 * Handles: find, upsert, bump lastSeenAt
 * Does NOT handle: business logic or multi-tenancy checks
 */
@Injectable()
export class DevicesRepository extends BaseRepository {
  constructor(@InjectDb() db: Db) {
    super(db);
  }

  /**
   * Find a device registration by (device_id, user_fk, store_fk) tuple.
   * Returns null if not found.
   */
  async findByDeviceAndUserAndStore(
    deviceId: string,
    userId: number,
    storeId: number,
  ): Promise<DeviceRegistration | null> {
    const [registration] = await this.db
      .select()
      .from(schema.deviceRegistration)
      .where(
        and(
          eq(schema.deviceRegistration.deviceId, deviceId),
          eq(schema.deviceRegistration.userId, userId),
          eq(schema.deviceRegistration.storeId, storeId),
        ),
      )
      .limit(1);

    return registration ?? null;
  }

  /**
   * Upsert a device registration.
   * If (device_id, user_fk, store_fk) exists, bump lastSeenAt.
   * If not, create a new row.
   *
   * Pass `tx` when this needs to be atomic with another write — e.g. the
   * switch-store flow updates session.activeStoreFk and registers the
   * device for the new store inside one transaction so a sync request
   * cannot land in the gap.
   */
  async upsert(
    data: NewDeviceRegistration,
    tx?: DbTransaction,
  ): Promise<DeviceRegistration> {
    const conn = tx ?? this.db;
    const [registration] = await conn
      .insert(schema.deviceRegistration)
      .values(data)
      .onConflictDoUpdate({
        target: [
          schema.deviceRegistration.deviceId,
          schema.deviceRegistration.userId,
          schema.deviceRegistration.storeId,
        ],
        set: {
          lastSeenAt: new Date(),
        },
      })
      .returning();

    return registration;
  }

  /**
   * Bump lastSeenAt for a registration by id.
   * Fire-and-forget operation: catches errors internally, doesn't throw.
   */
  async bumpLastSeen(registrationId: number): Promise<void> {
    try {
      await this.db
        .update(schema.deviceRegistration)
        .set({ lastSeenAt: new Date() })
        .where(eq(schema.deviceRegistration.id, registrationId))
        .execute();
    } catch {
      // Silently ignore errors — this is a telemetry operation
    }
  }
}
