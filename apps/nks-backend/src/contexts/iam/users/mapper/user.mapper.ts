import type { UserResponseDto, UserRow } from '../dto';

export class UserMapper {
  static buildUserDto(userRow: UserRow): UserResponseDto {
    return {
      guuid: userRow.guuid,
      iamUserId: userRow.iamUserId,
      firstName: userRow.firstName,
      lastName: userRow.lastName,
      email: userRow.email,
      emailVerified: userRow.emailVerified,
      phoneNumber: userRow.phoneNumber,
      phoneNumberVerified: userRow.phoneNumberVerified,
      image: userRow.image,
      isBlocked: userRow.isBlocked,
      blockedReason: userRow.blockedReason,
      createdAt: userRow.createdAt.toISOString(),
      primaryRole: userRow.primaryRole,
    };
  }
}
