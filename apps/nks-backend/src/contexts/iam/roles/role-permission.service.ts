import { Injectable, Logger } from '@nestjs/common';
import { PermissionsRepository } from './repositories/role-permissions.repository';
import { PermissionEvaluatorService } from './permission-evaluator.service';
import { TransactionService } from '../../../core/database/transaction.service';
import { AuditCommandService } from '../../compliance/audit/audit-command.service';
import { PermissionsChangelogService } from '../../../shared/permissions-changelog/permissions-changelog.service';
import { RolesValidator } from './validators';
import type { RoleEntityPermissions } from './dto/role-response.dto';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../../../core/database/schema';

type Db = NodePgDatabase<typeof schema>;

interface PermissionEntry {
  entityCode: string;
  canView?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  deny?: boolean;
}

/**
 * RolePermissionService — narrow concern for role permission management.
 *
 * Handles:
 * - Permission assignment and updates for roles
 * - Permission changelog recording
 * - Transactional permission updates with audit logging
 * - Permission cache invalidation
 *
 * Separated from RolesService to reduce coupling and improve testability.
 * Dependencies: rolePermissionsRepository, permissionEvaluator, txService,
 * auditCommand, permissionsChangelog
 */
@Injectable()
export class RolePermissionService {
  private readonly logger = new Logger(RolePermissionService.name);

  constructor(
    private readonly rolePermissionsRepository: PermissionsRepository,
    private readonly permissionEvaluator: PermissionEvaluatorService,
    private readonly txService: TransactionService,
    private readonly auditCommand: AuditCommandService,
    private readonly permissionsChangelog: PermissionsChangelogService,
  ) {}

  /**
   * Update role permissions with transaction management and audit logging.
   *
   * Performs:
   * 1. Permission validation (ceiling check against caller's permissions)
   * 2. Transactional bulk upsert of permissions
   * 3. Permission cache invalidation
   * 4. Audit logging for each permission change
   * 5. Asynchronous changelog recording (non-blocking failures)
   *
   * @param roleId - ID of the role to update
   * @param userId - ID of the user performing the update
   * @param entityEntries - Raw entity entries from Object.entries(dto.entityPermissions) for validation
   * @param permEntries - Normalized permission entries to upsert
   * @param callerPerms - Caller's entity permissions for ceiling validation
   */
  async updateRolePermissions(
    roleId: number,
    userId: number,
    entityEntries: [string, Record<string, boolean>][],
    permEntries: PermissionEntry[],
    callerPerms: RoleEntityPermissions,
  ): Promise<void> {
    if (permEntries.length === 0) {
      return;
    }

    // Validate that the caller's permissions ceiling is not exceeded
    RolesValidator.assertPermissionCeiling(entityEntries, callerPerms);

    // Perform transactional bulk upsert
    await this.txService.run(
      async (tx) => {
        await this.rolePermissionsRepository.bulkUpsert(roleId, permEntries, tx);
      },
      { name: 'UpdateRolePermissions' },
    );

    // Invalidate permission cache for this role
    this.permissionEvaluator.invalidateForRole(roleId);

    // Audit log each permission change and record in changelog
    for (const { entityCode, ...perms } of permEntries) {
      this.auditCommand.logEntityPermissionChanged(userId, roleId, entityCode, perms);
      this.permissionsChangelog.recordChange(roleId, entityCode, 'MODIFIED', perms).catch((e: unknown) =>
        this.logger.error(
          `Changelog recordChange failed: role=${roleId} entity=${entityCode}: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
    }
  }

  /**
   * Record a role assignment in the changelog.
   *
   * @param userFk - User being assigned the role
   * @param roleFk - Role being assigned
   */
  recordRoleAssigned(userFk: number, roleFk: number): void {
    this.permissionsChangelog.recordRoleAssigned(userFk, roleFk).catch((e: unknown) =>
      this.logger.error(
        `Changelog recordRoleAssigned failed: user=${userFk} role=${roleFk}: ${e instanceof Error ? e.message : String(e)}`,
      ),
    );
  }

  /**
   * Record a role removal from a user in the changelog.
   *
   * @param userFk - User having the role removed
   * @param roleFk - Role being removed
   */
  recordRoleRemoved(userFk: number, roleFk: number): void {
    this.permissionsChangelog.recordRoleRemoved(userFk, roleFk).catch((e: unknown) =>
      this.logger.error(
        `Changelog recordRoleRemoved failed: user=${userFk} role=${roleFk}: ${e instanceof Error ? e.message : String(e)}`,
      ),
    );
  }

  /**
   * Record bulk role removals for a user in a store.
   *
   * @param userFk - User having roles removed
   * @param roleIds - IDs of roles being removed
   */
  recordRolesBulkRemoved(userFk: number, roleIds: number[]): void {
    for (const roleId of roleIds) {
      this.recordRoleRemoved(userFk, roleId);
    }
  }

  /**
   * Record a role soft delete in the changelog and invalidate its cache.
   *
   * @param roleId - ID of the role being deleted
   */
  async recordRoleSoftDeleted(roleId: number): Promise<void> {
    await this.permissionsChangelog.recordRoleSoftDeleted(roleId);
    this.permissionEvaluator.invalidateForRole(roleId);
  }
}
