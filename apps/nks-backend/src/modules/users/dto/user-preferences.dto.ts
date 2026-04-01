import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Theme options for user preference
 */
export enum ThemeEnum {
  LIGHT = 'light',
  DARK = 'dark',
  AUTO = 'auto',
}

export const UpdateUserPreferencesSchema = z.object({
  theme: z
    .enum([ThemeEnum.LIGHT, ThemeEnum.DARK, ThemeEnum.AUTO])
    .optional()
    .describe('User theme preference'),
  timezone: z.string().optional().describe('User timezone (IANA identifier)'),
  notificationsEnabled: z
    .boolean()
    .optional()
    .describe('Enable/disable notifications'),
});

/**
 * Update User Preferences DTO
 * Used for PATCH /users/me/preferences to update multiple settings at once
 */
export class UpdateUserPreferencesDto extends createZodDto(
  UpdateUserPreferencesSchema,
) {}

export const UpdateThemeSchema = z.object({
  theme: z
    .enum([ThemeEnum.LIGHT, ThemeEnum.DARK, ThemeEnum.AUTO])
    .describe('Theme preference (light, dark, or auto)'),
});

/**
 * Update Theme DTO
 * Used for PATCH /users/me/preferences/theme
 */
export class UpdateThemeDto extends createZodDto(UpdateThemeSchema) {}

export const UpdateTimezoneSchema = z.object({
  timezone: z
    .string()
    .describe('IANA timezone identifier (e.g., Asia/Kolkata, UTC)'),
});

/**
 * Update Timezone DTO
 * Used for PATCH /users/me/preferences/timezone
 */
export class UpdateTimezoneDto extends createZodDto(UpdateTimezoneSchema) {}

/**
 * User Preferences Response DTO
 * Returned from GET /users/me/preferences
 */
export class UserPreferencesResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 123 })
  userFk: number;

  @ApiProperty({ enum: ThemeEnum, example: 'light' })
  theme: string;

  @ApiProperty({ example: 'Asia/Kolkata', nullable: true })
  timezone: string | null;

  @ApiProperty({ example: true })
  notificationsEnabled: boolean;

  @ApiProperty({ example: false })
  twoFactorEnabled: boolean;

  @ApiProperty({ example: '2026-03-28T10:30:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-03-28T10:30:00Z', nullable: true })
  updatedAt: Date | null;

  @ApiProperty({ example: null, nullable: true })
  deletedAt: Date | null;
}
