import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { RolesRepository } from './repositories/roles.repository';
import { RoleEntityPermissionRepository } from './repositories/role-entity-permission.repository';
import { SystemRoleCodes } from '../../common/constants/system-role-codes.constant';
import { EntityCodes } from '../../common/constants/entity-codes.constants';
import { AuditService } from '../audit/audit.service';
import type { CreateRoleDto, UpdateRoleDto } from './dto';
import type { RoleResponseDto, RoleDetailResponse } from './dto/role-response.dto';
import type { UserRoleRow, UserRoleWithStoreRow } from './dto/role-response.dto';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    private readonly rolesRepository: RolesRepository,
    private readonly roleEntityPermissionRepository: RoleEntityPermissionRepository,
    private readonly auditService: AuditService,
  ) {}

  // ─── Role CRUD ─────────────────────────────────────────────────────────────

  async createRole(userId: number, dto: CreateRoleDto, activeStoreId: number | null): Promise<RoleResponseDto> {
    if (activeStoreId !== dto.storeId) {
      throw new BadRequestException('You can only create roles for your active store');
    }

    const systemCodes = Object.values(SystemRoleCodes) as string[];
    if (systemCodes.includes(dto.code.toUpperCase())) {
      throw new BadRequestException(
        `Role code '${dto.code}' is reserved and cannot be used for custom roles`,
      );
    }

    const role = await this.rolesRepository.create({
      roleName: dto.name,
      code: dto.code,
      description: dto.description ?? null,
      sortOrder: dto.sortOrder ?? null,
      isSystem: false,
      storeFk: dto.storeId,
    });

    await this.auditService.logRoleCreated(userId, role.id, role.code, dto.storeId);
    this.logger.log(`Role created: ${role.code} by user ${userId}`);
    return role as RoleResponseDto;
  }

  async getRoleWithPermissions(guuid: string, activeStoreId: number | null): Promise<RoleDetailResponse> {
    const role = await this.rolesRepository.findByGuuid(guuid);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.storeFk && role.storeFk !== activeStoreId) {
      throw new BadRequestException('You can only view roles for your active store');
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

  async updateRoleByGuuid(
    userId: number,
    guuid: string,
    dto: UpdateRoleDto,
    activeStoreId: number | null,
  ): Promise<RoleResponseDto> {
    const role = await this.rolesRepository.findByGuuid(guuid);
    if (!role) throw new NotFoundException('Role not found');

    if (role.storeFk && role.storeFk !== activeStoreId) {
      throw new BadRequestException('You can only update roles for your active store');
    }

    // Validate ALL entity permission requests against the caller's ceiling
    // before any DB write — fail fast, all-or-nothing.
    const entityEntries = dto.entityPermissions
      ? Object.entries(dto.entityPermissions)
      : [];

    // Entity codes that are reserved for system roles and cannot be delegated
    // to custom roles regardless of what the caller holds.
    const NON_DELEGATABLE = new Set<string>([
      EntityCodes.ROLE,
      EntityCodes.AUDIT_LOG,
      EntityCodes.USER,
    ]);

    if (entityEntries.length > 0) {
      const callerPerms = await this.roleEntityPermissionRepository
        .getUserEntityPermissions(userId, activeStoreId!);

      for (const [entityCode, requested] of entityEntries) {
        if (NON_DELEGATABLE.has(entityCode)) {
          throw new ForbiddenException(
            `Permissions for '${entityCode}' cannot be assigned to custom roles`,
          );
        }

        const ceiling = callerPerms[entityCode];

        if (!ceiling || ceiling.deny) {
          throw new ForbiddenException(
            `You have no access to '${entityCode}' and cannot assign permissions for it`,
          );
        }

        for (const action of ['canView', 'canCreate', 'canEdit', 'canDelete'] as const) {
          if (requested[action] && !ceiling[action]) {
            throw new ForbiddenException(
              `You cannot grant '${action}' on '${entityCode}' — you do not hold that permission`,
            );
          }
        }
      }
    }

    // All validation passed — persist metadata changes.
    const updated = await this.rolesRepository.update(role.id, {
      ...(dto.name ? { roleName: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
    });

    if (!updated) throw new NotFoundException('Role not found after update');

    // Persist entity permissions — audit each changed entity individually.
    for (const [entityCode, requested] of entityEntries) {
      const perms = {
        canView:   Boolean(requested['canView']),
        canCreate: Boolean(requested['canCreate']),
        canEdit:   Boolean(requested['canEdit']),
        canDelete: Boolean(requested['canDelete']),
      };
      await this.roleEntityPermissionRepository.upsertPermission(role.id, entityCode, perms);
      await this.auditService.logEntityPermissionChanged(userId, role.id, entityCode, perms);
    }

    // Audit metadata changes only when something actually changed.
    const metaChanges: Record<string, unknown> = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
    };
    if (Object.keys(metaChanges).length > 0) {
      await this.auditService.logRoleUpdated(userId, role.id, updated.code, metaChanges);
    }

    this.logger.log(`Role updated: ${updated.code} by user ${userId}`);
    return updated as RoleResponseDto;
  }

  // ─── Role queries (delegated to repository) ────────────────────────────────

  async findUserRoles(userId: number): Promise<UserRoleWithStoreRow[]> {
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
