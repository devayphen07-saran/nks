import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, gt } from 'drizzle-orm';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import * as schema from '../../../../core/database/schema';
import type {
  NewPermissionsChangelogEntry,
} from '../../../../core/database/schema/permissions-changelog';

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

    // Collapse multiple changes for the same entityCode into a single net operation.
    //
    // Naive "keep latest" breaks the REMOVED → MODIFIED cycle: a permission
    // that was removed then re-granted (via a different role assignment) would
    // appear as MODIFIED — but the client never received the ADDED event, so it
    // would apply a diff against a non-existent entry.
    //
    // Net-effect rules (applied in order):
    //   last=REMOVED                     → REMOVED   (entity gone, regardless of history)
    //   last=ADDED                        → ADDED
    //   last=MODIFIED, no prior REMOVED   → MODIFIED  (in-place update, entry already known)
    //   last=MODIFIED, had prior REMOVED  → ADDED     (re-grant after revocation; client must create)
    type EntityState = { lastOp: string; data: unknown; hadRemoval: boolean };
    const state = new Map<string, EntityState>();

    for (const row of rows) {
      const existing = state.get(row.entityCode);
      state.set(row.entityCode, {
        lastOp:     row.operation,
        data:       row.data,
        hadRemoval: (existing?.hadRemoval ?? false) || row.operation === 'REMOVED',
      });
    }

    return Array.from(state.entries()).map(([entityCode, { lastOp, data, hadRemoval }]) => {
      let operation = lastOp;
      if (lastOp === 'MODIFIED' && hadRemoval) {
        operation = 'ADDED';
      }
      return { entityCode, operation, data };
    });
  }
}
