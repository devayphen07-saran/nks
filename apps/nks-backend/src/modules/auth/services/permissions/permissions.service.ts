import { Injectable, Logger } from '@nestjs/common';
import { RoleEntityPermissionRepository } from '../../../roles/repositories/role-entity-permission.repository';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
import { RolesRepository } from '../../../roles/repositories/roles.repository';
import { PermissionsChangelogRepository } from '../../repositories/permissions-changelog.repository';
import { AuthMapper, type UserRoleEntry, type PermissionContext } from '../../mappers/auth-mapper';
import { SystemRoleCodes } from '../../../../common/constants/system-role-codes.constant';

export interface PermissionsSnapshot {
  [entityCode: string]: {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    deny?: boolean;
  };
}

/**
 * Permissions Service
 *
 * Handles:
 * 1. Building permissions snapshots for JWT (all user's permissions across stores)
 * 2. Calculating delta changes (what changed since last version)
 * 3. Versioning permissions for mobile sync
 */
@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    private readonly authUsersRepository: AuthUsersRepository,
    private readonly roleEntityPermissionRepository: RoleEntityPermissionRepository,
    private readonly rolesRepository: RolesRepository,
    private readonly changelogRepository: PermissionsChangelogRepository,
  ) {}

  /**
   * Fetch roles, activeStoreId, and permissionCodes for a user.
   * Always fetches fresh from DB to ensure role changes are immediately reflected.
   */
  async getUserPermissions(
    userId: number,
  ): Promise<PermissionContext & { permissionCodes: string[] }> {
    const userRoles = await this.rolesRepository.findUserRoles(userId);

    const roleCodes = userRoles.map((r) => r.roleCode);
    const activeStoreId =
      userRoles.find((r) => r.storeFk != null)?.storeFk ?? null;
    const assignedAt = new Date().toISOString();
    const roles = AuthMapper.mapToRoleEntries(userRoles, undefined, assignedAt);

    return {
      roles,
      isSuperAdmin: roleCodes.includes(SystemRoleCodes.SUPER_ADMIN),
      activeStoreId,
      permissionCodes: this.extractPermissionCodes(userRoles),
    };
  }

  private extractPermissionCodes(
    userRoles: Array<{
      roleCode?: string;
      code?: string;
      permissions?: unknown;
    }>,
  ): string[] {
    const permissionCodes = new Set<string>();
    userRoles.forEach((role) => {
      const roleCode = role.roleCode || role.code;
      if (roleCode) permissionCodes.add(roleCode);
      if (role.permissions && Array.isArray(role.permissions)) {
        (role.permissions as Array<string | { code?: string }>).forEach(
          (perm) => {
            if (typeof perm === 'string') permissionCodes.add(perm);
            else if (typeof perm === 'object' && perm.code)
              permissionCodes.add(perm.code);
          },
        );
      }
    });
    return Array.from(permissionCodes);
  }

  /**
   * Build complete permissions snapshot for a user across all stores.
   * Used for JWT claims - mobile can use this for offline-first.
   *
   * PERMISSION UNION LOGIC (Most-Permissive Wins):
   * ───────────────────────────────────────────────
   * If a user has roles in multiple stores with different permissions,
   * we use a UNION (OR) approach: if ANY store grants a permission, the user has it.
   *
   * Example:
   *   User has CASHIER role in Store-1 (canCreate=false)
   *   User has MANAGER role in Store-2 (canCreate=true)
   *   Result: user gets canCreate=true globally
   *
   * Design rationale:
   * - Users may have different roles in different stores (e.g., manager at HQ, cashier at branch)
   * - Most-permissive approach avoids unnecessary permission denials
   * - For enforcement, the RBACGuard STILL checks per-store (doesn't let CASHIER create in Store-1)
   * - This snapshot is for mobile offline: avoids showing "no permission" on cached data
   *
   * IMPORTANT: This is a TRUST optimization, not a SECURITY enforcement.
   * Security is enforced by RBACGuard checking user's activeStoreId (line 80-93 in rbac.guard.ts).
   */
  async buildPermissionsSnapshot(userId: number): Promise<PermissionsSnapshot> {
    const storeIds = await this.authUsersRepository.findActiveStoreIds(userId);

    // Single batched query: fetches all role assignments + permissions in 2 DB round-trips
    return this.roleEntityPermissionRepository.getUserEntityPermissionsForAllStores(
      userId,
      storeIds,
    );
  }

  /**
   * Get current permissions version for a user
   */
  async getPermissionsVersion(userId: number): Promise<string> {
    return this.authUsersRepository.getPermissionsVersion(userId);
  }

  /**
   * Calculate delta changes between `sinceVersion` and the user's current version.
   *
   * Uses the `permissions_changelog` table which is written to whenever a role's
   * entity permissions change and is fanned-out to all users holding that role.
   * Multiple changelog entries for the same `entityCode` are collapsed server-side —
   * only the most recent operation (ADDED | MODIFIED | REMOVED) per entity is returned.
   *
   * Early-exit: if `sinceVersion` already matches the current version, all three
   * buckets are empty and no DB query is needed.
   *
   * Malformed `sinceVersion` (e.g. empty string, non-vN format) is treated as v0,
   * causing the full changelog to be returned — this is the safe fallback.
   *
   * @param userId      - The authenticated user requesting the delta
   * @param sinceVersion - Client's last known version string ("v3", "v12", …)
   * @returns Bucketed diff: `added`, `removed`, `modified` each keyed by entityCode
   */
  async calculateDelta(
    userId: number,
    sinceVersion: string,
  ): Promise<{
    version: string;
    added: PermissionsSnapshot;
    removed: PermissionsSnapshot;
    modified: PermissionsSnapshot;
  }> {
    const currentVersion = await this.getPermissionsVersion(userId);

    if (sinceVersion === currentVersion) {
      this.logger.debug(`Permissions delta for user ${userId}: already at version ${currentVersion}`);
      return { version: currentVersion, added: {}, removed: {}, modified: {} };
    }

    const sinceVersionNumber = this.parseVersionNumber(sinceVersion);
    this.logger.debug(
      `Permissions delta for user ${userId}: since=${sinceVersion} (${sinceVersionNumber}), current=${currentVersion}`,
    );

    const changes = await this.changelogRepository.getChangesSince(userId, sinceVersionNumber);

    const added: PermissionsSnapshot = {};
    const removed: PermissionsSnapshot = {};
    const modified: PermissionsSnapshot = {};

    for (const change of changes) {
      const perms = change.data as PermissionsSnapshot[string] | null;
      switch (change.operation) {
        case 'ADDED':
          if (perms) added[change.entityCode] = perms;
          break;
        case 'REMOVED':
          // Tombstone: all flags false so the client can clear the cached entry.
          removed[change.entityCode] = {
            canView: false,
            canCreate: false,
            canEdit: false,
            canDelete: false,
          };
          break;
        case 'MODIFIED':
          if (perms) modified[change.entityCode] = perms;
          break;
        default:
          this.logger.warn(`Unknown changelog operation '${change.operation}' for user ${userId} entity ${change.entityCode}`);
      }
    }

    this.logger.log(
      `Permissions delta for user ${userId}: added=${Object.keys(added).length} removed=${Object.keys(removed).length} modified=${Object.keys(modified).length}`,
    );

    return { version: currentVersion, added, removed, modified };
  }

  /**
   * Fan-out a single entity permission change to every user who holds the given role,
   * atomically incrementing each user's `permissionsVersion` and writing a changelog entry.
   *
   * Each user is processed independently — a failure for one user is logged and skipped
   * rather than aborting the entire fan-out.  This avoids a single bad user record
   * blocking changelog writes for an entire store's worth of users.
   *
   * Called by `RolesService.updateEntityPermissions` after each entity permission upsert.
   *
   * @param roleId      - The role whose entity permission was just changed
   * @param entityCode  - Which entity (e.g. 'PRODUCT', 'CUSTOMER')
   * @param operation   - Whether the permission row was ADDED, MODIFIED, or REMOVED
   * @param newPerms    - The new permission flags (null for REMOVED)
   */
  async recordEntityPermissionChange(
    roleId: number,
    entityCode: string,
    operation: 'ADDED' | 'REMOVED' | 'MODIFIED',
    newPerms: Record<string, boolean> | null,
  ): Promise<void> {
    const userIds = await this.rolesRepository.findUsersByRoleId(roleId);

    if (userIds.length === 0) {
      this.logger.debug(`recordEntityPermissionChange: role ${roleId} has no active users — skipping`);
      return;
    }

    let successCount = 0;

    // Each user has their own permissionsVersion row — no shared state, safe to run in parallel.
    await Promise.all(
      userIds.map(async (userId) => {
        try {
          const newVersion = await this.authUsersRepository.incrementPermissionsVersion(userId);
          const versionNumber = this.parseVersionNumber(newVersion);

          await this.changelogRepository.record([{
            userFk: userId,
            versionNumber,
            entityCode,
            operation,
            data: newPerms,
          }]);

          successCount++;
        } catch (err) {
          this.logger.error(
            `recordEntityPermissionChange: failed for user ${userId}, role ${roleId}, entity ${entityCode}`,
            err instanceof Error ? err.stack : String(err),
          );
          // Do not rethrow — partial fan-out failure must not roll back the role update itself.
        }
      }),
    );

    this.logger.log(
      `recordEntityPermissionChange: role=${roleId} entity=${entityCode} op=${operation} users=${successCount}/${userIds.length}`,
    );
  }

  /**
   * Increment user's permissions version.
   * Called when permissions change.
   */
  async incrementPermissionsVersion(userId: number): Promise<string> {
    const newVersion = await this.authUsersRepository.incrementPermissionsVersion(userId);
    this.logger.log(`Permissions version bumped for user ${userId}: → ${newVersion}`);
    return newVersion;
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
   * Parse the numeric part of a version string ("v3" → 3).
   * Returns 0 for malformed or missing values — causes the full changelog to be returned.
   */
  private parseVersionNumber(version: string): number {
    if (!version) return 0;
    const match = /^v(\d+)$/.exec(version);
    return match ? parseInt(match[1], 10) : 0;
  }
}
