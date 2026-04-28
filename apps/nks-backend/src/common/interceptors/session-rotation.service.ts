import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthContextService } from '../../contexts/iam/auth/services/session/auth-context.service';
import { AuthControllerHelpers } from '../utils/auth-helpers';
import { AUTH_CONSTANTS } from '../constants/app-constants';
import { CsrfService } from '../csrf.service';
import type { SessionUpdateContext } from '../guards/session-context';

/**
 * SessionRotationService — all DB and cookie side effects for session rotation.
 *
 * Extracted from SessionRotationInterceptor so the interceptor is a thin
 * orchestrator (reads context, checks headersSent, delegates here).
 *
 * Three cases, each delegating CSRF cookie work to CsrfService.refresh():
 *   shouldRotateSession  — rolling rotation: new token + new CSRF secret.
 *   csrfSecretOverride   — @RotateCsrf() route: CSRF secret only, token unchanged.
 *   neither              — no rotation: sync the CSRF cookie if stale.
 */
@Injectable()
export class SessionRotationService {
  private readonly logger = new Logger(SessionRotationService.name);

  constructor(
    private readonly authContext: AuthContextService,
    private readonly csrf: CsrfService,
  ) {}

  async applyUpdates(req: Request, res: Response, ctx: SessionUpdateContext): Promise<void> {
    if (ctx.shouldRotateSession) {
      const newToken = crypto.randomBytes(32).toString('hex');
      const newCsrfSecret = crypto.randomBytes(32).toString('hex');
      const newExpiresAt = new Date(
        Date.now() + AUTH_CONSTANTS.SESSION.EXPIRY_SECONDS * 1000,
      );

      const rotated = await this.authContext.rotateSessionToken(
        ctx.sessionToken,
        newToken,
        newExpiresAt,
        newCsrfSecret,
      );

      if (rotated) {
        AuthControllerHelpers.setSessionCookie(res, newToken);
        this.csrf.refresh(req, res, newCsrfSecret);
      } else {
        // Another concurrent request already rotated — sync CSRF with the
        // existing secret so the cookie doesn't go stale.
        this.logger.debug('Session rotation skipped — concurrent rotation already applied.');
        this.csrf.refresh(req, res, ctx.csrfSecret);
      }
    } else if (ctx.csrfSecretOverride) {
      // @RotateCsrf() route: rotate only the CSRF secret, not the session token.
      this.authContext
        .rotateCsrfSecret(ctx.sessionId, ctx.csrfSecretOverride)
        .catch((e: unknown) =>
          this.logger.warn(
            `rotateCsrfSecret failed session=${ctx.sessionId}: ${e instanceof Error ? e.message : String(e)}`,
          ),
        );
      this.csrf.refresh(req, res, ctx.csrfSecretOverride);
    } else {
      // No rotation — only refresh CSRF cookie if it is completely absent.
      // The cookie is set at login and stays in sync through rotation (Cases A/B).
      // Recomputing on every non-rotating request adds HMAC overhead with no gain.
      const cookies = req.cookies as Record<string, string | undefined>;
      if (!cookies['csrf_token']) {
        this.csrf.refresh(req, res, ctx.csrfSecret);
      }
    }
  }
}
