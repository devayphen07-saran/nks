import { Injectable, Logger } from '@nestjs/common';
import { RoleQueryService } from '../../../roles/role-query.service';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
import { PermissionsChangelogRepository } from '../../repositories/permissions-changelog.repository';
import { AuthMapper, type UserRoleEntry, type PermissionContext } from '../../mapper/auth-mapper';
import { SystemRoleCodes } from '../../../../../common/constants/system-role-codes.constant';

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
    private readonly roleQuery: RoleQueryService,
    private readonly changelogRepository: PermissionsChangelogRepository,
  ) {}

  /**
   * Fetch roles and isSuperAdmin for a user.
   * Always fetches fresh from DB to ensure role changes are immediately reflected.
   *
   * NOTE: activeStoreId is a SESSION concern, not a permissions concern.
   * It is read from session.activeStoreFk at auth time, not derived here.
   */
  async getUserPermissions(userId: number): Promise<PermissionContext> {
    const userRoles = await this.roleQuery.findUserRoles(userId);

    const roleCodes = userRoles.map((r) => r.roleCode);
    const assignedAt = new Date().toISOString();
    const roles = AuthMapper.buildRoleEntries(userRoles, undefined, assignedAt);

    return {
      roles,
      isSuperAdmin: roleCodes.includes(SystemRoleCodes.SUPER_ADMIN),
    };
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
    return this.roleQuery.getUserEntityPermissionsForAllStores(
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
