import { Injectable } from '@nestjs/common';
import { SessionRepository } from '../../repositories/session.repository';
import { SessionMapper } from '../../mapper/session.mapper';
import type { UserSession } from '../../../../../core/database/schema/auth/user-session';
import type { SessionInfoDto } from '../../dto';

export interface PublicSession {
  guuid: string;
  deviceId?: string;
  deviceName?: string;
  deviceType?: string;
  platform?: string;
  appVersion?: string;
  expiresAt: Date;
  createdAt: Date;
}

@Injectable()
export class SessionQueryService {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async getUserSessions(userId: number): Promise<SessionInfoDto[]> {
    const sessions = await this.sessionRepository.findActiveByUserId(userId);
    return sessions.map(SessionMapper.buildSessionInfoDtoFromRow);
  }

  async getSessionById(sessionId: number): Promise<UserSession | null> {
    return this.sessionRepository.findById(sessionId);
  }

  async getSessionByToken(token: string): Promise<UserSession | null> {
    return this.sessionRepository.findByToken(token);
  }
}
