import { Injectable, Logger } from '@nestjs/common';
import { SessionRepository } from '../../repositories/session.repository';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';

@Injectable()
export class AuthQueryService {
  private readonly logger = new Logger(AuthQueryService.name);

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly authUsersRepository: AuthUsersRepository,
  ) {}

  async checkSessionStatus(
    token: string,
    requestDeviceId: string | null,
  ): Promise<{ active: boolean; revoked: boolean; wipe: boolean }> {
    const session = await this.sessionRepository.findByToken(token);

    if (!session) return { active: false, revoked: true, wipe: false };

    // Device binding for the public probe endpoint. Without this an attacker
    // holding a stolen token can probe its status without triggering
    // device-mismatch alerts on a real authenticated route. We don't reveal
    // "wrong device" — return revoked, same as any other invalid case, so the
    // endpoint isn't an oracle for token-without-device validity.
    if (session.deviceId && session.deviceId !== requestDeviceId) {
      return { active: false, revoked: true, wipe: false };
    }

    if (session.refreshTokenRevokedAt) {
      return { active: false, revoked: true, wipe: false };
    }

    const user = await this.authUsersRepository.findById(Number(session.userId));
    if (user?.isBlocked) {
      return { active: false, revoked: true, wipe: true };
    }

    return { active: true, revoked: false, wipe: false };
  }
}
