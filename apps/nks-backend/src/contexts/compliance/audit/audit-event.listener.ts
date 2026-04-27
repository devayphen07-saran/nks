import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditEvents } from '../../../common/events/audit.events';
import { AuditRepository } from './repositories/audit.repository';
import type { AuditLogEntry } from './audit-command.service';

/**
 * Handles audit.log events off the hot path.
 *
 * AuditService.log() emits the event synchronously and returns immediately.
 * This listener processes the DB write asynchronously so failures here
 * never propagate back to the caller (login, logout, role update, etc.).
 */
@Injectable()
export class AuditEventListener {
  private readonly logger = new Logger(AuditEventListener.name);

  constructor(private readonly auditRepository: AuditRepository) {}

  @OnEvent(AuditEvents.LOG, { async: true, suppressErrors: false })
  async handleAuditLog(entry: AuditLogEntry): Promise<void> {
    try {
      await this.auditRepository.create({
        userFk: entry.userId,
        action: entry.action,
        entityType: entry.resourceType ?? null,
        entityId: entry.resourceId ? Number(entry.resourceId) : null,
        meta: entry.metadata ?? null,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
        isSuccess: entry.severity !== 'critical',
        failureReason: entry.severity === 'critical' ? entry.description : null,
      });

      const logLevel = entry.severity === 'critical' ? 'error' : 'log';
      this.logger[logLevel](
        `[AUDIT] ${entry.action} | User: ${entry.userId} | ${entry.description}`,
        entry.metadata,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (entry.severity === 'critical') {
        // Critical audit loss is a compliance event — log with a distinct prefix
        // so alerting rules can match it independently of other DB errors.
        this.logger.error(
          `[AUDIT-CRITICAL-LOSS] COMPLIANCE RISK — failed to persist critical audit event: ${entry.action} for user ${entry.userId}. Manual recovery required.`,
          { action: entry.action, userId: entry.userId, description: entry.description, err: errMsg },
        );
      } else {
        this.logger.error(`Failed to write audit log for ${entry.action}`, errMsg);
      }
    }
  }
}
