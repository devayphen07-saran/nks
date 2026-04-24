import { BadRequestException } from '../../../../common/exceptions';
import type { AuthResponseEnvelope } from '../dto/auth-response.dto';
import { STORE_CONSTANTS } from '../../../../common/constants/app-constants';
import { INITIAL_SYNC_CURSOR } from '../../../sync/sync.constants';
// crypto import removed - UUID generation is business logic, not transformation

export type PublicUserDto = {
  guuid: string;
  iamUserId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phoneNumber: string | null;
};

interface AuthResult {
  user: {
    id: string | number;
    guuid?: string | null;
    /**
     * Required external user identifier. Must be set by callers — mapper
     * refuses to build the envelope without it (see buildPublicUserDto).
     */
    iamUserId: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phoneNumber?: string | null;
  };
  token?: string | null;
  session?: {
    token?: string;
    expiresAt?: Date | string | null;
    sessionId?: string;
  };
}

export type UserRoleEntry = {
  roleId: number;
  roleCode:
    | (typeof STORE_CONSTANTS.STAFF_ROLES)[number]
    | typeof STORE_CONSTANTS.CUSTOMER_ROLE
    | string;
  storeId: number | null;
  storeGuuid: string | null;
  storeName: string | null;
  isPrimary: boolean;
  assignedAt: string;
  expiresAt: string | null;
};

export type PermissionContext = {
  roles: UserRoleEntry[];
  isSuperAdmin: boolean;
  method?: 'password' | 'otp' | 'oauth';
  mfaVerified?: boolean;
  mfaRequired?: boolean;
  trustLevel?: 'standard' | 'high' | 'unverified';
  stepUpRequired?: boolean;
};

export type TokenPair = {
  jwtToken: string;
  refreshToken: string;
  jwtExpiresAt: Date;
  refreshTokenExpiresAt: Date;
};

export class AuthMapper {
  static buildAuthResponseEnvelope(
    authResult: AuthResult,
    tokenPair?: TokenPair,
    defaultStore?: { guuid: string } | null,
    sessionId?: string, // Business logic: must be generated in service
    expiresAt?: string | Date, // Business logic: TTL calculation must be in service
    refreshExpiresAt?: string | Date, // Business logic: TTL calculation must be in service
    offlineToken?: string, // 3-day offline JWT for mobile offline verification
    offlineSessionSignature?: string, // HMAC-SHA256 of the offline session payload (server-side signed)
    deviceId?: string, // Echoed in sync.deviceId; null for web clients that don't send X-Device-Id
  ): AuthResponseEnvelope {
    const user = authResult.user;
    const sessionToken = authResult.token ?? authResult.session?.token ?? '';

    // Require sessionId from service (mapper is pure transformation only)
    if (!sessionId) {
      throw new BadRequestException(
        'AuthMapper.toAuthResponseEnvelope: sessionId is required',
      );
    }

    const jwtToken = tokenPair?.jwtToken;
    const refreshToken = tokenPair?.refreshToken ?? sessionToken;

    // Convert expiresAt/refreshExpiresAt to ISO string (transformation only, no calculation)
    const expiresAtStr =
      expiresAt instanceof Date
        ? expiresAt.toISOString()
        : String(expiresAt ?? '');
    const refreshExpiresAtStr =
      refreshExpiresAt instanceof Date
        ? refreshExpiresAt.toISOString()
        : String(refreshExpiresAt ?? '');

    return {
      user: this.buildPublicUserDto(user),
      session: {
        sessionId,
        sessionToken,
        tokenType: 'Bearer' as const,
        expiresAt: expiresAtStr,
        refreshToken,
        refreshExpiresAt: refreshExpiresAtStr,
        defaultStore: defaultStore ?? null,
        ...(jwtToken ? { jwtToken } : {}),
      },
      sync: {
        cursor: INITIAL_SYNC_CURSOR,
        lastSyncedAt: null,
        deviceId: deviceId ?? null,
      },
      ...(offlineToken ? { offlineToken } : {}),
      ...(offlineSessionSignature ? { offlineSessionSignature } : {}),
    };
  }

  static buildPublicUserDto(
    user: AuthResult['user'] | null | undefined,
  ): PublicUserDto {
    if (!user)
      throw new BadRequestException(
        'AuthMapper.toPublicUserDto: user is required',
      );

    if (!user.guuid) {
      throw new BadRequestException('AuthMapper.toPublicUserDto: user.guuid is required');
    }

    if (!user.iamUserId) {
      throw new BadRequestException('AuthMapper.toPublicUserDto: user.iamUserId is required');
    }

    return {
      guuid: user.guuid,
      iamUserId: user.iamUserId,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      email: user.email ?? null,
      phoneNumber: user.phoneNumber ?? null,
    };
  }

  /**
   * Transform database role rows to UserRoleEntry objects
   * Handles role code resolution, store ID overrides, and primary role detection
   */
  static buildRoleEntries(
    roleRows: Array<{
      roleId?: number | null;
      roleCode?: string;
      code?: string;
      storeFk?: number | null;
      storeGuuid?: string | null;
      storeName?: string | null;
      isPrimary?: boolean | null;
    }>,
    storeIdOverride?: number,
    assignedAt?: string, // Business logic: timestamp must be generated in service
  ): UserRoleEntry[] {
    if (!assignedAt) {
      throw new BadRequestException(
        'AuthMapper.mapToRoleEntries: assignedAt is required',
      );
    }

    return roleRows.map((roleRow, index) => {
      const resolvedRoleCode = roleRow.roleCode ?? roleRow.code;

      if (!resolvedRoleCode) {
        throw new BadRequestException(
          `AuthMapper.mapToRoleEntries: roleCode is required (row ${index})`,
        );
      }

      return {
        roleId: roleRow.roleId ?? 0,
        roleCode: resolvedRoleCode as UserRoleEntry['roleCode'],
        storeId: storeIdOverride ?? roleRow.storeFk ?? null,
        storeGuuid: roleRow.storeGuuid ?? null,
        storeName: roleRow.storeName ?? null,
        isPrimary: roleRow.isPrimary ?? false,
        assignedAt,
        expiresAt: null,
      };
    });
  }
}
