import type { UserResponseDto, UserRow } from '../dto';

export class UserMapper {
  static toDto(row: UserRow): UserResponseDto {
    return {
      guuid: row.guuid,
      name: row.name,
      email: row.email,
      emailVerified: row.emailVerified,
      phoneNumber: row.phoneNumber,
      phoneNumberVerified: row.phoneNumberVerified,
      image: row.image,
      isBlocked: row.isBlocked,
      blockedReason: row.blockedReason,
      primaryLoginMethod: row.primaryLoginMethod,
      loginCount: row.loginCount,
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      profileCompleted: row.profileCompleted,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      primaryRole: row.primaryRole,
    };
  }
}
