import { Injectable } from '@nestjs/common';
import type { SyncHandler } from './sync-handler.interface';
import type { SyncOperation } from '../types/sync-operation';
import type { SyncResult } from '../types/sync-result';
import type { DbTransaction } from '../../../core/database/transaction.service';
import { LocationRepository } from '../../reference-data/location/repositories/location.repository';

@Injectable()
export class StateSyncHandler implements SyncHandler {
  readonly entity = 'state';

  constructor(private readonly locationRepository: LocationRepository) {}

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
    tx: DbTransaction,
  ): Promise<{
    changes: Array<{ id: string; operation: 'upsert' | 'delete'; data: Record<string, unknown> | null }>;
    hasMore: boolean;
    nextCursor: string;
  }> {
    const rows = await this.locationRepository.findStateChangesAfter(
      cursorTs,
      cursorId,
      limit + 1,
      tx,
    );

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    if (page.length === 0) {
      return { changes: [], hasMore: false, nextCursor: `${cursorTs.getTime()}:${cursorId}` };
    }

    const last = page[page.length - 1];
    const nextCursor = `${(last.updatedAt ?? new Date()).getTime()}:${last.guuid}`;

    const changes = page.map((row) => ({
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
