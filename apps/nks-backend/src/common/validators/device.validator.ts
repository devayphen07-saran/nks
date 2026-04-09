import { Logger } from '@nestjs/common';

/**
 * DeviceValidator
 * Validates device type against User-Agent header to prevent device spoofing.
 * Device type should match the actual client platform.
 */
export class DeviceValidator {
  private static readonly logger = new Logger(DeviceValidator.name);

  /** Valid device types */
  private static readonly VALID_DEVICE_TYPES = ['IOS', 'ANDROID', 'WEB'] as const;

  /**
   * Validate device type against User-Agent header.
   * Prevents users from spoofing their device type (e.g., mobile pretending to be web).
   *
   * @param deviceType - Device type from custom header (IOS/ANDROID/WEB)
   * @param userAgent - User-Agent header from request
   * @returns Validated device type, or null if invalid/undetectable
   *
   * Examples:
   * - iOS app with X-Device-Type: IOS + User-Agent with "iPhone" → ✅ IOS
   * - Web with X-Device-Type: WEB + User-Agent with "Chrome" → ✅ WEB
   * - Mobile claiming WEB when User-Agent shows "iPhone" → ⚠️ Mismatch, fallback to UA detection
   * - No X-Device-Type header → ✅ Auto-detect from User-Agent
   */
  static validateAndNormalize(
    deviceType: string | undefined,
    userAgent: string | undefined,
  ): string | null {
    const ua = (userAgent || '').toLowerCase();

    // Detect actual device type from User-Agent
    const detectedType = this.detectFromUserAgent(ua);

    // If no explicit device type header provided, use detected
    if (!deviceType) {
      this.logger.debug(
        `No X-Device-Type header; auto-detected: ${detectedType || 'UNKNOWN'}`,
      );
      return detectedType;
    }

    const normalizedInput = deviceType.toUpperCase();

    // Validate that input is a known type
    if (!(this.VALID_DEVICE_TYPES as readonly string[]).includes(normalizedInput)) {
      this.logger.warn(
        `Invalid X-Device-Type header: ${deviceType}. Falling back to User-Agent detection.`,
      );
      return detectedType;
    }

    // If detected type exists, check for mismatch
    if (detectedType && detectedType !== normalizedInput) {
      this.logger.warn(
        `Device type mismatch: header claims ${normalizedInput}, but User-Agent suggests ${detectedType}. ` +
          `Trusting User-Agent (harder to spoof).`,
      );
      // Trust User-Agent over the custom header (harder to fake)
      return detectedType;
    }

    // No mismatch or couldn't detect from UA; accept the header
    return normalizedInput;
  }

  /**
   * Detect device type from User-Agent string.
   * Based on common User-Agent patterns.
   *
   * @param userAgent - Normalized lowercase User-Agent string
   * @returns Detected device type, or null if not recognized
   */
  private static detectFromUserAgent(userAgent: string): string | null {
    // iOS detection
    if (
      /iphone|ipad|ipod/.test(userAgent) ||
      /mac os x.*mobile/.test(userAgent)
    ) {
      return 'IOS';
    }

    // Android detection
    if (/android/.test(userAgent)) {
      return 'ANDROID';
    }

    // Windows, Linux, macOS, or generic desktop patterns
    if (/windows|linux|macintosh|x11|cros/.test(userAgent)) {
      return 'WEB';
    }

    // Couldn't detect
    return null;
  }

  /**
   * Log device type information for analytics/debugging.
   * Safe to call with potentially spoofed input; logs detected truth.
   */
  static logDeviceInfo(
    requestedType: string | undefined,
    userAgent: string | undefined,
    resolvedType: string | null,
  ): void {
    this.logger.debug(
      `Device validation: requested=${requestedType || 'none'}, ` +
        `ua_detected=${this.detectFromUserAgent((userAgent || '').toLowerCase()) || 'none'}, ` +
        `resolved=${resolvedType || 'none'}`,
    );
  }
}
