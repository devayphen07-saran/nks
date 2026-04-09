import { BadRequestException } from '@nestjs/common';
import { ErrorCodes, ErrorMessages } from '../../../../core/constants/error-codes';

/**
 * Email Validator
 * Validates email format
 */
export class EmailValidator {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /**
   * Validate email and throw BadRequestException if invalid
   */
  static validate(email: string): void {
    if (!email || typeof email !== 'string' || !this.EMAIL_REGEX.test(email.trim())) {
      throw new BadRequestException({
        errorCode: ErrorCodes.AUTH_INVALID_EMAIL,
        message: ErrorMessages[ErrorCodes.AUTH_INVALID_EMAIL],
      });
    }
  }

  /**
   * Check if email is valid without throwing
   */
  static isValid(email: string): boolean {
    return !!(email && typeof email === 'string' && this.EMAIL_REGEX.test(email.trim()));
  }

  /**
   * Normalize email to lowercase
   */
  static normalize(email: string): string {
    return email.trim().toLowerCase();
  }
}
