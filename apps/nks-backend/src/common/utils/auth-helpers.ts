import { Request, Response } from 'express';
import type { AuthResponseEnvelope } from '../../modules/auth/dto';

/**
 * Shared utilities for auth controllers
 * Extracts device info, manages session cookies
 */
export class AuthControllerHelpers {
  /**
   * Extract device identification headers from request
   * Used for device tracking and security (device binding)
   */
  static extractDeviceInfo(req: Request) {
    return {
      deviceId: (req.headers['x-device-id'] as string) || undefined,
      deviceName: (req.headers['x-device-name'] as string) || undefined,
      deviceType: (req.headers['x-device-type'] as string) || undefined,
      appVersion: (req.headers['x-app-version'] as string) || undefined,
    };
  }

  /**
   * Set httpOnly session cookie in response
   * Used for WEB clients only (mobile ignores this)
   */
  static setSessionCookie(res: Response, token: string): void {
    res.cookie('nks_session', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env['NODE_ENV'] === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    });
  }

  /**
   * Apply session cookie from AuthResponseEnvelope.
   * The envelope has shape: { requestId, traceId, data: { session: { sessionToken } } }
   */
  static applySessionCookie(res: Response, result: AuthResponseEnvelope): void {
    const token = result.data?.session?.sessionToken;
    if (token) {
      this.setSessionCookie(res, token);
    }
  }
}
