import { BadRequestException } from '@nestjs/common';
import { ErrorCode, ErrorMessages } from '../constants/error-codes.constants';

/** Dial code used for phone normalisation. Overrideable for non-India deployments. */
export const DEFAULT_DIAL_CODE = process.env['DEFAULT_DIAL_CODE'] ?? '+91';

const DIAL_CODE_NUMERIC = DEFAULT_DIAL_CODE.replace('+', '');

/**
 * PhoneValidator — centralised phone number validation.
 * Accepts: 10-digit (6-9 start), dial-code-prefixed, or numeric-prefix format.
 */
export class PhoneValidator {
  private static readonly PHONE_REGEX = /^(\+91|91)?[6-9]\d{9}$/;

  static validate(phone: string): void {
    if (!phone || typeof phone !== 'string' || !this.PHONE_REGEX.test(phone.trim())) {
      throw new BadRequestException({
        errorCode: ErrorCode.AUTH_INVALID_PHONE,
        message: ErrorMessages[ErrorCode.AUTH_INVALID_PHONE],
      });
    }
  }

  static isValid(phone: string): boolean {
    return !!(phone && typeof phone === 'string' && this.PHONE_REGEX.test(phone.trim()));
  }

  /** Normalise to <DEFAULT_DIAL_CODE>XXXXXXXXXX format. */
  static normalize(phone: string): string {
    phone = phone.trim();
    if (phone.startsWith(DEFAULT_DIAL_CODE)) return phone;
    if (phone.startsWith(DIAL_CODE_NUMERIC)) return `+${phone}`;
    return `${DEFAULT_DIAL_CODE}${phone}`;
  }
}
