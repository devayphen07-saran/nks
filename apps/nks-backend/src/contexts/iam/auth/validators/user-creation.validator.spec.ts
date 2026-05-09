import { UserCreationValidator } from './user-creation.validator';
import { BadRequestException } from '../../../../common/exceptions';
import { ErrorCode } from '../../../../common/constants/error-codes.constants';

const catchError = <T>(fn: () => void): T | undefined => {
  try {
    fn();
  } catch (e) {
    return e as T;
  }
  return undefined;
};

describe('UserCreationValidator', () => {
  describe('assertUserCreated', () => {
    it('does not throw for a non-null user', () => {
      expect(() => UserCreationValidator.assertUserCreated({ id: 1 })).not.toThrow();
    });

    it('throws BadRequestException with USER_CREATION_FAILED for null', () => {
      const err = catchError<BadRequestException>(() => UserCreationValidator.assertUserCreated(null));
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err?.code).toBe(ErrorCode.USER_CREATION_FAILED);
    });

    it('throws for undefined', () => {
      expect(() => UserCreationValidator.assertUserCreated(undefined)).toThrow(BadRequestException);
    });
  });

  describe('assertAdminExists', () => {
    it('does not throw when exists is true', () => {
      expect(() => UserCreationValidator.assertAdminExists(true)).not.toThrow();
    });

    it('throws BadRequestException with AUTH_NO_ADMIN_EXISTS when false', () => {
      const err = catchError<BadRequestException>(() => UserCreationValidator.assertAdminExists(false));
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err?.code).toBe(ErrorCode.AUTH_NO_ADMIN_EXISTS);
    });
  });
});