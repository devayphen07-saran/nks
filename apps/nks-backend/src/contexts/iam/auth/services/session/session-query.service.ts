import { Injectable, Logger } from '@nestjs/common';
import { SessionRepository } from '../../repositories/session.repository';
import { SessionMapper } from '../../mapper/session.mapper';
import type { SessionInfoDto } from '../../dto';

@Injectable()
export class SessionQueryService {
  private readonly logger = new Logger(SessionQueryService.name);

  constructor(private readonly sessionRepository: SessionRepository) {}

  async getUserSessions(userId: number): Promise<SessionInfoDto[]> {
    const sessions = await this.sessionRepository.findActiveByUserId(userId);
    return sessions.map(SessionMapper.buildSessionInfoDtoFromRow);
  }

  /**
   * Find a session by sessionId (string).
   * Used by device registration flow to look up userId and activeStoreFk after login.
   */
  async findSessionByIdString(sessionId: string): Promise<{ userId: number; activeStoreFk: number | null } | null> {
    const id = parseInt(sessionId, 10);
    if (Number.isNaN(id)) {
      return null;
    }
    const session = await this.sessionRepository.findById(id);
    if (!session) {
      return null;
    }
    return {
      userId: session.userId,
      activeStoreFk: session.activeStoreFk,
    };
  }
}
