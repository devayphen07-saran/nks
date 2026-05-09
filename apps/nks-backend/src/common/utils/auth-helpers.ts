import { Response } from 'express';
import type { AuthResponseEnvelope } from '../../contexts/iam/auth/dto';
import { AUTH_CONSTANTS } from '../constants/app-constants';
import { DeviceDetector } from './device-detector';

/**
 * Session-cookie + response shaping helpers for auth endpoints.
 *
 * ── Platform split (web vs mobile) ────────────────────────────────────────
 *
 *   WEB  — server sets `nks_session` httpOnly cookie. The body's
 *          `auth.bearerToken` is null'd out so the credential never appears
 *          in JS scope, CDN logs, or API gateway traces.
 *
 *   MOBILE — server skips the cookie. Body carries `auth.bearerToken` so the
 *          client can attach `Authorization: Bearer <bearerToken>` on requests.
 *
 * Detection lives in {@link DeviceDetector}; this class only owns the
 * cookie/response side-effects.
 */
export class AuthControllerHelpers {
  static readonly SESSION_COOKIE_NAME = 'nks_session';

  static setSessionCookie(res: Response, token: string): void {
    const sameSite = AUTH_CONSTANTS.SESSION.COOKIE_SAME_SITE;
    res.cookie(AuthControllerHelpers.SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite,
      // SameSite=none requires Secure=true (browser enforced).
      secure: AUTH_CONSTANTS.SESSION.COOKIE_SECURE || sameSite === 'none',
      maxAge: AUTH_CONSTANTS.SESSION.EXPIRY_SECONDS * 1000,
      path: '/',
    });
  }

  /** Apply session cookie from AuthResponseEnvelope. */
  static applySessionCookie(res: Response, result: AuthResponseEnvelope): void {
    const token = result.auth?.bearerToken;
    if (token) {
      AuthControllerHelpers.setSessionCookie(res, token);
    }
  }

  static clearSessionCookie(res: Response): void {
    const sameSite = AUTH_CONSTANTS.SESSION.COOKIE_SAME_SITE;
    res.clearCookie(AuthControllerHelpers.SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite,
      secure: AUTH_CONSTANTS.SESSION.COOKIE_SECURE || sameSite === 'none',
      path: '/',
    });
  }

  /**
   * Null out bearerToken for web clients.
   * Web receives it via the httpOnly cookie set by applySessionCookie() —
   * the body field is replaced with null so the credential never appears in
   * CDN logs, API gateways, or JS scope.
   * Call AFTER applySessionCookie() so the cookie is written first.
   */
  static forClient<T extends AuthResponseEnvelope>(result: T, deviceType?: string): T {
    if (DeviceDetector.isMobile(deviceType)) return result;
    return { ...result, auth: { ...result.auth, bearerToken: null } };
  }
}