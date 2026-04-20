import { BadRequestException } from '@nestjs/common';
import { ErrorCode, ErrorMessages } from '../constants/error-codes.constants';

/**
 * EmailValidator — centralised email format validation.
 * Imported by auth module and any other module that needs email validation.
 */
export class EmailValidator {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  static validate(email: string): void {
    if (!email || typeof email !== 'string' || !this.EMAIL_REGEX.test(email.trim())) {
      throw new BadRequestException({
        errorCode: ErrorCode.AUTH_INVALID_EMAIL,
        message: ErrorMessages[ErrorCode.AUTH_INVALID_EMAIL],
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
