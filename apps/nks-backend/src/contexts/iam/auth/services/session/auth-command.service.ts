import { Injectable, Logger } from '@nestjs/common';
import { SessionAuthValidator } from '../../validators';
import { SessionsRepository } from '../../repositories/sessions.repository';
import { SessionCommandService } from './session-command.service';
import { AuditCommandService } from '../../../../compliance/audit/audit-command.service';
import type { DeviceInfo } from '../../interfaces/device-info.interface';

@Injectable()
export class AuthCommandService {
  private readonly logger = new Logger(AuthCommandService.name);

  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly sessionCommand: SessionCommandService,
    private readonly auditCommand: AuditCommandService,
  ) {}

  async logout(token: string, userId: number): Promise<void> {
    await this.sessionCommand.invalidateSessionByToken(token);
    this.auditCommand.logLogout(userId);
  }

  async invalidateUserSessions(userId: number, reason = 'ROLE_CHANGE'): Promise<void> {
    const count = await this.sessionCommand.terminateAllSessions(userId);
    this.logger.log(`Invalidated ${count} session(s) for user ${userId}: ${reason}`);
  }

  async rotateSession(
    oldToken: string,
    userId: number,
    deviceInfo?: DeviceInfo,
  ): Promise<{ token: string; expiresAt: Date }> {
    const session = await this.sessionsRepository.findByToken(oldToken);
    SessionAuthValidator.assertSessionOwnership(session, userId);

    const newSession = await this.sessionCommand.createSessionForUser(userId, deviceInfo);
    await this.sessionsRepository.delete(session.id);
    return newSession;
  }

  async cleanupExpiredSessions(): Promise<{ deletedCount: number }> {
    const deletedCount = await this.sessionsRepository.deleteExpired();
    return { deletedCount };
  }
}
