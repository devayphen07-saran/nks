import { BadRequestException } from '@nestjs/common';
import { ErrorCode, ErrorMessages } from '../../../common/constants/error-codes.constants';

/**
 * User Preferences Validator
 * Validates user preference settings (theme, timezone, etc.)
 */
export class UserPreferencesValidator {
  private static readonly VALID_THEMES = ['light', 'dark', 'auto'];

  // IANA timezone database - common timezones
  private static readonly VALID_TIMEZONES = new Set([
    'UTC',
    'Asia/Kolkata',
    'Asia/Bangalore',
    'Asia/Mumbai',
    'Asia/Delhi',
    'Asia/Chennai',
    'Asia/Hyderabad',
    'Asia/Calcutta',
    'Asia/Darjeeling',
    'Asia/Dhaka',
    'Asia/Kathmandu',
    'Asia/Karachi',
    'Asia/Singapore',
    'Asia/Hong_Kong',
    'Asia/Shanghai',
    'Asia/Tokyo',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'America/New_York',
    'America/Los_Angeles',
    'America/Chicago',
    'America/Denver',
    'Australia/Sydney',
    'Australia/Melbourne',
    'Pacific/Auckland',
  ]);

  /**
   * Validate theme and throw BadRequestException if invalid
   */
  static validateTheme(theme: string): void {
    if (!theme || !this.VALID_THEMES.includes(theme.toLowerCase())) {
      throw new BadRequestException({
        errorCode: ErrorCode.USR_INVALID_THEME,
        message: ErrorMessages[ErrorCode.USR_INVALID_THEME],
      });
    }
  }

  /**
   * Validate timezone and throw BadRequestException if invalid
   */
  static validateTimezone(timezone: string): void {
    if (!timezone || !this.VALID_TIMEZONES.has(timezone)) {
      throw new BadRequestException({
        errorCode: ErrorCode.USR_INVALID_TIMEZONE,
        message: ErrorMessages[ErrorCode.USR_INVALID_TIMEZONE],
      });
    }
  }

  /**
   * Check if theme is valid without throwing
   */
  static isValidTheme(theme: string): boolean {
    return !!(theme && this.VALID_THEMES.includes(theme.toLowerCase()));
  }

  /**
   * Check if timezone is valid without throwing
   */
  static isValidTimezone(timezone: string): boolean {
    return !!(timezone && this.VALID_TIMEZONES.has(timezone));
  }

  /**
   * Get valid themes list
   */
  static getValidThemes(): string[] {
    return [...this.VALID_THEMES];
  }

  /**
   * Get valid timezones list
   */
  static getValidTimezones(): string[] {
    return Array.from(this.VALID_TIMEZONES).sort();
  }
}
