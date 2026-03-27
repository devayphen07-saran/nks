import { UserResponseDto } from '../dto';
import type { User } from '../../../core/database/schema';

export class UserMapper {
  static toResponseDto(entity: User): UserResponseDto {
    return {
      id: entity.id,
      guuid: entity.guuid,
      name: entity.name,
      email: entity.email,
      emailVerified: entity.emailVerified,
      image: entity.image,
      phoneNumber: entity.phoneNumber,
      phoneNumberVerified: entity.phoneNumberVerified,
      kycLevel: String(entity.kycLevel),
      languagePreference: entity.languagePreference,
      whatsappOptedIn: entity.whatsappOptedIn,
      loginCount: entity.loginCount,
      isBlocked: entity.isBlocked,
      createdAt: entity.createdAt?.toISOString() ?? null,
      updatedAt: entity.updatedAt?.toISOString() ?? null,
    };
  }
}
