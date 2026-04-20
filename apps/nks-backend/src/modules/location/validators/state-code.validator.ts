import { BadRequestException } from '@nestjs/common';
import { ErrorCode, ErrorMessages } from '../../../common/constants/error-codes.constants';

/**
 * State Code Validator
 * Validates Indian state codes (2-letter uppercase format)
 */
export class StateCodeValidator {
  private static readonly STATE_CODE_REGEX = /^[A-Z]{2}$/;

  /**
   * Validate state code and throw BadRequestException if invalid
   */
  static validate(stateCode: string): void {
    if (!stateCode || typeof stateCode !== 'string' || !this.STATE_CODE_REGEX.test(stateCode.trim())) {
      throw new BadRequestException({
        errorCode: ErrorCode.LOC_INVALID_STATE_CODE,
        message: ErrorMessages[ErrorCode.LOC_INVALID_STATE_CODE],
      });
    }
  }

  /**
   * Check if state code is valid without throwing
   */
  static isValid(stateCode: string): boolean {
    return !!(stateCode && typeof stateCode === 'string' && this.STATE_CODE_REGEX.test(stateCode.trim()));
  }

  /**
   * Normalize state code to uppercase
   */
  static normalize(stateCode: string): string {
    return stateCode.trim().toUpperCase();
  }
}
