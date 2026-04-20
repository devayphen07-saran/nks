import { BadRequestException } from '@nestjs/common';
import { ErrorCode, ErrorMessages } from '../../../common/constants/error-codes.constants';

/**
 * Pincode Validator
 * Validates Indian postal codes (6-digit format)
 */
export class PincodeValidator {
  private static readonly PINCODE_REGEX = /^\d{6}$/;

  /**
   * Validate pincode and throw BadRequestException if invalid
   */
  static validate(pincode: string): void {
    if (!pincode || typeof pincode !== 'string' || !this.PINCODE_REGEX.test(pincode.trim())) {
      throw new BadRequestException({
        errorCode: ErrorCode.LOC_INVALID_PINCODE,
        message: ErrorMessages[ErrorCode.LOC_INVALID_PINCODE],
      });
    }
  }

  /**
   * Check if pincode is valid without throwing
   */
  static isValid(pincode: string): boolean {
    return !!(pincode && typeof pincode === 'string' && this.PINCODE_REGEX.test(pincode.trim()));
  }

  /**
   * Normalize pincode (remove spaces)
   */
  static normalize(pincode: string): string {
    return pincode.trim();
  }
}
