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
  ): Promise<{ active: boolean; revoked: boolean; wipe: boolean }> {
    const session = await this.sessionRepository.findByToken(token);

    if (!session) return { active: false, revoked: true, wipe: false };

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
