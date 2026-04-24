import { ForbiddenException } from '../../../common/exceptions';
import { ErrorCode, errPayload } from '../../../common/constants/error-codes.constants';

export class SyncAccessValidator {
  static assertStoreMembership(storeId: number | null | undefined): asserts storeId is number {
    if (!storeId) throw new ForbiddenException(errPayload(ErrorCode.SYNC_STORE_ACCESS_DENIED));
  }

  static assertSessionNotExpired(offlineValidUntil: number): void {
    if (offlineValidUntil < Date.now()) throw new ForbiddenException(errPayload(ErrorCode.SYNC_SESSION_EXPIRED));
  }

  static assertSignatureValid(isValid: boolean): void {
    if (!isValid) throw new ForbiddenException(errPayload(ErrorCode.SYNC_SESSION_INVALID_SIGNATURE));
  }

  static assertDeviceNotRevoked(isRevoked: boolean): void {
    if (isRevoked) throw new ForbiddenException(errPayload(ErrorCode.SYNC_DEVICE_REVOKED));
  }

  static assertOfflineTokenValid<T>(jwtPayload: T | null | undefined): asserts jwtPayload is T {
    if (!jwtPayload) throw new ForbiddenException(errPayload(ErrorCode.SYNC_TOKEN_INVALID));
  }

  static assertRolesMatch(jwtRoles: string[], hmacRoles: string[]): void {
    const jwtSorted = [...jwtRoles].sort().join(',');
    const hmacSorted = [...hmacRoles].sort().join(',');
    if (jwtSorted !== hmacSorted) throw new ForbiddenException(errPayload(ErrorCode.SYNC_TOKEN_ROLE_MISMATCH));
  }

  static assertStoreMatch(jwtStoreGuuid: string | null, hmacStoreGuuid: string | null): void {
    if (jwtStoreGuuid !== hmacStoreGuuid) throw new ForbiddenException(errPayload(ErrorCode.SYNC_TOKEN_STORE_MISMATCH));
  }
}
