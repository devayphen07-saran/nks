import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthMapper } from '../mappers/auth-mapper';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  ProfileCompleteDto,
} from '../dto';
import { ApiResponse } from '../../../common/utils/api-response';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { RBACGuard } from '../../../common/guards/rbac.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../../../common/guards/auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RoutesService } from '../../routes/routes.service';
import { AdminRoutesPermissionsResponseDto } from '../../routes/dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly routesService: RoutesService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email + password' })
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return ApiResponse.ok(result, 'Login successful');
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register new user. First user auto-assigned SUPER_ADMIN.',
  })
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return ApiResponse.ok(result, 'Registration successful');
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh session token. Returns new access token.',
  })
  async refreshToken(@Body() dto: RefreshTokenDto) {
    const result = await this.authService.refreshSession(dto.refreshToken);
    return ApiResponse.ok(result, 'Token refreshed successfully');
  }

  @Post('profile/complete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary:
      'Unified endpoint for all profile updates (name, email, phone, password)',
    description: `
      Update authenticated user profile with any combination of:
      - name: Update user name
      - email + password: Add/update email (requires password)
      - phoneNumber: Add/update phone (triggers OTP verification)
      - password: Set/update password (requires email to be set)
    `,
  })
  async profileComplete(
    @CurrentUser('userId') userId: number,
    @Body() dto: ProfileCompleteDto,
  ) {
    const result = await this.authService.profileComplete(userId, dto);
    return ApiResponse.ok(result, result.message);
  }

  @Post('setup-personal')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Set up personal account (assigns CUSTOMER role)' })
  async setupPersonal(@CurrentUser('userId') userId: number) {
    const result = await this.authService.setupPersonal(userId);
    return ApiResponse.ok(result, 'Personal account set up');
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Invalidate the current session token' })
  async logout(@Req() req: Request) {
    const token = (req.headers.authorization ?? '')
      .replace('Bearer ', '')
      .trim();
    await this.authService.logout(token);
    return ApiResponse.ok(null, 'Logged out');
  }

  @Get('get-session')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Return the current session and refreshed permissions',
  })
  async getSession(
    @Req() req: AuthenticatedRequest,
    @CurrentUser('userId') userId: number,
  ) {
    const token = (req.headers.authorization ?? '').replace('Bearer ', '');
    const expiresAt = (req.session.expiresAt as Date | string) ?? undefined;

    const permissionContext = await this.authService.getUserPermissions(userId);
    const requestId = crypto.randomUUID();
    const traceId = crypto.randomUUID();

    const result = AuthMapper.toAuthResponseDto(
      {
        user: req.user,
        token,
        session: { expiresAt, sessionId: crypto.randomUUID() },
      },
      permissionContext,
      requestId,
      traceId,
    );
    return ApiResponse.ok(result, 'Session valid');
  }

  @Get('admin/routes-permissions')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RBACGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Get admin portal routes and permissions',
    description:
      'Returns all system routes and permissions for SUPER_ADMIN users. Used to render admin portal navigation and permission management interfaces.',
  })
  async getAdminRoutesPermissions(): Promise<
    ReturnType<typeof ApiResponse.ok>
  > {
    const data = await this.routesService.getAdminRoutesAndPermissions();
    return ApiResponse.ok(
      data as AdminRoutesPermissionsResponseDto,
      'Admin routes and permissions retrieved',
    );
  }
}
