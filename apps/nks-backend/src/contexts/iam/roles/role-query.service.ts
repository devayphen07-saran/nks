import { Injectable } from '@nestjs/common';
import { RolesRepository } from './repositories/roles.repository';
import { PermissionsRepository } from './repositories/role-permissions.repository';
import { RolesValidator } from './validators';
import { RoleMapper } from './mapper/role.mapper';
import { paginated } from '../../../common/utils/paginated-result';
import type { EntityTypeRow } from './repositories/role-permissions.repository';
import type {
  RoleEntityPermissions,
  RoleDetailResponse,
  RoleResponseDto,
  UserRoleRow,
  UserRoleWithStoreRow,
} from './dto/role-response.dto';
import type { PaginatedResult } from '../../../common/utils/paginated-result';

/**
 * RoleQueryService — cross-context read surface for roles and permissions.
 *
 * Exists so consumers outside `RolesModule` (AuthGuard in common/guards,
 * PermissionsService in iam/auth, …) never import `RolesRepository` or
 * `PermissionsRepository` directly. Keeps the repository layer
 * fully internal to this module.
 *
 * Kept focused on reads only; mutation flows continue to go through
 * `RolesService`. See BACKEND_ARCHITECTURE.md § Module-boundary rules.
 */
@Injectable()
export class RoleQueryService {
  constructor(
    private readonly rolesRepository: RolesRepository,
    private readonly rolePermissionsRepository: PermissionsRepository,
  ) {}

  // ─── Role reads ────────────────────────────────────────────────────────────

  /**
   * Active role rows for a user, enriched with the temporal metadata
   * AuthGuard needs to build `SessionUser.roles` (assignedAt, expiresAt).
   */
  findUserRolesForAuth(userId: number) {
    return this.rolesRepository.findUserRolesForAuth(userId);
  }

  /**
   * Active role rows for a user with store name resolved (used by the
   * snapshot / delta flows in the auth context).
   */
  findUserRoles(userId: number) {
    return this.rolesRepository.findUserRoles(userId);
  }

  /**
   * User IDs that hold a given role — fan-out target for permissions-
   * changelog writes.
   */
  findUsersByRoleId(roleId: number): Promise<number[]> {
    return this.rolesRepository.findUsersByRoleId(roleId);
  }

  /**
   * Resolve a system role's numeric id by its code (e.g. 'SUPER_ADMIN').
   * Returns null when the role does not exist.
   */
  findSystemRoleId(code: string): Promise<number | null> {
    return this.rolesRepository.findSystemRoleId(code);
  }

  /**
   * True when at least one active user holds the given role at platform
   * scope (storeFk IS NULL). Same predicate as `hasSuperAdmin` — either
   * name is fine, kept separate because of existing call-site naming.
   */
  hasUserWithRole(roleId: number): Promise<boolean> {
    return this.rolesRepository.hasUserWithRole(roleId);
  }

  /**
   * True when an active SUPER_ADMIN user already exists. Used to gate
   * registration flows (first-user bootstrapping).
   */
  hasSuperAdmin(superAdminRoleId: number): Promise<boolean> {
    return this.rolesRepository.hasSuperAdmin(superAdminRoleId);
  }

  /**
   * Find the primary store for a user in a given role (typically
   * STORE_OWNER). Returns null when no such assignment exists.
   */
  findPrimaryStoreForUser(
    userId: number,
    storeOwnerRoleId: number,
  ): Promise<{ guuid: string } | null> {
    return this.rolesRepository.findPrimaryStoreForUser(userId, storeOwnerRoleId);
  }

  // ─── Permission reads ──────────────────────────────────────────────────────

  /**
   * Per-store permission map — DENY in one store never bleeds into another.
   * Single round-trip regardless of store count; keyed by store guuid.
   */
  getUserEntityPermissionsPerStore(
    userId: number,
    storeIds: number[],
  ): Promise<Record<string, RoleEntityPermissions>> {
    return this.rolePermissionsRepository.getUserEntityPermissionsPerStore(
      userId,
      storeIds,
    );
  }

  /**
   * All active, non-hidden entity types with parent code resolved.
   * Used by getRoleWithPermissions to build the hierarchical permission tree.
   */
  getEntityTypeHierarchy(): Promise<EntityTypeRow[]> {
    return this.rolePermissionsRepository.getEntityTypeHierarchy();
  }

  // ─── HTTP-facing reads (previously on RolesService) ───────────────────────

  async getRoleWithPermissions(guuid: string, activeStoreId: number | null): Promise<RoleDetailResponse> {
    const role = await this.rolesRepository.findByGuuid(guuid);
    RolesValidator.assertFound(role);
    RolesValidator.assertRoleStoreAccess(role.storeFk, activeStoreId);

    const [flatPermissions, entityHierarchy, routePermissions, storeGuuid] = await Promise.all([
      this.rolePermissionsRepository.getEntityPermissionMapForRole(role.id),
      this.rolePermissionsRepository.getEntityTypeHierarchy(),
      this.rolesRepository.findRoutePermissionsByRoleId(role.id),
      role.storeFk ? this.rolesRepository.getStoreGuuidByFk(role.storeFk) : Promise.resolve(null),
    ]);

    const entityPermissions = RoleMapper.buildEntityPermissionTree(entityHierarchy, flatPermissions);
    return RoleMapper.buildRoleDetailDto(role, storeGuuid, entityPermissions, routePermissions);
  }

  async listUserRoles(userId: number): Promise<UserRoleWithStoreRow[]> {
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

  async listRoles(opts: {
    page: number;
    pageSize: number;
    storeId: number | null;
    isSuperAdmin: boolean;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    isActive?: boolean;
  }): Promise<PaginatedResult<RoleResponseDto>> {
    const { rows, total } = await this.rolesRepository.findAll({
      search: opts.search,
      page: opts.page,
      pageSize: opts.pageSize,
      storeId: opts.storeId,
      isSuperAdmin: opts.isSuperAdmin,
      sortBy: opts.sortBy,
      sortOrder: opts.sortOrder,
      isActive: opts.isActive,
    });
    return paginated({ items: rows, page: opts.page, pageSize: opts.pageSize, total });
  }
}
