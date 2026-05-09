import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, or, eq, gt, sql } from 'drizzle-orm';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import { BaseSyncHandler } from '../../sync/handlers/base-sync-handler';
import { DispatcherService } from '../../sync/services/dispatcher.service';
import * as schema from '../../../core/database/schema';
import { lookup } from '../../../core/database/schema/lookups/lookup/lookup.table';
import { lookupType } from '../../../core/database/schema/lookups/lookup-type/lookup-type.table';
import type { SyncOperation } from '../../sync/types/sync-operation';
import type { SyncResult } from '../../sync/types/sync-result';
import type { DeviceContext } from '../../sync/types/device-context';

type LookupWithTypeCode = typeof lookup.$inferSelect & { lookupTypeCode: string };

/**
 * LookupsSyncService handles pull-only sync for the generic lookup table.
 *
 * Lookups are platform-managed reference data (salutations, currencies, store
 * categories, etc.). Mobile devices pull them but never push mutations back.
 *
 * Global values  → store_fk IS NULL  — sent to every store
 * Store values   → store_fk = X      — sent only to that store
 *
 * queryChangesSince joins lookup_type to include the type code so the mobile
 * client can filter by type without storing a separate lookup_type table.
 */
@Injectable()
export class LookupsSyncService extends BaseSyncHandler<LookupWithTypeCode> implements OnModuleInit {
  private readonly logger = new Logger(LookupsSyncService.name);
  readonly entity = 'lookup';

  constructor(
    @InjectDb() private readonly db: NodePgDatabase<typeof schema>,
    private readonly dispatcher: DispatcherService,
  ) {
    super();
  }

  onModuleInit(): void {
    this.dispatcher.register('lookup', this);
  }

  toWireFormat(row: LookupWithTypeCode): Record<string, unknown> {
    return {
      guuid:          row.guuid,
      lookupTypeId:   row.lookupTypeFk,
      lookupTypeCode: row.lookupTypeCode,
      code:           row.code,
      label:          row.label,
      description:    row.description ?? null,
      storeId:        row.storeFk ?? null,
      isActive:       row.isActive,
      isSystem:       row.isSystem,
      isHidden:       row.isHidden,
      sortOrder:      row.sortOrder ?? null,
      version:        row.version,
      updatedAt:      row.updatedAt?.toISOString() ?? null,
      deletedAt:      row.deletedAt?.toISOString() ?? null,
    };
  }

  // Lookups are read-only from mobile — push mutations are rejected.
  async applyCreate(
    op: SyncOperation,
    _device: DeviceContext,
    _tx: any,
  ): Promise<SyncResult> {
    return {
      status: 'rejected',
      client_op_id: op.client_op_id,
      reason: 'Lookup values are managed by the platform and cannot be created from mobile',
    };
  }

  protected async queryChangesSince(
    cursorTs: Date,
    cursorId: string,
    storeId: number,
    limit: number,
    _tx: any,
  ): Promise<LookupWithTypeCode[]> {
    const cursorIdNum = Number(cursorId) || 0;

    const rows = await this.db
      .select({
        id:              lookup.id,
        guuid:           lookup.guuid,
        lookupTypeFk:    lookup.lookupTypeFk,
        lookupTypeCode:  lookupType.code,
        code:            lookup.code,
        label:           lookup.label,
        description:     lookup.description,
        storeFk:         lookup.storeFk,
        isActive:        lookup.isActive,
        isSystem:        lookup.isSystem,
        isHidden:        lookup.isHidden,
        sortOrder:       lookup.sortOrder,
        version:         lookup.version,
        createdByDevice: lookup.createdByDevice,
        createdAt:       lookup.createdAt,
        updatedAt:       lookup.updatedAt,
        deletedAt:       lookup.deletedAt,
        createdBy:       lookup.createdBy,
        modifiedBy:      lookup.modifiedBy,
        deletedBy:       lookup.deletedBy,
      })
      .from(lookup)
      .innerJoin(lookupType, eq(lookup.lookupTypeFk, lookupType.id))
      .where(
        and(
          // Global lookups (store_fk IS NULL) OR this store's scoped lookups
          sql`(${lookup.storeFk} IS NULL OR ${lookup.storeFk} = ${storeId})`,
          // Compound cursor: rows after (cursorTs, cursorId)
          or(
            gt(lookup.updatedAt, cursorTs),
            and(
              eq(lookup.updatedAt, cursorTs),
              gt(lookup.id, cursorIdNum),
            ),
          ),
        ),
      )
      .orderBy(lookup.updatedAt, lookup.id)
      .limit(limit);

    return rows as LookupWithTypeCode[];
  }
}
