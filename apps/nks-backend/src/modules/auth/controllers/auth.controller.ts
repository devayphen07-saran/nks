import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Req,
  Res,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../../common/guards/auth.guard';
import type { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { RefreshTokenService } from '../services/refresh-token.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthControllerHelpers } from '../../../common/utils/auth-helpers';
import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  AuthResponseEnvelope,
  MeResponseDto,
  SyncTimeDto,
} from '../dto';
import {
  PermissionsSnapshotDto,
  PermissionsDeltaDto,
  SessionListDto,
  GetPermissionsDeltaQuerySchema,
  GetPermissionsDeltaQueryDto,
} from '../dto/permissions.dto';
import { ApiResponse } from '../../../common/utils/api-response';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { JWTConfigService } from '../../../config/jwt.config';
import type { VerifyClaimsResponse } from '../services/auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly jwtConfigService: JWTConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email + password' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<AuthResponseEnvelope>> {
    const deviceInfo = AuthControllerHelpers.extractDeviceInfo(req);
    const result = await this.authService.login(dto, deviceInfo);
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
    const result = await this.authService.register(dto, deviceInfo);
    AuthControllerHelpers.applySessionCookie(res, result);
    return ApiResponse.ok(result, 'Registration successful');
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
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
    }>
  > {
    const cookieToken = this.parseSessionCookie(req);
    const providedRefreshToken = cookieToken ?? dto.refreshToken;

    if (!providedRefreshToken) {
      throw new UnauthorizedException(
        'No refresh token provided. Send via body or cookie.',
      );
    }

    // X-Device-ID header — sent by mobile clients, absent for web
    const deviceId =
      (req.headers as Record<string, string | undefined>)['x-device-id'] ??
      null;

    // ───────────────────────────────────────────────────────────────
    // PHASE 1 SECURITY: Refresh Token Rotation + Reuse Detection
    // ───────────────────────────────────────────────────────────────
    // Step 1: Extract sessionId from refresh token
    const sessionId =
      await this.refreshTokenService.extractSessionIdFromRefreshToken(
        providedRefreshToken,
      );

    // Step 2: Verify token validity and detect reuse/theft
    // If token was revoked (previous rotation), this throws immediately
    // and the service nukes ALL sessions for this user
    await this.refreshTokenService.verifyRefreshToken(
      sessionId,
      providedRefreshToken,
    );

    // Step 3: Call existing refresh logic (generates new access token)
    // Note: Token rotation (step 4 previously) is already done inside refreshAccessToken()
    // No need to call rotateRefreshToken() again - would cause duplicate rotation
    const result = await this.authService.refreshAccessToken(
      providedRefreshToken,
      deviceId,
    );

    AuthControllerHelpers.setSessionCookie(res, result.sessionToken);
    return ApiResponse.ok(result, 'Token refreshed successfully');
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
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
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      lastLoginIp: null,
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
    // No AuthGuard — works even when the session has already expired.
    // Read token from cookie directly; delete it from DB (best-effort).
    const token = this.parseSessionCookie(req);
    if (token) {
      try {
        await this.authService.logout(token);
      } catch (err) {
        // Log the error but don't block logout - best-effort session cleanup
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

  @Get('.well-known/jwks.json')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get JWKS public key set',
    description:
      'Returns the public key in JWKS format for JWT verification. Includes active key + fallback keys from past 7 days for graceful key rotation. Used by mobile clients for offline JWT verification. Cache max 1 hour for fast emergency rotation propagation.',
  })
  getJWKS(@Res({ passthrough: true }) res: Response): Record<string, unknown> {
    const jwks = this.jwtConfigService.getPublicKeyAsJWKS();
    // 1-hour cache (3600s) for fast emergency key rotation propagation
    // Mobile clients will refetch within 1h, catching emergency rotations
    res.set('Cache-Control', 'public, max-age=3600');
    res.set('Content-Type', 'application/jwk-set+json');
    return jwks;
  }

  @Post('sync-time')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sync device time with server',
    description:
      'Mobile clients call this to calculate device time offset. Returns server time so client can calculate: offset = serverTime - deviceTime',
  })
  async syncTime(
    @Body() dto: SyncTimeDto,
  ): Promise<
    ApiResponse<{ serverTime: number; offset: number; deviceTime: number }>
  > {
    const serverTime = Math.floor(Date.now() / 1000);
    const offset = serverTime - dto.deviceTime;
    return ApiResponse.ok(
      { serverTime, offset, deviceTime: dto.deviceTime },
      'Time synchronized',
    );
  }

  @Post('token/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify JWT token claims',
    description:
      'Verify JWT token claims and check if roles have changed. Used by mobile during offline sync to detect role changes and get updated permissions. Token is read from Authorization: Bearer <token> header only (never in request body).',
  })
  async verifyToken(
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<VerifyClaimsResponse>> {
    // AuthGuard has already verified the token and populated req.user
    // Extract the raw token from Authorization header if needed for additional checks
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    const result = await this.authService.verifyClaims(token);
    return ApiResponse.ok(result, 'Token verified');
  }

  @Get('permissions-snapshot')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get full permissions snapshot',
    description:
      'Returns complete permissions snapshot for offline-first mobile apps. Includes all entity permissions across all user stores.',
  })
  async getPermissionsSnapshot(
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<PermissionsSnapshotDto>> {
    const snapshot = await this.authService.getPermissionsSnapshot(
      req.user.userId,
    );
    const version = await this.authService.getPermissionsVersion(
      req.user.userId,
    );
    return ApiResponse.ok(
      { version, snapshot } as PermissionsSnapshotDto,
      'Permissions snapshot retrieved',
    );
  }

  @Get('permissions-delta')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get permissions delta since version',
    description:
      'Returns only added/removed/modified permissions since specified version. Optimized for mobile delta sync to reduce bandwidth.',
  })
  async getPermissionsDelta(
    @Query(new ZodValidationPipe(GetPermissionsDeltaQuerySchema))
    query: GetPermissionsDeltaQueryDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<PermissionsDeltaDto>> {
    const delta = await this.authService.calculatePermissionsDelta(
      req.user.userId,
      query.sinceVersion,
    );
    return ApiResponse.ok(
      delta as PermissionsDeltaDto,
      'Permissions delta calculated',
    );
  }

  @Get('sessions')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
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
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Terminate a specific session',
    description: 'Remotely logout from a specific device/session',
  })
  async terminateSession(
    @Param('sessionId') sessionId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<null>> {
    await this.authService.terminateSession(req.user.userId, sessionId);
    return ApiResponse.ok(null, 'Session terminated');
  }

  @Delete('sessions')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Terminate all sessions',
    description:
      'Remote logout from all devices (e.g., after password change or compromise)',
  })
  async terminateAllSessions(
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<null>> {
    await this.authService.terminateAllSessions(req.user.userId);
    return ApiResponse.ok(null, 'All sessions terminated');
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
   * Parse httpOnly session cookie from request
   * Used for logout and refresh token endpoints
   */
  private parseSessionCookie(req: Request): string | undefined {
    const cookieHeader = req.headers.cookie || '';
    const match = cookieHeader.match(/nks_session=([^;]+)/);
    return match?.[1]?.trim();
  }
}
