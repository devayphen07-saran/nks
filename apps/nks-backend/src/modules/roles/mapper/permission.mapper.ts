import { PermissionResponseDto } from '../dto/permission-response.dto';
import type { Permission } from '../../../core/database/schema';

export class PermissionMapper {
  static toResponseDto(entity: Permission): PermissionResponseDto {
    return {
      id: entity.id,
      guuid: entity.guuid,
      name: entity.name,
      code: entity.code,
      resource: entity.resource,
      action: entity.action,
      description: entity.description,
      isSystem: entity.isSystem,
    };
  }
}
