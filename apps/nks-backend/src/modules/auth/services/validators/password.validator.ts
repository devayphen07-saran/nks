import { BadRequestException } from '@nestjs/common';
import { ErrorCodes, ErrorMessages } from '../../../../core/constants/error-codes';

/**
 * Password Validator
 * Validates password strength and requirements
 */
export class PasswordValidator {
  private static readonly MIN_LENGTH = 12;

  /**
   * Validate password strength
   * Requirements:
   * - At least 12 characters
   * - At least one uppercase letter
   * - At least one lowercase letter
   * - At least one number
   * - At least one special character
   */
  static validateStrength(password: string): void {
    if (!password || password.length < this.MIN_LENGTH || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^\w\s]/.test(password)) {
      throw new BadRequestException({
        errorCode: ErrorCodes.AUTH_WEAK_PASSWORD,
        message: ErrorMessages[ErrorCodes.AUTH_WEAK_PASSWORD],
      });
    }
  }

  /**
   * Check if password meets strength requirements
   */
  static isStrong(password: string): boolean {
    if (!password || password.length < this.MIN_LENGTH) return false;
    if (!/[A-Z]/.test(password)) return false;
    if (!/[a-z]/.test(password)) return false;
    if (!/[0-9]/.test(password)) return false;
    if (!/[^\w\s]/.test(password)) return false;
    return true;
  }
}
