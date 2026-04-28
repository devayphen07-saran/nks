import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AppConfigService } from '../../config/app-config.service';
import { CsrfService } from '../csrf.service';

/**
 * CsrfMiddleware — pre-auth CSRF cookie bootstrapper.
 *
 * Responsibility: ensure the web client has a csrf_token cookie BEFORE a
 * session exists so the login/register form can include X-CSRF-Token.
 * This is the double-submit baseline for unauthenticated requests.
 *
 * The token is IP-bound: HMAC-SHA256(nonce:clientIp, CSRF_HMAC_SECRET).
 * Binding to the originating IP makes the token harder to reuse from a
 * different network context even if intercepted.
 *
 * What this middleware does NOT do:
 *   - Validate X-CSRF-Token (guard owns that for authenticated routes)
 *   - Touch the csrf_token cookie for authenticated sessions
 *     (cookie is always present after login; if it exists, this branch is a no-op)
 *
 * Skip conditions (no cookie work needed):
 *   - GET / HEAD / OPTIONS  — safe methods, no state mutation
 *   - Authorization: Bearer — mobile/API clients, no cookies involved
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  constructor(
    private readonly appConfig: AppConfigService,
    private readonly csrf: CsrfService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Safe methods cannot carry state-mutating side effects — nothing to protect.
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();

    // Bearer clients don't use cookies — CSRF is irrelevant.
    if (req.headers['authorization']?.startsWith('Bearer ')) return next();

    // Set a pre-auth CSRF cookie if none exists.
    // Authenticated sessions: csrf_token is always set in the login/register/
    //   OTP-verify/refresh response and kept fresh by SessionRotationService —
    //   the cookie will already be present, so this branch is a no-op.
    // Unauthenticated: provides an IP-bound baseline so the web app has a
    //   csrf_token cookie available before any session exists.
    const cookies = req.cookies as Record<string, string | undefined>;
    if (!cookies['csrf_token']) {
      const sameSite = this.appConfig.csrfSameSite;
      res.cookie('csrf_token', this.csrf.generate(), {
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
