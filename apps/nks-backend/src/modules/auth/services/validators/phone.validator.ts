import { BadRequestException } from '@nestjs/common';
import { ErrorCodes, ErrorMessages } from '../../../../core/constants/error-codes';

/**
 * Phone Number Validator
 * Validates Indian phone numbers
 * Accepts: 10-digit (6-9 start) or +91-prefixed format
 */
export class PhoneValidator {
  private static readonly PHONE_REGEX = /^(\+91)?[6-9]\d{9}$/;

  /**
   * Validate phone and throw BadRequestException if invalid
   */
  static validate(phone: string): void {
    if (!phone || typeof phone !== 'string' || !this.PHONE_REGEX.test(phone.trim())) {
      throw new BadRequestException({
        errorCode: ErrorCodes.AUTH_INVALID_PHONE,
        message: ErrorMessages[ErrorCodes.AUTH_INVALID_PHONE],
      });
    }
  }

  /**
   * Check if phone is valid without throwing
   */
  static isValid(phone: string): boolean {
    return !!(phone && typeof phone === 'string' && this.PHONE_REGEX.test(phone.trim()));
  }

  /**
   * Normalize phone to +91 format
   */
  static normalize(phone: string): string {
    phone = phone.trim();
    if (phone.startsWith('+91')) return phone;
    if (phone.startsWith('91')) return `+${phone}`;
    return `+91${phone}`;
  }
}
