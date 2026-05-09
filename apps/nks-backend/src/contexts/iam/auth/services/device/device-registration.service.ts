import { Injectable, Logger } from '@nestjs/common';
import { DevicesRepository } from '../../repositories/devices.repository';
import type { DeviceRegistration } from '../../../../../core/database/schema';
import type { DbTransaction } from '../../../../../core/database/transaction.service';

/**
 * DeviceRegistrationService handles mobile device registration and lifecycle.
 *
 * Devices register at (device_id, user_id, store_id) tuples. When a user
 * switches stores, we UPSERT a new row for the new store. Old rows remain
 * in the DB but are orphaned (never queried again).
 *
 * This service has no business logic — it delegates to DevicesRepository.
 * Authorization checks (user can access store) happen at the controller level.
 */
@Injectable()
export class DeviceRegistrationService {
  private readonly logger = new Logger(DeviceRegistrationService.name);

  constructor(private readonly devicesRepo: DevicesRepository) {}

  /**
   * Register or update a device for a user at a store.
   *
   * UPSERT pattern: if (device_id, user_id, store_id) exists, bump lastSeenAt.
   * If not, create a new row.
   *
   * Called on:
   * - Login: registerDevice(userId, user.defaultStoreId, deviceId)
   * - Store switch: registerDevice(userId, newStoreId, deviceId)
   *
   * @param userId User ID
   * @param storeId Store ID (active or default)
   * @param deviceId Stable device UUID from mobile
   * @returns The registration row (created or updated)
   */
  async registerDevice(
    userId: number,
    storeId: number,
    deviceId: string,
    tx?: DbTransaction,
  ): Promise<DeviceRegistration> {
    const registration = await this.devicesRepo.upsert(
      {
        deviceId,
        userId,
        storeId,
        lastSeenAt: new Date(),
      },
      tx,
    );

    this.logger.debug(
      `Device registered: device_id=${deviceId}, user_id=${userId}, store_id=${storeId}`,
    );

    return registration;
  }

  /**
   * Find a device registration by (device_id, user_id, store_id).
   *
   * Used by DeviceAuthGuard to validate sync requests:
   * Guard checks if this (device, user, CURRENT_active_store) exists.
   * If not, sync is forbidden.
   *
   * @param deviceId Device UUID
   * @param userId User ID
   * @param storeId Store ID (from JWT activeStoreId)
   * @returns The registration row or null if not found
   */
  async findByDeviceAndUserAndStore(
    deviceId: string,
    userId: number,
    storeId: number,
  ): Promise<DeviceRegistration | null> {
    return this.devicesRepo.findByDeviceAndUserAndStore(
      deviceId,
      userId,
      storeId,
    );
  }

  /**
   * Bump lastSeenAt for a registration.
   *
   * Called by DeviceAuthGuard on every sync request (fire-and-forget).
   * Errors are silently ignored — this is a telemetry operation.
   *
   * @param registrationId Registration row ID
   */
  async bumpLastSeen(registrationId: number): Promise<void> {
    await this.devicesRepo.bumpLastSeen(registrationId);
  }
}
