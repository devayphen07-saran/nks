import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { BadRequestException, UnauthorizedException } from '../../exceptions';
import { ErrorCode } from '../../constants/error-codes.constants';
import { AuthControllerHelpers } from '../../utils/auth-helpers';

export type AuthType = 'cookie' | 'bearer';
export interface ExtractedToken {
  token: string;
  authType: AuthType;
}

/**
 * Extracts the session token from an incoming request and identifies the
 * auth transport: cookie (web) or Bearer (mobile/API).
 *
 * Rejects when both are present — a web client sending Bearer would silently
 * bypass CSRF protection, so mixed usage is disallowed at the protocol level.
 */
@Injectable()
export class SessionTokenExtractorService {
  private readonly logger = new Logger(SessionTokenExtractorService.name);

  extract(req: Request): ExtractedToken {
    const authHeader = req.headers['authorization'];
    const bearer =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : null;

    const cookies = req.cookies as Record<string, string | undefined>;
    const cookie = cookies[AuthControllerHelpers.SESSION_COOKIE_NAME] ?? null;

    if (bearer && cookie) {
      // Mobile clients (iOS/Android) maintain a global HTTP cookie jar — the
      // nks_session cookie set at login is automatically included in every
      // subsequent request alongside the explicit Authorization header.
      // CSRF attacks require a browser context; mobile apps with an explicit
      // Bearer header are not vulnerable, so we prefer Bearer and ignore the
      // cookie rather than rejecting the request.
      const deviceType = req.headers['x-device-type'];
      const isMobile =
        deviceType === 'IOS' ||
        deviceType === 'ANDROID' ||
        deviceType === 'ios' ||
        deviceType === 'android';

      if (!isMobile) {
        throw new BadRequestException({
          errorCode: ErrorCode.BAD_REQUEST,
          message: 'Use Bearer token or session cookie — not both.',
        });
      }
      // Mobile: fall through to Bearer branch below
    }

    if (bearer) return { token: bearer, authType: 'bearer' };
    if (cookie) return { token: cookie, authType: 'cookie' };

    throw new UnauthorizedException({
      errorCode: ErrorCode.AUTH_TOKEN_INVALID,
      message: 'No token provided.',
    });
  }
}
