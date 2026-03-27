import { BadRequestException } from '@nestjs/common';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { PublicUserDto } from '../../users/dto/public-user.dto';

interface AuthResult {
  user: {
    id: string | number;
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
    | 'SUPER_ADMIN'
    | 'STORE_OWNER'
    | 'STAFF'
    | 'STORE_MANAGER'
    | 'CASHIER'
    | 'DELIVERY'
    | 'CUSTOMER';
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
  featureFlags?: Record<string, boolean>;
};

export class AuthMapper {
  static toAuthResponseDto(
    authResult: AuthResult,
    permissionContext: PermissionContext,
    requestId: string,
    traceId: string,
  ): AuthResponseDto {
    const user = authResult.user;
    const token = authResult.token ?? authResult.session?.token ?? '';
    const sessionId = authResult.session?.sessionId ?? crypto.randomUUID();
    const issuedAt = new Date().toISOString();
    const expiresAt =
      authResult.session?.expiresAt instanceof Date
        ? authResult.session.expiresAt.toISOString()
        : (authResult.session?.expiresAt ??
          new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString());
    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const absoluteExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const {
      isSuperAdmin,
      roles,
      activeStoreId,
      method = 'password',
      mfaVerified = false,
      mfaRequired = false,
      trustLevel = 'standard',
      stepUpRequired = false,
      featureFlags = {},
    } = permissionContext;

    // Determine initial route based on user role
    const initialRoute = isSuperAdmin ? '/admin/dashboard' : '/select-store';

    return {
      requestId,
      traceId,
      apiVersion: '2026-03',
      status: 'success',
      timestamp: issuedAt,
      data: {
        user: this.toPublicUserDto(user),
        session: {
          sessionId,
          tokenType: 'Bearer',
          accessToken: token,
          issuedAt,
          expiresAt,
          refreshToken: token,
          refreshExpiresAt,
          mechanism: method,
          absoluteExpiry,
        },
        authContext: {
          method,
          mfaVerified,
          mfaRequired,
          trustLevel,
          stepUpRequired,
        },
        access: {
          isSuperAdmin,
          activeStoreId: activeStoreId ?? null,
          roles,
          initialRoute,
        },
        flags: featureFlags,
      },
    } as unknown as AuthResponseDto;
  }

  static toPublicUserDto(
    user: AuthResult['user'] | null | undefined,
  ): PublicUserDto {
    if (!user)
      throw new BadRequestException(
        'AuthMapper.toPublicUserDto: user is required',
      );

    const lastLoginAt = user.lastLoginAt
      ? (typeof user.lastLoginAt === 'string' ? user.lastLoginAt : user.lastLoginAt.toISOString())
      : null;

    return {
      id: Number(user.id || 0),
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
