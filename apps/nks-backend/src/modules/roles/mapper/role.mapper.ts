import { RoleResponseDto } from '../dto/role-response.dto';
import type { Role } from '../../../core/database/schema';

export class RoleMapper {
  static toResponseDto(entity: Role): RoleResponseDto {
    return {
      id: entity.id,
      guuid: entity.guuid,
      roleName: entity.roleName,
      code: entity.code,
      description: entity.description,
      sortOrder: entity.sortOrder,
      isSystem: entity.isSystem,
    };
  }
}
