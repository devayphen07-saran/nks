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
  static buildEntityStatusDto(entityStatusRow: EntityStatusRow): EntityStatusResponse {
    return {
      entityCode: entityStatusRow.entityCode,
      statusGuuid: entityStatusRow.statusGuuid,
      statusCode: entityStatusRow.statusCode,
      name: entityStatusRow.name,
      fontColor: entityStatusRow.fontColor,
      bgColor: entityStatusRow.bgColor,
      borderColor: entityStatusRow.borderColor,
      isBold: entityStatusRow.isBold,
      isActive: entityStatusRow.isActive,
      sortOrder: entityStatusRow.sortOrder,
    };
  }
}
