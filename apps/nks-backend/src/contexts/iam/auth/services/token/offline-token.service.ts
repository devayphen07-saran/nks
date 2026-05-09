import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JWTConfigService } from '../../../../../config/jwt.config';
import { signOfflineSession } from '../../../../../common/utils/offline-session-hmac';
import { JWT_AUDIENCE, OFFLINE_TOKEN_TTL_MS } from '../../auth.constants';
import type { UserRoleEntry } from '../../mapper/auth-mapper';

export interface OfflineCredentials {
  token: string;
  sessionSignature: string;
}

export interface OfflineUserContext {
  userId: number;
  guuid: string;
  iamUserId: string;
  email: string | null;
}

@Injectable()
export class OfflineTokenService {
  private readonly logger = new Logger(OfflineTokenService.name);
  private readonly offlineHmacSecret: string;

  constructor(
    private readonly jwtConfig: JWTConfigService,
    private readonly configService: ConfigService,
  ) {
    this.offlineHmacSecret = this.configService.getOrThrow<string>(
      'OFFLINE_SESSION_HMAC_SECRET',
    );
  }

  build(
    user: OfflineUserContext,
    sessionGuuid: string,
    roles: UserRoleEntry[],
    activeStoreId: number | null,
  ): OfflineCredentials {
    const roleCodes = roles.map((r) => r.roleCode);
    const ttlSeconds = Math.floor(OFFLINE_TOKEN_TTL_MS / 1000);

    const token = this.jwtConfig.signOfflineToken(
      {
        sub: user.guuid,
        sid: sessionGuuid,
        jti: crypto.randomUUID(),
        iamUserId: user.iamUserId,
        ...(user.email ? { email: user.email } : {}),
        roles: roleCodes,
        iss: 'nks-auth',
        aud: JWT_AUDIENCE,
      },
      ttlSeconds,
    );

    const sessionSignature = signOfflineSession(
      {
        userId: user.userId,
        storeId: activeStoreId,
        roles: roleCodes,
        offlineValidUntil: Date.now() + OFFLINE_TOKEN_TTL_MS,
      },
      this.offlineHmacSecret,
    );

    return { token, sessionSignature };
  }

  buildIfMobile(
    user: OfflineUserContext,
    sessionGuuid: string,
    roles: UserRoleEntry[],
    activeStoreId: number | null,
    isMobile: boolean,
  ): OfflineCredentials | null {
    if (!isMobile) return null;
    return this.build(user, sessionGuuid, roles, activeStoreId);
  }
}
