import type { UserSession } from '../../../../core/database/schema/auth/user-session';
import type { User as DbUser } from '../../../../core/database/schema/auth/users/users.table';
import type { PublicSession } from '../services/session/session-query.service';
import type { SessionInfoDto } from '../dto';
import type { SessionUser, SessionUserRole } from '../interfaces/session-user.interface';
import { SystemRoleCodes } from '../../../../common/constants/system-role-codes.constant';

/** BetterAuth extends the base User with custom plugin columns at runtime. */
type BetterAuthUser = DbUser & {
  guuid?: string;
  phoneNumber?: string | null;
  phoneNumberVerified?: boolean;
  kycLevel?: number;
  languagePreference?: string;
  whatsappOptedIn?: boolean;
  isBlocked?: boolean;
  blockedReason?: string | null;
  loginCount?: number;
};

type RoleRow = {
  roleId: number;
  roleCode: string;
  storeFk: number | null;
  storeName: string | null;
  isPrimary: boolean;
  assignedAt: Date;
  expiresAt: Date | null;
};

/**
 * Session Mapper
 *
 * Transforms internal UserSession entities to public-facing DTOs
 * Hides sensitive data (refresh tokens, session tokens, etc.)
 */
export class SessionMapper {
  static buildSessionUser(
    dbUser: DbUser,
    roleRows: RoleRow[],
    activeStoreFk: number | null,
  ): SessionUser {
    const u = dbUser as BetterAuthUser;

    const roles: SessionUserRole[] = roleRows.map((r) => ({
      roleId: r.roleId,
      roleCode: r.roleCode,
      storeId: r.storeFk ?? null,
      storeName: r.storeName ?? null,
      isPrimary: r.isPrimary,
      assignedAt: r.assignedAt.toISOString(),
      expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    }));

    const primaryRole =
      roleRows.find((r) => r.isPrimary)?.roleCode ?? roleRows[0]?.roleCode ?? null;
    const isSuperAdmin = roles.some((r) => r.roleCode === SystemRoleCodes.SUPER_ADMIN);

    return {
      id: String(u.id),
      userId: Number(u.id),
      guuid: u.guuid ?? '',
      iamUserId: u.iamUserId ?? '',
      firstName: u.firstName ?? null,
      lastName: u.lastName ?? null,
      email: u.email ?? '',
      emailVerified: u.emailVerified ?? false,
      image: u.image ?? null,
      phoneNumber: u.phoneNumber ?? null,
      phoneNumberVerified: u.phoneNumberVerified ?? false,
      kycLevel: u.kycLevel ?? 0,
      languagePreference: u.languagePreference ?? 'en',
      whatsappOptedIn: u.whatsappOptedIn ?? true,
      isBlocked: u.isBlocked ?? false,
      blockedReason: u.blockedReason ?? null,
      loginCount: u.loginCount ?? 0,
      lastLoginAt: u.lastLoginAt ?? null,
      roles,
      primaryRole,
      isSuperAdmin,
      activeStoreId: activeStoreFk,
    };
  }

  static buildPublicSession(session: UserSession): PublicSession {
    return {
      guuid: session.guuid,
      deviceId: session.deviceId ?? undefined,
      deviceName: session.deviceName ?? undefined,
      deviceType: session.deviceType ?? undefined,
      platform: session.platform ?? undefined,
      appVersion: session.appVersion ?? undefined,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    };
  }

  static buildSessionInfoDto(session: PublicSession): SessionInfoDto {
    return {
      guuid: session.guuid,
      deviceId: session.deviceId ?? null,
      deviceName: session.deviceName ?? null,
      deviceType: session.deviceType ?? null,
      platform: session.platform ?? null,
      appVersion: session.appVersion ?? null,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  static buildSessionInfoDtoFromRow(userSession: UserSession): SessionInfoDto {
    return SessionMapper.buildSessionInfoDto(SessionMapper.buildPublicSession(userSession));
  }
}
