import { BadRequestException } from '@nestjs/common';
import { ErrorCodes, ErrorMessages } from '../../../core/constants/error-codes';

/**
 * Code Existence Validator
 * Validates that a code/lookup value exists in the database
 */
export class CodeExistsValidator {
  /**
   * Validate code exists and throw BadRequestException if not found
   */
  static validate(codeId: number | null | undefined): void {
    if (!codeId || typeof codeId !== 'number' || codeId <= 0) {
      throw new BadRequestException({
        errorCode: ErrorCodes.COD_CODE_NOT_FOUND,
        message: ErrorMessages[ErrorCodes.COD_CODE_NOT_FOUND],
      });
    }
  }

  /**
   * Check if code ID is valid without throwing
   */
  static isValid(codeId: number | null | undefined): boolean {
    return !!(codeId && typeof codeId === 'number' && codeId > 0);
  }
}
