import { BadRequestException } from '@nestjs/common';
import { ErrorCodes, ErrorMessages } from '../../../core/constants/error-codes';

/**
 * Status Existence Validator
 * Validates that a status exists in the database
 */
export class StatusExistsValidator {
  /**
   * Validate status exists and throw BadRequestException if not found
   */
  static validate(statusId: number | null | undefined): void {
    if (!statusId || typeof statusId !== 'number' || statusId <= 0) {
      throw new BadRequestException({
        errorCode: ErrorCodes.STA_STATUS_NOT_FOUND,
        message: ErrorMessages[ErrorCodes.STA_STATUS_NOT_FOUND],
      });
    }
  }

  /**
   * Check if status ID is valid without throwing
   */
  static isValid(statusId: number | null | undefined): boolean {
    return !!(statusId && typeof statusId === 'number' && statusId > 0);
  }
}
