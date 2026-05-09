import { InternalServerException } from '../../../../common/exceptions';
import { ErrorCode, errPayload } from '../../../../common/constants/error-codes.constants';
import type { AuthResponseEnvelope } from '../dto/auth-response.dto';
import type { OfflineCredentials } from '../services/token/offline-token.service';

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
  bearerToken: string;
}

export type UserRoleEntry = {
  roleCode: string;
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
  refreshToken: string;
  jwtExpiresAt: Date;
  refreshTokenExpiresAt: Date;
};

export interface BuildEnvelopeOptions {
  authResult: AuthResult;
  tokenPair: TokenPair;
  defaultStore: { id: number; guuid: string } | null | undefined;
  sessionId: string;
  sessionExpiresAt: string | Date;
  refreshTokenExpiresAt: string | Date;
  offline?: OfflineCredentials | null;
}


export class AuthMapper {
  static buildAuthResponseEnvelope({
    authResult,
    tokenPair,
    defaultStore,
    sessionId,
    sessionExpiresAt,
    refreshTokenExpiresAt,
    offline,
  }: BuildEnvelopeOptions): AuthResponseEnvelope {
    const { user, bearerToken } = authResult;

    const sessionExpiresAtStr = sessionExpiresAt instanceof Date ? sessionExpiresAt.toISOString() : sessionExpiresAt;
    const refreshTokenExpiresAtStr = refreshTokenExpiresAt instanceof Date ? refreshTokenExpiresAt.toISOString() : refreshTokenExpiresAt;

    return {
      user: this.buildPublicUserDto(user),
      auth: {
        sessionId,
        bearerToken,
        sessionExpiresAt: sessionExpiresAtStr,
        refreshToken: tokenPair.refreshToken,
        refreshTokenExpiresAt: refreshTokenExpiresAtStr,
      },
      context: {
        defaultStoreGuuid: defaultStore?.guuid ?? null,
        defaultStoreId: defaultStore?.id ?? null,
      },
      offline: offline ?? null,
    };
  }

  static buildPublicUserDto(user: AuthResult['user']): PublicUserDto {
    if (!user.guuid || !user.iamUserId) {
      throw new InternalServerException(errPayload(ErrorCode.INTERNAL_SERVER_ERROR));
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
      roleCode?: string;
      code?: string;
      storeFk?: number | null;
      storeGuuid?: string | null;
      storeName?: string | null;
      isPrimary?: boolean | null;
      assignedAt: Date | string;
    }>,
    storeIdOverride?: number,
  ): UserRoleEntry[] {
    return roleRows.map((roleRow) => {
      const resolvedRoleCode = roleRow.roleCode ?? roleRow.code;
      if (!resolvedRoleCode) {
        throw new InternalServerException(errPayload(ErrorCode.INTERNAL_SERVER_ERROR));
      }
      const assignedAt =
        roleRow.assignedAt instanceof Date
          ? roleRow.assignedAt.toISOString()
          : roleRow.assignedAt;

      return {
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
