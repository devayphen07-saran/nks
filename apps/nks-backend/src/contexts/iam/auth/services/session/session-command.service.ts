import { Injectable, Logger } from '@nestjs/common';
import { SessionRepository } from '../../repositories/session.repository';
import { SessionRevocationRepository } from '../../repositories/session-revocation.repository';
import { AuditCommandService } from '../../../../compliance/audit/audit-command.service';
import { SessionAuthValidator } from '../../validators';
import type { DbTransaction } from '../../../../../core/database/transaction.service';

@Injectable()
export class SessionCommandService {
  private readonly logger = new Logger(SessionCommandService.name);

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly sessionRevocationRepository: SessionRevocationRepository,
    private readonly auditCommand: AuditCommandService,
  ) {}

  async logout(token: string, userId: number): Promise<void> {
    const session = await this.sessionRepository.findByToken(token);
    if (!session) {
      this.logger.debug(
        `Logout called for user ${userId} but session not found — already expired or revoked`,
      );
      return;
    }
    SessionAuthValidator.assertSessionBelongsToUser(session, userId);
    await this.sessionRevocationRepository.revokeSession(session.id, 'LOGOUT');
    this.auditCommand.logLogout(userId);
  }

  async invalidateSession(sessionId: number): Promise<void> {
    await this.sessionRepository.delete(sessionId);
    this.logger.debug(`Session invalidated: ${sessionId}`);
  }

  async terminateSession(userId: number, sessionGuuid: string): Promise<void> {
    const session = await this.sessionRepository.findByGuuid(sessionGuuid);
    if (!session) {
      this.logger.debug(
        `terminateSession: session ${sessionGuuid} not found — already removed`,
      );
      return;
    }
    SessionAuthValidator.assertSessionBelongsToUser(session, userId);
    await this.sessionRevocationRepository.revokeSession(
      session.id,
      'TERMINATED',
    );
    this.logger.debug(`Session terminated by user: ${session.id}`);
  }

  async terminateAllSessions(userId: number): Promise<void> {
    await this.sessionRevocationRepository.revokeAllForUser(
      userId,
      'TERMINATED',
    );
    this.logger.debug(`All sessions terminated for user ${userId}`);
  }

  async updateActiveStore(
    sessionId: number,
    storeId: number,
    tx?: DbTransaction,
  ): Promise<void> {
    await this.sessionRepository.setActiveStore(sessionId, storeId, tx);
    this.logger.debug(
      `Session ${sessionId} active store updated to ${storeId}`,
    );
  }
}
