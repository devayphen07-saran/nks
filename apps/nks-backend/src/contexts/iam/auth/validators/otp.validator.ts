import { BadRequestException, UnauthorizedException } from '../../../../common/exceptions';
import { ErrorCode, errPayload } from '../../../../common/constants/error-codes.constants';

export class OtpValidator {
  static assertMsg91SendSuccess(response: { type?: string; message?: string } | null | undefined): void {
    if (!response || response.type === 'error') {
      throw new BadRequestException(response?.message || 'Failed to send OTP');
    }
  }

  static assertMsg91VerifySuccess(response: { type?: string; message?: string } | null | undefined): void {
    if (response?.type !== 'success') {
      throw new BadRequestException(response?.message || 'Invalid OTP');
    }
  }

  static assertOtpFound<T>(otpRecord: T | null | undefined): asserts otpRecord is T {
    if (!otpRecord) throw new BadRequestException(errPayload(ErrorCode.OTP_NOT_FOUND));
  }

  static assertOtpNotUsed(isUsed: boolean): void {
    if (isUsed) throw new BadRequestException(errPayload(ErrorCode.OTP_ALREADY_USED));
  }

  static assertOtpNotExpired(expiresAt: Date): void {
    if (expiresAt < new Date()) throw new BadRequestException(errPayload(ErrorCode.OTP_EXPIRED));
  }

  static assertAttemptsNotExceeded(attempts: number, max: number): void {
    if (attempts >= max) throw new BadRequestException(errPayload(ErrorCode.OTP_MAX_ATTEMPTS_EXCEEDED));
  }

  static assertOtpValid(isValid: boolean): void {
    if (!isValid) throw new BadRequestException(errPayload(ErrorCode.OTP_INVALID));
  }

  static assertUserFound<T>(user: T | null | undefined): asserts user is T {
    if (!user) throw new BadRequestException(errPayload(ErrorCode.USER_NOT_FOUND));
  }

  static assertNotBlocked(user: { isBlocked?: boolean | null }): void {
    if (user.isBlocked) throw new UnauthorizedException(errPayload(ErrorCode.USER_BLOCKED));
  }

  static assertEmailPresent(email: string | null | undefined): asserts email is string {
    if (!email) throw new BadRequestException(errPayload(ErrorCode.AUTH_EMAIL_NOT_SET));
  }
}
