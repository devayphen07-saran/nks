import type { StatusResponse } from '../dto/status.dto';
import type { Status } from '../../../../core/database/schema/entity-system/status/status.table';

export class StatusMapper {
  static buildStatusDto(status: Status): StatusResponse {
    return {
      guuid: status.guuid,
      code: status.code,
      name: status.name,
      description: status.description ?? null,
      fontColor: status.fontColor ?? null,
      bgColor: status.bgColor ?? null,
      borderColor: status.borderColor ?? null,
      isBold: status.isBold,
      isActive: status.isActive,
      isSystem: status.isSystem,
      sortOrder: status.sortOrder ?? null,
      createdAt: status.createdAt.toISOString(),
      updatedAt: status.updatedAt?.toISOString() ?? null,
    };
  }
}
