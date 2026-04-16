import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, gt } from 'drizzle-orm';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import * as schema from '../../../core/database/schema';
import type {
  NewPermissionsChangelogEntry,
} from '../../../core/database/schema/permissions-changelog';

type Db = NodePgDatabase<typeof schema>;

/**
 * PermissionsChangelogRepository
 * Handles version-stamped permission change entries.
 * Responsibilities:
 * - Record permission changes for a set of users at a given version
 * - Fetch changes since a version number for the delta endpoint
 */
@Injectable()
export class PermissionsChangelogRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  /**
   * Bulk-insert changelog entries.
   * Called after a role's entity permissions change — one entry per affected user.
   */
  async record(entries: NewPermissionsChangelogEntry[]): Promise<void> {
    if (entries.length === 0) return;
    await this.db.insert(schema.permissionsChangelog).values(entries);
  }

  /**
   * Return all changes for a user where version_number > sinceVersionNumber.
   * Multiple changes for the same entityCode are collapsed — only the latest survives.
   */
  async getChangesSince(
    userId: number,
    sinceVersionNumber: number,
  ): Promise<
    Array<{
      entityCode: string;
      operation: string;
      data: unknown;
    }>
  > {
    const rows = await this.db
      .select({
        entityCode: schema.permissionsChangelog.entityCode,
        operation: schema.permissionsChangelog.operation,
        data: schema.permissionsChangelog.data,
        versionNumber: schema.permissionsChangelog.versionNumber,
      })
      .from(schema.permissionsChangelog)
      .where(
        and(
          eq(schema.permissionsChangelog.userFk, userId),
          gt(schema.permissionsChangelog.versionNumber, sinceVersionNumber),
        ),
      )
      .orderBy(schema.permissionsChangelog.versionNumber);

    // Collapse multiple changes for the same entityCode — keep the latest operation.
    const latest = new Map<string, { entityCode: string; operation: string; data: unknown }>();
    for (const row of rows) {
      latest.set(row.entityCode, {
        entityCode: row.entityCode,
        operation: row.operation,
        data: row.data,
      });
    }

    return Array.from(latest.values());
  }
}
