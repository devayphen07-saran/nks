import { Injectable, Logger } from '@nestjs/common';
import { SessionAuthValidator } from '../../validators';
import { SessionRepository } from '../../repositories/session.repository';
import { SessionContextRepository } from '../../repositories/session-context.repository';
import { SessionCommandService } from './session-command.service';
import { SessionBootstrapService } from './session-bootstrap.service';
import { AuditCommandService } from '../../../../compliance/audit/audit-command.service';
import type { DeviceInfo } from '../../interfaces/device-info.interface';

@Injectable()
export class AuthCommandService {
  private readonly logger = new Logger(AuthCommandService.name);

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly sessionContextRepository: SessionContextRepository,
    private readonly sessionCommand: SessionCommandService,
    private readonly sessionBootstrap: SessionBootstrapService,
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
    const session = await this.sessionRepository.findByToken(oldToken);
    SessionAuthValidator.assertSessionOwnership(session, userId);

    const newSession = await this.sessionBootstrap.createForUser(userId, deviceInfo);
    await this.sessionRepository.delete(session.id);
    return newSession;
  }

  async cleanupExpiredSessions(): Promise<{ deletedCount: number }> {
    const deletedCount = await this.sessionContextRepository.deleteExpired();
    return { deletedCount };
  }
}
