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
  Logger,
  UnauthorizedException,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../../../common/guards/auth.guard';
import type { Request, Response } from 'express';
import {
  ErrorCode,
  errPayload,
} from '../../../../common/constants/error-codes.constants';
import { ForbiddenException } from '../../../../common/exceptions';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthControllerHelpers } from '../../../../common/utils/auth-helpers';
import { DeviceDetector, type DeviceInfo } from '../../../../common/utils/device-detector';
import { extractCookieValue } from '../../../../common/utils/cookie.utils';
import { ResponseMessage } from '../../../../common/decorators/response-message.decorator';
import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  AuthResponseEnvelope,
  MeResponseDto,
} from '../dto';
import {
  OnboardingCompleteDto,
  OnboardingCompleteResponseDto,
} from '../dto/onboarding.dto';
import { SessionListDto } from '../dto/permissions.dto';
import { Public } from '../../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { RateLimit } from '../../../../common/decorators/rate-limit.decorator';
import { NoEntityPermissionRequired } from '../../../../common/decorators/no-entity-permission-required.decorator';
import { RawResponse } from '../../../../common/decorators/raw-response.decorator';
import { CsrfService } from '../../../../common/csrf.service';
import { JWTConfigService } from '../../../../config/jwt.config';
import type { SessionUser } from '../interfaces/session-user.interface';
import { PasswordAuthService } from '../services/flows/password-auth.service';
import { AuthQueryService } from '../services/session/auth-query.service';
import { SessionCommandService } from '../services/session/session-command.service';
import { SessionQueryService } from '../services/session/session-query.service';
import { OnboardingService } from '../services/flows/onboarding.service';
import { PermissionsService } from '../services/permissions/permissions.service';
import { TokenLifecycleService } from '../services/token/token-lifecycle.service';
import { DeviceRegistrationFlowService } from '../services/device/device-registration-flow.service';
import {
  MAX_SESSION_TOKEN_LENGTH,
  MIN_SESSION_TOKEN_LENGTH,
} from '../auth.constants';
import {
  DeviceContextHeaders,
  type DeviceContext,
} from '../../../../common/decorators/device-context.decorator';

@ApiTags('Auth')
@Controller('auth')
@ApiBearerAuth()
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly passwordAuth: PasswordAuthService,
    private readonly tokenLifecycle: TokenLifecycleService,
    private readonly authQuery: AuthQueryService,
    private readonly sessionCommand: SessionCommandService,
    private readonly sessionQuery: SessionQueryService,
    private readonly onboarding: OnboardingService,
    private readonly permissions: PermissionsService,
    private readonly jwtConfig: JWTConfigService,
    private readonly csrf: CsrfService,
    private readonly deviceRegistrationFlow: DeviceRegistrationFlowService,
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
    const deviceInfo = DeviceDetector.extract(req);
    const { envelope, csrfSecret } = await this.passwordAuth.login(
      dto,
      deviceInfo,
    );
    return this.applyAuthResponse(res, envelope, csrfSecret, deviceInfo);
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
    const deviceInfo = DeviceDetector.extract(req);
    const { envelope, csrfSecret } = await this.passwordAuth.register(dto, deviceInfo);
    return this.applyAuthResponse(res, envelope, csrfSecret, deviceInfo);
  }

  @Post('sync-time')
  @HttpCode(HttpStatus.OK)
  @NoEntityPermissionRequired(
    'clock sync: authenticated but no entity permission needed',
  )
  @ResponseMessage('Success')
  @ApiOperation({ summary: 'Calculate device clock offset relative to server' })
  syncTime(@Body() body: { deviceTime?: number }): { offset: number } {
    const serverTime = Math.floor(Date.now() / 1000);
    const deviceTime = body?.deviceTime ?? serverTime;
    return { offset: serverTime - deviceTime };
  }

  @Post('refresh-token')
  @Public()
  @HttpCode(HttpStatus.OK)
  // No per-IP @RateLimit here. Refresh is keyed per-user inside
  // TokenLifecycleService.enforceRateLimit (60 per 15 min per userId), which
  // is the correct granule. A per-IP cap on this @Public endpoint also
  // collapses every device behind a shared NAT (store WiFi, office, hotspot)
  // into one bucket and turns flaky-network refresh bursts into 429 cascades
  // — we hit that exact trap in production. The global default (100/15min)
  // still backstops anonymous abuse before the service layer is reached.
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
    @DeviceContextHeaders() device: DeviceContext,
  ): Promise<AuthResponseEnvelope> {
    const cookieToken = this.parseSessionCookie(req);
    const providedRefreshToken = dto.refreshToken ?? cookieToken;

    if (!providedRefreshToken) {
      throw new UnauthorizedException(
        errPayload(ErrorCode.AUTH_REFRESH_TOKEN_INVALID),
      );
    }

    const isMobile = DeviceDetector.isMobile(device.deviceType ?? undefined);
    const { envelope, csrfSecret } =
      await this.tokenLifecycle.refreshAccessToken(
        providedRefreshToken,
        device.deviceId,
        isMobile,
      );

    AuthControllerHelpers.applySessionCookie(res, envelope);
    if (envelope.auth?.bearerToken && !isMobile) {
      this.csrf.refresh(res, csrfSecret);
    }
    return AuthControllerHelpers.forClient(
      envelope,
      device.deviceType ?? undefined,
    );
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @NoEntityPermissionRequired(
    'self-service: user reading their own session and profile data',
  )
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
    // Mobile sends token in Authorization: Bearer <token>; web uses httpOnly cookie.
    const token =
      this.parseSessionCookie(req) ??
      (req.headers.authorization?.replace(/^Bearer\s+/i, '') || undefined);
    if (token) {
      await this.sessionCommand.logout(token, req.user.userId);
    }
    AuthControllerHelpers.clearSessionCookie(res);
    this.csrf.clear(res);
    return null;
  }

  @Get('mobile-jwks')
  @Public()
  @HttpCode(HttpStatus.OK)
  @RawResponse()
  @ApiOperation({
    summary: 'Get RS256 JWKS for mobile offline verification',
    description:
      'Returns the RS256 public key in JWKS format for verifying access and offline JWTs on device.',
  })
  getMobileJwks(@Res({ passthrough: true }) res: Response): object {
    const jwks = this.jwtConfig.getPublicKeyAsJWKS();
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
    @DeviceContextHeaders() device: DeviceContext,
  ): Promise<SessionListDto> {
    const activeSessions = await this.sessionQuery.getUserSessions(
      req.user.userId,
    );
    return {
      sessions: activeSessions,
      currentSessionId: device.sessionId,
      total: activeSessions.length,
    };
  }

  @Delete('sessions/:sessionGuuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  @NoEntityPermissionRequired(
    'self-service: user revoking one of their own sessions',
  )
  @ApiOperation({
    summary: 'Terminate a specific session',
    description: 'Remotely logout from a specific device/session',
  })
  async terminateSession(
    @Param('sessionGuuid', ParseUUIDPipe) sessionGuuid: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.sessionCommand.terminateSession(req.user.userId, sessionGuuid);
  }

  @Delete('sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @NoEntityPermissionRequired(
    'self-service: user revoking all their own sessions',
  )
  @ApiOperation({
    summary: 'Terminate all sessions',
    description:
      'Remote logout from all devices (e.g., after password change or compromise)',
  })
  async terminateAllSessions(@Req() req: AuthenticatedRequest): Promise<void> {
    await this.sessionCommand.terminateAllSessions(req.user.userId);
  }

  @Get('session-status')
  @Public()
  // 20 per 15 min per IP. This is the mobile reconnection handler — a single
  // device flapping between WiFi/cellular can legitimately call it several
  // times in seconds, and shared NAT (store/office/hotspot) multiplies that
  // across devices on the same egress IP. 3 was too tight; 20 still blocks
  // enumeration because the response only echoes the caller's own session
  // state (no oracle for unrelated tokens).
  @RateLimit(20)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Session status checked')
  @ApiOperation({
    summary: 'Check session revocation status',
    description:
      'Returns whether the current session is active or revoked. Used by mobile reconnection handler. No AuthGuard — validates session token directly.',
  })
  async getSessionStatus(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ active: boolean; revoked: boolean; wipe: boolean }> {
    res.set('Cache-Control', 'no-store');

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : this.parseSessionCookie(req);

    // Reject obviously invalid tokens before touching the DB.
    if (
      !token ||
      token.length < MIN_SESSION_TOKEN_LENGTH ||
      token.length > MAX_SESSION_TOKEN_LENGTH
    ) {
      return { active: false, revoked: true, wipe: false };
    }

    // Caller must supply X-Device-Id when the session is device-bound. This
    // closes the public-probe oracle: a stolen token alone returns 'revoked'
    // unless the caller can also prove device possession.
    const requestDeviceId =
      (req.headers['x-device-id'] as string | undefined) ?? null;
    return this.authQuery.checkSessionStatus(token, requestDeviceId);
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
    return this.onboarding.completeOnboarding(req.user.userId, dto);
  }

  @Get('permissions-snapshot')
  @HttpCode(HttpStatus.OK)
  @NoEntityPermissionRequired(
    'self-service: user reading their own permission snapshot',
  )
  @ResponseMessage('Permissions snapshot retrieved')
  @ApiOperation({
    summary: 'Get full permissions snapshot',
    description:
      'Returns all entity permissions for the authenticated user across all their stores. Used by mobile for offline caching and by frontend for permission-aware UI rendering.',
  })
  async getPermissionsSnapshot(@CurrentUser() user: SessionUser) {
    return this.permissions.buildPermissionsSnapshot(user.userId);
  }

  @Get('permissions-delta')
  @HttpCode(HttpStatus.OK)
  @NoEntityPermissionRequired(
    'self-service: user reading their own permissions delta',
  )
  @ResponseMessage('Permissions delta retrieved')
  @ApiOperation({
    summary: 'Get permissions delta since version',
    description:
      'Returns only permissions that changed since the provided version string. Used by mobile for efficient incremental sync after reconnection.',
  })
  async getPermissionsDelta(
    @CurrentUser() user: SessionUser,
    @Query('version') sinceVersion: string,
  ) {
    return this.permissions.calculateDelta(user.userId, sinceVersion ?? '');
  }

  @Post('switch-store')
  @HttpCode(HttpStatus.OK)
  @NoEntityPermissionRequired('self-service: user switching their active store')
  @ResponseMessage('Store switched successfully')
  @ApiOperation({
    summary: 'Switch active store for current session',
    description:
      'Updates the session to a different store. Used by mobile to switch between managed stores. Device is automatically registered for the new store.',
  })
  async switchStore(
    @Body() dto: { storeId: number },
    @CurrentUser() user: SessionUser,
    @DeviceContextHeaders() device: DeviceContext,
  ): Promise<{ success: boolean; activeStoreId: number }> {
    const { storeId } = dto;

    // Tenant isolation: refuse to point the session at a store the user is
    // not a member of. Without this check, any authenticated user could
    // switch into any store id (cross-tenant access).
    //
    // No SUPER_ADMIN bypass: even super-admins must hold a membership row
    // (staff mapping or ownership) to bind a session to a store.
    const allowedStoreIds = await this.permissions.findActiveStoreIds(user.userId);
    if (!allowedStoreIds.includes(storeId)) {
      throw new ForbiddenException(errPayload(ErrorCode.AUTH_FORBIDDEN_STORE_ACCESS));
    }

    // Atomic: update session.activeStoreFk and upsert device_registration in
    // one transaction. Awaited so the response is only sent once both writes
    // are committed — eliminates the race where mobile starts syncing the
    // new store before the device registration row exists.
    //
    // The session id comes from the bearer-validated SessionUser (set by
    // AuthGuard) — never from a client-supplied header. This prevents a
    // request from being told which session row to mutate.
    await this.deviceRegistrationFlow.switchActiveStore(
      user.sessionId,
      storeId,
      device.deviceId ?? null,
    );

    return { success: true, activeStoreId: storeId };
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
   * Shared post-auth wiring for login and register:
   * set session cookie, refresh CSRF, strip token for web.
   *
   * Device registration is handled by AuthFlowOrchestratorService — both
   * password and OTP flows register the device atomically as part of the
   * unified auth flow. Controllers are no longer involved.
   */
  private applyAuthResponse(
    res: Response,
    envelope: AuthResponseEnvelope,
    csrfSecret: string,
    deviceInfo: DeviceInfo,
  ): AuthResponseEnvelope {
    const isMobile = DeviceDetector.isMobile(deviceInfo.deviceType);
    AuthControllerHelpers.applySessionCookie(res, envelope);

    if (envelope.auth?.bearerToken && !isMobile) {
      this.csrf.refresh(res, csrfSecret);
    }

    return AuthControllerHelpers.forClient(envelope, deviceInfo.deviceType);
  }

  private parseSessionCookie(req: Request): string | undefined {
    return extractCookieValue(
      req.headers.cookie ?? '',
      AuthControllerHelpers.SESSION_COOKIE_NAME,
    );
  }
}
