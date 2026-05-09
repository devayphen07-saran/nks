import { PasswordAuthValidator } from './password-auth.validator';
import {
  UnauthorizedException,
  ConflictException,
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

describe('PasswordAuthValidator', () => {
  describe('assertUserFound', () => {
    it('does not throw for a non-null user', () => {
      expect(() => PasswordAuthValidator.assertUserFound({ id: 1 })).not.toThrow();
    });

    it('throws UnauthorizedException with AUTH_INVALID_CREDENTIALS for null', () => {
      const err = catchError<UnauthorizedException>(() => PasswordAuthValidator.assertUserFound(null));
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err?.code).toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);
    });

    it('throws for undefined', () => {
      expect(() => PasswordAuthValidator.assertUserFound(undefined)).toThrow(UnauthorizedException);
    });
  });

  describe('assertNotBlocked', () => {
    it('does not throw when isBlocked is false', () => {
      expect(() => PasswordAuthValidator.assertNotBlocked({ isBlocked: false })).not.toThrow();
    });

    it('does not throw when isBlocked is null', () => {
      expect(() => PasswordAuthValidator.assertNotBlocked({ isBlocked: null })).not.toThrow();
    });

    it('does not throw when isBlocked is undefined', () => {
      expect(() => PasswordAuthValidator.assertNotBlocked({})).not.toThrow();
    });

    it('throws UnauthorizedException with USER_BLOCKED when isBlocked is true', () => {
      const err = catchError<UnauthorizedException>(() =>
        PasswordAuthValidator.assertNotBlocked({ isBlocked: true }),
      );
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err?.code).toBe(ErrorCode.USER_BLOCKED);
    });
  });

  describe('assertNotLocked', () => {
    it('does not throw when accountLockedUntil is null', () => {
      expect(() => PasswordAuthValidator.assertNotLocked({ accountLockedUntil: null })).not.toThrow();
    });

    it('does not throw when accountLockedUntil is undefined', () => {
      expect(() => PasswordAuthValidator.assertNotLocked({})).not.toThrow();
    });

    it('does not throw when accountLockedUntil is in the past', () => {
      const past = new Date(Date.now() - 60_000);
      expect(() => PasswordAuthValidator.assertNotLocked({ accountLockedUntil: past })).not.toThrow();
    });

    it('throws UnauthorizedException with AUTH_ACCOUNT_LOCKED when lock is in the future', () => {
      const future = new Date(Date.now() + 60_000);
      const err = catchError<UnauthorizedException>(() =>
        PasswordAuthValidator.assertNotLocked({ accountLockedUntil: future }),
      );
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err?.code).toBe(ErrorCode.AUTH_ACCOUNT_LOCKED);
    });
  });

  describe('assertPasswordValid', () => {
    it('does not throw when isValid is true', () => {
      expect(() => PasswordAuthValidator.assertPasswordValid(true)).not.toThrow();
    });

    it('throws UnauthorizedException with AUTH_INVALID_CREDENTIALS when false', () => {
      const err = catchError<UnauthorizedException>(() => PasswordAuthValidator.assertPasswordValid(false));
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err?.code).toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);
    });
  });

  describe('assertEmailNotTaken', () => {
    it('does not throw for null', () => {
      expect(() => PasswordAuthValidator.assertEmailNotTaken(null)).not.toThrow();
    });

    it('does not throw for undefined', () => {
      expect(() => PasswordAuthValidator.assertEmailNotTaken(undefined)).not.toThrow();
    });

    it('throws ConflictException with USER_EMAIL_ALREADY_EXISTS when existing record present', () => {
      const err = catchError<ConflictException>(() => PasswordAuthValidator.assertEmailNotTaken({ id: 1 }));
      expect(err).toBeInstanceOf(ConflictException);
      expect(err?.code).toBe(ErrorCode.USER_EMAIL_ALREADY_EXISTS);
    });
  });

  describe('assertUserCreated', () => {
    it('does not throw for a non-null user', () => {
      expect(() => PasswordAuthValidator.assertUserCreated({ id: 1 })).not.toThrow();
    });

    it('throws ConflictException with USER_EMAIL_ALREADY_EXISTS for null', () => {
      const err = catchError<ConflictException>(() => PasswordAuthValidator.assertUserCreated(null));
      expect(err).toBeInstanceOf(ConflictException);
      expect(err?.code).toBe(ErrorCode.USER_EMAIL_ALREADY_EXISTS);
    });
  });
});