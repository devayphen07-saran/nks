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
 * Unified auth flow: create session → generate tokens → build auth envelope.
 * Called by PasswordAuthService (login/register) and OtpAuthOrchestrator.
 */
export async function executeAuthFlow(
  user: AuthUserContext,
  deviceInfo: DeviceInfo | undefined,
  sessions: SessionCommandService,
  tokens: TokenService,
): Promise<AuthResponseEnvelope> {
  const session = await sessions.createSessionForUser(user.id, deviceInfo);

  const tokenPair = await tokens.createTokenPair(
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

  return tokens.buildAuthResponse(
    user,
    session.token,
    session.expiresAt,
    session.sessionGuuid,
    tokenPair,
    session.permissions,
    deviceInfo?.deviceId,
  );
}
