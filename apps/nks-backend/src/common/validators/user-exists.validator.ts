import { BadRequestException } from '@nestjs/common';
import { ErrorCode, ErrorMessages } from '../constants/error-codes.constants';

/**
 * User Existence Validator
 * Validates that a user exists in the database
 */
export class UserExistsValidator {
  /**
   * Validate user exists and throw BadRequestException if not found
   */
  static validate(userId: number | null | undefined): void {
    if (!userId || typeof userId !== 'number' || userId <= 0) {
      throw new BadRequestException({
        errorCode: ErrorCode.USER_NOT_FOUND,
        message: ErrorMessages[ErrorCode.USER_NOT_FOUND],
      });
    }
  }

  /**
   * Check if user ID is valid without throwing
   */
  static isValid(userId: number | null | undefined): boolean {
    return !!(userId && typeof userId === 'number' && userId > 0);
  }
}
