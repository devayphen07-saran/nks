import { Injectable } from '@nestjs/common';
import { SessionCommandService } from '../session/session-command.service';
import { TokenService } from '../token/token.service';
import type { AuthResponseEnvelope } from '../../dto';
import type { DeviceInfo } from '../../interfaces/device-info.interface';

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
 * Handles: create session → generate tokens → build auth envelope.
 * Called by PasswordAuthService (login/register) and OtpAuthOrchestratorService.
 */
@Injectable()
export class AuthFlowOrchestratorService {
  constructor(
    private readonly sessions: SessionCommandService,
    private readonly tokens: TokenService,
  ) {}

  async execute(
    user: AuthUserContext,
    deviceInfo: DeviceInfo | undefined,
  ): Promise<AuthResponseEnvelope> {
    const session = await this.sessions.createSessionForUser(user.id, deviceInfo);

    const tokenPair = await this.tokens.createTokenPair(
      user.guuid,
      session.token,
      session.userRoles,
      session.userEmail,
      session.sessionGuuid,
      session.jti,
      user.iamUserId,
      user.firstName,
      user.lastName,
    );

    return this.tokens.buildAuthResponse(
      user,
      session.token,
      session.expiresAt,
      session.sessionGuuid,
      tokenPair,
      session.permissions,
      deviceInfo?.deviceId,
    );
  }
}

// Backward compatibility: standalone function wrapper
export async function executeAuthFlow(
  user: AuthUserContext,
  deviceInfo: DeviceInfo | undefined,
  sessions: SessionCommandService,
  tokens: TokenService,
): Promise<AuthResponseEnvelope> {
  const service = new AuthFlowOrchestratorService(sessions, tokens);
  return service.execute(user, deviceInfo);
}
