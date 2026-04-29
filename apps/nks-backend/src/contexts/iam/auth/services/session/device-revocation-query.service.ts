import { Injectable } from '@nestjs/common';
import { RevokedDevicesRepository } from '../../repositories/revoked-devices.repository';

/**
 * DeviceRevocationQueryService — narrow read surface that lets services in
 * other contexts (currently `SyncService` in `contexts/sync`) check device
 * revocation status without importing `RevokedDevicesRepository` directly.
 *
 * Keeps the iam/auth repository layer fully internal to this context.
 * Mutation flows (actual `revoke(...)`) continue to go through
 * `SessionService.terminateSession`; this service is read-only by design.
 *
 * See BACKEND_ARCHITECTURE.md § Module-boundary rules.
 */
@Injectable()
export class DeviceRevocationQueryService {
  constructor(
    private readonly revokedDevicesRepository: RevokedDevicesRepository,
  ) {}

  /**
   * True iff the given (userId, deviceId) pair has been explicitly revoked.
   * Used by the sync push handler to reject offline operations from a
   * device whose session was terminated, even while its 3-day offline HMAC
   * signature is still cryptographically valid.
   */
  isRevoked(userId: number, deviceId: string): Promise<boolean> {
    return this.revokedDevicesRepository.isRevoked(userId, deviceId);
  }
}
