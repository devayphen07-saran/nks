import { BadRequestException } from '@nestjs/common';
import type { AuthResponseEnvelope } from '../dto/auth-response.dto';
import { STORE_CONSTANTS } from '../../../common/constants/app-constants';
// crypto import removed - UUID generation is business logic, not transformation

export type PublicUserDto = {
  id: string;
  guuid: string;
  name: string;
  email: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
  image: string | null;
};

interface AuthResult {
  user: {
    id: string | number;
    guuid?: string | null;
    email?: string | null;
    name: string;
    emailVerified?: boolean;
    image?: string | null;
    phoneNumber?: string | null;
    phoneNumberVerified?: boolean;
  };
  token?: string | null;
  session?: {
    token?: string;
    expiresAt?: Date | string | null;
    sessionId?: string;
  };
}

export type UserRoleEntry = {
  roleCode:
    | (typeof STORE_CONSTANTS.STAFF_ROLES)[number]
    | typeof STORE_CONSTANTS.CUSTOMER_ROLE
    | string;
  storeId: number | null;
  storeName: string | null;
  isPrimary: boolean;
  assignedAt: string;
  expiresAt: string | null;
};

export type PermissionContext = {
  roles: UserRoleEntry[];
  isSuperAdmin: boolean;
  activeStoreId: number | null;
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
  static toAuthResponseEnvelope(
    authResult: AuthResult,
    permissionContext: PermissionContext,
    requestId: string,
    traceId: string,
    tokenPair?: TokenPair,
    defaultStore?: { guuid: string } | null,
    sessionId?: string, // Business logic: must be generated in service
    issuedAt?: string, // Business logic: must be generated in service
    expiresAt?: string | Date, // Business logic: TTL calculation must be in service
    refreshExpiresAt?: string | Date, // Business logic: TTL calculation must be in service
    offlineToken?: string, // 7-day offline JWT for mobile offline verification
  ): AuthResponseEnvelope {
    const user = authResult.user;
    const sessionToken = authResult.token ?? authResult.session?.token ?? '';

    // Require sessionId and issuedAt from service (mapper is pure transformation only)
    if (!sessionId) {
      throw new BadRequestException(
        'AuthMapper.toAuthResponseEnvelope: sessionId is required',
      );
    }
    if (!issuedAt) {
      throw new BadRequestException(
        'AuthMapper.toAuthResponseEnvelope: issuedAt is required',
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

    const { roles } = permissionContext;

    return {
      requestId,
      traceId,
      apiVersion: '2026-03',
      timestamp: issuedAt,
      user: this.toPublicUserDto(user),
      session: {
        sessionId,
        sessionToken,
        expiresAt: expiresAtStr,
        refreshToken,
        refreshExpiresAt: refreshExpiresAtStr,
        defaultStore: defaultStore ?? null,
        ...(jwtToken ? { jwtToken } : {}),
      },
      access: {
        isSuperAdmin: permissionContext.isSuperAdmin ?? false,
        activeStoreId: permissionContext.activeStoreId ?? null,
        roles: roles.map((r) => ({
          roleCode: r.roleCode,
          storeId: r.storeId ?? null,
          storeName: r.storeName ?? null,
          isPrimary: r.isPrimary,
          assignedAt: r.assignedAt,
          expiresAt: r.expiresAt ?? null,
        })),
      },
      ...(offlineToken ? { offlineToken } : {}),
    };
  }

  static toPublicUserDto(
    user: AuthResult['user'] | null | undefined,
  ): PublicUserDto {
    if (!user)
      throw new BadRequestException(
        'AuthMapper.toPublicUserDto: user is required',
      );

    return {
      id: String(Number(user.id || 0)),
      guuid: user.guuid || '',
      name: user.name || '',
      email: user.email || null,
      emailVerified: !!user.emailVerified,
      phoneNumber: user.phoneNumber || null,
      phoneNumberVerified: !!user.phoneNumberVerified,
      image: user.image || null,
    };
  }

  /**
   * Transform database role rows to UserRoleEntry objects
   * Handles role code resolution, store ID overrides, and primary role detection
   */
  static mapToRoleEntries(
    rows: Array<{
      roleCode?: string;
      code?: string;
      storeFk?: number | null;
      storeName?: string | null;
    }>,
    storeIdOverride?: number,
    assignedAt?: string, // Business logic: timestamp must be generated in service
  ): UserRoleEntry[] {
    if (!assignedAt) {
      throw new BadRequestException(
        'AuthMapper.mapToRoleEntries: assignedAt is required',
      );
    }

    return rows.map((r) => {
      const roleCode = (r.roleCode ?? r.code) as UserRoleEntry['roleCode'];
      return {
        roleCode,
        storeId: storeIdOverride ?? r.storeFk ?? null,
        storeName: r.storeName ?? null,
        // Primary role: STORE_OWNER (user owns the store) or global role with no store scope
        isPrimary:
          roleCode === 'STORE_OWNER' ||
          (r.storeFk === null && roleCode === 'SUPER_ADMIN'),
        assignedAt, // Transformation only - value provided by service
        expiresAt: null,
      };
    });
  }
}
