import { Injectable } from '@nestjs/common';
import { SessionsRepository } from '../../repositories/sessions.repository';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';

@Injectable()
export class AuthQueryService {
  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly authUsersRepository: AuthUsersRepository,
  ) {}

  async checkSessionStatus(
    token: string,
  ): Promise<{ active: boolean; revoked: boolean; wipe: boolean }> {
    const session = await this.sessionsRepository.findByToken(token);

    if (!session) return { active: false, revoked: true, wipe: false };

    if (session.refreshTokenRevokedAt) {
      return { active: false, revoked: true, wipe: false };
    }

    const user = await this.authUsersRepository.findById(Number(session.userFk));
    if (user?.isBlocked) {
      return { active: false, revoked: true, wipe: true };
    }

    return { active: true, revoked: false, wipe: false };
  }
}
