import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { ForbiddenException, UnauthorizedException } from '../../exceptions';
import { ErrorCode } from '../../constants/error-codes.constants';
import { AuthContextService } from '../../../contexts/iam/auth/services/session/auth-context.service';
import { CsrfService } from '../../csrf.service';
import type { AuthType } from './token-extractor.service';

type AuthContext = Awaited<ReturnType<AuthContextService['findSessionAuthContext']>>;
export type SessionRow = NonNullable<AuthContext['session']>;
export type UserRow = NonNullable<AuthContext['user']>;
export type RoleRow = AuthContext['roles'][number];

export interface ValidatedSession {
  session: SessionRow;
  user: UserRow;
  roles: RoleRow[];
}

/**
 * SessionValidatorService — session token validation pipeline.
 *
 * 1. Single DB round trip via AuthContextService (session + JTI + user + roles joined).
 * 2. Expiry check.
 * 3. Revocation check.
 * 4. User existence check (inner-joined, but guard for type narrowing).
 * 5. CSRF header validation for cookie sessions (delegated to CsrfService).
 * 6. Sec-Fetch-Site enforcement (defense-in-depth): Bearer requests from browser
 *    contexts are rejected. Browsers set Sec-Fetch-Site as a forbidden header
 *    (XSS on our own origin cannot forge it). Mobile apps and server clients never
 *    send it — non-breaking for legitimate callers. This is NOT the primary
 *    protection: device binding (X-Device-Id vs session.deviceId) and theft
 *    detection (CAS rotation + revoke-all-on-replay) are the real controls.
 *    Tokens exfiltrated through non-XSS channels (crash logs, leaked URLs,
 *    compromised mobile keychain) bypass this check entirely.
 *
 * Returns ValidatedSession (session + pre-fetched user + roles) or throws; never returns null.
 */
@Injectable()
export class SessionValidatorService {
  private readonly logger = new Logger(SessionValidatorService.name);

  constructor(
    private readonly authContext: AuthContextService,
    private readonly csrf: CsrfService,
  ) {}

  async validate(token: string, req: Request, authType: AuthType): Promise<ValidatedSession> {
    const { session, user, roles } = await this.authContext.findSessionAuthContext(token);

    if (!session) {
      throw new UnauthorizedException({ errorCode: ErrorCode.AUTH_TOKEN_INVALID, message: 'Invalid or expired session token.' });
    }
    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException({ errorCode: ErrorCode.AUTH_SESSION_EXPIRED, message: 'Session has expired.' });
    }
    if (!user) {
      throw new UnauthorizedException({ errorCode: ErrorCode.AUTH_TOKEN_INVALID, message: 'User not found for session.' });
    }

    if (authType === 'bearer') {
      // Defense-in-depth, NOT the primary control. The real protections are
      // device binding (below) and theft detection (token rotation + revoke-all
      // on replay). This check narrows the same-origin XSS exfiltration vector
      // specifically: browsers set Sec-Fetch-Site as a forbidden header that JS
      // cannot override, while mobile/server clients never send it. Tokens
      // leaked via crash logs, error trackers, URL params, or mobile keychain
      // compromise bypass this check entirely — those vectors must be caught
      // by the device-binding step that follows.
      const secFetchSite = req.headers['sec-fetch-site'];
      if (secFetchSite) {
        this.logger.warn({
          msg: 'Bearer request from browser context rejected',
          secFetchSite,
          path: req.path,
          ip: req.ip,
        });
        throw new ForbiddenException({
          errorCode: ErrorCode.FORBIDDEN,
          message: 'Bearer transport is not permitted from browser contexts.',
        });
      }

      if (session.deviceId) {
        const requestDeviceId = (req.headers['x-device-id'] as string | undefined) ?? null;
        if (requestDeviceId !== session.deviceId) {
          throw new UnauthorizedException({ errorCode: ErrorCode.AUTH_DEVICE_MISMATCH, message: 'Device changed — please re-authenticate.' });
        }
      }
    }

    if (authType === 'cookie') {
      this.csrf.validateRequest(req, session.csrfSecret);
    }

    return { session, user, roles };
  }
}
