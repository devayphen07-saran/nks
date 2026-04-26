import { pgTable, bigint, varchar, boolean, unique, index } from 'drizzle-orm/pg-core';
import { junctionEntity } from '../../base.entity';
import { status } from '../../entity-system/status';
import { entityType } from '../../lookups/entity-type/entity-type.table';

/**
 * entity_status_mapping
 *
 * Defines which statuses are valid for a given entity type.
 * entityCode is a FK to entity_type.code (SCREAMING_SNAKE_CASE, e.g. 'STORE', 'INVOICE').
 * API callers may pass lowercase — EntityCodeValidator.normalize() uppercases before lookup.
 */
export const entityStatusMapping = pgTable(
  'entity_status_mapping',
  {
    ...junctionEntity(),

    entityCode: varchar('entity_code', { length: 50 })
      .notNull()
      .references(() => entityType.code, { onDelete: 'restrict' }),

    statusFk: bigint('status_fk', { mode: 'number' })
      .notNull()
      .references(() => status.id, { onDelete: 'cascade' }),

    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    unique('entity_status_mapping_unique_idx').on(table.entityCode, table.statusFk),
    index('entity_status_mapping_entity_idx').on(table.entityCode),
    index('entity_status_mapping_status_idx').on(table.statusFk),
  ],
);

export type EntityStatusMapping    = typeof entityStatusMapping.$inferSelect;
export type NewEntityStatusMapping = typeof entityStatusMapping.$inferInsert;
