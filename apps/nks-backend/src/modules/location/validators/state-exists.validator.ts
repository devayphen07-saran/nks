import { BadRequestException } from '@nestjs/common';
import { ErrorCodes, ErrorMessages } from '../../../core/constants/error-codes';

/**
 * State Existence Validator
 * Validates that a state exists in the database
 */
export class StateExistsValidator {
  /**
   * Validate state exists and throw BadRequestException if not found
   */
  static validate(stateId: number | null | undefined): void {
    if (!stateId || typeof stateId !== 'number' || stateId <= 0) {
      throw new BadRequestException({
        errorCode: ErrorCodes.LOC_STATE_NOT_FOUND,
        message: ErrorMessages[ErrorCodes.LOC_STATE_NOT_FOUND],
      });
    }
  }

  /**
   * Check if state ID is valid without throwing
   */
  static isValid(stateId: number | null | undefined): boolean {
    return !!(stateId && typeof stateId === 'number' && stateId > 0);
  }
}
