import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { UnauthorizedException } from '../../exceptions';
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
    const { session, user, revokedJti, roles } = await this.authContext.findSessionAuthContext(token);

    if (!session) {
      throw new UnauthorizedException({ errorCode: ErrorCode.AUTH_TOKEN_INVALID, message: 'Invalid or expired session token.' });
    }
    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException({ errorCode: ErrorCode.AUTH_SESSION_EXPIRED, message: 'Session has expired.' });
    }
    if (revokedJti) {
      throw new UnauthorizedException({ errorCode: ErrorCode.AUTH_TOKEN_INVALID, message: 'Token has been revoked.' });
    }
    if (!user) {
      throw new UnauthorizedException({ errorCode: ErrorCode.AUTH_SESSION_EXPIRED, message: 'User not found for session.' });
    }

    if (authType === 'cookie') {
      this.csrf.validateRequest(req, session.csrfSecret);
    }

    if (authType === 'bearer' && session.deviceId) {
      const requestDeviceId = (req.headers['x-device-id'] as string | undefined) ?? null;
      if (requestDeviceId && requestDeviceId !== session.deviceId) {
        throw new UnauthorizedException({ errorCode: ErrorCode.AUTH_SESSION_EXPIRED, message: 'Device changed — please re-authenticate.' });
      }
    }

    return { session, user, roles };
  }
}
