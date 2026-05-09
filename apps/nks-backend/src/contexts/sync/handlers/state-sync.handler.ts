import { Injectable } from '@nestjs/common';
import { and, gt, or, eq } from 'drizzle-orm';
import type { SyncHandler } from './sync-handler.interface';
import type { SyncOperation } from '../types/sync-operation';
import type { SyncResult } from '../types/sync-result';
import * as schema from '../../../core/database/schema';

type StateRow = typeof schema.state.$inferSelect;

@Injectable()
export class StateSyncHandler implements SyncHandler {
  readonly entity = 'state';

  apply(_op: SyncOperation): Promise<SyncResult> {
    return Promise.resolve({
      status: 'rejected' as const,
      client_op_id: _op.client_op_id,
      reason: 'state is read-only reference data',
    });
  }

  async getChangesSince(
    cursorTs: Date,
    cursorId: string,
    _storeId: number,
    limit: number,
    tx: any,
  ): Promise<{
    changes: Array<{ id: string; operation: 'upsert' | 'delete'; data: Record<string, unknown> | null }>;
    hasMore: boolean;
    nextCursor: string;
  }> {
    const rows: StateRow[] = await tx
      .select()
      .from(schema.state)
      .where(
        or(
          gt(schema.state.updatedAt, cursorTs),
          and(
            eq(schema.state.updatedAt, cursorTs),
            gt(schema.state.guuid, cursorId),
          ),
        ),
      )
      .orderBy(schema.state.updatedAt, schema.state.guuid)
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    if (page.length === 0) {
      return { changes: [], hasMore: false, nextCursor: `${cursorTs.getTime()}:${cursorId}` };
    }

    const last = page[page.length - 1];
    const nextCursor = `${(last.updatedAt ?? new Date()).getTime()}:${last.guuid}`;

    const changes = page.map((row: StateRow) => ({
      id: String(row.id),
      operation: row.deletedAt ? ('delete' as const) : ('upsert' as const),
      data: row.deletedAt ? null : {
        guuid:            row.guuid,
        stateName:        row.stateName,
        stateCode:        row.stateCode,
        gstStateCode:     row.gstStateCode ?? null,
        isUnionTerritory: row.isUnionTerritory,
        isActive:         row.isActive,
        updatedAt:        (row.updatedAt ?? new Date()).toISOString(),
        deletedAt:        null,
      },
    }));

    return { changes, hasMore, nextCursor };
  }
}
