import { Injectable, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { InjectDb } from '../../core/database/inject-db.decorator';
import { TransactionService, type DbTransaction } from '../../core/database/transaction.service';
import * as schema from '../../core/database/schema';

/**
 * PermissionsChangelogService — @Global() fan-out for entity permission changes.
 *
 * Called by RolesService after a role's entity permissions are upserted.
 * For each active user holding the role:
 *   1. Atomically increments the user's `permissionsVersion`.
 *   2. Writes a changelog entry so GET /auth/permissions-delta returns the diff.
 *
 * Failures for individual users are logged and skipped — a partial fan-out
 * failure must not roll back the role update itself.
 *
 * Lives in shared/ (not iam/auth/) so it can be injected into RolesModule
 * without creating a circular dependency (AuthModule → RolesModule).
 */
@Injectable()
export class PermissionsChangelogService {
  private readonly logger = new Logger(PermissionsChangelogService.name);

  constructor(
    @InjectDb() private readonly db: NodePgDatabase<typeof schema>,
    private readonly txService: TransactionService,
  ) {}

  async recordChange(
    roleId: number,
    entityCode: string,
    operation: 'ADDED' | 'REMOVED' | 'MODIFIED',
    newPerms: Record<string, boolean> | null,
  ): Promise<void> {
    const userRows = await this.db
      .select({ userId: schema.userRoleMapping.userFk })
      .from(schema.userRoleMapping)
      .where(
        and(
          eq(schema.userRoleMapping.roleFk, roleId),
          eq(schema.userRoleMapping.isActive, true),
          isNull(schema.userRoleMapping.deletedAt),
        ),
      );

    if (userRows.length === 0) {
      this.logger.debug(`recordChange: role ${roleId} has no active users — skipping`);
      return;
    }

    let successCount = 0;
    await Promise.all(
      userRows.map(async ({ userId }) => {
        try {
          await this.txService.run(async (tx) => {
            const versionNumber = await this.incrementPermissionsVersion(userId, tx);
            await tx.insert(schema.permissionsChangelog).values({
              userFk: userId,
              versionNumber,
              entityCode,
              operation,
              data: newPerms,
            });
          }, { name: 'PermissionsChangelog.recordChange' });
          successCount++;
        } catch (err) {
          this.logger.error(
            `recordChange: failed for user ${userId}, role ${roleId}, entity ${entityCode}`,
            err instanceof Error ? err.stack : String(err),
          );
        }
      }),
    );

    this.logger.log(
      `recordChange: role=${roleId} entity=${entityCode} op=${operation} users=${successCount}/${userRows.length}`,
    );
  }

  /**
   * Fan-out ADDED changelog entries for a user who was just assigned a role.
   * Called by the service layer AFTER the role assignment transaction commits.
   */
  async recordRoleAssigned(userId: number, roleId: number): Promise<void> {
    const perms = await this.getEntityPermsForRole(roleId);
    if (perms.length === 0) return;
    await this.fanOutForUser(userId, roleId, 'ADDED', perms);
  }

  /**
   * Fan-out REMOVED changelog entries for a user who lost a specific role.
   * Called by the service layer AFTER the role removal transaction commits.
   */
  async recordRoleRemoved(userId: number, roleId: number): Promise<void> {
    const perms = await this.getEntityPermsForRole(roleId);
    if (perms.length === 0) return;
    await this.fanOutForUser(userId, roleId, 'REMOVED', perms);
  }

  /**
   * Fan-out REMOVED changelog entries to ALL active users who held a role
   * that was just soft-deleted. Permissions are queried before deletion.
   */
  async recordRoleSoftDeleted(roleId: number): Promise<void> {
    const [perms, userRows] = await Promise.all([
      this.getEntityPermsForRole(roleId),
      this.db
        .select({ userId: schema.userRoleMapping.userFk })
        .from(schema.userRoleMapping)
        .where(
          and(
            eq(schema.userRoleMapping.roleFk, roleId),
            eq(schema.userRoleMapping.isActive, true),
            isNull(schema.userRoleMapping.deletedAt),
          ),
        ),
    ]);

    if (perms.length === 0 || userRows.length === 0) return;

    await Promise.allSettled(
      userRows.map(({ userId }) => this.fanOutForUser(userId, roleId, 'REMOVED', perms)),
    );

    this.logger.log(
      `recordRoleSoftDeleted: role=${roleId} fanned out REMOVED to ${userRows.length} users`,
    );
  }

  /** Fetch entity-permission entries for a role as flat {entityCode, perms} rows. */
  private async getEntityPermsForRole(
    roleId: number,
  ): Promise<Array<{ entityCode: string; perms: Record<string, boolean> }>> {
    const rows = await this.db
      .select({
        entityCode: schema.entityType.code,
        actionCode: schema.permissionAction.code,
        allowed:    schema.rolePermissions.allowed,
        deny:       schema.rolePermissions.deny,
      })
      .from(schema.rolePermissions)
      .innerJoin(schema.entityType, eq(schema.rolePermissions.entityTypeFk, schema.entityType.id))
      .innerJoin(schema.permissionAction, eq(schema.rolePermissions.actionFk, schema.permissionAction.id))
      .where(
        and(
          eq(schema.rolePermissions.roleFk, roleId),
          eq(schema.rolePermissions.isActive, true),
          isNull(schema.rolePermissions.deletedAt),
        ),
      );

    // Collapse action rows into one perms object per entityCode
    const map = new Map<string, Record<string, boolean>>();
    for (const row of rows) {
      const existing = map.get(row.entityCode) ?? {};
      existing[row.actionCode] = row.allowed && !row.deny;
      map.set(row.entityCode, existing);
    }
    return Array.from(map.entries()).map(([entityCode, perms]) => ({ entityCode, perms }));
  }

  /** Write changelog entries for all entity codes, bumping version once per entry. */
  private async fanOutForUser(
    userId: number,
    roleId: number,
    operation: 'ADDED' | 'REMOVED',
    perms: Array<{ entityCode: string; perms: Record<string, boolean> }>,
  ): Promise<void> {
    for (const { entityCode, perms: newPerms } of perms) {
      try {
        await this.txService.run(async (tx) => {
          const versionNumber = await this.incrementPermissionsVersion(userId, tx);
          await tx.insert(schema.permissionsChangelog).values({
            userFk: userId,
            versionNumber,
            entityCode,
            operation,
            data: operation === 'REMOVED' ? null : newPerms,
          });
        }, { name: 'PermissionsChangelog.fanOutForUser' });
      } catch (err) {
        this.logger.error(
          `fanOutForUser: failed for user=${userId} role=${roleId} entity=${entityCode} op=${operation}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }

  private async incrementPermissionsVersion(userId: number, tx: DbTransaction): Promise<number> {
    const [updated] = await tx
      .update(schema.users)
      .set({ permissionsVersion: sql`${schema.users.permissionsVersion} + 1` })
      .where(eq(schema.users.id, userId))
      .returning({ permissionsVersion: schema.users.permissionsVersion });
    return updated?.permissionsVersion ?? 1;
  }
}
