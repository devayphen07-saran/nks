import * as crypto from 'crypto';
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, from, switchMap, map } from 'rxjs';
import { AuthContextService } from '../../contexts/iam/auth/services/session/auth-context.service';
import { CsrfValidationService } from '../guards/services/csrf-validation.service';
import { AuthControllerHelpers } from '../utils/auth-helpers';
import { AUTH_CONSTANTS } from '../constants/app-constants';
import type { SessionUpdateContext } from '../guards/session-context';

/** @deprecated Import SessionUpdateContext from guards/session-context instead. */
export type PendingSessionUpdates = SessionUpdateContext;

/**
 * SessionRotationInterceptor — handles all cookie side effects after auth.
 *
 * AuthGuard stamps `req.sessionContext` after successful validation.
 * This interceptor reads that signal AFTER the handler returns and applies
 * the appropriate DB and cookie updates, keeping the guard a pure
 * validation layer (no side effects in canActivate).
 *
 * Three cases:
 *   1. shouldRotateSession — rolling rotation due: atomically replace
 *      session token + CSRF secret in DB, set new session + CSRF cookies.
 *   2. csrfSecretOverride — @RotateCsrf() route: rotate CSRF secret only,
 *      session token unchanged.
 *   3. Neither — just sync the CSRF cookie if absent/stale.
 *
 * If rotation DB write fails (race — another concurrent request won),
 * the cookie falls back to the existing CSRF secret (no broken state).
 *
 * If response headers are already sent (streaming endpoint, direct res.send()),
 * cookie writes are skipped with a warning — rotation is not attempted since
 * updating the DB without delivering the new token to the client would break
 * the next request's CSRF check.
 */
@Injectable()
export class SessionRotationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SessionRotationInterceptor.name);

  constructor(
    private readonly authContext: AuthContextService,
    private readonly csrfValidator: CsrfValidationService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    return next.handle().pipe(
      switchMap((data) =>
        from(this.applySessionUpdates(context)).pipe(map(() => data)),
      ),
    );
  }

  private async applySessionUpdates(context: ExecutionContext): Promise<void> {
    const req = context.switchToHttp().getRequest<Request>();
    const ctx = req.sessionContext;
    if (!ctx) return;

    const res = context.switchToHttp().getResponse<Response>();

    if (res.headersSent) {
      this.logger.warn(
        `Session update skipped for "${req.method} ${req.path}" — headers already sent. ` +
        'Avoid streaming responses on cookie-authenticated routes that require rotation.',
      );
      return;
    }

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
        this.csrfValidator.syncCookie(req, res, newCsrfSecret);
      } else {
        // Another concurrent request already rotated — sync CSRF with the
        // (unchanged) existing secret so the cookie doesn't go stale.
        this.logger.debug('Session rotation skipped — concurrent rotation already applied.');
        this.csrfValidator.syncCookie(req, res, ctx.csrfSecretOrToken);
      }
    } else if (ctx.csrfSecretOverride) {
      // @RotateCsrf() — rotate only the CSRF secret, not the session token.
      this.authContext
        .rotateCsrfSecret(ctx.sessionId, ctx.csrfSecretOverride)
        .catch((e: unknown) =>
          this.logger.warn(
            `rotateCsrfSecret failed session=${ctx.sessionId}: ${e instanceof Error ? e.message : String(e)}`,
          ),
        );
      this.csrfValidator.syncCookie(req, res, ctx.csrfSecretOverride);
    } else {
      // No rotation — refresh CSRF cookie if absent or stale.
      this.csrfValidator.syncCookie(req, res, ctx.csrfSecretOrToken);
    }
  }
}
