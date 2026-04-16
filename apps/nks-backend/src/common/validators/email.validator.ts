import { BadRequestException } from '@nestjs/common';
import { ErrorCodes, ErrorMessages } from '../../core/constants/error-codes';

/**
 * EmailValidator — centralised email format validation.
 * Imported by auth module and any other module that needs email validation.
 */
export class EmailValidator {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  static validate(email: string): void {
    if (!email || typeof email !== 'string' || !this.EMAIL_REGEX.test(email.trim())) {
      throw new BadRequestException({
        errorCode: ErrorCodes.AUTH_INVALID_EMAIL,
        message: ErrorMessages[ErrorCodes.AUTH_INVALID_EMAIL],
      });
    }
  }

  static isValid(email: string): boolean {
    return !!(email && typeof email === 'string' && this.EMAIL_REGEX.test(email.trim()));
  }

  static normalize(email: string): string {
    return email.trim().toLowerCase();
  }
}
