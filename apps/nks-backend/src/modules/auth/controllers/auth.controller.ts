import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Req,
  Res,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../../common/guards/auth.guard';
import type { Request, Response } from 'express';
import { AuthService } from '../services/session/auth.service';
import { PasswordAuthService } from '../services/flows/password-auth.service';
import { TokenLifecycleService } from '../services/token/token-lifecycle.service';
import { OnboardingService } from '../services/flows/onboarding.service';
import { PermissionsService, type PermissionsSnapshot } from '../services/permissions/permissions.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthControllerHelpers } from '../../../common/utils/auth-helpers';
import { extractCookieValue } from '../../../common/utils/cookie.utils';
import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  AuthResponseEnvelope,
  MeResponseDto,
} from '../dto';
import { OnboardingCompleteDto, OnboardingCompleteResponseDto } from '../dto/onboarding.dto';
import { SessionListDto } from '../dto/permissions.dto';
import { ApiResponse } from '../../../common/utils/api-response';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { RateLimitingGuard } from '../../../common/guards/rate-limiting.guard';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RateLimit } from '../../../common/decorators/rate-limit.decorator';
import { JWTConfigService } from '../../../config/jwt.config';
import type { SessionUser } from '../interfaces/session-user.interface';

@ApiTags('Auth')
@Controller('auth')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly passwordAuthService: PasswordAuthService,
    private readonly tokenLifecycleService: TokenLifecycleService,
    private readonly jwtConfigService: JWTConfigService,
    private readonly onboardingService: OnboardingService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitingGuard)
  @RateLimit(10)
  @ApiOperation({ summary: 'Login with email + password' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<AuthResponseEnvelope>> {
    const deviceInfo = AuthControllerHelpers.extractDeviceInfo(req);
    const result = await this.passwordAuthService.login(dto, deviceInfo);
    AuthControllerHelpers.applySessionCookie(res, result);
    return ApiResponse.ok(result, 'Login successful');
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register new user. First user auto-assigned SUPER_ADMIN.',
  })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<AuthResponseEnvelope>> {
    const deviceInfo = AuthControllerHelpers.extractDeviceInfo(req);
    const result = await this.passwordAuthService.register(dto, deviceInfo);
    AuthControllerHelpers.applySessionCookie(res, result);
    return ApiResponse.ok(result, 'Registration successful');
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitingGuard)
  @RateLimit(30)
  @ApiOperation({
    summary: 'Refresh access token using refresh token',
    description:
      'Rotates both access and refresh tokens. Works for web (cookie) and mobile (body). Implements refresh token rotation + theft detection (if token reused, all sessions are terminated).',
  })
  async refreshToken(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<
    ApiResponse<{
      sessionId: string;
      sessionToken: string;
      jwtToken: string;
      expiresAt: string;
      refreshToken: string;
      refreshExpiresAt: string;
      defaultStore: { guuid: string } | null;
      offlineToken: string;
    }>
  > {
    const cookieToken = this.parseSessionCookie(req);
    // Prefer body token (mobile sends refresh token in body).
    // Fall back to cookie only for web clients that don't send a body.
    const providedRefreshToken = dto.refreshToken ?? cookieToken;

    if (!providedRefreshToken) {
      throw new UnauthorizedException(
        'No refresh token provided. Send via body or cookie.',
      );
    }

    const deviceId =
      (req.headers as Record<string, string | undefined>)['x-device-id'] ??
      null;

    const result = await this.tokenLifecycleService.refreshAccessToken(
      providedRefreshToken,
      deviceId,
    );

    AuthControllerHelpers.setSessionCookie(res, result.sessionToken);
    return ApiResponse.ok(result, 'Token refreshed successfully');
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get current authenticated user',
    description:
      'Validates the session and returns user profile + roles. Web calls this on mount to verify the httpOnly cookie is still valid.',
  })
  getMe(@Req() req: AuthenticatedRequest): ApiResponse<MeResponseDto> {
    const u = req.user;
    const me: MeResponseDto = {
      id: u.id,
      guuid: u.guuid,
      name: u.name,
      email: u.email,
      emailVerified: u.emailVerified,
      phoneNumber: u.phoneNumber,
      phoneNumberVerified: u.phoneNumberVerified,
      image: u.image,
    };
    return ApiResponse.ok(me, 'Authenticated');
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Invalidate the current session token' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<null>> {
    const token = this.parseSessionCookie(req);
    if (token) {
      try {
        await this.authService.logout(token);
      } catch (err) {
        this.logger.warn(
          `Failed to revoke session during logout: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    res.clearCookie('nks_session', {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env['NODE_ENV'] === 'production',
      path: '/',
    });
    return ApiResponse.ok(null, 'Logged out');
  }

  @Get('mobile-jwks')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get RS256 JWKS for mobile offline verification',
    description:
      'Returns the RS256 public key in JWKS format for verifying access and offline JWTs on device.',
  })
  getMobileJwks(@Res({ passthrough: true }) res: Response): Record<string, unknown> {
    const publicKeyJwk = this.jwtConfigService.getPublicKeyAsJwk();
    res.set('Cache-Control', 'public, max-age=3600');
    res.set('Content-Type', 'application/jwk-set+json');
    return {
      keys: [
        {
          ...publicKeyJwk,
          kid: this.jwtConfigService.getCurrentKid(),
          use: 'sig',
          alg: 'RS256',
          pem: this.jwtConfigService.getPublicKeyPem(),
        },
      ],
    };
  }

  @Get('sessions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List user device sessions',
    description:
      'Returns all active sessions for the user. Useful for device management and remote logout.',
  })
  async getSessions(
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<SessionListDto>> {
    const sessions = await this.authService.getUserSessions(req.user.userId);
    const currentSessionId = req.headers['x-session-id'] as string;
    return ApiResponse.ok(
      {
        sessions,
        currentSessionId: currentSessionId ? Number(currentSessionId) : null,
        total: sessions.length,
      } as SessionListDto,
      'Sessions retrieved',
    );
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Terminate a specific session',
    description: 'Remotely logout from a specific device/session',
  })
  async terminateSession(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.authService.terminateSession(req.user.userId, sessionId);
  }

  @Delete('sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Terminate all sessions',
    description:
      'Remote logout from all devices (e.g., after password change or compromise)',
  })
  async terminateAllSessions(
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.authService.terminateAllSessions(req.user.userId);
  }

  /**
   * GET /auth/session-status
   * Mobile reconnection check — no AuthGuard so revoked/expired sessions
   * still get a useful response rather than a 401.
   */
  @Get('session-status')
  @Public()
  @UseGuards(RateLimitingGuard)
  @RateLimit(5)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check session revocation status',
    description:
      'Returns whether the current session is active or revoked. Used by mobile reconnection handler. No AuthGuard — validates session token directly.',
  })
  async getSessionStatus(
    @Req() req: Request,
  ): Promise<ApiResponse<{ active: boolean; revoked: boolean; wipe: boolean }>> {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : this.parseSessionCookie(req);

    if (!token) {
      return ApiResponse.ok(
        { active: false, revoked: true, wipe: false },
        'No session token',
      );
    }

    const result = await this.authService.checkSessionStatus(token);
    return ApiResponse.ok(result, result.active ? 'Session active' : 'Session revoked');
  }

  @Post('profile-complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete user profile (name / email+password / phone)',
    description: 'Called during onboarding to set name and add credentials.',
  })
  async profileComplete(
    @Req() req: AuthenticatedRequest,
    @Body() dto: OnboardingCompleteDto,
  ): Promise<ApiResponse<OnboardingCompleteResponseDto>> {
    const result = await this.onboardingService.completeOnboarding(Number(req.user.id), dto);
    return ApiResponse.ok(result, result.message);
  }

  @Get('permissions-snapshot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get full permissions snapshot',
    description:
      'Returns all entity permissions for the authenticated user across all their stores. Used by mobile for offline caching and by frontend for permission-aware UI rendering.',
  })
  async getPermissionsSnapshot(
    @CurrentUser() user: SessionUser,
  ): Promise<ApiResponse<PermissionsSnapshot>> {
    const snapshot = await this.permissionsService.buildPermissionsSnapshot(user.userId);
    return ApiResponse.ok(snapshot, 'Permissions snapshot retrieved');
  }

  @Get('permissions-delta')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get permissions delta since version',
    description:
      'Returns only permissions that changed since the provided version string. Used by mobile for efficient incremental sync after reconnection.',
  })
  async getPermissionsDelta(
    @CurrentUser() user: SessionUser,
    @Query('version') sinceVersion: string,
  ): Promise<ApiResponse<{ version: string; added: PermissionsSnapshot; removed: PermissionsSnapshot; modified: PermissionsSnapshot }>> {
    const delta = await this.permissionsService.calculateDelta(user.userId, sinceVersion ?? '');
    return ApiResponse.ok(delta, 'Permissions delta retrieved');
  }

  /**
   * POST /auth/sync-time
   * Mobile calls this at login and after token refresh to calculate device clock offset.
   * Returns offset = serverTime - deviceTime (seconds). Positive means device is behind.
   */
  @Post('sync-time')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sync device clock with server time',
    description: 'Returns the offset between server and device time in seconds. Used by mobile for clock drift detection before offline operations.',
  })
  getSyncTime(@Body() body: { deviceTime?: number }): ApiResponse<{ serverTime: number; offset: number }> {
    const serverTime = Math.floor(Date.now() / 1000);
    const offset = body.deviceTime != null ? serverTime - body.deviceTime : 0;
    return ApiResponse.ok({ serverTime, offset }, 'Server time');
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private parseSessionCookie(req: Request): string | undefined {
    return extractCookieValue(req.headers.cookie ?? '', 'nks_session');
  }
}
