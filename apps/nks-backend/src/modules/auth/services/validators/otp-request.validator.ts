import { BadRequestException } from '@nestjs/common';
import { ErrorCodes, ErrorMessages } from '../../../../core/constants/error-codes';
import { PhoneValidator } from './phone.validator';
import { EmailValidator } from './email.validator';

/**
 * OTP Request Validator
 * Validates OTP request parameters (phone or email)
 */
export class OtpRequestValidator {
  /**
   * Validate phone for OTP sending
   */
  static validatePhone(phone: string): void {
    PhoneValidator.validate(phone);
  }

  /**
   * Validate email for OTP sending
   */
  static validateEmail(email: string): void {
    EmailValidator.validate(email);
  }

  /**
   * Validate OTP code (6 digits)
   */
  static validateOtpCode(otp: string): void {
    const OTP_REGEX = /^\d{6}$/;
    if (!otp || !OTP_REGEX.test(otp)) {
      throw new BadRequestException({
        errorCode: ErrorCodes.AUTH_INVALID_OTP,
        message: ErrorMessages[ErrorCodes.AUTH_INVALID_OTP],
      });
    }
  }

  /**
   * Validate request ID (UUID format)
   */
  static validateRequestId(reqId: string): void {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!reqId || !UUID_REGEX.test(reqId)) {
      throw new BadRequestException({
        errorCode: ErrorCodes.GEN_INVALID_INPUT,
        message: ErrorMessages[ErrorCodes.GEN_INVALID_INPUT],
      });
    }
  }
}
