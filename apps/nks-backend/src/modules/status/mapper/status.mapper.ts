import type { StatusResponse } from '../dto/status.dto';
import type { Status } from '../../../core/database/schema/entity-system/status/status.table';

export class StatusMapper {
  static toResponse(row: Status): StatusResponse {
    return {
      guuid: row.guuid,
      code: row.code,
      name: row.name,
      description: row.description ?? null,
      fontColor: row.fontColor ?? null,
      bgColor: row.bgColor ?? null,
      borderColor: row.borderColor ?? null,
      isBold: row.isBold,
      isActive: row.isActive,
      isSystem: row.isSystem,
      sortOrder: row.sortOrder ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt?.toISOString() ?? null,
    };
  }
}
