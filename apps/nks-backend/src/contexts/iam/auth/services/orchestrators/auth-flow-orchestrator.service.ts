import { Injectable, Logger } from '@nestjs/common';
import { InternalServerException } from '../../../../../common/exceptions';
import { ErrorCode, errPayload } from '../../../../../common/constants/error-codes.constants';
import { SessionBootstrapService } from '../session/session-bootstrap.service';
import type { SessionContext } from '../session/session-bootstrap.service';
import { TokenService } from '../token/token.service';
import { RoleQueryService } from '../../../roles/role-query.service';
import { AuthUtilsService } from '../shared/auth-utils.service';
import { OfflineTokenService } from '../token/offline-token.service';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
import { DeviceRegistrationFlowService } from '../device/device-registration-flow.service';
import { AuthMapper } from '../../mapper/auth-mapper';
import type { TokenPair, UserRoleEntry } from '../../mapper/auth-mapper';
import type { AuthResponseEnvelope } from '../../dto';
import type { DeviceInfo } from '../../interfaces/device-info.interface';
import { DeviceDetector } from '../../../../../common/utils/device-detector';
import { SystemRoleCodes } from '../../../../../common/constants/system-role-codes.constant';

export interface AuthUserContext {
  id: number;
  guuid: string;
  iamUserId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  emailVerified: boolean;
  image: string | null | undefined;
  phoneNumber: string | null | undefined;
  phoneNumberVerified: boolean;
  defaultStoreFk?: number | null;
}

/**
 * AuthFlowOrchestratorService — Unified auth flow orchestration.
 *
 * Handles: create session → issue tokens → build auth envelope.
 * Called by PasswordAuthService (login/register) and OtpAuthOrchestratorService.
 */
@Injectable()
export class AuthFlowOrchestratorService {
  private readonly logger = new Logger(AuthFlowOrchestratorService.name);

  constructor(
    private readonly bootstrap: SessionBootstrapService,
    private readonly tokens: TokenService,
    private readonly roleQuery: RoleQueryService,
    private readonly authUtils: AuthUtilsService,
    private readonly offlineTokenService: OfflineTokenService,
    private readonly authUsersRepo: AuthUsersRepository,
    private readonly deviceRegistrationFlow: DeviceRegistrationFlowService,
  ) {}

  async execute(
    user: AuthUserContext,
    deviceInfo: DeviceInfo | undefined,
  ): Promise<{ envelope: AuthResponseEnvelope; csrfSecret: string }> {
    if (!user.guuid || !user.iamUserId) {
      throw new InternalServerException(errPayload(ErrorCode.INTERNAL_SERVER_ERROR));
    }

    const isMobile = DeviceDetector.isMobile(deviceInfo?.deviceType);
    const session = await this.createSession(user, deviceInfo);
    const tokenPair = await this.issueTokens(session);
    const envelope = await this.buildEnvelope(user, session, tokenPair, isMobile);

    // Single canonical place to register the device for the user's active
    // store after authentication. Covers password login, OTP login, and
    // register flows. Idempotent upsert at the data layer — safe to retry.
    await this.registerDeviceIfPossible(session.id, deviceInfo?.deviceId ?? null);

    return { envelope, csrfSecret: session.csrfSecret };
  }

  private async registerDeviceIfPossible(
    sessionId: number,
    deviceId: string | null,
  ): Promise<void> {
    if (!deviceId) return;
    try {
      await this.deviceRegistrationFlow.registerAfterLogin(String(sessionId), deviceId);
    } catch (err) {
      // Device registration failure must not block login — the session is
      // still valid. The device will register on the next /sync/pull retry
      // path or via /auth/switch-store. Log and proceed.
      this.logger.error(
        `Device registration failed for session ${sessionId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ─── Private Steps ─────────────────────────────────────────────────────────

  private createSession(user: AuthUserContext, deviceInfo: DeviceInfo | undefined): Promise<SessionContext> {
    return this.bootstrap.createForUser(user.id, deviceInfo);
  }

  private issueTokens(session: SessionContext): Promise<TokenPair> {
    return this.tokens.createTokenPair({ sessionToken: session.token });
  }

  private async buildEnvelope(
    user: AuthUserContext,
    session: SessionContext,
    tokenPair: TokenPair,
    isMobile: boolean,
  ): Promise<AuthResponseEnvelope> {
    const roles = session.permissions.roles ?? [];
    const defaultStoreFk = await this.authUsersRepo.findDefaultStoreId(user.id);
    const primaryStore = await this.resolvePrimaryStore(user.id, defaultStoreFk, roles);
    const primaryStoreId = primaryStore ? (defaultStoreFk ?? null) : null;
    const offline = this.offlineTokenService.buildIfMobile(
      {
        userId: user.id,
        guuid: user.guuid,
        iamUserId: user.iamUserId,
        email: user.email,
      },
      session.sessionGuuid,
      roles,
      primaryStoreId,
      isMobile,
    );

    return AuthMapper.buildAuthResponseEnvelope({
      authResult: {
        user: {
          id: user.id,
          guuid: user.guuid,
          iamUserId: user.iamUserId,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber ?? null,
        },
        bearerToken: session.token,
      },
      tokenPair,
      defaultStore: primaryStore,
      sessionId: session.sessionGuuid,
      sessionExpiresAt: session.expiresAt,
      refreshTokenExpiresAt: tokenPair.refreshTokenExpiresAt,
      offline,
    });
  }

  private async resolvePrimaryStore(
    userId: number,
    defaultStoreFk: number | null | undefined,
    roles: UserRoleEntry[],
  ): Promise<{ id: number; guuid: string } | null> {
    if (!defaultStoreFk || !roles.some((r) => r.storeId === defaultStoreFk)) return null;
    const roleId = await this.authUtils.getCachedSystemRoleId(SystemRoleCodes.STORE_OWNER);
    if (!roleId) return null;
    return this.roleQuery.findPrimaryStoreForUser(userId, roleId);
  }
}
