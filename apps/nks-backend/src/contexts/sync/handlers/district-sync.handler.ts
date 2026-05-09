import { Injectable } from '@nestjs/common';
import { and, gt, or, eq } from 'drizzle-orm';
import type { SyncHandler } from './sync-handler.interface';
import type { SyncOperation } from '../types/sync-operation';
import type { SyncResult } from '../types/sync-result';
import * as schema from '../../../core/database/schema';

type DistrictRow = {
  id: number;
  guuid: string;
  districtName: string;
  districtCode: string | null;
  lgdCode: string | null;
  isActive: boolean;
  updatedAt: Date | null;
  deletedAt: Date | null;
  stateGuuid: string | null;
};

@Injectable()
export class DistrictSyncHandler implements SyncHandler {
  readonly entity = 'district';

  apply(_op: SyncOperation): Promise<SyncResult> {
    return Promise.resolve({
      status: 'rejected' as const,
      client_op_id: _op.client_op_id,
      reason: 'district is read-only reference data',
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
    const rows: DistrictRow[] = await tx
      .select({
        id:           schema.district.id,
        guuid:        schema.district.guuid,
        districtName: schema.district.districtName,
        districtCode: schema.district.districtCode,
        lgdCode:      schema.district.lgdCode,
        isActive:     schema.district.isActive,
        updatedAt:    schema.district.updatedAt,
        deletedAt:    schema.district.deletedAt,
        stateGuuid:   schema.state.guuid,
      })
      .from(schema.district)
      .leftJoin(schema.state, eq(schema.district.stateFk, schema.state.id))
      .where(
        or(
          gt(schema.district.updatedAt, cursorTs),
          and(
            eq(schema.district.updatedAt, cursorTs),
            gt(schema.district.guuid, cursorId),
          ),
        ),
      )
      .orderBy(schema.district.updatedAt, schema.district.guuid)
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    if (page.length === 0) {
      return { changes: [], hasMore: false, nextCursor: `${cursorTs.getTime()}:${cursorId}` };
    }

    const last = page[page.length - 1];
    const nextCursor = `${(last.updatedAt ?? new Date()).getTime()}:${last.guuid}`;

    const changes = page.map((row: DistrictRow) => ({
      id: String(row.id),
      operation: row.deletedAt ? ('delete' as const) : ('upsert' as const),
      data: row.deletedAt ? null : {
        guuid:        row.guuid,
        districtName: row.districtName,
        districtCode: row.districtCode ?? null,
        lgdCode:      row.lgdCode ?? null,
        stateGuuid:   row.stateGuuid ?? null,
        isActive:     row.isActive,
        updatedAt:    (row.updatedAt ?? new Date()).toISOString(),
        deletedAt:    null,
      },
    }));

    return { changes, hasMore, nextCursor };
  }
}
