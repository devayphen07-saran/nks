import { Injectable, Logger } from '@nestjs/common';
import { RoleEntityPermissionRepository } from '../../roles/role-entity-permission.repository';
import { RoleMapper } from '../../roles/mapper/role.mapper';
import { AuthUsersRepository } from '../repositories/auth-users.repository';

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
  ) {}

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

    // Collect permissions from all stores
    const allStorePermissions: PermissionsSnapshot[] = [];
    for (const storeId of storeIds) {
      const storePerms =
        await this.roleEntityPermissionRepository.getUserEntityPermissions(
          userId,
          storeId,
        );
      allStorePermissions.push(storePerms);
    }

    // Merge permissions using RoleMapper (union approach)
    return RoleMapper.mergePermissions(allStorePermissions);
  }

  /**
   * Get current permissions version for a user
   */
  async getPermissionsVersion(userId: number): Promise<string> {
    return this.authUsersRepository.getPermissionsVersion(userId);
  }

  /**
   * Calculate delta changes between two versions
   * Returns only added/removed/changed permissions
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

    // If versions match, no changes
    if (sinceVersion === currentVersion) {
      return {
        version: currentVersion,
        added: {},
        removed: {},
        modified: {},
      };
    }

    // In a full implementation, this would store previous snapshots in DB
    // For now, return full snapshot as "modified"
    const current = await this.buildPermissionsSnapshot(userId);

    return {
      version: currentVersion,
      added: current,
      removed: {},
      modified: {},
    };
  }

  /**
   * Increment user's permissions version
   * Called when permissions change
   */
  async incrementPermissionsVersion(userId: number): Promise<string> {
    const newVersion =
      await this.authUsersRepository.incrementPermissionsVersion(userId);

    this.logger.log(
      `Permissions version bumped for user ${userId}: → ${newVersion}`,
    );

    return newVersion;
  }
}
