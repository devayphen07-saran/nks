import { SessionAuthValidator } from './session-auth.validator';
import {
  UnauthorizedException,
  ForbiddenException,
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

describe('SessionAuthValidator', () => {
  describe('assertSessionOwnership', () => {
    it('does not throw when session exists and userId matches', () => {
      const session = { userId: 42 };
      expect(() => SessionAuthValidator.assertSessionOwnership(session, 42)).not.toThrow();
    });

    it('throws UnauthorizedException with AUTH_INVALID_SESSION_TOKEN when session is null', () => {
      const err = catchError<UnauthorizedException>(() =>
        SessionAuthValidator.assertSessionOwnership(null, 42),
      );
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err?.code).toBe(ErrorCode.AUTH_INVALID_SESSION_TOKEN);
    });

    it('throws UnauthorizedException when userId does not match', () => {
      const session = { userId: 42 };
      const err = catchError<UnauthorizedException>(() =>
        SessionAuthValidator.assertSessionOwnership(session, 99),
      );
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err?.code).toBe(ErrorCode.AUTH_INVALID_SESSION_TOKEN);
    });

    it('throws for undefined session', () => {
      expect(() => SessionAuthValidator.assertSessionOwnership(undefined, 42)).toThrow(UnauthorizedException);
    });
  });

  describe('assertSessionBelongsToUser', () => {
    it('does not throw when userId matches', () => {
      expect(() => SessionAuthValidator.assertSessionBelongsToUser({ userId: 42 }, 42)).not.toThrow();
    });

    it('throws ForbiddenException with AUTH_FORBIDDEN_SESSION when userId does not match', () => {
      const err = catchError<ForbiddenException>(() =>
        SessionAuthValidator.assertSessionBelongsToUser({ userId: 1 }, 42),
      );
      expect(err).toBeInstanceOf(ForbiddenException);
      expect(err?.code).toBe(ErrorCode.AUTH_FORBIDDEN_SESSION);
    });
  });

  describe('assertSessionCreated', () => {
    it('does not throw for a non-null session', () => {
      expect(() => SessionAuthValidator.assertSessionCreated({ id: 1 })).not.toThrow();
    });

    it('throws UnauthorizedException with AUTH_SESSION_CREATE_FAILED for null', () => {
      const err = catchError<UnauthorizedException>(() => SessionAuthValidator.assertSessionCreated(null));
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err?.code).toBe(ErrorCode.AUTH_SESSION_CREATE_FAILED);
    });
  });
});