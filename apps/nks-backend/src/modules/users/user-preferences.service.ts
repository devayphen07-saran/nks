import { Injectable, ForbiddenException } from '@nestjs/common';
import { eq, and, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../core/database/inject-db.decorator';
import * as schema from '../../core/database/schema';
import { UserPreferencesValidator } from './validators';
import { AuthorizationValidator } from '../../common/validators/authorization.validator';
import { UserPreferencesRepository } from './repositories/user-preferences.repository';

@Injectable()
export class UserPreferencesService {
  constructor(
    @InjectDb() private readonly db: NodePgDatabase<typeof schema>,
    private readonly userPreferencesRepository: UserPreferencesRepository,
  ) {}

  /**
   * Get or create user preferences.
   * Creates with defaults if doesn't exist.
   */
  async getOrCreate(userId: number, createdBy: number) {
    const existing = await this.get(userId);
    if (existing) return existing;

    return this.userPreferencesRepository.create({
      userFk: userId,
      theme: 'light',
      notificationsEnabled: true,
      createdBy,
    });
  }

  /**
   * Get user preferences.
   */
  async get(userId: number) {
    return this.userPreferencesRepository.findByUserId(userId);
  }

  /**
   * Update user preferences.
   * SECURITY: Validates that requesting user has permission to modify target user's preferences
   */
  async update(
    userId: number,
    data: Partial<schema.UserPreferences>,
    modifiedBy: number,
    isSuperAdmin: boolean = false,
  ) {
    // Authorization check: User can only modify their own preferences unless SUPER_ADMIN
    AuthorizationValidator.validateOwnResource(userId, modifiedBy, isSuperAdmin);

    return this.userPreferencesRepository.update(userId, {
      ...data,
      modifiedBy,
    });
  }

  /**
   * Set theme preference.
   * SECURITY: Validates theme is valid and user has permission
   */
  async setTheme(
    userId: number,
    theme: string,
    modifiedBy: number,
    isSuperAdmin: boolean = false,
  ) {
    // Validate theme value using UserPreferencesValidator
    UserPreferencesValidator.validateTheme(theme);

    return this.update(userId, { theme }, modifiedBy, isSuperAdmin);
  }

  /**
   * Set timezone preference.
   * SECURITY: Validates timezone is valid and user has permission
   */
  async setTimezone(
    userId: number,
    timezone: string,
    modifiedBy: number,
    isSuperAdmin: boolean = false,
  ) {
    // Validate timezone value using UserPreferencesValidator
    UserPreferencesValidator.validateTimezone(timezone);

    return this.update(userId, { timezone }, modifiedBy, isSuperAdmin);
  }

  /**
   * Soft delete user preferences.
   * SECURITY: Validates user has permission to delete target user's preferences
   */
  async delete(
    userId: number,
    deletedBy: number,
    isSuperAdmin: boolean = false,
  ) {
    // Authorization check: User can only delete their own preferences unless SUPER_ADMIN
    if (userId !== deletedBy && !isSuperAdmin) {
      throw new ForbiddenException('You can only delete your own preferences');
    }

    return this.userPreferencesRepository.softDelete(userId, deletedBy);
  }
}
