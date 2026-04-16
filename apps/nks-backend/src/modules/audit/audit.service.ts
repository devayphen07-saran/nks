import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditRepository } from './repositories/audit.repository';
import { AuditMapper } from './mappers/audit.mapper';
import type { AuditListQuery } from './dto/requests';
import type { AuditLogResponseDto } from './dto/responses';

export enum AuditEventType {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  OTP_VERIFY = 'OTP_VERIFY',
  OTP_SEND = 'OTP_SEND',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PERMISSION_GRANT = 'PERMISSION_GRANT',
  PERMISSION_REVOKE = 'PERMISSION_REVOKE',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  TOKEN_THEFT_DETECTED = 'TOKEN_THEFT_DETECTED',
  SUPER_ADMIN_ACTION = 'SUPER_ADMIN_ACTION',
  BREAK_GLASS_ACCESS = 'BREAK_GLASS_ACCESS',
  DEVICE_LOGIN = 'DEVICE_LOGIN',
  DEVICE_LOGOUT = 'DEVICE_LOGOUT',
  SESSION_TERMINATE = 'SESSION_TERMINATE',
  STORE_DATA_ACCESS = 'STORE_DATA_ACCESS',
  // Role lifecycle
  ROLE_CREATED = 'ROLE_CREATED',
  ROLE_UPDATED = 'ROLE_UPDATED',
  ROLE_ASSIGNED = 'ROLE_ASSIGNED',
  ROLE_REVOKED = 'ROLE_REVOKED',
}

/** Database audit action type enum — must match auditActionTypeEnum in schema */
type DatabaseAuditActionType =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'TOKEN_REFRESH'
  | 'TOKEN_REVOKE'
  | 'PASSWORD_RESET'
  | 'EMAIL_VERIFIED'
  | 'PHONE_VERIFIED'
  | 'OTP_REQUESTED'
  | 'OTP_VERIFIED'
  | 'OTP_FAILED'
  | 'INVITE_SENT'
  | 'INVITE_ACCEPTED'
  | 'INVITE_REVOKED'
  | 'ROLE_ASSIGNED'
  | 'ROLE_REVOKED'
  | 'PERMISSION_GRANTED'
  | 'PERMISSION_REVOKED'
  | 'STORE_CREATED'
  | 'STORE_DELETED'
  | 'ACCOUNT_BLOCKED'
  | 'ACCOUNT_UNBLOCKED';

/** Maps AuditEventType to database auditActionTypeEnum values */
const AUDIT_EVENT_TYPE_MAPPING: Record<AuditEventType, DatabaseAuditActionType> =
  {
    [AuditEventType.LOGIN]: 'LOGIN',
    [AuditEventType.LOGOUT]: 'LOGOUT',
    [AuditEventType.OTP_VERIFY]: 'OTP_VERIFIED',
    [AuditEventType.OTP_SEND]: 'OTP_REQUESTED',
    [AuditEventType.PASSWORD_CHANGE]: 'PASSWORD_RESET',
    [AuditEventType.PERMISSION_GRANT]: 'PERMISSION_GRANTED',
    [AuditEventType.PERMISSION_REVOKE]: 'PERMISSION_REVOKED',
    [AuditEventType.TOKEN_REFRESH]: 'TOKEN_REFRESH',
    [AuditEventType.TOKEN_THEFT_DETECTED]: 'ACCOUNT_BLOCKED',
    [AuditEventType.SUPER_ADMIN_ACTION]: 'UPDATE',
    [AuditEventType.BREAK_GLASS_ACCESS]: 'UPDATE',
    [AuditEventType.DEVICE_LOGIN]: 'LOGIN',
    [AuditEventType.DEVICE_LOGOUT]: 'LOGOUT',
    [AuditEventType.SESSION_TERMINATE]: 'LOGOUT',
    [AuditEventType.STORE_DATA_ACCESS]: 'UPDATE',
    [AuditEventType.ROLE_CREATED]: 'CREATE',
    [AuditEventType.ROLE_UPDATED]: 'UPDATE',
    [AuditEventType.ROLE_ASSIGNED]: 'ROLE_ASSIGNED',
    [AuditEventType.ROLE_REVOKED]: 'ROLE_REVOKED',
  };

/** Convert AuditEventType to database enum value with strict validation */
function mapAuditEventType(
  eventType: AuditEventType | string,
): DatabaseAuditActionType {
  if (eventType in AUDIT_EVENT_TYPE_MAPPING) {
    return AUDIT_EVENT_TYPE_MAPPING[eventType as AuditEventType];
  }

  // Fallback: if value is already a valid database enum value, pass through
  const validDbValues = Object.values(AUDIT_EVENT_TYPE_MAPPING);
  if (validDbValues.includes(eventType as DatabaseAuditActionType)) {
    return eventType as DatabaseAuditActionType;
  }

  throw new BadRequestException(`Invalid audit event type: ${eventType}`);
}

export interface AuditLogEntry {
  eventType: AuditEventType | string;
  userId: number;
  description: string;
  metadata?: Record<string, any>;
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
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly auditRepository: AuditRepository,
  ) {}

  /**
   * Log an audit event
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.auditRepository.create({
        userFk: entry.userId,
        action: mapAuditEventType(entry.eventType),
        entityType: entry.resourceType || null,
        entityId: entry.resourceId ? Number(entry.resourceId) : null,
        meta: entry.metadata || null,
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent || null,
        isSuccess: entry.severity !== 'critical',
        failureReason: entry.severity === 'critical' ? entry.description : null,
      });

      // Log to application logger for real-time monitoring
      const logLevel = entry.severity === 'critical' ? 'error' : 'log';
      this.logger[logLevel](
        `[AUDIT] ${entry.eventType} | User: ${entry.userId} | ${entry.description}`,
        entry.metadata,
      );
    } catch (err) {
      this.logger.error(
        `Failed to write audit log for ${entry.eventType}`,
        err instanceof Error ? err.message : String(err),
      );
      // Don't throw - audit logging failure shouldn't block auth flow
    }
  }

  /**
   * Log login event
   */
  async logLogin(
    userId: number,
    method: string,
    deviceInfo?: {
      deviceId?: string;
      deviceType?: string;
      appVersion?: string;
    },
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.LOGIN,
      userId,
      description: `User logged in via ${method}`,
      metadata: deviceInfo,
      severity: 'info',
    });
  }

  /**
   * Log logout event
   */
  async logLogout(userId: number, reason?: string): Promise<void> {
    await this.log({
      eventType: AuditEventType.LOGOUT,
      userId,
      description: reason || 'User logged out',
      severity: 'info',
    });
  }

  /**
   * Log token theft detection (critical security event)
   */
  async logTokenTheftDetected(
    userId: number,
    sessionId: string,
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.TOKEN_THEFT_DETECTED,
      userId,
      description: `Refresh token reuse detected - all sessions terminated`,
      metadata: { sessionId },
      severity: 'critical',
      resourceType: 'session',
      resourceId: sessionId,
    });
  }

  /**
   * Log permission grant
   */
  async logPermissionGrant(
    userId: number,
    grantedBy: number,
    entityCode: string,
    action: string,
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.PERMISSION_GRANT,
      userId,
      description: `Permission granted for ${entityCode}.${action} by user ${grantedBy}`,
      metadata: { grantedBy, entityCode, action },
      severity: 'info',
      resourceType: 'permission',
      resourceId: `${entityCode}:${action}`,
    });
  }

  /**
   * Log permission revocation
   */
  async logPermissionRevoke(
    userId: number,
    revokedBy: number,
    entityCode: string,
    action: string,
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.PERMISSION_REVOKE,
      userId,
      description: `Permission revoked for ${entityCode}.${action} by user ${revokedBy}`,
      metadata: { revokedBy, entityCode, action },
      severity: 'warning',
      resourceType: 'permission',
      resourceId: `${entityCode}:${action}`,
    });
  }

  /**
   * Log break-glass Super Admin access (highest severity)
   */
  async logBreakGlassAccess(
    userId: number,
    action: string,
    reason: string,
    affectedUserId?: number,
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.BREAK_GLASS_ACCESS,
      userId,
      description: `[BREAK-GLASS] ${action}: ${reason}`,
      metadata: { affectedUserId, action, reason },
      severity: 'critical',
      resourceType: 'user',
      resourceId: affectedUserId || userId,
    });
  }

  /**
   * Log Super Admin action
   */
  async logSuperAdminAction(
    userId: number,
    action: string,
    resourceType: string,
    resourceId: string | number,
    details?: Record<string, any>,
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.SUPER_ADMIN_ACTION,
      userId,
      description: `Super Admin performed: ${action} on ${resourceType}`,
      metadata: { action, resourceType, resourceId, details },
      severity: 'warning',
      resourceType,
      resourceId,
    });
  }

  /**
   * Log store data access (read, create, update, delete)
   * Used to track record-level security events for audit trail
   */
  async logStoreDataAccess(
    userId: number,
    storeId: number,
    action: 'read' | 'create' | 'update' | 'delete',
    entityType: string,
    entityId?: string | number,
    details?: Record<string, any>,
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.STORE_DATA_ACCESS,
      userId,
      description: `User ${action} ${entityType} in store ${storeId}`,
      metadata: {
        storeId,
        action,
        entityType,
        entityId,
        ...details,
      },
      severity: 'info',
      resourceType: `${entityType}@store${storeId}`,
      resourceId: entityId || storeId,
    });
  }

  /**
   * Log role creation.
   */
  async logRoleCreated(
    actorId: number,
    roleId: number,
    roleCode: string,
    storeId: number,
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.ROLE_CREATED,
      userId: actorId,
      description: `Role '${roleCode}' created for store ${storeId}`,
      metadata: { roleId, roleCode, storeId },
      severity: 'info',
      resourceType: 'role',
      resourceId: roleId,
    });
  }

  /**
   * Log role update (name / description / sortOrder changes).
   */
  async logRoleUpdated(
    actorId: number,
    roleId: number,
    roleCode: string,
    changes: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.ROLE_UPDATED,
      userId: actorId,
      description: `Role '${roleCode}' updated`,
      metadata: { roleId, roleCode, changes },
      severity: 'info',
      resourceType: 'role',
      resourceId: roleId,
    });
  }

  /**
   * Log entity-permission change on a role.
   * Called once per entity code that was updated.
   */
  async logEntityPermissionChanged(
    actorId: number,
    roleId: number,
    entityCode: string,
    newPerms: Record<string, boolean>,
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.PERMISSION_GRANT,
      userId: actorId,
      description: `Permissions for '${entityCode}' updated on role ${roleId}`,
      metadata: { roleId, entityCode, newPerms },
      severity: 'warning',
      resourceType: 'role_permission',
      resourceId: roleId,
    });
  }

  /**
   * Get audit logs with filtering and pagination.
   */
  async getLogs(query: AuditListQuery): Promise<{ logs: AuditLogResponseDto[]; total: number }> {
    const { rows, total } = await this.auditRepository.findAll(query);
    return { logs: AuditMapper.toResponseDtoList(rows), total };
  }

  /**
   * Get a single audit log by ID.
   */
  async getById(id: number): Promise<AuditLogResponseDto> {
    const row = await this.auditRepository.findById(id);
    if (!row) throw new NotFoundException(`Audit log ${id} not found`);
    return AuditMapper.toResponseDto(row);
  }
}
