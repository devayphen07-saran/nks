import { Request, Response } from 'express';
import type { AuthResponseEnvelope } from '../../contexts/iam/auth/dto';
import { DeviceValidator } from '../validators';
import { AUTH_CONSTANTS } from '../constants/app-constants';

/**
 * Shared utilities for auth controllers.
 *
 * ── Platform split (web vs mobile) ────────────────────────────────────────
 *
 *  The same endpoints (`/auth/login`, `/auth/otp/verify`, `/auth/register`,
 *  `/auth/refresh-token`) serve both web and mobile clients. The body shape
 *  is identical; only the transport for the session token differs.
 *
 *    WEB (deviceType === undefined or 'WEB'):
 *      - Server sets `nks_session` as an httpOnly / sameSite=strict cookie
 *        containing the session token.
 *      - Web client does NOT read sessionToken from the body; relies on the
 *        cookie being sent automatically on subsequent requests.
 *
 *    MOBILE (deviceType ∈ {'ANDROID', 'IOS'}):
 *      - Server does NOT set the session cookie (controllers skip the call
 *        based on `deviceInfo.deviceType`).
 *      - Mobile stores `session.sessionToken` and `session.jwtToken` from
 *        the body and attaches `Authorization: Bearer <token>` on requests.
 *      - Mobile additionally consumes `offlineToken` / `offlineSessionSignature`
 *        for offline-capable verification.
 *
 *  Detection: driven by the `X-Device-Type` request header (normalised by
 *  `DeviceValidator` against `User-Agent`). If absent or 'WEB', cookie path.
 *  If 'ANDROID' / 'IOS', token-in-body path.
 *
 *  Logout / refresh mirror the same split:
 *    - web clears the cookie via `clearSessionCookie`;
 *    - mobile discards the locally-stored token and calls `/auth/logout`.
 */
export class AuthControllerHelpers {
  static readonly SESSION_COOKIE_NAME = 'nks_session';

  // Max lengths for free-form device header fields.
  // Guards against oversized inputs reaching audit log and session row writes.
  private static readonly DEVICE_FIELD_MAX = {
    deviceId: 64,
    deviceName: 100,
    appVersion: 32,
    userAgent: 512,
  } as const;

  /**
   * Extract device identification headers from request.
   * Validates device type against User-Agent to prevent spoofing.
   * Caps free-form string fields to prevent oversized inputs reaching DB writes.
   */
  static extractDeviceInfo(req: Request) {
    const deviceTypeHeader = (req.headers['x-device-type'] as string) || undefined;
    const rawUserAgent = (req.headers['user-agent'] as string) || undefined;

    const validatedDeviceType = DeviceValidator.validateAndNormalize(
      deviceTypeHeader,
      rawUserAgent,
    );

    const ipAddress: string | undefined = req.ip ?? undefined;

    return {
      deviceId: AuthControllerHelpers.cap(
        req.headers['x-device-id'] as string,
        AuthControllerHelpers.DEVICE_FIELD_MAX.deviceId,
      ),
      deviceName: AuthControllerHelpers.cap(
        req.headers['x-device-name'] as string,
        AuthControllerHelpers.DEVICE_FIELD_MAX.deviceName,
      ),
      deviceType: validatedDeviceType || undefined,
      appVersion: AuthControllerHelpers.cap(
        req.headers['x-app-version'] as string,
        AuthControllerHelpers.DEVICE_FIELD_MAX.appVersion,
      ),
      ipAddress,
      userAgent: AuthControllerHelpers.cap(
        rawUserAgent,
        AuthControllerHelpers.DEVICE_FIELD_MAX.userAgent,
      ),
    };
  }

  /**
   * Set httpOnly session cookie in response
   * Used for WEB clients only (mobile ignores this)
   */
  static setSessionCookie(res: Response, token: string): void {
    res.cookie(AuthControllerHelpers.SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      // 'strict' prevents CSRF but blocks the cookie on cross-site top-level navigations
      // (e.g. OAuth callback, email deep links). Switch to 'lax' if those flows are added.
      sameSite: 'strict',
      secure: AUTH_CONSTANTS.SESSION.COOKIE_SECURE,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  /**
   * Apply session cookie from AuthResponseEnvelope.
   */
  static applySessionCookie(res: Response, result: AuthResponseEnvelope): void {
    const token = result.session?.sessionToken;
    if (token) {
      this.setSessionCookie(res, token);
    }
  }

  static clearSessionCookie(res: Response): void {
    res.clearCookie(AuthControllerHelpers.SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'strict',
      secure: AUTH_CONSTANTS.SESSION.COOKIE_SECURE,
      path: '/',
    });
  }

  private static cap(value: string | undefined, max: number): string | undefined {
    return value ? value.slice(0, max) : undefined;
  }
}
