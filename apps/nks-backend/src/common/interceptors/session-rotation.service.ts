import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthContextService } from '../../contexts/iam/auth/services/session/auth-context.service';
import { AuthControllerHelpers } from '../utils/auth-helpers';
import { AUTH_CONSTANTS } from '../constants/app-constants';
import type { SessionUpdateContext } from '../guards/session-context';

/**
 * SessionRotationService — DB + cookie side effects for rolling session rotation.
 *
 * Only one concern now: when the 1-hour rotation window has elapsed, mint a
 * fresh session token, CAS-rotate the row, and reset the cookie. CSRF lives
 * on its own pure double-submit cookie that does not need to rotate with the
 * session — see CsrfService.
 */
@Injectable()
export class SessionRotationService {
  private readonly logger = new Logger(SessionRotationService.name);

  constructor(private readonly authContext: AuthContextService) {}

  async applyUpdates(_req: Request, res: Response, ctx: SessionUpdateContext): Promise<void> {
    if (!ctx.shouldRotateSession) return;

    const newToken = crypto.randomBytes(32).toString('hex');
    const newExpiresAt = new Date(
      Date.now() + AUTH_CONSTANTS.SESSION.EXPIRY_SECONDS * 1000,
    );

    const rotated = await this.authContext.rotateSessionToken(
      ctx.sessionToken,
      newToken,
      newExpiresAt,
    );

    if (rotated) {
      AuthControllerHelpers.setSessionCookie(res, newToken);
    } else {
      this.logger.debug('Session rotation skipped — concurrent rotation already applied.');
    }
  }
}
