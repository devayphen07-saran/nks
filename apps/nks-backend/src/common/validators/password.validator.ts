import { BadRequestException } from '@nestjs/common';
import { ErrorCodes, ErrorMessages } from '../../core/constants/error-codes';

/**
 * PasswordValidator — centralised password strength validation.
 * Requirements: ≥12 chars, uppercase, lowercase, digit, special character.
 */
export class PasswordValidator {
  private static readonly MIN_LENGTH = 12;

  static validateStrength(password: string): void {
    if (
      !password ||
      password.length < this.MIN_LENGTH ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^\w\s]/.test(password)
    ) {
      throw new BadRequestException({
        errorCode: ErrorCodes.AUTH_WEAK_PASSWORD,
        message: ErrorMessages[ErrorCodes.AUTH_WEAK_PASSWORD],
      });
    }
  }

  static isStrong(password: string): boolean {
    return (
      !!password &&
      password.length >= this.MIN_LENGTH &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[^\w\s]/.test(password)
    );
  }
}
