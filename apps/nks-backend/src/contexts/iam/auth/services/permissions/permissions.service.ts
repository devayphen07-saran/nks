import { Injectable, Logger } from '@nestjs/common';
import { RoleQueryService } from '../../../roles/role-query.service';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
import { PermissionsChangelogRepository } from '../../repositories/permissions-changelog.repository';
import { AuthMapper, type PermissionContext } from '../../mapper/auth-mapper';
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

export interface PermissionsSnapshotResponse {
  /** Current permissions version — use as cursor for GET /auth/permissions-delta?version= */
  version: number;
  /**
   * Per-store permission map keyed by store guuid.
   * Isolated: a deny in Store B does not suppress an allow the user holds in Store A.
   * The flat merged snapshot (all stores merged) is intentionally removed — it allowed
   * a deny in one store to silently revoke access the user legitimately holds elsewhere.
   */
  storePermissions: {
    [storeGuuid: string]: PermissionsSnapshot;
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
    const userRoles = await this.roleQuery.findUserRolesForAuth(userId);

    const roleCodes = userRoles.map((r) => r.roleCode);
    const roles = AuthMapper.buildRoleEntries(userRoles);

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
  async buildPermissionsSnapshot(userId: number): Promise<PermissionsSnapshotResponse> {
    const [storeIds, version] = await Promise.all([
      this.authUsersRepository.findActiveStoreIds(userId),
      this.getPermissionsVersion(userId),
    ]);

    const storePermissions = await this.roleQuery.getUserEntityPermissionsPerStore(userId, storeIds);
    return { version, storePermissions };
  }

  /**
   * Get current permissions version for a user
   */
  async getPermissionsVersion(userId: number): Promise<number> {
    return this.authUsersRepository.getPermissionsVersion(userId);
  }

  async calculateDelta(
    userId: number,
    sinceVersion: string,
  ): Promise<{
    version: number;
    added: PermissionsSnapshot;
    removed: PermissionsSnapshot;
    modified: PermissionsSnapshot;
  }> {
    const currentVersion = await this.getPermissionsVersion(userId);
    const sinceVersionNumber = this.parseVersionNumber(sinceVersion);

    if (sinceVersionNumber === currentVersion) {
      this.logger.debug(`Permissions delta for user ${userId}: already at version ${currentVersion}`);
      return { version: currentVersion, added: {}, removed: {}, modified: {} };
    }

    this.logger.debug(
      `Permissions delta for user ${userId}: since=${sinceVersionNumber}, current=${currentVersion}`,
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

  // Accepts plain integer ("3") or legacy "v3" format for backward compatibility.
  // Returns 0 for malformed input — triggers a full changelog download.
  private parseVersionNumber(version: string): number {
    if (!version) return 0;
    const plain = /^\d+$/.exec(version);
    if (plain) return parseInt(version, 10);
    const prefixed = /^v(\d+)$/.exec(version);
    return prefixed ? parseInt(prefixed[1], 10) : 0;
  }
}
