import { UnauthorizedException, ForbiddenException, NotFoundException } from '../../../../common/exceptions';
import { ErrorCode, errPayload } from '../../../../common/constants/error-codes.constants';

export class SessionAuthValidator {
  static assertSessionOwnership<T extends { userFk: number | string }>(
    session: T | null | undefined,
    userId: number,
  ): asserts session is T {
    if (!session || session.userFk !== userId) {
      throw new UnauthorizedException(errPayload(ErrorCode.AUTH_INVALID_SESSION_TOKEN));
    }
  }

  static assertNotForbiddenSession(
    requestingUserId: number | undefined,
    targetUserId: number,
    isSuperAdmin: boolean,
  ): void {
    if (requestingUserId && targetUserId !== requestingUserId && !isSuperAdmin) {
      throw new ForbiddenException(errPayload(ErrorCode.AUTH_FORBIDDEN_SESSION));
    }
  }

  static assertSessionFound<T>(session: T | null | undefined): asserts session is T {
    if (!session) throw new NotFoundException(errPayload(ErrorCode.AUTH_SESSION_NOT_FOUND));
  }

  static assertSessionBelongsToUser<T extends { userFk: number | string }>(
    session: T,
    userId: number,
  ): void {
    if (session.userFk !== userId) {
      throw new ForbiddenException(errPayload(ErrorCode.AUTH_FORBIDDEN_SESSION));
    }
  }

  static assertSessionCreated<T>(session: T | null | undefined): asserts session is T {
    if (!session) throw new UnauthorizedException(errPayload(ErrorCode.AUTH_SESSION_CREATE_FAILED));
  }
}
