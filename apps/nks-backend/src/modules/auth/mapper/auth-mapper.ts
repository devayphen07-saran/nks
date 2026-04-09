import { BadRequestException } from '@nestjs/common';
import type { AuthResponseEnvelope } from '../dto/auth-response.dto';
import { STORE_CONSTANTS } from '../../../common/constants/app-constants';

export type PublicUserDto = {
  id: string;
  guuid: string;
  name: string;
  email: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
  image: string | null;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
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
    lastLoginAt?: Date | string | null;
    lastLoginIp?: string | null;
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
  ): AuthResponseEnvelope {
    const user = authResult.user;
    const sessionToken = authResult.token ?? authResult.session?.token ?? '';
    const sessionId = authResult.session?.sessionId ?? crypto.randomUUID();
    const issuedAt = new Date().toISOString();

    const jwtToken = tokenPair?.jwtToken;
    const refreshToken = tokenPair?.refreshToken ?? sessionToken;
    const jwtExpiresAt = tokenPair?.jwtExpiresAt;
    const refreshTokenExpiresAt = tokenPair?.refreshTokenExpiresAt;

    const expiresAt =
      jwtExpiresAt instanceof Date
        ? jwtExpiresAt.toISOString()
        : authResult.session?.expiresAt instanceof Date
          ? authResult.session.expiresAt.toISOString()
          : new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const refreshExpiresAt =
      refreshTokenExpiresAt instanceof Date
        ? refreshTokenExpiresAt.toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const {
      method = 'password',
      mfaVerified = false,
      mfaRequired = false,
      trustLevel = 'standard',
      stepUpRequired = false,
      roles,
    } = permissionContext;

    return {
      requestId,
      traceId,
      apiVersion: '2026-03',
      timestamp: issuedAt,
      data: {
        user: this.toPublicUserDto(user),
        session: {
          sessionId,
          tokenType: 'Bearer',
          sessionToken,
          issuedAt,
          expiresAt,
          refreshToken,
          refreshExpiresAt,
          mechanism: method,
          absoluteExpiry: refreshExpiresAt,
          defaultStore: defaultStore ?? null,
          ...(jwtToken ? { jwtToken } : {}),
        },
        authContext: {
          method,
          mfaVerified,
          mfaRequired,
          trustLevel,
          stepUpRequired,
        },
        access: {
          isSuperAdmin: permissionContext.isSuperAdmin ?? false,
          activeStoreId: permissionContext.activeStoreId ?? null,
          roles: roles.map((r) => ({
            roleCode: r.roleCode,
            storeId: r.storeId ?? null,
            storeName: r.storeName ?? null,
            isPrimary: r.isPrimary,
            assignedAt: r.assignedAt ?? new Date().toISOString(),
            expiresAt: r.expiresAt ?? null,
          })),
        },
      },
    };
  }

  static toPublicUserDto(
    user: AuthResult['user'] | null | undefined,
  ): PublicUserDto {
    if (!user)
      throw new BadRequestException(
        'AuthMapper.toPublicUserDto: user is required',
      );

    const lastLoginAt = user.lastLoginAt
      ? user.lastLoginAt instanceof Date
        ? user.lastLoginAt.toISOString()
        : String(user.lastLoginAt)
      : null;

    return {
      id: String(Number(user.id || 0)),
      guuid: user.guuid || '',
      name: user.name || '',
      email: user.email || null,
      emailVerified: !!user.emailVerified,
      phoneNumber: user.phoneNumber || null,
      phoneNumberVerified: !!user.phoneNumberVerified,
      image: user.image || null,
      lastLoginAt,
      lastLoginIp: user.lastLoginIp || null,
    };
  }
}
