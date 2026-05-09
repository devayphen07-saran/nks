import type { Request } from 'express';
import { DeviceValidator } from '../validators';

/**
 * Device detection — extracts and normalises device identifiers from
 * request headers. The same auth endpoints serve web and mobile, and the
 * downstream code (cookie vs body session token, audit log, session row)
 * branches on the result of this extraction.
 *
 * Lives apart from session/cookie helpers so it can be reused in non-auth
 * contexts (telemetry, rate-limit fingerprinting) without dragging in
 * Response or AuthResponseEnvelope dependencies.
 */
export class DeviceDetector {
  // Caps protect downstream writes (audit log, session row) from oversized inputs.
  private static readonly DEVICE_FIELD_MAX = {
    deviceId: 64,
    deviceName: 100,
    appVersion: 32,
    userAgent: 512,
  } as const;

  /**
   * Extract device identification headers. Validates X-Device-Type against
   * User-Agent to prevent spoofing, caps free-form fields to a safe length.
   */
  static extract(req: Request) {
    const deviceTypeHeader = (req.headers['x-device-type'] as string) || undefined;
    const rawUserAgent = (req.headers['user-agent'] as string) || undefined;

    const validatedDeviceType = DeviceValidator.validateAndNormalize(
      deviceTypeHeader,
      rawUserAgent,
    );

    const ipAddress: string | undefined = req.ip ?? undefined;

    return {
      deviceId: DeviceDetector.cap(req.headers['x-device-id'] as string, DeviceDetector.DEVICE_FIELD_MAX.deviceId),
      deviceName: DeviceDetector.cap(req.headers['x-device-name'] as string, DeviceDetector.DEVICE_FIELD_MAX.deviceName),
      deviceType: validatedDeviceType || undefined,
      appVersion: DeviceDetector.cap(req.headers['x-app-version'] as string, DeviceDetector.DEVICE_FIELD_MAX.appVersion),
      ipAddress,
      userAgent: DeviceDetector.cap(rawUserAgent, DeviceDetector.DEVICE_FIELD_MAX.userAgent),
    };
  }

  /**
   * Returns true when the request comes from a native mobile client.
   * Web clients (no deviceType, or deviceType === 'WEB') return false.
   */
  static isMobile(deviceType?: string): boolean {
    return deviceType === 'ANDROID' || deviceType === 'IOS';
  }

  private static cap(value: string | undefined, max: number): string | undefined {
    return value ? value.slice(0, max) : undefined;
  }
}

export type DeviceInfo = ReturnType<typeof DeviceDetector.extract>;