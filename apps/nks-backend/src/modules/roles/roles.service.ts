import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RolesRepository } from './repositories/roles.repository';
import { RoleEntityPermissionRepository } from './repositories/role-entity-permission.repository';
import { PermissionChecker } from '../../common/utils/permission-checker';
import type { CreateRoleDto, UpdateRoleDto } from './dto';
import type { RoleResponseDto, RoleDetailResponse } from './dto/role-response.dto';
import type { UserRoleRow } from './dto/role-response.dto';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    private readonly rolesRepository: RolesRepository,
    private readonly roleEntityPermissionRepository: RoleEntityPermissionRepository,
    private readonly permissionChecker: PermissionChecker,
  ) {}

  // ─── Role CRUD ─────────────────────────────────────────────────────────────

  async createRole(userId: number, dto: CreateRoleDto): Promise<RoleResponseDto> {
    await this.permissionChecker.assertStoreOwner(
      userId,
      dto.storeId,
      'You can only create roles for stores you own',
    );

    const role = await this.rolesRepository.create({
      roleName: dto.name,
      code: dto.code,
      description: dto.description ?? null,
      sortOrder: dto.sortOrder ?? null,
      isSystem: false,
      storeFk: dto.storeId,
    });

    this.logger.log(`Role created: ${role.code} by user ${userId}`);
    return role as RoleResponseDto;
  }

  async getRoleWithPermissions(guuid: string, userId: number): Promise<RoleDetailResponse> {
    const role = await this.rolesRepository.findByGuuid(guuid);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.storeFk) {
      await this.permissionChecker.assertStoreOwner(
        userId,
        role.storeFk,
        'You can only view roles for stores you own',
      );
    }

    const [entityPermissions, routePermissions] = await Promise.all([
      this.roleEntityPermissionRepository.findByRoleId(role.id),
      this.rolesRepository.findRoutePermissionsByRoleId(role.id),
    ]);

    const entityPermissionsMap = entityPermissions.reduce<Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>>(
      (acc, p) => {
        acc[p.entityCode] = {
          canView: p.canView,
          canCreate: p.canCreate,
          canEdit: p.canEdit,
          canDelete: p.canDelete,
        };
        return acc;
      },
      {},
    );

    return {
      ...role,
      entityPermissions: entityPermissionsMap,
      routePermissions,
    };
  }

  async updateRoleByGuuid(guuid: string, dto: UpdateRoleDto, userId: number): Promise<RoleResponseDto> {
    const role = await this.rolesRepository.findByGuuid(guuid);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.storeFk) {
      await this.permissionChecker.assertStoreOwner(
        userId,
        role.storeFk,
        'You can only update roles for stores you own',
      );
    }

    const updated = await this.rolesRepository.update(role.id, {
      ...(dto.name ? { roleName: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
    });

    if (!updated) {
      throw new NotFoundException('Role not found after update');
    }

    this.logger.log(`Role updated: ${updated.code} by user ${userId}`);
    return updated as RoleResponseDto;
  }

  // ─── Role queries (delegated to repository) ────────────────────────────────

  async findUserRoles(userId: number): Promise<UserRoleRow[]> {
    return this.rolesRepository.findUserRoles(userId);
  }

  async isStoreOwner(userId: number, storeId: number): Promise<boolean> {
    return this.rolesRepository.isStoreOwner(userId, storeId);
  }

  async getActiveRolesForStore(
    userId: number,
    storeId: number,
  ): Promise<Pick<UserRoleRow, 'roleId' | 'roleCode' | 'isSystem' | 'isPrimary'>[]> {
    return this.rolesRepository.getActiveRolesForStore(userId, storeId);
  }
}
