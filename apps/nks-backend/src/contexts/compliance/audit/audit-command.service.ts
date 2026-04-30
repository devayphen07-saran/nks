import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditEvents } from '../../../common/events/audit.events';
import { SYSTEM_USER_ID } from '../../../common/constants/app-constants';
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

@Injectable()
export class AuditCommandService {
  private readonly logger = new Logger(AuditCommandService.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Emit an audit event for async persistence by AuditEventListener.
   *
   * Caller-safety: emit() is wrapped in try/catch so that an audit emission
   * failure (serialization error, listener throw with suppressErrors:false)
   * NEVER breaks the business operation that triggered it. Failures are
   * logged with [AUDIT-EMIT-FAIL] prefix for ops monitoring. The persistence
   * listener has its own [AUDIT-CRITICAL-LOSS] alert for DB write failures.
   */
  log(entry: AuditLogEntry): void {
    try {
      this.eventEmitter.emit(AuditEvents.LOG, entry);
    } catch (e: unknown) {
      this.logger.error(
        `[AUDIT-EMIT-FAIL] action=${entry.action} userId=${entry.userId} resource=${entry.resourceType ?? 'n/a'}:${entry.resourceId ?? 'n/a'} err=${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  // ─── Authentication ──────────────────────────────────────────────────────────

  logLogin(userId: number, ipAddress?: string, userAgent?: string): void {
    this.log({
      action: 'CREATE',
      userId,
      description: 'User logged in',
      ipAddress,
      userAgent,
      severity: 'info',
      resourceType: 'session',
      resourceId: userId,
    });
  }

  logFailedLogin(email: string, ipAddress?: string, userAgent?: string, reason?: string): void {
    this.log({
      action: 'DELETE',
      userId: SYSTEM_USER_ID, // failed login has no authenticated actor
      description: `Failed login attempt for ${email}${reason ? `: ${reason}` : ''}`,
      metadata: { email, reason },
      ipAddress,
      userAgent,
      severity: 'warning',
      resourceType: 'authentication',
      resourceId: email,
    });
  }

  logLogout(userId: number, reason?: string): void {
    this.log({ action: 'LOGOUT', userId, description: reason || 'User logged out', severity: 'info' });
  }

  // ─── Session Management ──────────────────────────────────────────────────────

  logSessionCreated(userId: number, sessionId: number, ipAddress?: string, userAgent?: string): void {
    this.log({
      action: 'CREATE',
      userId,
      description: 'Session created',
      metadata: { sessionId },
      ipAddress,
      userAgent,
      severity: 'info',
      resourceType: 'session',
      resourceId: sessionId,
    });
  }

  logSessionDeleted(userId: number, sessionId: number, ipAddress?: string, userAgent?: string): void {
    this.log({
      action: 'DELETE',
      userId,
      description: 'Session deleted',
      metadata: { sessionId },
      ipAddress,
      userAgent,
      severity: 'info',
      resourceType: 'session',
      resourceId: sessionId,
    });
  }

  logSessionRevoked(userId: number, sessionId: number, reason: string, ipAddress?: string, userAgent?: string): void {
    this.log({
      action: 'LOGOUT',
      userId,
      description: `Session revoked: ${reason}`,
      metadata: { sessionId, reason },
      ipAddress,
      userAgent,
      severity: reason === 'LOGOUT' ? 'info' : 'warning',
      resourceType: 'session',
      resourceId: sessionId,
    });
  }

  logAllSessionsRevoked(userId: number, reason: string, sessionCount: number, ipAddress?: string, userAgent?: string): void {
    this.log({
      action: 'LOGOUT',
      userId,
      description: `All ${sessionCount} session(s) revoked: ${reason}`,
      metadata: { sessionCount, reason },
      ipAddress,
      userAgent,
      severity: 'warning',
      resourceType: 'session',
      resourceId: userId,
    });
  }

  // ─── Token Management ────────────────────────────────────────────────────────

  logTokenRotated(userId: number, sessionId: number, ipAddress?: string, userAgent?: string): void {
    this.log({
      action: 'UPDATE',
      userId,
      description: 'Refresh token rotated',
      metadata: { sessionId },
      ipAddress,
      userAgent,
      severity: 'info',
      resourceType: 'token',
      resourceId: sessionId,
    });
  }

  logTokenRefreshed(userId: number, sessionId: number, ipAddress?: string, userAgent?: string): void {
    this.log({
      action: 'UPDATE',
      userId,
      description: 'Access token refreshed',
      metadata: { sessionId },
      ipAddress,
      userAgent,
      severity: 'info',
      resourceType: 'token',
      resourceId: sessionId,
    });
  }

  logTokenTheftDetected(userId: number, sessionId: string | number, ipAddress?: string, userAgent?: string): void {
    this.log({
      action: 'ACCOUNT_BLOCKED',
      userId,
      description: 'Refresh token reuse detected - all sessions terminated',
      metadata: { sessionId },
      ipAddress,
      userAgent,
      severity: 'critical',
      resourceType: 'session',
      resourceId: sessionId,
    });
  }

  // ─── Permissions ────────────────────────────────────────────────────────────

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

  // ─── Break-Glass & Admin Actions ─────────────────────────────────────────────

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

  // ─── Role Management ────────────────────────────────────────────────────────

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

  logRoleDeleted(actorId: number, roleId: number, roleCode: string): void {
    this.log({
      action: 'DELETE',
      userId: actorId,
      description: `Role '${roleCode}' deleted`,
      metadata: { roleId, roleCode },
      severity: 'warning',
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

  logRoleAssigned(actorId: number, userFk: number, roleFk: number, storeFk: number | null): void {
    this.log({
      action: 'CREATE',
      userId: actorId,
      description: `Role ${roleFk} assigned to user ${userFk}`,
      metadata: { userFk, roleFk, storeFk },
      severity: 'info',
      resourceType: 'user_role_mapping',
      resourceId: roleFk,
    });
  }

  logRoleRemoved(actorId: number, userFk: number, roleFk: number, storeFk: number | null): void {
    this.log({
      action: 'DELETE',
      userId: actorId,
      description: `Role ${roleFk} removed from user ${userFk}`,
      metadata: { userFk, roleFk, storeFk },
      severity: 'info',
      resourceType: 'user_role_mapping',
      resourceId: roleFk,
    });
  }

  logRolesBulkRemoved(actorId: number, userFk: number, storeFk: number, roleIds: number[]): void {
    this.log({
      action: 'DELETE',
      userId: actorId,
      description: `All roles removed from user ${userFk} in store ${storeFk}`,
      metadata: { userFk, storeFk, roleIds },
      severity: 'info',
      resourceType: 'user_role_mapping',
      resourceId: userFk,
    });
  }

  // ─── Status Management ──────────────────────────────────────────────────────

  logStatusCreated(actorId: number, guuid: string, code: string): void {
    this.log({
      action: 'CREATE',
      userId: actorId,
      description: `Status '${code}' created`,
      metadata: { guuid, code },
      severity: 'info',
      resourceType: 'status',
      resourceId: guuid,
    });
  }

  logStatusUpdated(actorId: number, guuid: string, code: string, changes: Record<string, unknown>): void {
    this.log({
      action: 'UPDATE',
      userId: actorId,
      description: `Status '${code}' updated`,
      metadata: { guuid, code, changes },
      severity: 'info',
      resourceType: 'status',
      resourceId: guuid,
    });
  }

  logStatusDeleted(actorId: number, guuid: string, code: string): void {
    this.log({
      action: 'DELETE',
      userId: actorId,
      description: `Status '${code}' deleted`,
      metadata: { guuid, code },
      severity: 'info',
      resourceType: 'status',
      resourceId: guuid,
    });
  }

  logEntityStatusAssigned(actorId: number, entityCode: string, statusCode: string): void {
    this.log({
      action: 'CREATE',
      userId: actorId,
      description: `Status '${statusCode}' assigned to entity '${entityCode}'`,
      metadata: { entityCode, statusCode },
      severity: 'info',
      resourceType: 'entity_status',
      resourceId: `${entityCode}:${statusCode}`,
    });
  }

  logEntityStatusRemoved(actorId: number, entityCode: string, statusCode: string): void {
    this.log({
      action: 'DELETE',
      userId: actorId,
      description: `Status '${statusCode}' removed from entity '${entityCode}'`,
      metadata: { entityCode, statusCode },
      severity: 'info',
      resourceType: 'entity_status',
      resourceId: `${entityCode}:${statusCode}`,
    });
  }

  // ─── Lookup Management ──────────────────────────────────────────────────────

  logLookupValueCreated(actorId: number, valueId: number, categoryCode: string): void {
    this.log({
      action: 'CREATE',
      userId: actorId,
      description: `Lookup value ${valueId} created in '${categoryCode}'`,
      metadata: { valueId, categoryCode },
      severity: 'info',
      resourceType: 'lookup_value',
      resourceId: valueId,
    });
  }

  logLookupValueUpdated(actorId: number, valueId: number, categoryCode: string): void {
    this.log({
      action: 'UPDATE',
      userId: actorId,
      description: `Lookup value ${valueId} updated in '${categoryCode}'`,
      metadata: { valueId, categoryCode },
      severity: 'info',
      resourceType: 'lookup_value',
      resourceId: valueId,
    });
  }

  logLookupValueDeleted(actorId: number, valueId: number, categoryCode: string): void {
    this.log({
      action: 'DELETE',
      userId: actorId,
      description: `Lookup value ${valueId} deleted from '${categoryCode}'`,
      metadata: { valueId, categoryCode },
      severity: 'info',
      resourceType: 'lookup_value',
      resourceId: valueId,
    });
  }
}
