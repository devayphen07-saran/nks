import * as crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { AUTH_CONSTANTS } from '../../constants/app-constants';
import type { SessionUpdateContext } from '../session-context';

type RotationInput = { lastRotatedAt: Date | null; createdAt: Date };
type ContextInput = { id: number; csrfSecret: string };

/**
 * SessionLifecycleService — session lifecycle decisions for AuthGuard.
 *
 * Two responsibilities:
 *   isRotationDue()       — pure time-based check; guard decides whether to flag rotation.
 *   buildSessionContext() — constructs the SessionUpdateContext stamped on req.sessionContext.
 *
 * Extracting context construction here keeps AuthGuard a pure orchestrator:
 * no crypto, no object construction, just delegation.
 */
@Injectable()
export class SessionLifecycleService {
  isRotationDue(session: RotationInput): boolean {
    const lastRotated = session.lastRotatedAt ?? session.createdAt;
    return Date.now() - lastRotated.getTime() >= AUTH_CONSTANTS.SESSION.ROTATION_INTERVAL_SECONDS * 1000;
  }

  /**
   * Build the typed signal that AuthGuard stamps on req.sessionContext.
   *
   * @param isRotateCsrf — true when the handler is decorated with @RotateCsrf().
   *   csrfSecretOverride is generated here so crypto stays in the lifecycle layer,
   *   not scattered across the guard.
   */
  buildSessionContext(
    token: string,
    session: ContextInput,
    shouldRotateSession: boolean,
    isRotateCsrf: boolean,
  ): SessionUpdateContext {
    return {
      authType: 'cookie',
      sessionToken: token,
      sessionId: session.id,
      csrfSecret: session.csrfSecret,
      shouldRotateSession,
      csrfSecretOverride: isRotateCsrf
        ? crypto.randomBytes(32).toString('hex')
        : undefined,
    };
  }
}
