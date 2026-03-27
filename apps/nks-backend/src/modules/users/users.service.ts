import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { UpdateProfileDto } from './dto';
import * as schema from '../../core/database/schema';

type User = typeof schema.users.$inferSelect;

@Injectable()
export class UsersService {
  constructor(private readonly usersRepo: UsersRepository) {}

  /**
   * Get user profile by ID.
   * Returns raw internal User. The Controller is responsible for stripping sensitive info.
   */
  async getProfile(userId: number): Promise<User> {
    const user = await this.usersRepo.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Update the authenticated user's profile.
   * Only allows safe, user-editable fields.
   */
  async updateProfile(userId: number, dto: UpdateProfileDto): Promise<User> {
    const user = await this.usersRepo.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.usersRepo.update(userId, {
      name: dto.name,
      languagePreference: dto.languagePreference,
      whatsappOptedIn: dto.whatsappOptedIn,
      image: dto.image,
    });

    return updated;
  }
}
