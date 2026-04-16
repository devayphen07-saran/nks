import type { AuditLog } from '../../../core/database/schema/audit-log';
import type { AuditLogResponseDto } from '../dto/responses';

export class AuditMapper {
  static toResponseDto(log: AuditLog): AuditLogResponseDto {
    return {
      id: log.id,
      userFk: log.userFk ?? null,
      storeFk: log.storeFk ?? null,
      sessionFk: log.sessionFk ?? null,
      action: log.action,
      entityType: log.entityType ?? null,
      entityId: log.entityId ?? null,
      meta: (log.meta as Record<string, unknown> | null) ?? null,
      ipAddress: log.ipAddress ?? null,
      userAgent: log.userAgent ?? null,
      deviceId: log.deviceId ?? null,
      deviceType: log.deviceType ?? null,
      isSuccess: log.isSuccess,
      failureReason: log.failureReason ?? null,
      createdAt: log.createdAt.toISOString(),
    };
  }

  static toResponseDtoList(logs: AuditLog[]): AuditLogResponseDto[] {
    return logs.map(AuditMapper.toResponseDto);
  }
}
