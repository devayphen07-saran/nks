import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { SessionTokenRepository } from '../../repositories/session-token.repository';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
import { PermissionsService } from '../permissions/permissions.service';
import { AuthUtilsService } from '../shared/auth-utils.service';
import { SessionAuthValidator } from '../../validators';
import { InternalServerException } from '../../../../../common/exceptions';
import {
  ErrorCode,
  errPayload,
} from '../../../../../common/constants/error-codes.constants';
import { DeviceTypeEnum } from '../../../../../common/validators/session.validator';
import type { UserRoleEntry, PermissionContext } from '../../mapper/auth-mapper';
import type { DeviceInfo } from '../../interfaces/device-info.interface';

export interface SessionContext {
  /**
   * Numeric primary key of the user_session row.
   *
   * Use for backend writes that target a specific session (device
   * registration upsert, active-store updates, audit log linkage).
   * The guuid above is the public identifier exposed to clients.
   */
  id: number;
  token: string;
  expiresAt: Date;
  sessionGuuid: string;
  jti: string;
  csrfSecret: string;
  userRoles: UserRoleEntry[];
  userEmail: string | null;
  permissions: PermissionContext;
}

/**
 * SessionBootstrapService — application service for full session initialisation.
 *
 * Extracted from SessionService to give it a single clear responsibility:
 * take a BetterAuth session stub and enrich it with roles, permissions,
 * device fingerprint, store selection, and JTI before it is usable.
 *
 * SessionService handles session CRUD (create, find, terminate, revoke).
 * SessionBootstrapService handles the initial enrichment pipeline.
 */
@Injectable()
export class SessionBootstrapService {
  private readonly logger = new Logger(SessionBootstrapService.name);

  constructor(
    private readonly sessionTokenRepository: SessionTokenRepository,
    private readonly authUsersRepository: AuthUsersRepository,
    private readonly permissionsService: PermissionsService,
    private readonly authUtils: AuthUtilsService,
  ) {}

  async createForUser(
    userId: number,
    deviceInfo?: DeviceInfo,
  ): Promise<SessionContext> {
    // BREAKING: tied to better-auth@^1.6.2 internalAdapter API.
    const ctx = await this.authUtils.getBetterAuthContext();
    const session = await ctx.internalAdapter.createSession(String(userId));
    SessionAuthValidator.assertSessionCreated(session);

    try {
      const permissions = await this.permissionsService.getUserPermissions(userId);
      const userRoles = permissions.roles ?? [];

      const user = await this.authUsersRepository.findEmailAndGuuid(userId);
      if (!user?.guuid) {
        throw new InternalServerException(errPayload(ErrorCode.INTERNAL_SERVER_ERROR));
      }

      const rawType = deviceInfo?.deviceType?.toUpperCase();
      const validatedDeviceType =
        rawType && Object.values(DeviceTypeEnum).includes(rawType as DeviceTypeEnum)
          ? (rawType as DeviceTypeEnum)
          : null;

      const activeStoreFk = AuthUtilsService.resolveStoreIfMember(
        user.defaultStoreFk,
        userRoles,
      );

      const jti = crypto.randomUUID();
      const csrfSecret = crypto.randomBytes(32).toString('hex');

      const updatedSession = await this.sessionTokenRepository.updateByToken(session.token, {
        activeStoreFk,
        jti,
        csrfSecret,
        ...(deviceInfo
          ? {
              deviceId: deviceInfo.deviceId ?? null,
              deviceName: deviceInfo.deviceName ?? null,
              deviceType: validatedDeviceType,
              appVersion: deviceInfo.appVersion ?? null,
              ipAddress: deviceInfo.ipAddress ?? null,
              userAgent: deviceInfo.userAgent ?? null,
            }
          : {}),
      });

      if (!updatedSession?.guuid) {
        throw new InternalServerException(errPayload(ErrorCode.INTERNAL_SERVER_ERROR));
      }

      this.logger.log(`Session bootstrapped for user ${userId}.`);

      return {
        id: updatedSession.id,
        token: session.token,
        expiresAt: session.expiresAt,
        sessionGuuid: updatedSession.guuid,
        jti,
        csrfSecret,
        userRoles,
        userEmail: user.email,
        permissions,
      };
    } catch (err) {
      this.logger.error(
        `Session bootstrap failed for user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }
}
