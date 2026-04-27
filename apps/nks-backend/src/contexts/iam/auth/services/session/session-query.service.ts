import { Injectable } from '@nestjs/common';
import { SessionsRepository } from '../../repositories/sessions.repository';
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
  constructor(private readonly sessionsRepository: SessionsRepository) {}

  async getUserSessions(userId: number): Promise<SessionInfoDto[]> {
    const sessions = await this.sessionsRepository.findActiveByUserId(userId);
    return sessions.map(SessionMapper.buildSessionInfoDtoFromRow);
  }

  async getSessionById(sessionId: number): Promise<UserSession | null> {
    return this.sessionsRepository.findById(sessionId);
  }

  async getSessionByToken(token: string): Promise<UserSession | null> {
    return this.sessionsRepository.findByToken(token);
  }
}
