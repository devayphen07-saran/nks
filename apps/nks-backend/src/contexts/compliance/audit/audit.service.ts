import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { AuditRepository } from './repositories/audit.repository';
import { AuditValidator } from './validators/audit.validator';
import { AuditMapper } from './mapper/audit.mapper';
import { AuditEvents } from '../../../common/events/audit.events';
import { NotFoundException } from '../../../common/exceptions';
import {
  ErrorCode,
  errPayload,
} from '../../../common/constants/error-codes.constants';
import type { PaginatedResult } from '../../../common/utils/paginated-result';
import { paginated } from '../../../common/utils/paginated-result';
import type { AuditListQuery } from './dto/requests';
import type { AuditLogResponseDto } from './dto/responses';
import type { NewAuditLog } from '../../../core/database/schema/audit-log';

type AuditAction = NewAuditLog['action'];

export interface AuditLogEntry {
  action: AuditAction;
  userId: number;
  description: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  severity?: 'info' | 'warning' | 'critical';
  resourceType?: string;
  resourceId?: string | number;
}

/**
 * Audit Service
 *
 * Logs all security-relevant events for compliance and forensics:
 * - Authentication events (login, logout, OTP verify)
 * - Permission changes (grant, revoke)
 * - Token events (refresh, theft detection)
 * - Super Admin actions (break-glass, sensitive operations)
 * - Device/session events
 */
@Injectable()
export class AuditService {
  constructor(
    private readonly auditRepository: AuditRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Emit an audit event — returns immediately, DB write happens off the hot path.
   * AuditEventListener handles the actual insert and application-level logging.
   */
  log(entry: AuditLogEntry): void {
    this.eventEmitter.emit(AuditEvents.LOG, entry);
  }

  logLogout(userId: number, reason?: string): void {
    this.log({
      action: 'LOGOUT',
      userId,
      description: reason || 'User logged out',
      severity: 'info',
    });
  }

  logTokenTheftDetected(userId: number, sessionId: string): void {
    this.log({
      action: 'ACCOUNT_BLOCKED',
      userId,
      description: `Refresh token reuse detected - all sessions terminated`,
      metadata: { sessionId },
      severity: 'critical',
      resourceType: 'session',
      resourceId: sessionId,
    });
  }

  logPermissionGrant(userId: number, grantedBy: number, entityCode: string, action: string): void {
    this.log({
      action: 'PERMISSION_GRANTED',
      userId,
      description: `Permission granted for ${entityCode}.${action} by user ${grantedBy}`,
      metadata: { grantedBy, entityCode, action },
      severity: 'info',
      resourceType: 'permission',
      resourceId: `${entityCode}:${action}`,
    });
  }

  logPermissionRevoke(userId: number, revokedBy: number, entityCode: string, action: string): void {
    this.log({
      action: 'PERMISSION_REVOKED',
      userId,
      description: `Permission revoked for ${entityCode}.${action} by user ${revokedBy}`,
      metadata: { revokedBy, entityCode, action },
      severity: 'warning',
      resourceType: 'permission',
      resourceId: `${entityCode}:${action}`,
    });
  }

  logBreakGlassAccess(userId: number, action: string, reason: string, affectedUserId?: number): void {
    this.log({
      action: 'UPDATE',
      userId,
      description: `[BREAK-GLASS] ${action}: ${reason}`,
      metadata: { affectedUserId, action, reason },
      severity: 'critical',
      resourceType: 'user',
      resourceId: affectedUserId || userId,
    });
  }

  logSuperAdminAction(userId: number, action: string, resourceType: string, resourceId: string | number, details?: Record<string, unknown>): void {
    this.log({
      action: 'UPDATE',
      userId,
      description: `Super Admin performed: ${action} on ${resourceType}`,
      metadata: { action, resourceType, resourceId, details },
      severity: 'warning',
      resourceType,
      resourceId,
    });
  }

  logStoreDataAccess(userId: number, storeId: number, action: 'read' | 'create' | 'update' | 'delete', entityType: string, entityId?: string | number, details?: Record<string, unknown>): void {
    this.log({
      action: 'UPDATE',
      userId,
      description: `User ${action} ${entityType} in store ${storeId}`,
      metadata: { storeId, action, entityType, entityId, ...details },
      severity: 'info',
      resourceType: `${entityType}@store${storeId}`,
      resourceId: entityId || storeId,
    });
  }

  logRoleCreated(actorId: number, roleId: number, roleCode: string, storeId: number): void {
    this.log({
      action: 'CREATE',
      userId: actorId,
      description: `Role '${roleCode}' created for store ${storeId}`,
      metadata: { roleId, roleCode, storeId },
      severity: 'info',
      resourceType: 'role',
      resourceId: roleId,
    });
  }

  logRoleUpdated(actorId: number, roleId: number, roleCode: string, changes: Record<string, unknown>): void {
    this.log({
      action: 'UPDATE',
      userId: actorId,
      description: `Role '${roleCode}' updated`,
      metadata: { roleId, roleCode, changes },
      severity: 'info',
      resourceType: 'role',
      resourceId: roleId,
    });
  }

  logEntityPermissionChanged(actorId: number, roleId: number, entityCode: string, newPerms: Record<string, boolean>): void {
    this.log({
      action: 'PERMISSION_GRANTED',
      userId: actorId,
      description: `Permissions for '${entityCode}' updated on role ${roleId}`,
      metadata: { roleId, entityCode, newPerms },
      severity: 'warning',
      resourceType: 'role_permission',
      resourceId: roleId,
    });
  }

  // ─── Reference-data CRUD audit helpers ──────────────────────────────────

  logCodeCategoryCreated(actorId: number, categoryId: number, code: string): void {
    this.log({ action: 'CREATE', userId: actorId, description: `Code category '${code}' created`, metadata: { categoryId, code }, severity: 'info', resourceType: 'code_category', resourceId: categoryId });
  }

  logCodeValueCreated(actorId: number, valueId: number, code: string, categoryCode: string): void {
    this.log({ action: 'CREATE', userId: actorId, description: `Code value '${code}' created in '${categoryCode}'`, metadata: { valueId, code, categoryCode }, severity: 'info', resourceType: 'code_value', resourceId: valueId });
  }

  logCodeValueUpdated(actorId: number, valueId: number, changes: Record<string, unknown>): void {
    this.log({ action: 'UPDATE', userId: actorId, description: `Code value ${valueId} updated`, metadata: { valueId, changes }, severity: 'info', resourceType: 'code_value', resourceId: valueId });
  }

  logCodeValueDeleted(actorId: number, valueId: number): void {
    this.log({ action: 'DELETE', userId: actorId, description: `Code value ${valueId} deleted`, metadata: { valueId }, severity: 'info', resourceType: 'code_value', resourceId: valueId });
  }

  logStatusCreated(actorId: number, guuid: string, code: string): void {
    this.log({ action: 'CREATE', userId: actorId, description: `Status '${code}' created`, metadata: { guuid, code }, severity: 'info', resourceType: 'status', resourceId: guuid });
  }

  logStatusUpdated(actorId: number, guuid: string, code: string, changes: Record<string, unknown>): void {
    this.log({ action: 'UPDATE', userId: actorId, description: `Status '${code}' updated`, metadata: { guuid, code, changes }, severity: 'info', resourceType: 'status', resourceId: guuid });
  }

  logStatusDeleted(actorId: number, guuid: string, code: string): void {
    this.log({ action: 'DELETE', userId: actorId, description: `Status '${code}' deleted`, metadata: { guuid, code }, severity: 'info', resourceType: 'status', resourceId: guuid });
  }

  logLookupValueCreated(actorId: number, valueId: number, categoryCode: string): void {
    this.log({ action: 'CREATE', userId: actorId, description: `Lookup value ${valueId} created in '${categoryCode}'`, metadata: { valueId, categoryCode }, severity: 'info', resourceType: 'lookup_value', resourceId: valueId });
  }

  logLookupValueUpdated(actorId: number, valueId: number, categoryCode: string): void {
    this.log({ action: 'UPDATE', userId: actorId, description: `Lookup value ${valueId} updated in '${categoryCode}'`, metadata: { valueId, categoryCode }, severity: 'info', resourceType: 'lookup_value', resourceId: valueId });
  }

  logLookupValueDeleted(actorId: number, valueId: number, categoryCode: string): void {
    this.log({ action: 'DELETE', userId: actorId, description: `Lookup value ${valueId} deleted from '${categoryCode}'`, metadata: { valueId, categoryCode }, severity: 'info', resourceType: 'lookup_value', resourceId: valueId });
  }

  logEntityStatusAssigned(actorId: number, entityCode: string, statusCode: string): void {
    this.log({ action: 'CREATE', userId: actorId, description: `Status '${statusCode}' assigned to entity '${entityCode}'`, metadata: { entityCode, statusCode }, severity: 'info', resourceType: 'entity_status', resourceId: `${entityCode}:${statusCode}` });
  }

  logEntityStatusRemoved(actorId: number, entityCode: string, statusCode: string): void {
    this.log({ action: 'DELETE', userId: actorId, description: `Status '${statusCode}' removed from entity '${entityCode}'`, metadata: { entityCode, statusCode }, severity: 'info', resourceType: 'entity_status', resourceId: `${entityCode}:${statusCode}` });
  }

  /**
   * Get audit logs with filtering and pagination.
   */
  async listLogs(query: AuditListQuery): Promise<PaginatedResult<AuditLogResponseDto>> {
    const { rows, total } = await this.auditRepository.findPage({
      page: query.page,
      pageSize: query.pageSize,
      userGuuid: query.userGuuid,
      storeGuuid: query.storeGuuid,
      action: query.action,
      entityType: query.entityType,
      isSuccess: query.isSuccess,
      fromDate: query.fromDate,
      toDate: query.toDate,
    });
    return paginated({ items: rows.map(AuditMapper.buildAuditLogDto), page: query.page, pageSize: query.pageSize, total });
  }

  /**
   * Get a single audit log by guuid.
   */
  async getByGuuid(auditGuuid: string): Promise<AuditLogResponseDto> {
    const row = await this.auditRepository.findByGuuid(auditGuuid);
    if (!row) throw new NotFoundException(errPayload(ErrorCode.AUDIT_LOG_NOT_FOUND));
    return AuditMapper.buildAuditLogDto(row);
  }
}
