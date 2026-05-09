import { OtpValidator } from './otp.validator';
import {
  BadRequestException,
  UnauthorizedException,
} from '../../../../common/exceptions';
import { ErrorCode } from '../../../../common/constants/error-codes.constants';

const catchError = <T>(fn: () => void): T | undefined => {
  try {
    fn();
  } catch (e) {
    return e as T;
  }
  return undefined;
};

describe('OtpValidator', () => {
  describe('assertMsg91SendSuccess', () => {
    it('does not throw for a success response', () => {
      expect(() => OtpValidator.assertMsg91SendSuccess({ type: 'success' })).not.toThrow();
    });

    it('throws BadRequestException for null response', () => {
      expect(() => OtpValidator.assertMsg91SendSuccess(null)).toThrow(BadRequestException);
    });

    it('throws BadRequestException for undefined response', () => {
      expect(() => OtpValidator.assertMsg91SendSuccess(undefined)).toThrow(BadRequestException);
    });

    it('throws BadRequestException for error type', () => {
      expect(() =>
        OtpValidator.assertMsg91SendSuccess({ type: 'error', message: 'rate limited' }),
      ).toThrow(BadRequestException);
    });
  });

  describe('assertMsg91VerifySuccess', () => {
    it('does not throw for type "success"', () => {
      expect(() => OtpValidator.assertMsg91VerifySuccess({ type: 'success' })).not.toThrow();
    });

    it('throws BadRequestException for non-success type', () => {
      expect(() => OtpValidator.assertMsg91VerifySuccess({ type: 'error' })).toThrow(BadRequestException);
    });

    it('throws BadRequestException for null', () => {
      expect(() => OtpValidator.assertMsg91VerifySuccess(null)).toThrow(BadRequestException);
    });
  });

  describe('assertOtpFound', () => {
    it('does not throw for a non-null record', () => {
      expect(() => OtpValidator.assertOtpFound({ id: 1 })).not.toThrow();
    });

    it('throws BadRequestException with OTP_NOT_FOUND for null', () => {
      const err = catchError<BadRequestException>(() => OtpValidator.assertOtpFound(null));
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err?.code).toBe(ErrorCode.OTP_NOT_FOUND);
    });
  });

  describe('assertOtpNotUsed', () => {
    it('does not throw when isUsed is false', () => {
      expect(() => OtpValidator.assertOtpNotUsed(false)).not.toThrow();
    });

    it('throws BadRequestException with OTP_ALREADY_USED when true', () => {
      const err = catchError<BadRequestException>(() => OtpValidator.assertOtpNotUsed(true));
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err?.code).toBe(ErrorCode.OTP_ALREADY_USED);
    });
  });

  describe('assertOtpNotExpired', () => {
    it('does not throw for a future expiry', () => {
      expect(() => OtpValidator.assertOtpNotExpired(new Date(Date.now() + 60_000))).not.toThrow();
    });

    it('throws BadRequestException with OTP_EXPIRED for past date', () => {
      const err = catchError<BadRequestException>(() =>
        OtpValidator.assertOtpNotExpired(new Date(Date.now() - 60_000)),
      );
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err?.code).toBe(ErrorCode.OTP_EXPIRED);
    });
  });

  describe('assertAttemptsNotExceeded', () => {
    it('does not throw when attempts under max', () => {
      expect(() => OtpValidator.assertAttemptsNotExceeded(2, 5)).not.toThrow();
    });

    it('throws BadRequestException with OTP_MAX_ATTEMPTS_EXCEEDED when at max', () => {
      const err = catchError<BadRequestException>(() => OtpValidator.assertAttemptsNotExceeded(5, 5));
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err?.code).toBe(ErrorCode.OTP_MAX_ATTEMPTS_EXCEEDED);
    });

    it('throws when attempts exceed max', () => {
      expect(() => OtpValidator.assertAttemptsNotExceeded(10, 5)).toThrow(BadRequestException);
    });
  });

  describe('assertOtpValid', () => {
    it('does not throw when isValid is true', () => {
      expect(() => OtpValidator.assertOtpValid(true)).not.toThrow();
    });

    it('throws BadRequestException with OTP_INVALID when false', () => {
      const err = catchError<BadRequestException>(() => OtpValidator.assertOtpValid(false));
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err?.code).toBe(ErrorCode.OTP_INVALID);
    });
  });

  describe('assertUserFound', () => {
    it('does not throw for a non-null user', () => {
      expect(() => OtpValidator.assertUserFound({ id: 1 })).not.toThrow();
    });

    it('throws BadRequestException with USER_NOT_FOUND for null', () => {
      const err = catchError<BadRequestException>(() => OtpValidator.assertUserFound(null));
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err?.code).toBe(ErrorCode.USER_NOT_FOUND);
    });
  });

  describe('assertNotBlocked', () => {
    it('does not throw when not blocked', () => {
      expect(() => OtpValidator.assertNotBlocked({ isBlocked: false })).not.toThrow();
    });

    it('does not throw when isBlocked is undefined', () => {
      expect(() => OtpValidator.assertNotBlocked({})).not.toThrow();
    });

    it('throws UnauthorizedException with USER_BLOCKED when blocked', () => {
      const err = catchError<UnauthorizedException>(() =>
        OtpValidator.assertNotBlocked({ isBlocked: true }),
      );
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err?.code).toBe(ErrorCode.USER_BLOCKED);
    });
  });

  describe('assertEmailPresent', () => {
    it('does not throw for a non-empty email string', () => {
      expect(() => OtpValidator.assertEmailPresent('user@example.com')).not.toThrow();
    });

    it('throws BadRequestException with AUTH_EMAIL_NOT_SET for null', () => {
      const err = catchError<BadRequestException>(() => OtpValidator.assertEmailPresent(null));
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err?.code).toBe(ErrorCode.AUTH_EMAIL_NOT_SET);
    });

    it('throws for undefined', () => {
      expect(() => OtpValidator.assertEmailPresent(undefined)).toThrow(BadRequestException);
    });

    it('throws for empty string', () => {
      expect(() => OtpValidator.assertEmailPresent('')).toThrow(BadRequestException);
    });
  });
});