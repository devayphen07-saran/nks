import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditCommandService } from '../../../../compliance/audit/audit-command.service';
import { SessionEvents } from '../../../../../common/events/session.events';

export interface Session {
  id: number;
  userId: number;
  refreshTokenRevokedAt: Date | null;
}

/**
 * TokenTheftDetectionService
 *
 * Detects and handles token theft scenarios:
 *   - Reuse of a rotated refresh token (refreshTokenRevokedAt !== null)
 *
 * Responsibilities:
 *   1. Detect theft condition
 *   2. Log to audit trail (compliance facing)
 *   3. Emit SessionEvents.REVOKE_ALL_FOR_USER (for asynchronous cleanup of all user sessions)
 *
 * Security-critical: This service is part of the token rotation hardening.
 * Token reuse after rotation is a strong indicator of device compromise.
 */
@Injectable()
export class TokenTheftDetectionService {
  private readonly logger = new Logger(TokenTheftDetectionService.name);

  constructor(
    private readonly auditService: AuditCommandService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Detects if a session has been compromised via refresh token reuse.
   *
   * If the session's refreshTokenRevokedAt is set, it means the refresh token
   * was already rotated and revoked. An attempt to reuse it indicates theft.
   *
   * On detection:
   *   - Logs critical error to application logs
   *   - Records in audit trail (compliance/security queries this table)
   *   - Emits event to revoke all sessions for the user (async cleanup)
   *
   * @param session The session that was attempted to be refreshed
   * @returns true if theft was detected (and handled), false otherwise
   */
  detectAndHandleTheft(session: Session): boolean {
    if (session.refreshTokenRevokedAt === null) {
      return false;
    }

    // Theft detected
    this.logger.error(
      `TOKEN THEFT DETECTED: User ${session.userId} reused rotated refresh token. Session ${session.id} compromised.`,
      {
        sessionId: session.id,
        revokedAt: session.refreshTokenRevokedAt,
        attemptedAt: new Date(),
      },
    );

    // Emit to audit trail — structured log alone is not enough: the audit
    // table is the security-facing record that compliance tools query.
    this.auditService.log({
      action: 'TOKEN_REVOKE',
      userId: session.userId,
      description: 'TOKEN THEFT: refresh token reused after rotation — all sessions force-terminated',
      severity: 'critical',
      resourceType: 'session',
      resourceId: session.id,
      metadata: {
        sessionId: session.id,
        revokedAt: session.refreshTokenRevokedAt,
        reason: 'TOKEN_THEFT_DETECTED',
      },
    });

    // Fan out full session cleanup off the hot path — the compromised session is
    // already marked (refreshTokenRevokedAt set), so further reuse is rejected
    // before the listener fires. Other sessions are cleaned up asynchronously.
    this.eventEmitter.emit(SessionEvents.REVOKE_ALL_FOR_USER, {
      userId: session.userId,
      reason: 'TOKEN_REUSE',
    });

    return true;
  }
}
