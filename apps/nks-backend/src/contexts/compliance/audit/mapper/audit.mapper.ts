import type { AuditLogRow, AuditLogResponseDto } from '../dto/responses/audit-log.response.dto';

export class AuditMapper {
  static buildAuditLogDto(auditLogRow: AuditLogRow): AuditLogResponseDto {
    return {
      guuid: auditLogRow.guuid,
      userGuuid: auditLogRow.userGuuid ?? null,
      userIamUserId: auditLogRow.userIamUserId ?? null,
      storeGuuid: auditLogRow.storeGuuid ?? null,
      sessionGuuid: auditLogRow.sessionGuuid ?? null,
      entityGuuid: null,
      action: auditLogRow.action,
      entityType: auditLogRow.entityType ?? null,
      meta: (auditLogRow.meta as Record<string, unknown> | null) ?? null,
      ipAddress: auditLogRow.ipAddress ?? null,
      userAgent: auditLogRow.userAgent ?? null,
      deviceId: auditLogRow.deviceId ?? null,
      deviceType: auditLogRow.deviceType ?? null,
      isSuccess: auditLogRow.isSuccess,
      failureReason: auditLogRow.failureReason ?? null,
      createdAt: auditLogRow.createdAt.toISOString(),
    };
  }
}
