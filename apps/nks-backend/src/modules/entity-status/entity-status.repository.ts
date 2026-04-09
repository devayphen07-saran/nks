import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import { InjectDb } from '../../core/database/inject-db.decorator';
import * as schema from '../../core/database/schema';
import { status } from '../../core/database/schema/entity-system/status/status.table';
import { entityStatusMapping } from '../../core/database/schema/entity-system/entity-status-mapping/entity-status-mapping.table';

type EntityStatusMappingRow = typeof entityStatusMapping.$inferSelect;

export interface EntityStatusJoinedRow {
  entityCode: string;
  isActive: boolean;
  statusGuuid: string;
  statusCode: string;
  name: string;
  fontColor: string | null;
  bgColor: string | null;
  borderColor: string | null;
  isBold: boolean;
  sortOrder: number | null;
}

@Injectable()
export class EntityStatusRepository {
  constructor(@InjectDb() private readonly db: NodePgDatabase<typeof schema>) {}

  /** All statuses mapped to an entity (including inactive statuses) */
  async findByEntityCode(entityCode: string): Promise<EntityStatusJoinedRow[]> {
    return this.db
      .select({
        entityCode:  entityStatusMapping.entityCode,
        isActive:    entityStatusMapping.isActive,
        statusGuuid: status.guuid,
        statusCode:  status.code,
        name:        status.name,
        fontColor:   status.fontColor,
        bgColor:     status.bgColor,
        borderColor: status.borderColor,
        isBold:      status.isBold,
        sortOrder:   status.sortOrder,
      })
      .from(entityStatusMapping)
      .innerJoin(
        status,
        and(
          eq(entityStatusMapping.statusFk, status.id),
          eq(status.isActive, true),
        ),
      )
      .where(eq(entityStatusMapping.entityCode, entityCode))
      .orderBy(status.sortOrder, status.code);
  }

  /** Find a specific mapping by entityCode + statusId */
  async findMapping(entityCode: string, statusId: number): Promise<EntityStatusMappingRow | null> {
    const [row] = await this.db
      .select()
      .from(entityStatusMapping)
      .where(
        and(
          eq(entityStatusMapping.entityCode, entityCode),
          eq(entityStatusMapping.statusFk, statusId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /** Assign a status to an entity */
  async assign(entityCode: string, statusId: number): Promise<EntityStatusMappingRow> {
    const [row] = await this.db
      .insert(entityStatusMapping)
      .values({ entityCode, statusFk: statusId, isActive: true })
      .onConflictDoUpdate({
        target: [
          entityStatusMapping.entityCode,
          entityStatusMapping.statusFk,
        ],
        set: { isActive: true },
      })
      .returning();
    return row;
  }

  /** Remove a status from an entity */
  async remove(entityCode: string, statusId: number): Promise<EntityStatusMappingRow | null> {
    const [row] = await this.db
      .delete(entityStatusMapping)
      .where(
        and(
          eq(entityStatusMapping.entityCode, entityCode),
          eq(entityStatusMapping.statusFk, statusId),
        ),
      )
      .returning();
    return row ?? null;
  }
}
