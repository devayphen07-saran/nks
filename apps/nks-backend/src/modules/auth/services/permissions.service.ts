import { Injectable, Logger } from '@nestjs/common';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../core/database/schema';
import { eq, and } from 'drizzle-orm';
import { RoleEntityPermissionRepository } from '../../roles/role-entity-permission.repository';

type Db = NodePgDatabase<typeof schema>;

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
    @InjectDb() private readonly db: Db,
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
    const userStores = await this.db
      .select({
        storeId: schema.storeUserMapping.storeFk,
      })
      .from(schema.storeUserMapping)
      .where(
        and(
          eq(schema.storeUserMapping.userFk, userId),
          eq(schema.storeUserMapping.isActive, true),
        ),
      );

    const snapshot: PermissionsSnapshot = {};

    // Collect permissions from all stores
    for (const store of userStores) {
      if (!store.storeId) continue;

      const storePerms =
        await this.roleEntityPermissionRepository.getUserEntityPermissions(
          userId,
          store.storeId,
        );

      // Merge permissions (union approach)
      for (const [entityCode, perms] of Object.entries(storePerms)) {
        if (!snapshot[entityCode]) {
          snapshot[entityCode] = {
            canView: false,
            canCreate: false,
            canEdit: false,
            canDelete: false,
            deny: false,
          };
        }
        // Union: if ANY store grants, user has it (except deny)
        snapshot[entityCode].canView =
          snapshot[entityCode].canView || perms.canView;
        snapshot[entityCode].canCreate =
          snapshot[entityCode].canCreate || perms.canCreate;
        snapshot[entityCode].canEdit =
          snapshot[entityCode].canEdit || perms.canEdit;
        snapshot[entityCode].canDelete =
          snapshot[entityCode].canDelete || perms.canDelete;
        // DENY: if ANY store denies, deny is true (overrides all)
        snapshot[entityCode].deny =
          (snapshot[entityCode].deny || perms.deny) ?? false;
      }
    }

    return snapshot;
  }

  /**
   * Get current permissions version for a user
   */
  async getPermissionsVersion(userId: number): Promise<string> {
    const [user] = await this.db
      .select({ permissionsVersion: schema.users.permissionsVersion })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    return user?.permissionsVersion ?? 'v1';
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
    const [user] = await this.db
      .select({ permissionsVersion: schema.users.permissionsVersion })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      this.logger.warn(`User ${userId} not found for version increment`);
      return 'v1';
    }

    const currentVersion = user.permissionsVersion ?? 'v1';
    const versionNum = parseInt(currentVersion.substring(1), 10) || 1;
    const newVersion = `v${versionNum + 1}`;

    await this.db
      .update(schema.users)
      .set({ permissionsVersion: newVersion })
      .where(eq(schema.users.id, userId));

    this.logger.log(
      `Permissions version bumped for user ${userId}: ${currentVersion} → ${newVersion}`,
    );

    return newVersion;
  }
}
