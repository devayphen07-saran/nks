import { BadRequestException } from '@nestjs/common';
import { ErrorCodes, ErrorMessages } from '../../../core/constants/error-codes';

/**
 * Entity Code Validator
 * Validates entity code format (lowercase alphanumeric, underscores, dashes)
 */
export class EntityCodeValidator {
  private static readonly ENTITY_CODE_REGEX = /^[a-z0-9_-]+$/;

  /**
   * Validate entity code and throw BadRequestException if invalid
   */
  static validate(entityCode: string): void {
    if (!entityCode || typeof entityCode !== 'string' || !this.ENTITY_CODE_REGEX.test(entityCode.trim())) {
      throw new BadRequestException({
        errorCode: ErrorCodes.ENT_INVALID_CODE_FORMAT,
        message: ErrorMessages[ErrorCodes.ENT_INVALID_CODE_FORMAT],
      });
    }
  }

  /**
   * Check if entity code is valid without throwing
   */
  static isValid(entityCode: string): boolean {
    return !!(entityCode && typeof entityCode === 'string' && this.ENTITY_CODE_REGEX.test(entityCode.trim()));
  }

  /**
   * Normalize entity code to lowercase
   */
  static normalize(entityCode: string): string {
    return entityCode.trim().toLowerCase();
  }
}
