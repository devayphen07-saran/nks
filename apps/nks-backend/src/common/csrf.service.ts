import * as crypto from 'crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppConfigService } from '../config/app-config.service';
import { ForbiddenException } from './exceptions';
import { ErrorCode } from './constants/error-codes.constants';
import { AUTH_CONSTANTS } from './constants/app-constants';

const CSRF_UNSAFE_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);
const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';

/**
 * CsrfService — session-bound double-submit.
 *
 * The cookie carries the value so JS can read it for the X-CSRF-Token header,
 * but validation compares the header against the SESSION'S csrfSecret column
 * (not the cookie). That bind defeats subdomain cookie tossing: an attacker
 * who controls a sibling subdomain can overwrite the cookie but cannot forge
 * the DB-stored value.
 *
 * Pure double-submit (header == cookie) was rejected because cookie tossing
 * collapses the protection. The DB lookup costs nothing extra since the auth
 * context query already SELECTs the session row.
 */
@Injectable()
export class CsrfService implements OnModuleInit {
  private readonly logger = new Logger(CsrfService.name);

  constructor(private readonly appConfig: AppConfigService) {}

  onModuleInit(): void {
    if (this.appConfig.isProduction && this.appConfig.csrfSameSite === 'none') {
      this.logger.warn(
        {
          config: { CSRF_SAME_SITE: 'none' },
          impact: 'SameSite cross-origin cookie gate disabled — CSRF token is the sole CSRF defense',
          action: 'Verify all state-mutating endpoints enforce X-CSRF-Token; prefer SameSite=strict unless cross-origin is required',
        },
        'CSRF misconfiguration: CSRF_SAME_SITE=none in production',
      );
    }
  }

  /** Generate a fresh random secret (32 bytes hex). Used by session bootstrap. */
  generate(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate the X-CSRF-Token header against the session's stored secret.
   * No-op for safe methods. Throws ForbiddenException on mismatch.
   */
  validateRequest(req: Request, csrfSecret: string): void {
    if (!CSRF_UNSAFE_METHODS.has(req.method)) return;

    const header = req.headers[CSRF_HEADER];
    if (typeof header !== 'string' || !this.timingSafeEqual(header, csrfSecret)) {
      throw new ForbiddenException({
        errorCode: ErrorCode.FORBIDDEN,
        message: 'CSRF token missing or invalid',
      });
    }
  }

  /**
   * Set the csrf_token cookie to the session's secret. Idempotent — caller can
   * invoke after every login/register/refresh; if the cookie already matches
   * the secret, the browser just receives the same Set-Cookie header again.
   */
  refresh(res: Response, csrfSecret: string): void {
    const sameSite = AUTH_CONSTANTS.SESSION.COOKIE_SAME_SITE;
    res.cookie(CSRF_COOKIE, csrfSecret, {
      httpOnly: false,
      secure: AUTH_CONSTANTS.SESSION.COOKIE_SECURE || sameSite === 'none',
      sameSite,
      maxAge: AUTH_CONSTANTS.SESSION.EXPIRY_SECONDS * 1000,
      path: '/',
    });
  }

  /** Clear the cookie on logout. */
  clear(res: Response): void {
    const sameSite = AUTH_CONSTANTS.SESSION.COOKIE_SAME_SITE;
    res.clearCookie(CSRF_COOKIE, {
      httpOnly: false,
      secure: AUTH_CONSTANTS.SESSION.COOKIE_SECURE || sameSite === 'none',
      sameSite,
      path: '/',
    });
  }

  /**
   * Constant-time equality. Both inputs hashed first so timingSafeEqual always
   * sees equal-length buffers — eliminates the early-exit length oracle that
   * would otherwise leak token length information.
   */
  private timingSafeEqual(a: string, b: string): boolean {
    const bufA = crypto.createHash('sha256').update(a).digest();
    const bufB = crypto.createHash('sha256').update(b).digest();
    return crypto.timingSafeEqual(bufA, bufB);
  }
}
