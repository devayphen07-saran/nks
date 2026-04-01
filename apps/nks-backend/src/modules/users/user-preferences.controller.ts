import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse as SwaggerResponse,
} from '@nestjs/swagger';
import { UserPreferencesService } from '../../features/user-preferences/user-preferences.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponse } from '../../common/utils/api-response';
import {
  UpdateUserPreferencesDto,
  UpdateThemeDto,
  UpdateTimezoneDto,
  UserPreferencesResponseDto,
} from './dto';

@ApiTags('User Preferences')
@ApiBearerAuth()
@Controller('users')
export class UserPreferencesController {
  constructor(
    private readonly userPreferencesService: UserPreferencesService,
  ) {}

  /**
   * GET /api/users/me/preferences
   * Get current user's preferences
   */
  @Get('me/preferences')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get current user preferences',
    description:
      'Retrieve all user preferences including theme, language, timezone, and verification status',
  })
  @SwaggerResponse({
    status: 200,
    description: 'User preferences retrieved successfully',
    type: UserPreferencesResponseDto,
  })
  @SwaggerResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getPreferences(@CurrentUser('userId') userId: number) {
    const preferences = await this.userPreferencesService.get(userId);

    if (!preferences) {
      // If preferences don't exist, create with defaults
      const created = await this.userPreferencesService.getOrCreate(
        userId,
        userId,
      );
      return ApiResponse.ok(created, 'User preferences retrieved successfully');
    }

    return ApiResponse.ok(
      preferences,
      'User preferences retrieved successfully',
    );
  }

  /**
   * PATCH /api/users/me/preferences
   * Update multiple preferences at once
   */
  @Patch('me/preferences')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update user preferences',
    description:
      'Update one or more user preferences (theme, language, timezone, notification settings)',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Preferences updated successfully',
    type: UserPreferencesResponseDto,
  })
  @SwaggerResponse({
    status: 400,
    description: 'Invalid preference values',
  })
  @SwaggerResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async updatePreferences(
    @CurrentUser('userId') userId: number,
    @Body() dto: UpdateUserPreferencesDto,
  ) {
    const updated = await this.userPreferencesService.update(
      userId,
      dto,
      userId,
    );

    return ApiResponse.ok(updated, 'Preferences updated successfully');
  }

  /**
   * PATCH /api/users/me/preferences/theme
   * Update theme only (light/dark)
   */
  @Patch('me/preferences/theme')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update theme preference',
    description: 'Update user theme (light or dark)',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Theme updated successfully',
    schema: {
      example: { theme: 'dark' },
    },
  })
  @SwaggerResponse({
    status: 400,
    description: 'Invalid theme value',
  })
  @SwaggerResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async updateTheme(
    @CurrentUser('userId') userId: number,
    @Body() dto: UpdateThemeDto,
  ) {
    const updated = await this.userPreferencesService.setTheme(
      userId,
      dto.theme,
      userId,
    );

    return ApiResponse.ok(
      { theme: updated.theme },
      'Theme updated successfully',
    );
  }

  /**
   * PATCH /api/users/me/preferences/timezone
   * Update timezone preference
   */
  @Patch('me/preferences/timezone')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update timezone preference',
    description: 'Update user timezone (e.g., Asia/Kolkata, America/New_York)',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Timezone updated successfully',
    schema: {
      example: { timezone: 'Asia/Kolkata' },
    },
  })
  @SwaggerResponse({
    status: 400,
    description: 'Invalid timezone',
  })
  @SwaggerResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async updateTimezone(
    @CurrentUser('userId') userId: number,
    @Body() dto: UpdateTimezoneDto,
  ) {
    const updated = await this.userPreferencesService.setTimezone(
      userId,
      dto.timezone,
      userId,
    );

    return ApiResponse.ok(
      { timezone: updated.timezone },
      'Timezone updated successfully',
    );
  }
}
