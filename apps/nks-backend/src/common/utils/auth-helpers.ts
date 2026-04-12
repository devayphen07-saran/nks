import { Request, Response } from 'express';
import type { AuthResponseEnvelope } from '../../modules/auth/dto';
import { DeviceValidator } from '../validators';

/**
 * Shared utilities for auth controllers
 * Extracts device info, manages session cookies
 */
export class AuthControllerHelpers {
  /**
   * Extract device identification headers from request
   * Validates device type against User-Agent to prevent spoofing
   * Used for device tracking and security (device binding)
   */
  static extractDeviceInfo(req: Request) {
    const deviceTypeHeader = (req.headers['x-device-type'] as string) || undefined;
    const userAgent = (req.headers['user-agent'] as string) || undefined;

    // Validate and normalize device type against User-Agent
    const validatedDeviceType = DeviceValidator.validateAndNormalize(
      deviceTypeHeader,
      userAgent,
    );

    // Resolve real client IP (respects X-Forwarded-For from trusted proxies)
    const forwarded = req.headers['x-forwarded-for'];
    const ipAddress: string | undefined = forwarded
      ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0])?.trim()
      : (req.ip ?? req.socket?.remoteAddress ?? undefined);

    return {
      deviceId: (req.headers['x-device-id'] as string) || undefined,
      deviceName: (req.headers['x-device-name'] as string) || undefined,
      deviceType: validatedDeviceType || undefined,
      appVersion: (req.headers['x-app-version'] as string) || undefined,
      // Request metadata for audit logging
      ipAddress,
      userAgent,
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
   */
  static applySessionCookie(res: Response, result: AuthResponseEnvelope): void {
    const token = result.session?.sessionToken;
    if (token) {
      this.setSessionCookie(res, token);
    }
  }
}
