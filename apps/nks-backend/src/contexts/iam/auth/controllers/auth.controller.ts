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
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../../../common/guards/auth.guard';
import type { Request, Response } from 'express';
import { ErrorCode, errPayload } from '../../../../common/constants/error-codes.constants';
import { AuthService } from '../services/session/auth.service';
import { SessionService } from '../services/session/session.service';
import { PasswordAuthService } from '../services/flows/password-auth.service';
import { TokenLifecycleService } from '../services/token/token-lifecycle.service';
import { OnboardingService } from '../services/flows/onboarding.service';
import { PermissionsService, type PermissionsSnapshot, type PermissionsSnapshotResponse } from '../services/permissions/permissions.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthControllerHelpers } from '../../../../common/utils/auth-helpers';
import { extractCookieValue } from '../../../../common/utils/cookie.utils';
import { ResponseMessage } from '../../../../common/decorators/response-message.decorator';
import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  AuthResponseEnvelope,
  MeResponseDto,
  SyncTimeDto,
} from '../dto';
import { OnboardingCompleteDto, OnboardingCompleteResponseDto } from '../dto/onboarding.dto';
import { SessionListDto } from '../dto/permissions.dto';
import { Public } from '../../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { RateLimit } from '../../../../common/decorators/rate-limit.decorator';
import { NoEntityPermissionRequired } from '../../../../common/decorators/no-entity-permission-required.decorator';
import { SkipTransform } from '../../../../common/decorators/skip-transform.decorator';
import { JWTConfigService } from '../../../../config/jwt.config';
import type { SessionUser } from '../interfaces/session-user.interface';

@ApiTags('Auth')
@Controller('auth')
@ApiBearerAuth()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly passwordAuthService: PasswordAuthService,
    private readonly tokenLifecycleService: TokenLifecycleService,
    private readonly jwtConfigService: JWTConfigService,
    private readonly onboardingService: OnboardingService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @RateLimit(10)
  @ResponseMessage('Login successful')
  @ApiOperation({ summary: 'Login with email + password' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseEnvelope> {
    const deviceInfo = AuthControllerHelpers.extractDeviceInfo(req);
    const result = await this.passwordAuthService.login(dto, deviceInfo);
    AuthControllerHelpers.applySessionCookie(res, result);
    return AuthControllerHelpers.forClient(result, deviceInfo.deviceType);
  }

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @RateLimit(10)
  @ResponseMessage('Registration successful')
  @ApiOperation({
    summary: 'Register new user. First user auto-assigned SUPER_ADMIN.',
  })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseEnvelope> {
    const deviceInfo = AuthControllerHelpers.extractDeviceInfo(req);
    const result = await this.passwordAuthService.register(dto, deviceInfo);
    AuthControllerHelpers.applySessionCookie(res, result);
    return AuthControllerHelpers.forClient(result, deviceInfo.deviceType);
  }

  @Post('refresh-token')
  @Public()
  @HttpCode(HttpStatus.OK)
  @RateLimit(30)
  @ResponseMessage('Token refreshed successfully')
  @ApiOperation({
    summary: 'Refresh access token using refresh token',
    description:
      'Rotates both access and refresh tokens. Works for web (cookie) and mobile (body). Implements refresh token rotation + theft detection (if token reused, all sessions are terminated).',
  })
  async refreshToken(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseEnvelope & { permissionsChanged: boolean }> {
    const cookieToken = this.parseSessionCookie(req);
    const providedRefreshToken = dto.refreshToken ?? cookieToken;

    if (!providedRefreshToken) {
      throw new UnauthorizedException(errPayload(ErrorCode.AUTH_REFRESH_TOKEN_INVALID));
    }

    const deviceId =
      (req.headers as Record<string, string | undefined>)['x-device-id'] ?? null;

    const result = await this.tokenLifecycleService.refreshAccessToken(
      providedRefreshToken,
      deviceId,
    );

    const deviceType =
      (req.headers as Record<string, string | undefined>)['x-device-type'];
    AuthControllerHelpers.applySessionCookie(res, result);
    return AuthControllerHelpers.forClient(result, deviceType);
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @NoEntityPermissionRequired('self-service: user reading their own session and profile data')
  @ResponseMessage('Authenticated')
  @ApiOperation({
    summary: 'Get current authenticated user',
    description:
      'Validates the session and returns user profile + roles. Web calls this on mount to verify the httpOnly cookie is still valid.',
  })
  getMe(@Req() req: AuthenticatedRequest): MeResponseDto {
    const u = req.user;
    return {
      guuid: u.guuid,
      iamUserId: u.iamUserId,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      emailVerified: u.emailVerified,
      phoneNumber: u.phoneNumber,
      phoneNumberVerified: u.phoneNumberVerified,
      image: u.image,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @NoEntityPermissionRequired('self-service: user revoking their own session')
  @ResponseMessage('Logged out')
  @ApiOperation({ summary: 'Invalidate the current session token' })
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<null> {
    const token = this.parseSessionCookie(req);
    if (token) {
      await this.authService.logout(token, req.user.userId);
    }
    AuthControllerHelpers.clearSessionCookie(res);
    return null;
  }

  @Get('mobile-jwks')
  @Public()
  @HttpCode(HttpStatus.OK)
  @SkipTransform()
  @ApiOperation({
    summary: 'Get RS256 JWKS for mobile offline verification',
    description:
      'Returns the RS256 public key in JWKS format for verifying access and offline JWTs on device.',
  })
  getMobileJwks(@Res({ passthrough: true }) res: Response): object {
    const jwks = this.jwtConfigService.getPublicKeyAsJWKS();
    res.set('Cache-Control', 'public, max-age=3600');
    res.set('Content-Type', 'application/jwk-set+json');
    return jwks;
  }

  @Get('sessions')
  @HttpCode(HttpStatus.OK)
  @NoEntityPermissionRequired('self-service: user listing their own sessions')
  @ResponseMessage('Sessions retrieved')
  @ApiOperation({
    summary: 'List user device sessions',
    description:
      'Returns all active sessions for the user. Useful for device management and remote logout.',
  })
  async getSessions(
    @Req() req: AuthenticatedRequest,
  ): Promise<SessionListDto> {
    const sessions = await this.sessionService.getUserSessions(req.user.userId);
    const currentSessionId = (req.headers['x-session-id'] as string) ?? null;
    return { sessions, currentSessionId, total: sessions.length };
  }

  @Delete('sessions/:sessionGuuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  @NoEntityPermissionRequired('self-service: user revoking one of their own sessions')
  @ApiOperation({
    summary: 'Terminate a specific session',
    description: 'Remotely logout from a specific device/session',
  })
  async terminateSession(
    @Param('sessionGuuid', ParseUUIDPipe) sessionGuuid: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.sessionService.terminateSession(req.user.userId, sessionGuuid);
  }

  @Delete('sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @NoEntityPermissionRequired('self-service: user revoking all their own sessions')
  @ApiOperation({
    summary: 'Terminate all sessions',
    description:
      'Remote logout from all devices (e.g., after password change or compromise)',
  })
  async terminateAllSessions(
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.sessionService.terminateAllSessions(req.user.userId);
  }

  @Get('session-status')
  @Public()
  @RateLimit(5)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Session status checked')
  @ApiOperation({
    summary: 'Check session revocation status',
    description:
      'Returns whether the current session is active or revoked. Used by mobile reconnection handler. No AuthGuard — validates session token directly.',
  })
  async getSessionStatus(
    @Req() req: Request,
  ): Promise<{ active: boolean; revoked: boolean; wipe: boolean }> {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : this.parseSessionCookie(req);

    if (!token) {
      return { active: false, revoked: true, wipe: false };
    }

    return this.authService.checkSessionStatus(token);
  }

  @Post('profile-complete')
  @HttpCode(HttpStatus.OK)
  @NoEntityPermissionRequired('self-service: user completing their own profile')
  @ResponseMessage('Profile updated')
  @ApiOperation({
    summary: 'Complete user profile (name / email+password / phone)',
    description: 'Called during onboarding to set name and add credentials.',
  })
  async profileComplete(
    @Req() req: AuthenticatedRequest,
    @Body() dto: OnboardingCompleteDto,
  ): Promise<OnboardingCompleteResponseDto> {
    return this.onboardingService.completeOnboarding(req.user.userId, dto);
  }

  @Get('permissions-snapshot')
  @HttpCode(HttpStatus.OK)
  @NoEntityPermissionRequired('self-service: user reading their own permission snapshot')
  @ResponseMessage('Permissions snapshot retrieved')
  @ApiOperation({
    summary: 'Get full permissions snapshot',
    description:
      'Returns all entity permissions for the authenticated user across all their stores. Used by mobile for offline caching and by frontend for permission-aware UI rendering.',
  })
  async getPermissionsSnapshot(
    @CurrentUser() user: SessionUser,
  ): Promise<PermissionsSnapshotResponse> {
    return this.permissionsService.buildPermissionsSnapshot(user.userId);
  }

  @Get('permissions-delta')
  @HttpCode(HttpStatus.OK)
  @NoEntityPermissionRequired('self-service: user reading their own permissions delta')
  @ResponseMessage('Permissions delta retrieved')
  @ApiOperation({
    summary: 'Get permissions delta since version',
    description:
      'Returns only permissions that changed since the provided version string. Used by mobile for efficient incremental sync after reconnection.',
  })
  async getPermissionsDelta(
    @CurrentUser() user: SessionUser,
    @Query('version') sinceVersion: string,
  ): Promise<{ version: number; added: PermissionsSnapshot; removed: PermissionsSnapshot; modified: PermissionsSnapshot }> {
    return this.permissionsService.calculateDelta(user.userId, sinceVersion ?? '');
  }

  @Post('sync-time')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Server time')
  @ApiOperation({
    summary: 'Sync device clock with server time',
    description: 'Returns the offset between server and device time in seconds. Used by mobile for clock drift detection before offline operations.',
  })
  getSyncTime(@Body() dto: SyncTimeDto): { serverTime: number; offset: number } {
    const serverTime = Math.floor(Date.now() / 1000);
    const offset = serverTime - dto.deviceTime;
    return { serverTime, offset };
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private parseSessionCookie(req: Request): string | undefined {
    return extractCookieValue(req.headers.cookie ?? '', AuthControllerHelpers.SESSION_COOKIE_NAME);
  }
}
