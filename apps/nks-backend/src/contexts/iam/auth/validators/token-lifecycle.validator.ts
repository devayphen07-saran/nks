import { UnauthorizedException } from '../../../../common/exceptions';
import { ErrorCode, errPayload } from '../../../../common/constants/error-codes.constants';

export class TokenLifecycleValidator {
  static assertRefreshTokenValid(session: unknown): asserts session is NonNullable<typeof session> {
    if (!session) throw new UnauthorizedException(errPayload(ErrorCode.AUTH_REFRESH_TOKEN_INVALID));
  }

  static assertTokenHashValid(isValid: boolean): void {
    if (!isValid) throw new UnauthorizedException(errPayload(ErrorCode.AUTH_REFRESH_TOKEN_INVALID));
  }

  static assertNotCompromised(revokedAt: Date | null | undefined): void {
    if (revokedAt !== null && revokedAt !== undefined) {
      throw new UnauthorizedException(errPayload(ErrorCode.AUTH_SESSION_COMPROMISED));
    }
  }

  static assertSessionNotExpired(expiresAt: Date): void {
    if (expiresAt < new Date()) throw new UnauthorizedException(errPayload(ErrorCode.AUTH_SESSION_EXPIRED));
  }

  static assertDeviceMatch(sessionDeviceId: string | null, requestDeviceId: string | null): void {
    if (sessionDeviceId !== null && sessionDeviceId !== requestDeviceId) {
      throw new UnauthorizedException(errPayload(ErrorCode.AUTH_DEVICE_MISMATCH));
    }
  }

  static assertRefreshTokenNotExpired(refreshTokenExpiresAt: Date | null | undefined): void {
    if (refreshTokenExpiresAt && refreshTokenExpiresAt < new Date()) {
      throw new UnauthorizedException(errPayload(ErrorCode.AUTH_REFRESH_TOKEN_EXPIRED));
    }
  }

  static assertSessionCreated<T>(session: T | null | undefined): asserts session is T {
    if (!session) throw new UnauthorizedException(errPayload(ErrorCode.AUTH_SESSION_ROTATION_FAILED));
  }

  static assertRotationSucceeded(rotated: boolean): void {
    if (!rotated) throw new UnauthorizedException(errPayload(ErrorCode.AUTH_REFRESH_TOKEN_INVALID));
  }
}
