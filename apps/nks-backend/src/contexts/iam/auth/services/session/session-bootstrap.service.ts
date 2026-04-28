import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionsRepository } from '../../repositories/sessions.repository';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
import { PermissionsService } from '../permissions/permissions.service';
import { AuthUtilsService } from '../shared/auth-utils.service';
import { SessionAuthValidator } from '../../validators';
import { InternalServerException } from '../../../../../common/exceptions';
import { DeviceTypeEnum } from '../../../../../common/validators/session.validator';
import type { UserRoleEntry } from '../../mapper/auth-mapper';
import type { DeviceInfo } from '../../interfaces/device-info.interface';

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
  private readonly ipHmacSecret: string;

  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly authUsersRepository: AuthUsersRepository,
    private readonly permissionsService: PermissionsService,
    private readonly authUtils: AuthUtilsService,
    private readonly configService: ConfigService,
  ) {
    this.ipHmacSecret = this.configService.getOrThrow<string>('IP_HMAC_SECRET');
  }

  async createForUser(
    userId: number,
    deviceInfo?: DeviceInfo,
  ): Promise<{
    token: string;
    expiresAt: Date;
    sessionGuuid: string;
    jti: string;
    userRoles: UserRoleEntry[];
    userEmail: string;
    permissions: Awaited<ReturnType<PermissionsService['getUserPermissions']>>;
  }> {
    // BREAKING: tied to better-auth@^1.6.2 internalAdapter API.
    const ctx = await this.authUtils.getBetterAuthContext();
    const session = await ctx.internalAdapter.createSession(String(userId));
    SessionAuthValidator.assertSessionCreated(session);

    try {
      const permissions = await this.permissionsService.getUserPermissions(userId);
      const userRoles = permissions.roles ?? [];

      const user = await this.authUsersRepository.findEmailAndGuuid(userId);
      if (!user?.guuid) {
        throw new InternalServerException('User record missing guuid — cannot sign JWT');
      }

      const roleHash = this.authUtils.hashRoles(userRoles);

      const rawType = deviceInfo?.deviceType?.toUpperCase();
      const validatedDeviceType =
        rawType && Object.values(DeviceTypeEnum).includes(rawType as DeviceTypeEnum)
          ? (rawType as DeviceTypeEnum)
          : null;

      const ipHash = deviceInfo?.ipAddress
        ? crypto.createHmac('sha256', this.ipHmacSecret).update(deviceInfo.ipAddress).digest('hex')
        : null;

      const defaultStoreId = user.defaultStoreFk ?? null;
      const activeStoreFk =
        defaultStoreId !== null && userRoles.some((r) => r.storeId === defaultStoreId)
          ? defaultStoreId
          : null;

      const jti = crypto.randomUUID();
      const csrfSecret = crypto.randomBytes(32).toString('hex');

      const updatedSession = await this.sessionsRepository.updateByToken(session.token, {
        roleHash,
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
              ipHash,
            }
          : {}),
      });

      if (!updatedSession?.guuid) {
        throw new InternalServerException('Session update failed — cannot proceed without session guuid');
      }

      this.logger.log(`Session bootstrapped for user ${userId}.`);

      return {
        token: session.token,
        expiresAt: session.expiresAt,
        sessionGuuid: updatedSession.guuid,
        jti,
        userRoles,
        userEmail: user.email ?? '',
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
