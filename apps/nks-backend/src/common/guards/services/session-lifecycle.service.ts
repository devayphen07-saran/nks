import { Injectable } from '@nestjs/common';
import { AUTH_CONSTANTS } from '../../constants/app-constants';

/**
 * SessionLifecycleService — pure rotation-due check.
 *
 * The guard uses this to decide whether to flag `shouldRotateSession` in
 * `_pendingSessionUpdates`. The actual DB rotation and cookie writes are
 * handled post-handler by SessionRotationInterceptor, keeping the guard a
 * pure validation layer.
 */
@Injectable()
export class SessionLifecycleService {
  isRotationDue(session: { lastRotatedAt: Date | null; createdAt: Date }): boolean {
    const lastRotated = session.lastRotatedAt ?? session.createdAt;
    return Date.now() - lastRotated.getTime() >= AUTH_CONSTANTS.SESSION.ROTATION_INTERVAL_SECONDS * 1000;
  }
}
