import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ForbiddenException } from '../../exceptions';
import { ErrorCode } from '../../constants/error-codes.constants';
import { AUTH_CONSTANTS } from '../../constants/app-constants';
import { CsrfTokenService } from '../../middleware/csrf-token.service';

// Methods that mutate server state — CSRF enforcement applies only to these.
const CSRF_UNSAFE_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

/**
 * CSRF validation and cookie sync logic extracted from AuthGuard.
 *
 * validate() — throws ForbiddenException for invalid/missing X-CSRF-Token on
 *   state-mutating requests (POST/PUT/DELETE/PATCH).
 *
 * syncCookie() — keeps the csrf_token cookie current with the session's
 *   csrfSecret so the web client always has the right value to send.
 */
@Injectable()
export class CsrfValidationService {
  constructor(private readonly csrfToken: CsrfTokenService) {}

  validate(req: Request, csrfSecretOrToken: string): void {
    if (!CSRF_UNSAFE_METHODS.has(req.method)) return;

    const expected = this.csrfToken.computeForSession(csrfSecretOrToken);
    const provided = req.headers['x-csrf-token'];

    if (typeof provided !== 'string' || !this.csrfToken.validate(provided, expected)) {
      throw new ForbiddenException({
        errorCode: ErrorCode.FORBIDDEN,
        message: 'CSRF token missing or invalid',
      });
    }
  }

  syncCookie(req: Request, res: Response, csrfSecretOrToken: string): void {
    const expected = this.csrfToken.computeForSession(csrfSecretOrToken);
    const existing = (req.cookies as Record<string, string | undefined>)['csrf_token'];
    if (existing === expected) return;

    const sameSite = AUTH_CONSTANTS.SESSION.COOKIE_SAME_SITE;
    res.cookie('csrf_token', expected, {
      httpOnly: false,
      secure: AUTH_CONSTANTS.SESSION.COOKIE_SECURE || sameSite === 'none',
      sameSite,
      maxAge: AUTH_CONSTANTS.SESSION.EXPIRY_SECONDS * 1000,
      path: '/',
    });
  }
}
