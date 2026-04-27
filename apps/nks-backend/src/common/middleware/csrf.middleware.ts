import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AppConfigService } from '../../config/app-config.service';
import { CsrfTokenService } from './csrf-token.service';
import { AuthControllerHelpers } from '../utils/auth-helpers';

/**
 * CSRF Sync Middleware — manages the csrf_token cookie lifecycle only.
 *
 * CSRF Sync Middleware — pre-auth CSRF cookie only.
 *
 * Responsibility split:
 *   Middleware: sets a random csrf_token cookie for UNAUTHENTICATED requests only.
 *              (pre-login state; double-submit baseline so the web app has a token
 *               available before the session exists)
 *   AuthGuard:  for authenticated cookie sessions, computes csrf_token from
 *              session.csrfSecret (per-session random secret stored in DB) and
 *              refreshes the cookie after every auth check.
 *
 * Skip conditions:
 *   - Bearer token requests — mobile clients; no CSRF concern.
 *   - Requests that already have an nks_session cookie — AuthGuard handles those.
 *
 * Why non-httpOnly: the double-submit pattern requires JS to read csrf_token
 * so it can echo the value in X-CSRF-Token on state-mutating requests.
 * SameSite=strict (default) means a cross-origin attacker cannot make the
 * browser send it automatically.
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  constructor(
    private readonly appConfig: AppConfigService,
    private readonly csrfToken: CsrfTokenService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Safe methods cannot carry state-mutating side effects — nothing to protect.
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();

    // Bearer clients don't use cookies — CSRF is irrelevant.
    if (req.headers['authorization']?.startsWith('Bearer ')) return next();

    const cookies = req.cookies as Record<string, string | undefined>;

    // Authenticated sessions: AuthGuard loads the session row (which carries
    // csrfSecret) and refreshes the CSRF cookie after auth. Skip here.
    if (cookies[AuthControllerHelpers.SESSION_COOKIE_NAME]) return next();

    // Unauthenticated: set a random pre-auth CSRF cookie so the web app has
    // a token value available before login completes.
    if (!cookies['csrf_token']) {
      const sameSite = this.appConfig.csrfSameSite;
      res.cookie('csrf_token', this.csrfToken.generatePreAuth(), {
        httpOnly: false,
        secure: this.appConfig.isProduction || sameSite === 'none',
        sameSite,
        maxAge: 3600 * 1000,
        path: '/',
      });
    }

    next();
  }
}
