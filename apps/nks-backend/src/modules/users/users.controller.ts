import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse as SwaggerResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto, UserResponseDto } from './dto';
import { UserMapper } from './mapper';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponse } from '../../common/utils/api-response';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /api/users/me
   */
  @Get('me')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get current user profile' })
  @SwaggerResponse({
    type: UserResponseDto,
    status: 200,
    description: 'Profile retrieved successfully',
  })
  async getProfile(@CurrentUser('userId') userId: number) {
    const profile = await this.usersService.getProfile(userId);
    return ApiResponse.ok(
      UserMapper.toResponseDto(profile),
      'Profile retrieved successfully',
    );
  }

  /**
   * PATCH /api/users/me
   */
  @Patch('me')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Update current user profile' })
  @SwaggerResponse({
    type: UserResponseDto,
    status: 200,
    description: 'Profile updated successfully',
  })
  async updateProfile(
    @CurrentUser('userId') userId: number,
    @Body() dto: UpdateProfileDto,
  ) {
    const updated = await this.usersService.updateProfile(userId, dto);
    return ApiResponse.ok(
      UserMapper.toResponseDto(updated),
      'Profile updated successfully',
    );
  }
}
