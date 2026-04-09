import { BadRequestException } from '@nestjs/common';
import { ErrorCodes, ErrorMessages } from '../../../core/constants/error-codes';

/**
 * Pincode Existence Validator
 * Validates that a pincode exists in the database
 */
export class PincodeExistsValidator {
  /**
   * Validate pincode exists and throw BadRequestException if not found
   */
  static validate(pincodeId: number | null | undefined): void {
    if (!pincodeId || typeof pincodeId !== 'number' || pincodeId <= 0) {
      throw new BadRequestException({
        errorCode: ErrorCodes.LOC_PINCODE_NOT_FOUND,
        message: ErrorMessages[ErrorCodes.LOC_PINCODE_NOT_FOUND],
      });
    }
  }

  /**
   * Check if pincode ID is valid without throwing
   */
  static isValid(pincodeId: number | null | undefined): boolean {
    return !!(pincodeId && typeof pincodeId === 'number' && pincodeId > 0);
  }
}
