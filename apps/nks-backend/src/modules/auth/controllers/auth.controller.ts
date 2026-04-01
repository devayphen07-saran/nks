import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
  ParseIntPipe,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import * as crypto from 'crypto';
import { AuthService } from '../services/auth.service';
import { AuthMapper } from '../mappers/auth-mapper';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  ProfileCompleteDto,
  StoreSelectDto,
  AuthResponseDto,
} from '../dto';
import { ApiResponse } from '../../../common/utils/api-response';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { RBACGuard } from '../../../common/guards/rbac.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../../../common/guards/auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JWTConfigService } from '../../../common/config/jwt.config';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtConfigService: JWTConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email + password' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // ✅ ISSUE #5 FIX: Extract device info and pass to service
    const deviceInfo = this.extractDeviceInfo(req);
    const result = await this.authService.login(dto, deviceInfo);
    this.applySessionCookie(res, result);
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
  ) {
    // ✅ ISSUE #5 FIX: Extract device info and pass to service
    const deviceInfo = this.extractDeviceInfo(req);
    const result = await this.authService.register(dto, deviceInfo);
    this.applySessionCookie(res, result);
    return ApiResponse.ok(result, 'Registration successful');
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '✅ MODULE 2: Refresh access token using refresh token',
    description:
      'Generate a new access token using the refresh token. Works for both web and mobile. Refresh tokens expire in 30 days.',
  })
  async refreshToken(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // ✅ MODULE 2: Extract refresh token from body or cookie
    const cookieToken = this.parseSessionCookie(req);
    const refreshToken = cookieToken ?? dto.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException(
        'No refresh token provided. Send via body or cookie.',
      );
    }

    // ✅ MODULE 2: Generate new access token
    const result = await this.authService.refreshAccessToken(refreshToken);

    // Set new access token as httpOnly cookie for web
    if (result.accessToken) {
      this.setSessionCookie(res, result.accessToken);
    }

    return ApiResponse.ok(result, 'Access token refreshed successfully');
  }

  @Post('profile/complete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
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

  /**
   * ⚠️ DEPRECATED: Select active store
   * Use POST /store/select/{storeId} instead.
   * This endpoint is kept for backwards compatibility.
   */
  @Post('store/select')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '⚠️ DEPRECATED: Select active store',
    description:
      '⚠️ DEPRECATED: Use POST /store/select/{storeId} instead. This endpoint is kept for backwards compatibility.',
  })
  async selectStore(
    @Req() req: AuthenticatedRequest,
    @CurrentUser('userId') userId: number,
    @Body() dto: StoreSelectDto,
  ) {
    const token = this.extractBearerToken(req);
    const result = await this.authService.switchStore(
      userId,
      token,
      dto.storeId,
    );
    return ApiResponse.ok(result, 'Store selected');
  }

  @Post('setup-personal')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set up personal account (assigns CUSTOMER role)' })
  async setupPersonal(@CurrentUser('userId') userId: number) {
    const result = await this.authService.setupPersonal(userId);
    return ApiResponse.ok(result, 'Personal account set up');
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invalidate the current session token' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = this.extractBearerToken(req);
    await this.authService.logout(token);
    res.clearCookie('nks_session', { path: '/' });
    return ApiResponse.ok(null, 'Logged out');
  }

  @Post('lock-status/:userId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Check if account is locked',
    description:
      'Returns account lock status, unlock time if locked, and attempts remaining',
  })
  async checkLockStatus(@Param('userId', ParseIntPipe) userId: number) {
    const status = await this.authService.checkAccountLockStatus(userId);
    return ApiResponse.ok(status, 'Account lock status retrieved');
  }

  @Post('admin/unlock/:userId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RBACGuard)
  @ApiBearerAuth()
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Unlock a locked account (admin only)',
    description:
      'SUPER_ADMIN only. Unlocks a user account and resets failed login attempts.',
  })
  async adminUnlockAccount(
    @CurrentUser('userId') adminUserId: number,
    @Param('userId', ParseIntPipe) targetUserId: number,
  ) {
    await this.authService.adminUnlockAccount(targetUserId, adminUserId);
    return ApiResponse.ok(null, 'Account unlocked successfully');
  }

  /**
   * ❌ REMOVED: Redundant endpoint
   * Alternative endpoints to use:
   * - GET /routes/me — Get user routes based on their roles
   * - POST /auth/refresh-token — Refresh access token
   * Clients should use these instead of calling get-session directly.
   */

  /**
   * ❌ REMOVED: Duplicate endpoint
   * Use GET /routes/admin/combined instead
   * This endpoint was causing confusion with routes.controller.ts
   */

  @Get('.well-known/jwks.json')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get JWKS public key set',
    description:
      'Returns the public key in JWKS format for JWT verification. Used by mobile clients for offline JWT verification. Cache this response for 24 hours.',
  })
  getJWKS(@Res({ passthrough: true }) res: Response) {
    const jwks = this.jwtConfigService.getPublicKeyAsJWKS();
    res.set('Cache-Control', 'public, max-age=86400'); // 24 hours
    return ApiResponse.ok(jwks, 'JWKS public key set');
  }

  @Post('sync-time')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '✅ MODULE 4: Sync device time with server',
    description:
      'Mobile clients call this endpoint to calculate device time offset. Used to validate token expiry accurately even if device time is wrong. Returns server time so client can calculate: offset = serverTime - deviceTime',
  })
  async syncTime(@Body() dto: { deviceTime: number }) {
    const serverTime = Math.floor(Date.now() / 1000); // seconds since epoch
    const offset = serverTime - dto.deviceTime;

    return ApiResponse.ok(
      {
        serverTime,
        offset,
        deviceTime: dto.deviceTime,
      },
      'Time synchronized',
    );
  }

  @Post('verify-claims')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify JWT claims (mobile offline sync)',
    description:
      'Verify JWT token claims and check if roles have changed. Used by mobile during offline sync to detect role changes and get updated permissions.',
  })
  async verifyClaims(@Body() dto: { jwtToken: string }) {
    const result = await this.authService.verifyClaims(dto.jwtToken);
    return ApiResponse.ok(result, 'Claims verified');
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
   * ✅ ISSUE #5 FIX: Extract device info from request headers
   * Captures device tracking information for session audit
   */
  private extractDeviceInfo(req: Request): {
    deviceId?: string;
    deviceName?: string;
    deviceType?: string;
    appVersion?: string;
  } {
    return {
      deviceId: (req.headers['x-device-id'] as string) || undefined,
      deviceName: (req.headers['x-device-name'] as string) || undefined,
      deviceType: (req.headers['x-device-type'] as string) || undefined, // web, ios, android
      appVersion: (req.headers['x-app-version'] as string) || undefined,
    };
  }

  /** Strip "Bearer " prefix from Authorization header. */
  private extractBearerToken(req: Request): string {
    return (req.headers.authorization ?? '').replace('Bearer ', '').trim();
  }

  /** Extract accessToken from an auth response and set it as an httpOnly cookie. */
  private applySessionCookie(res: Response, result: AuthResponseDto): void {
    const token = result.data?.session?.accessToken;
    if (token) this.setSessionCookie(res, token);
  }

  private setSessionCookie(res: Response, token: string): void {
    res.cookie('nks_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env['NODE_ENV'] === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    });
  }

  /** Parse nks_session token from Cookie header without requiring cookie-parser. */
  private parseSessionCookie(req: Request): string | undefined {
    return (req.headers.cookie ?? '')
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('nks_session='))
      ?.split('=')[1];
  }
}
