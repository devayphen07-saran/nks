import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { BadRequestException, UnauthorizedException } from '../../exceptions';
import { ErrorCode } from '../../constants/error-codes.constants';
import { AuthControllerHelpers } from '../../utils/auth-helpers';
import { MAX_SESSION_TOKEN_LENGTH } from '../../../contexts/iam/auth/auth.constants';

export type AuthType = 'cookie' | 'bearer';

/**
 * Extracts session token and auth transport type from the incoming HTTP request.
 * Rejects mixed bearer + cookie usage to prevent CSRF bypass.
 */
@Injectable()
export class TokenExtractorService {
  private readonly logger = new Logger(TokenExtractorService.name);

  extract(req: Request): { token: string; authType: AuthType } {
    const authHeader = req.headers['authorization'];
    const bearer =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : null;

    const cookies = req.cookies as Record<string, string | undefined>;
    const cookie = cookies[AuthControllerHelpers.SESSION_COOKIE_NAME] ?? null;

    if (bearer && cookie) {
      const deviceType = (req.headers['x-device-type'] as string | undefined)?.toUpperCase();
      const isMobile = deviceType === 'IOS' || deviceType === 'ANDROID';

      if (!isMobile) {
        throw new BadRequestException({
          errorCode: ErrorCode.BAD_REQUEST,
          message: 'Use Bearer token or session cookie — not both.',
        });
      }
      // Mobile: OS cookie jar auto-attaches nks_session; Bearer takes precedence
    }

    // Cap session token length before any DB lookup — prevents hash-computation DoS
    // on arbitrarily large inputs. See MAX_SESSION_TOKEN_LENGTH comment in auth.constants.
    if (bearer) {
      if (bearer.length > MAX_SESSION_TOKEN_LENGTH) {
        throw new UnauthorizedException({ errorCode: ErrorCode.AUTH_TOKEN_INVALID, message: 'Token exceeds maximum length.' });
      }
      return { token: bearer, authType: 'bearer' };
    }
    if (cookie) {
      if (cookie.length > MAX_SESSION_TOKEN_LENGTH) {
        throw new UnauthorizedException({ errorCode: ErrorCode.AUTH_TOKEN_INVALID, message: 'Token exceeds maximum length.' });
      }
      return { token: cookie, authType: 'cookie' };
    }

    throw new UnauthorizedException({
      errorCode: ErrorCode.AUTH_TOKEN_INVALID,
      message: 'No token provided.',
    });
  }
}
