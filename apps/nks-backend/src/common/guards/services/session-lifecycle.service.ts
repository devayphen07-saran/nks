import { Injectable, Logger } from '@nestjs/common';
import { AUTH_CONSTANTS } from '../../constants/app-constants';
import type { SessionUpdateContext } from '../session-context';

type RotationInput = { lastRotatedAt: Date | null; createdAt: Date };

/**
 * SessionLifecycleService — session lifecycle decisions for AuthGuard.
 *
 *   isRotationDue()       — pure time-based check; guard decides whether to flag rotation.
 *   buildSessionContext() — constructs the SessionUpdateContext stamped on req.sessionContext.
 */
@Injectable()
export class SessionLifecycleService {
  private readonly logger = new Logger(SessionLifecycleService.name);

  isRotationDue(session: RotationInput): boolean {
    const lastRotated = session.lastRotatedAt ?? session.createdAt;
    return Date.now() - lastRotated.getTime() >= AUTH_CONSTANTS.SESSION.ROTATION_INTERVAL_SECONDS * 1000;
  }

  buildSessionContext(
    token: string,
    sessionId: number,
    shouldRotateSession: boolean,
  ): SessionUpdateContext {
    return {
      authType: 'cookie',
      sessionToken: token,
      sessionId,
      shouldRotateSession,
    };
  }
}
