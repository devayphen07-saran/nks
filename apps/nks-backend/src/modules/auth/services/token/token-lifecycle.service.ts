import * as crypto from 'crypto';
import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import * as schema from '../../../../core/database/schema';
import { JWTConfigService } from '../../../../config/jwt.config';
import { RefreshTokenService } from '../session/refresh-token.service';
import { SessionsRepository } from '../../repositories/sessions.repository';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
import { RolesRepository } from '../../../roles/repositories/roles.repository';
import { PermissionsService } from '../permissions/permissions.service';
import { AuthUtilsService } from '../shared/auth-utils.service';
import {
  JWT_AUDIENCE,
  OFFLINE_JWT_EXPIRATION,
  SYSTEM_ROLE_STORE_OWNER,
} from '../../auth.constants';
import { ErrorCodes, ErrorMessages } from '../../../../core/constants/error-codes';

type Db = NodePgDatabase<typeof schema>;

export interface VerifyClaimsResponse {
  isValid: boolean;
  sub?: string;
  rolesChanged: boolean;
  currentRoles?: string[];
  stores?: Array<{ id: number | null; name: string | null }>;
}

/**
 * TokenLifecycleService
 *
 * Owns the token rotation and verification flows:
 *   - refreshAccessToken — validate refresh token, rotate session, issue new token pair
 *   - verifyClaims       — verify JWT signature and detect role changes
 *
 * These flows are security-critical and intentionally isolated from the
 * initial login/register flows in PasswordAuthService.
 */
@Injectable()
export class TokenLifecycleService {
  private readonly logger = new Logger(TokenLifecycleService.name);

  constructor(
    @InjectDb() private readonly db: Db,
    private readonly jwtConfigService: JWTConfigService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly sessionsRepository: SessionsRepository,
    private readonly authUsersRepository: AuthUsersRepository,
    private readonly rolesRepository: RolesRepository,
    private readonly permissionsService: PermissionsService,
    private readonly authUtils: AuthUtilsService,
  ) {}

  async refreshAccessToken(
    refreshToken: string,
    deviceId: string | null = null,
  ): Promise<{
    sessionId: string;
    sessionToken: string;
    jwtToken: string;
    expiresAt: string;
    refreshToken: string;
    refreshExpiresAt: string;
    defaultStore: { guuid: string } | null;
    offlineToken: string;
  }> {
    // Step 1: Hash for DB lookup (token is fully opaque)
    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    // Step 2: Fetch session with EXCLUSIVE LOCK — prevents concurrent rotation races
    const session =
      await this.sessionsRepository.findByRefreshTokenHashForUpdate(
        refreshTokenHash,
      );
    if (!session) throw new UnauthorizedException({ errorCode: ErrorCodes.AUTH_INVALID_REFRESH_TOKEN, message: ErrorMessages[ErrorCodes.AUTH_INVALID_REFRESH_TOKEN] });

    const isValidToken = this.refreshTokenService.verifyTokenHash(
      refreshToken,
      session.refreshTokenHash,
    );
    if (!isValidToken) throw new UnauthorizedException({ errorCode: ErrorCodes.AUTH_INVALID_REFRESH_TOKEN, message: ErrorMessages[ErrorCodes.AUTH_INVALID_REFRESH_TOKEN] });

    // Step 2b: Theft detection — if token was already rotated, terminate all sessions
    if (session.refreshTokenRevokedAt !== null) {
      this.logger.error(
        `TOKEN THEFT DETECTED: User ${session.userId} reused rotated refresh token. Session ${session.id} compromised.`,
        {
          sessionId: session.id,
          revokedAt: session.refreshTokenRevokedAt,
          attemptedAt: new Date(),
        },
      );
      await this.sessionsRepository.revokeAndDeleteAllForUser(
        session.userId,
        'TOKEN_REUSE',
      );
      throw new UnauthorizedException({ errorCode: ErrorCodes.AUTH_SESSION_COMPROMISED, message: ErrorMessages[ErrorCodes.AUTH_SESSION_COMPROMISED] });
    }

    if (session.expiresAt < new Date())
      throw new UnauthorizedException({ errorCode: ErrorCodes.AUTH_SESSION_EXPIRED, message: ErrorMessages[ErrorCodes.AUTH_SESSION_EXPIRED] });

    // Step 3a: Device binding — mobile tokens must match device
    if (session.deviceId !== null && session.deviceId !== deviceId) {
      throw new UnauthorizedException({ errorCode: ErrorCodes.AUTH_DEVICE_MISMATCH, message: ErrorMessages[ErrorCodes.AUTH_DEVICE_MISMATCH] });
    }

    // Step 3b: Refresh token expiry
    if (
      session.refreshTokenExpiresAt &&
      session.refreshTokenExpiresAt < new Date()
    ) {
      throw new UnauthorizedException({ errorCode: ErrorCodes.AUTH_REFRESH_TOKEN_EXPIRED, message: ErrorMessages[ErrorCodes.AUTH_REFRESH_TOKEN_EXPIRED] });
    }

    // Step 4: Fetch permissions + user in parallel
    const [permissions, user] = await Promise.all([
      this.permissionsService.getUserPermissions(session.userId),
      this.authUsersRepository.findEmailAndGuuid(session.userId),
    ]);

    if (!user?.guuid) {
      throw new InternalServerErrorException(
        'User record missing guuid — cannot sign JWT',
      );
    }

    const userRoles = permissions.roles || [];
    const currentRoleHash = this.authUtils.hashRoles(userRoles);
    const accessTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    // Step 5: Rotate session — BetterAuth issues a new opaque token
    const ctx = await this.authUtils.getBetterAuthContext();
    const createdSession = await ctx.internalAdapter.createSession(
      String(session.userId),
    );
    if (!createdSession)
      throw new UnauthorizedException({ errorCode: ErrorCodes.AUTH_SESSION_ROTATION_FAILED, message: ErrorMessages[ErrorCodes.AUTH_SESSION_ROTATION_FAILED] });

    const newSession = await this.sessionsRepository.findByToken(
      createdSession.token,
    );
    if (!newSession)
      throw new UnauthorizedException({ errorCode: ErrorCodes.AUTH_SESSION_ROTATION_FAILED, message: ErrorMessages[ErrorCodes.AUTH_SESSION_ROTATION_FAILED] });

    // Step 6: Generate new refresh token
    const { token: newRefreshToken, tokenHash: newRefreshTokenHash } =
      this.refreshTokenService.generateRefreshToken();
    const newRefreshTokenExpiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ); // 7d

    const accessToken = this.jwtConfigService.signToken({
      sub: user.guuid,
      sid: newSession.guuid,
      jti: crypto.randomUUID(),
      ...(user.email ? { email: user.email } : {}),
      roles: userRoles.map((r) => r.roleCode),
      iss: 'nks-auth',
      aud: JWT_AUDIENCE,
    });

    // Step 7: Atomically update new session + revoke old refresh token
    await this.db.transaction(async (_tx) => {
      await this.sessionsRepository.update(newSession.id, {
        roleHash: currentRoleHash,
        deviceId: session.deviceId,
        deviceName: session.deviceName,
        deviceType: session.deviceType,
        appVersion: session.appVersion,
        activeStoreFk: session.activeStoreFk,
        refreshTokenHash: newRefreshTokenHash,
        refreshTokenExpiresAt: newRefreshTokenExpiresAt,
        accessTokenExpiresAt,
      });
      await this.sessionsRepository.update(session.id, {
        refreshTokenRevokedAt: new Date(),
        revokedReason: 'ROTATION',
      });
    });

    // Step 8: Fetch default store
    const storeOwnerRoleId = await this.authUtils.getCachedSystemRoleId(
      SYSTEM_ROLE_STORE_OWNER,
    );
    const primaryStore = storeOwnerRoleId
      ? await this.rolesRepository.findPrimaryStoreForUser(
          session.userId,
          storeOwnerRoleId,
        )
      : null;

    const offlineToken = this.jwtConfigService.signOfflineToken(
      {
        sub: user.guuid,
        ...(user.email ? { email: user.email } : {}),
        roles: userRoles.map((r) => r.roleCode),
        stores: userRoles
          .filter((r) => r.storeId && r.storeName)
          .map((r) => ({
            id: r.storeId as number,
            name: r.storeName as string,
          })),
        activeStoreId: userRoles.find((r) => r.storeId)?.storeId || null,
      },
      OFFLINE_JWT_EXPIRATION,
    );

    this.logger.log(`Session rotated for user ${session.userId}`);

    return {
      sessionId: newSession.guuid,
      sessionToken: newSession.token,
      jwtToken: accessToken,
      expiresAt: accessTokenExpiresAt.toISOString(),
      refreshToken: newRefreshToken,
      refreshExpiresAt: newRefreshTokenExpiresAt.toISOString(),
      defaultStore: primaryStore ? { guuid: primaryStore.guuid } : null,
      offlineToken,
    };
  }

  async verifyClaims(jwtToken: string): Promise<VerifyClaimsResponse> {
    try {
      const payload = this.jwtConfigService.verifyToken(jwtToken);

      if (payload.aud !== JWT_AUDIENCE) {
        throw new UnauthorizedException({ errorCode: ErrorCodes.AUTH_INVALID_JWT_AUDIENCE, message: ErrorMessages[ErrorCodes.AUTH_INVALID_JWT_AUDIENCE] });
      }

      const user = await this.authUsersRepository.findByGuuid(payload.sub);
      if (!user) throw new UnauthorizedException({ errorCode: ErrorCodes.AUTH_USER_NOT_FOUND, message: ErrorMessages[ErrorCodes.AUTH_USER_NOT_FOUND] });

      const currentPermissions =
        await this.permissionsService.getUserPermissions(user.id);
      const currentRoles = currentPermissions.roles || [];
      const currentRoleCodes = currentRoles.map((r) => r.roleCode);

      const tokenRoles = payload.roles || [];
      const rolesChanged = !this.arraysEqual(
        [...currentRoleCodes].sort(),
        [...tokenRoles].sort(),
      );

      this.logger.log(
        `JWT claims verified for ${payload.sub}. Roles changed: ${rolesChanged}`,
      );

      return {
        isValid: true,
        sub: payload.sub,
        rolesChanged,
        currentRoles: currentRoleCodes,
        stores: currentRoles
          .filter((r) => r.storeId)
          .map((r) => ({ id: r.storeId, name: r.storeName })),
      };
    } catch (error) {
      this.logger.error(`JWT verification failed: ${error}`);
      return { isValid: false, rolesChanged: false };
    }
  }

  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => val === b[idx]);
  }
}
