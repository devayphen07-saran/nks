import { Injectable, ForbiddenException } from '@nestjs/common';
import { ErrorCodes, ErrorMessages } from '../../core/constants/error-codes';
import { UserPreferencesValidator } from './validators';
import { AuthorizationValidator } from '../../common/validators/authorization.validator';
import { UserPreferencesRepository } from './repositories/user-preferences.repository';
import { UserPreferences } from '../../core/database/schema';

@Injectable()
export class UserPreferencesService {
  constructor(
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
    data: Partial<UserPreferences>,
    modifiedBy: number,
    isSuperAdmin: boolean = false,
  ) {
    // Authorization check: User can only modify their own preferences unless SUPER_ADMIN
    AuthorizationValidator.validateOwnResource(
      userId,
      modifiedBy,
      isSuperAdmin,
    );

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
      throw new ForbiddenException({
        errorCode: ErrorCodes.GEN_FORBIDDEN,
        message: ErrorMessages[ErrorCodes.GEN_FORBIDDEN],
      });
    }

    return this.userPreferencesRepository.softDelete(userId, deletedBy);
  }
}
