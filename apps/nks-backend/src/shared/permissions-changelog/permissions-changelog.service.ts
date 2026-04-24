import { Injectable, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { InjectDb } from '../../core/database/inject-db.decorator';
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

  constructor(@InjectDb() private readonly db: NodePgDatabase<typeof schema>) {}

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
          const newVersion = await this.incrementPermissionsVersion(userId);
          const versionNumber = this.parseVersionNumber(newVersion);
          await this.db.insert(schema.permissionsChangelog).values({
            userFk: userId,
            versionNumber,
            entityCode,
            operation,
            data: newPerms,
          });
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

  private async incrementPermissionsVersion(userId: number): Promise<string> {
    const [updated] = await this.db
      .update(schema.users)
      .set({
        permissionsVersion: sql`'v' || (COALESCE(CAST(SUBSTRING(${schema.users.permissionsVersion} FROM 2) AS INTEGER), 0) + 1)`,
      })
      .where(eq(schema.users.id, userId))
      .returning({ permissionsVersion: schema.users.permissionsVersion });
    return updated?.permissionsVersion ?? 'v1';
  }

  private parseVersionNumber(version: string): number {
    const match = /^v(\d+)$/.exec(version);
    return match ? parseInt(match[1], 10) : 0;
  }
}
