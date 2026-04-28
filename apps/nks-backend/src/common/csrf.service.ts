import * as crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppConfigService } from '../config/app-config.service';
import { ForbiddenException } from './exceptions';
import { ErrorCode } from './constants/error-codes.constants';
import { AUTH_CONSTANTS } from './constants/app-constants';

const CSRF_UNSAFE_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

/**
 * CsrfService — single source of truth for all CSRF token logic.
 *
 * Three responsibilities, one service:
 *
 *   generate(ip)         — IP-bound pre-auth token for unauthenticated requests.
 *   computeForSession()  — derive the session-bound token from the per-session secret.
 *   validateRequest()    — check X-CSRF-Token header on state-mutating requests.
 *   refresh()            — keep the csrf_token cookie in sync post-handler.
 *
 * Previously split across CsrfTokenService (compute/generate) and
 * CsrfValidationService (validate/syncCookie). Consolidated so every layer
 * (middleware, guard, interceptor, auth controllers) injects one service
 * and CSRF reasoning stays in one place.
 */
@Injectable()
export class CsrfService {
  private readonly csrfHmacSecret: string;

  constructor(private readonly appConfig: AppConfigService) {
    this.csrfHmacSecret = this.appConfig.csrfHmacSecret;
  }

  /**
   * Generate a pre-auth CSRF token for unauthenticated requests.
   * Pure random 32 bytes — no IP binding (IP binding causes false mismatches
   * on mobile networks, VPNs, and proxies with no meaningful security gain).
   */
  generate(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Derive the session-bound CSRF token from the per-session secret.
   */
  computeForSession(csrfSecret: string): string {
    return crypto
      .createHmac('sha256', this.csrfHmacSecret)
      .update(csrfSecret)
      .digest('hex');
  }

  /**
   * Validate the X-CSRF-Token request header for state-mutating methods.
   * No-op for GET / HEAD / OPTIONS — those cannot carry state mutations.
   */
  validateRequest(req: Request, csrfSecret: string): void {
    if (!CSRF_UNSAFE_METHODS.has(req.method)) return;

    const expected = this.computeForSession(csrfSecret);
    const provided = req.headers['x-csrf-token'];

    if (typeof provided !== 'string' || !this.timingSafeEqual(provided, expected)) {
      throw new ForbiddenException({
        errorCode: ErrorCode.FORBIDDEN,
        message: 'CSRF token missing or invalid',
      });
    }
  }

  /**
   * Keep the csrf_token cookie in sync with the current session secret.
   * Sets the cookie only when the current cookie value is absent or stale.
   * Called post-handler by SessionRotationService and immediately after
   * login/register/OTP-verify by auth controllers.
   */
  refresh(req: Request, res: Response, csrfSecret: string): void {
    const expected = this.computeForSession(csrfSecret);
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

  /**
   * Constant-time equality check for CSRF token comparison.
   *
   * Both inputs are SHA-256 hashed before comparison so timingSafeEqual
   * always receives equal-length buffers — eliminates the early-exit length
   * oracle that would otherwise leak token length information.
   */
  private timingSafeEqual(a: string, b: string): boolean {
    const bufA = crypto.createHash('sha256').update(a).digest();
    const bufB = crypto.createHash('sha256').update(b).digest();
    return crypto.timingSafeEqual(bufA, bufB);
  }
}
