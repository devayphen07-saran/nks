import { Injectable, Logger } from '@nestjs/common';
import { DeviceRegistrationService } from './device-registration.service';
import { SessionQueryService } from '../session/session-query.service';
import { SessionCommandService } from '../session/session-command.service';
import { TransactionService } from '../../../../../core/database/transaction.service';

/**
 * DeviceRegistrationFlowService orchestrates device registration side-effects.
 *
 * Handles the flow of:
 * - Login: register device after successful auth
 * - Store switch: register device for new store atomically with the session update
 *
 * Queries session to extract userId and storeId, delegates to DeviceRegistrationService.
 */
@Injectable()
export class DeviceRegistrationFlowService {
  private readonly logger = new Logger(DeviceRegistrationFlowService.name);

  constructor(
    private readonly deviceRegistration: DeviceRegistrationService,
    private readonly sessionQuery: SessionQueryService,
    private readonly sessionCommand: SessionCommandService,
    private readonly txService: TransactionService,
  ) {}

  /**
   * Register device after successful login.
   *
   * Looks up the session to extract userId and activeStoreId, then
   * calls registerDevice(). Errors are silently caught.
   *
   * Called by AuthController.login() after passwordAuth completes.
   *
   * @param sessionId Session ID returned by auth flow
   * @param deviceId Device UUID from X-Device-Id header
   */
  async registerAfterLogin(sessionId: string, deviceId: string): Promise<void> {
    try {
      const session = await this.sessionQuery.findSessionByIdString(sessionId);
      if (!session?.userId || session.activeStoreFk === null) {
        return;
      }

      await this.deviceRegistration.registerDevice(
        session.userId,
        session.activeStoreFk,
        deviceId,
      );
    } catch (err) {
      this.logger.debug(
        `Device registration after login failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Atomically switch the session's active store and register the device for
   * the new store. Both writes happen in a single transaction so a sync
   * request that lands between them cannot see a mismatched
   * (session.activeStoreFk, device_registration) pair.
   *
   * Errors propagate to the caller — switching stores is a user action and
   * silent failure here would strand the device on the old store with no
   * indication to the user.
   *
   * @param sessionId Session id (numeric, parsed from the session token id)
   * @param storeId   Target store id the user is switching to
   * @param deviceId  Stable device UUID from X-Device-Id header (optional —
   *                  when missing, only the session is updated)
   */
  async switchActiveStore(
    sessionId: number,
    storeId: number,
    deviceId: string | null,
  ): Promise<void> {
    // Resolve the userId before opening the transaction. The userId is
    // immutable for a session, so reading it outside the tx is safe and
    // keeps the tx scope minimal (one UPDATE + one UPSERT).
    const userId = deviceId ? await this.resolveUserId(sessionId) : null;

    await this.txService.run(
      async (tx) => {
        await this.sessionCommand.updateActiveStore(sessionId, storeId, tx);
        if (deviceId && userId !== null) {
          await this.deviceRegistration.registerDevice(
            userId,
            storeId,
            deviceId,
            tx,
          );
        }
      },
      { name: 'SwitchActiveStore' },
    );
  }

  /**
   * Register device when user switches stores.
   *
   * Legacy entry point — kept for callers that updated the session
   * separately. New code should use switchActiveStore() which makes both
   * writes atomic.
   *
   * @param sessionId Session ID (contains updated activeStoreId)
   * @param deviceId Device UUID from X-Device-Id header
   */
  async registerAfterStoreSwitch(sessionId: string, deviceId: string): Promise<void> {
    try {
      const session = await this.sessionQuery.findSessionByIdString(sessionId);
      if (!session?.userId || session.activeStoreFk === null) {
        return;
      }

      await this.deviceRegistration.registerDevice(
        session.userId,
        session.activeStoreFk,
        deviceId,
      );
    } catch (err) {
      this.logger.debug(
        `Device registration after store switch failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Look up the userId for a numeric sessionId. Used by switchActiveStore
   * to attribute the device registration to the right user.
   */
  private async resolveUserId(sessionId: number): Promise<number> {
    const session = await this.sessionQuery.findSessionByIdString(String(sessionId));
    if (!session?.userId) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return session.userId;
  }
}
