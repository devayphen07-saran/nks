import { Injectable } from '@nestjs/common';
import { and, gt, or, eq, isNull } from 'drizzle-orm';
import type { SyncHandler } from './sync-handler.interface';
import type { SyncOperation } from '../types/sync-operation';
import type { SyncResult } from '../types/sync-result';
import * as schema from '../../../core/database/schema';

type LookupRow = {
  id: number;
  guuid: string;
  lookupTypeFk: number;
  lookupTypeCode: string | null;
  code: string;
  label: string;
  description: string | null;
  storeFk: number | null;
  isActive: boolean;
  isSystem: boolean;
  isHidden: boolean;
  sortOrder: number | null;
  version: number;
  updatedAt: Date | null;
  deletedAt: Date | null;
};

@Injectable()
export class LookupSyncHandler implements SyncHandler {
  readonly entity = 'lookup';

  apply(_op: SyncOperation): Promise<SyncResult> {
    return Promise.resolve({
      status: 'rejected' as const,
      client_op_id: _op.client_op_id,
      reason: 'lookup is read-only reference data',
    });
  }

  async getChangesSince(
    cursorTs: Date,
    cursorId: string,
    storeId: number,
    limit: number,
    tx: any,
  ): Promise<{
    changes: Array<{ id: string; operation: 'upsert' | 'delete'; data: Record<string, unknown> | null }>;
    hasMore: boolean;
    nextCursor: string;
  }> {
    const rows: LookupRow[] = await tx
      .select({
        id:             schema.lookup.id,
        guuid:          schema.lookup.guuid,
        lookupTypeFk:   schema.lookup.lookupTypeFk,
        lookupTypeCode: schema.lookupType.code,
        code:           schema.lookup.code,
        label:          schema.lookup.label,
        description:    schema.lookup.description,
        storeFk:        schema.lookup.storeFk,
        isActive:       schema.lookup.isActive,
        isSystem:       schema.lookup.isSystem,
        isHidden:       schema.lookup.isHidden,
        sortOrder:      schema.lookup.sortOrder,
        version:        schema.lookup.version,
        updatedAt:      schema.lookup.updatedAt,
        deletedAt:      schema.lookup.deletedAt,
      })
      .from(schema.lookup)
      .leftJoin(schema.lookupType, eq(schema.lookup.lookupTypeFk, schema.lookupType.id))
      .where(
        and(
          or(isNull(schema.lookup.storeFk), eq(schema.lookup.storeFk, storeId)),
          or(
            gt(schema.lookup.updatedAt, cursorTs),
            and(
              eq(schema.lookup.updatedAt, cursorTs),
              gt(schema.lookup.guuid, cursorId),
            ),
          ),
        ),
      )
      .orderBy(schema.lookup.updatedAt, schema.lookup.guuid)
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    if (page.length === 0) {
      return { changes: [], hasMore: false, nextCursor: `${cursorTs.getTime()}:${cursorId}` };
    }

    const last = page[page.length - 1];
    const nextCursor = `${(last.updatedAt ?? new Date()).getTime()}:${last.guuid}`;

    const changes = page.map((row: LookupRow) => ({
      id: String(row.id),
      operation: row.deletedAt ? ('delete' as const) : ('upsert' as const),
      data: row.deletedAt ? null : {
        guuid:          row.guuid,
        lookupTypeId:   row.lookupTypeFk,
        lookupTypeCode: row.lookupTypeCode ?? '',
        code:           row.code,
        label:          row.label,
        description:    row.description ?? null,
        storeId:        row.storeFk ?? null,
        isActive:       row.isActive,
        isSystem:       row.isSystem,
        isHidden:       row.isHidden,
        sortOrder:      row.sortOrder ?? null,
        version:        row.version,
        updatedAt:      (row.updatedAt ?? new Date()).toISOString(),
        deletedAt:      null,
      },
    }));

    return { changes, hasMore, nextCursor };
  }
}
