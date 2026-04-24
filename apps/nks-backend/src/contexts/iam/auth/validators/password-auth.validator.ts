import {
  UnauthorizedException,
  ConflictException,
} from '../../../../common/exceptions';
import {
  ErrorCode,
  errPayload,
} from '../../../../common/constants/error-codes.constants';

export class PasswordAuthValidator {
  static assertUserFound<T>(user: T | null | undefined): asserts user is T {
    if (!user)
      throw new UnauthorizedException(
        errPayload(ErrorCode.AUTH_INVALID_CREDENTIALS),
      );
  }

  static assertNotBlocked(user: { isBlocked?: boolean | null }): void {
    if (user.isBlocked)
      throw new UnauthorizedException(errPayload(ErrorCode.USER_BLOCKED));
  }

  static assertNotLocked(user: { accountLockedUntil?: Date | null }): void {
    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      throw new UnauthorizedException(
        errPayload(ErrorCode.AUTH_ACCOUNT_LOCKED),
      );
    }
  }

  static assertEmailVerified(user: { emailVerified?: boolean | null }): void {
    if (!user.emailVerified)
      throw new UnauthorizedException(
        errPayload(ErrorCode.AUTH_EMAIL_NOT_VERIFIED),
      );
  }

  static assertPasswordValid(isValid: boolean): void {
    if (!isValid)
      throw new UnauthorizedException(
        errPayload(ErrorCode.AUTH_INVALID_CREDENTIALS),
      );
  }

  static assertEmailNotTaken<T>(existing: T | null | undefined): void {
    if (existing)
      throw new ConflictException(
        errPayload(ErrorCode.USER_EMAIL_ALREADY_EXISTS),
      );
  }

  static assertUserCreated<T>(user: T | null | undefined): asserts user is T {
    if (!user)
      throw new ConflictException(
        errPayload(ErrorCode.USER_EMAIL_ALREADY_EXISTS),
      );
  }
}
