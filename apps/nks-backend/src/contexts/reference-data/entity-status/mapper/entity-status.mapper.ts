import type { EntityStatusResponse } from '../dto/entity-status.dto';

interface EntityStatusRow {
  entityCode: string;
  isActive: boolean;
  statusGuuid: string;
  statusCode: string;
  name: string;
  fontColor: string | null;
  bgColor: string | null;
  borderColor: string | null;
  isBold: boolean;
  sortOrder: number | null;
}

export class EntityStatusMapper {
  static toResponse(row: EntityStatusRow): EntityStatusResponse {
    return {
      entityCode: row.entityCode,
      statusGuuid: row.statusGuuid,
      statusCode: row.statusCode,
      name: row.name,
      fontColor: row.fontColor,
      bgColor: row.bgColor,
      borderColor: row.borderColor,
      isBold: row.isBold,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
    };
  }
}
