import { Injectable } from '@nestjs/common';
import type { UserPreferences } from '../../../core/database/schema/user-preferences';
import { UserPreferencesValidator } from './validators';
import { AuthorizationValidator } from '../../../common/validators/authorization.validator';
import { UserPreferencesRepository } from './repositories/user-preferences.repository';

@Injectable()
export class UserPreferencesService {
  constructor(
    private readonly userPreferencesRepository: UserPreferencesRepository,
  ) {}

  async getOrCreate(userId: number, createdBy: number): Promise<UserPreferences | null> {
    const existing = await this.get(userId);
    if (existing) return existing;

    return this.userPreferencesRepository.create({
      userFk: userId,
      theme: 'light',
      notificationsEnabled: true,
      createdBy,
    });
  }

  async get(userId: number): Promise<UserPreferences | null> {
    return this.userPreferencesRepository.findByUserId(userId);
  }

  async update(
    userId: number,
    data: Partial<UserPreferences>,
    modifiedBy: number,
  ) {
    AuthorizationValidator.validateOwnResource(userId, modifiedBy);

    return this.userPreferencesRepository.update(userId, {
      ...data,
      modifiedBy,
    });
  }

  async setTheme(userId: number, theme: string, modifiedBy: number) {
    UserPreferencesValidator.validateTheme(theme);
    return this.update(userId, { theme }, modifiedBy);
  }

  async setTimezone(userId: number, timezone: string, modifiedBy: number) {
    UserPreferencesValidator.validateTimezone(timezone);
    return this.update(userId, { timezone }, modifiedBy);
  }

  async delete(userId: number, deletedBy: number) {
    AuthorizationValidator.validateOwnResource(userId, deletedBy);
    return this.userPreferencesRepository.softDelete(userId, deletedBy);
  }
}
