import { BadRequestException } from '@nestjs/common';
import { ErrorCodes, ErrorMessages } from '../../../core/constants/error-codes';

/**
 * Entity Existence Validator
 * Validates that an entity exists in the database
 */
export class EntityExistsValidator {
  /**
   * Validate entity exists and throw BadRequestException if not found
   */
  static validate(entityId: number | null | undefined): void {
    if (!entityId || typeof entityId !== 'number' || entityId <= 0) {
      throw new BadRequestException({
        errorCode: ErrorCodes.ENT_ENTITY_NOT_FOUND,
        message: ErrorMessages[ErrorCodes.ENT_ENTITY_NOT_FOUND],
      });
    }
  }

  /**
   * Check if entity ID is valid without throwing
   */
  static isValid(entityId: number | null | undefined): boolean {
    return !!(entityId && typeof entityId === 'number' && entityId > 0);
  }
}
